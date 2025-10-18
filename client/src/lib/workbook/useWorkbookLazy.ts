/**
 * React hook for managing workbook state with lazy loading
 * Integrates with backend API for cell data fetching
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { WorkbookJSON, SheetJSON, Cell } from './types';
import {
  createWorkbook,
  addSheet,
  deleteSheet,
  getCell,
  getWorkbookStats,
  cloneWorkbook,
} from './utils';
import { applyOperations, type EditCellOp, type DeleteCellOp } from './operations';
import { undo, redo, canUndo, canRedo } from './undo';
import { hydrateHFFromWorkbook, hydrateHFFromWorkbookPatch, recomputeAndPatchCache, type HydrationResult } from './hyperformula';
import { fetchCellRange, cellRangeCache, type CellRange } from './api-client';


export interface UseWorkbookLazyOptions {
  initialWorkbook?: WorkbookJSON;
  sheetId?: string;
  enableFormulas?: boolean;
  viewportBuffer?: number; // Number of cells to fetch outside viewport
}

export interface UseWorkbookLazyReturn {
  // State
  workbook: WorkbookJSON;
  currentSheetId: string;
  currentSheet: SheetJSON | undefined;
  
  // Lazy loading state
  isLoading: boolean;
  error: string | null;
  loadedRanges: Set<string>;
  
  // Data access
  getCellData: (row: number, col: number) => CellData | undefined;
  getCellDataRange: (rowStart: number, rowEnd: number, colStart: number, colEnd: number) => CellData[][];
  
  // Actions
  setCell: (address: string, cell: Cell) => void;
  getCellValue: (address: string) => Cell | undefined;
  clearCell: (address: string) => void;
  
  // Sheet management
  addNewSheet: (name?: string) => SheetJSON;
  switchSheet: (sheetId: string) => void;
  renameSheet: (sheetId: string, name: string) => void;
  deleteSheetById: (sheetId: string) => void;
  
  // Workbook operations
  updateWorkbook: (updater: (wb: WorkbookJSON) => WorkbookJSON) => void;
  resetWorkbook: (newWorkbook?: WorkbookJSON) => void;
  
  // Lazy loading
  loadRange: (range: CellRange) => Promise<void>;
  invalidateRange: (range: CellRange) => void;
  
  // Undo/Redo
  undoLast: () => void;
  redoLast: () => void;
  canUndoAction: boolean;
  canRedoAction: boolean;
  
  // Formula computation
  recompute: () => void;
  isComputing: boolean;
  
  // Utilities
  stats: ReturnType<typeof getWorkbookStats>;
  isDirty: boolean;
}

// Import CellData type from lib/types
import type { CellData } from '@/lib/types';

export function useWorkbookLazy(options: UseWorkbookLazyOptions = {}): UseWorkbookLazyReturn {
  const [workbook, setWorkbook] = useState<WorkbookJSON>(() => 
    options.initialWorkbook || createWorkbook('Untitled')
  );
  
  const [currentSheetId, setCurrentSheetId] = useState<string>(() => 
    options.sheetId || workbook.sheets[0]?.id || ''
  );
  
  const [isDirty, setIsDirty] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  // Ref to keep latest workbook for async callbacks
  const workbookRef = useRef<WorkbookJSON>(workbook);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedRanges, setLoadedRanges] = useState<Set<string>>(new Set());
  
  // Local cell data cache (merged with fetched data)
  const localCellCache = useRef<Map<string, CellData>>(new Map());
  
  // HyperFormula instance
  const hfRef = useRef<HydrationResult | null>(null);
  const enableFormulas = options.enableFormulas !== false;


  const currentSheet = useMemo(() => 
    workbook.sheets.find(s => s.id === currentSheetId),
    [workbook.sheets, currentSheetId]
  );

  const stats = useMemo(() => getWorkbookStats(workbook), [workbook]);
  
  // Undo/Redo state
  const canUndoAction = useMemo(() => canUndo(workbook), [workbook]);
  const canRedoAction = useMemo(() => canRedo(workbook), [workbook]);

  // Generate cache key for a cell
  const getCellKey = useCallback((row: number, col: number): string => {
    return `${currentSheetId}:${row}:${col}`;
  }, [currentSheetId]);

  // Get cell data (combines local cache and fetched data)
  const getCellData = useCallback((row: number, col: number): CellData | undefined => {
    const key = getCellKey(row, col);
    
    // Check local cache first (for edited cells)
    const localData = localCellCache.current.get(key);
    if (localData) {
      return localData;
    }
    
    // Check if we have fetched data for this range
    const rangeKey = JSON.stringify({
      sheetId: currentSheetId,
      rowStart: row,
      rowEnd: row,
      colStart: col,
      colEnd: col,
    });
    
    if (loadedRanges.has(rangeKey)) {
      // This would be populated by the range fetch
      return {
        value: '',
        formula: undefined,
        formatting: {},
      };
    }
    
    return undefined;
  }, [currentSheetId, getCellKey, loadedRanges]);

  // Get cell data for a range
  const getCellDataRange = useCallback((rowStart: number, rowEnd: number, colStart: number, colEnd: number): CellData[][] => {
    const range: CellRange = {
      sheetId: currentSheetId,
      rowStart,
      rowEnd,
      colStart,
      colEnd,
    };
    
    // Check cache first
    const cacheKey = JSON.stringify(range);
    const cached = cellRangeCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Return empty grid for now (will be populated by loadRange)
    const rows = rowEnd - rowStart + 1;
    const cols = colEnd - colStart + 1;
    
    return Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({
        value: '',
        formatting: {},
      }))
    );
  }, [currentSheetId]);

  // Load cell range from backend
  const loadRange = useCallback(async (range: CellRange): Promise<void> => {
    if (range.sheetId !== currentSheetId) return;
    
    const cacheKey = JSON.stringify(range);
    
    // Check if already loaded
    if (loadedRanges.has(cacheKey)) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const cellData = await fetchCellRange(range);
      
      // Update loaded ranges
      setLoadedRanges(prev => new Set([...prev, cacheKey]));
      
      // Cache the data
      cellRangeCache.set(cacheKey, cellData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cell data');
      console.error('Failed to load cell range:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentSheetId, loadedRanges]);

  // Invalidate a range (clear cache)
  const invalidateRange = useCallback((range: CellRange): void => {
    cellRangeCache.invalidateRange(range);
    
    const cacheKey = JSON.stringify(range);
    setLoadedRanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(cacheKey);
      return newSet;
    });
  }, []);

  // Update workbook and mark as dirty
  const updateWorkbook = useCallback((updater: (wb: WorkbookJSON) => WorkbookJSON) => {
    setWorkbook(prev => {
      const updated = updater(cloneWorkbook(prev));
      updated.meta.modifiedAt = new Date().toISOString();
      workbookRef.current = updated;
      return updated;
    });
    setIsDirty(true);
  }, []);

  // Set cell (updates local cache)
  const setCell = useCallback((address: string, cell: Cell) => {
    if (!currentSheetId) return;
    
    // Parse address (e.g., "A1" -> row: 0, col: 0)
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) return;
    
    const col = match[1].split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
    const row = parseInt(match[2]) - 1;
    
    // Update local cache
    const key = getCellKey(row, col);
    const cellData: CellData = {
      value: cell.formula || cell.raw?.toString() || '',
      formula: cell.formula,
      formatting: cell.style || {},
    };
    
    localCellCache.current.set(key, cellData);
    
    // Update workbook for undo/redo support
    updateWorkbook(wb => {
      const op: EditCellOp = {
        type: 'editCell',
        sheetId: currentSheetId,
        address,
        cell,
      };
      applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
      return wb;
    });
  }, [currentSheetId, getCellKey, updateWorkbook]);

  // Get cell value from workbook
  const getCellValue = useCallback((address: string): Cell | undefined => {
    if (!currentSheetId) return undefined;
    return getCell(workbook, currentSheetId, address);
  }, [workbook, currentSheetId]);

  // Clear cell
  const clearCell = useCallback((address: string) => {
    if (!currentSheetId) return;
    
    // Parse address
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) return;
    
    const col = match[1].split('').reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
    const row = parseInt(match[2]) - 1;
    
    // Remove from local cache
    const key = getCellKey(row, col);
    localCellCache.current.delete(key);
    
    updateWorkbook(wb => {
      const op: DeleteCellOp = {
        type: 'deleteCell',
        sheetId: currentSheetId,
        address,
      };
      applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
      return wb;
    });
  }, [currentSheetId, getCellKey, updateWorkbook]);

  // Sheet management functions
  const addNewSheet = useCallback((name?: string): SheetJSON => {
    let newSheet: SheetJSON | undefined;
    updateWorkbook(wb => {
      newSheet = addSheet(wb, name);
      
      if (wb.workbookProperties?.workbookView) {
        wb.workbookProperties.workbookView.activeTab = wb.sheets.length - 1;
      }
      
      try {
        const inverse = {
          id: `undo-delete-${newSheet?.id || 'unknown'}`,
          type: 'deleteSheet',
          timestamp: new Date().toISOString(),
          sheetId: newSheet!.id,
          payload: null,
          inverse: undefined,
        } as any;
        wb.actionLog = wb.actionLog || [];
        wb.actionLog.push(inverse);
      } catch (e) {
        console.warn('Failed to push add-sheet inverse action:', e);
      }
      
      return wb;
    });

    if (newSheet) {
      setCurrentSheetId(newSheet.id);
      
      try {
        if (enableFormulas && hfRef.current && hfRef.current.hf) {
          const warnings = hydrateHFFromWorkbookPatch(hfRef.current, newSheet);
          if (warnings && warnings.length > 0) console.warn('HF patch warnings:', warnings);
        }
      } catch (err) {
        console.warn('Error while patching HF for new sheet:', err);
        if (hfRef.current) {
          try {
            hfRef.current.hf.destroy();
          } catch (e) {}
          hfRef.current = null;
        }
      }
      
      return newSheet;
    }

    return currentSheet!;
  }, [currentSheet, updateWorkbook, enableFormulas]);

  const switchSheet = useCallback((sheetId: string) => {
    const sheetIndex = workbook.sheets.findIndex(s => s.id === sheetId);
    if (sheetIndex >= 0) {
      setCurrentSheetId(sheetId);
      
      updateWorkbook(wb => {
        if (wb.workbookProperties?.workbookView) {
          wb.workbookProperties.workbookView.activeTab = sheetIndex;
        }
        return wb;
      });
      
      // Clear local cache when switching sheets
      localCellCache.current.clear();
      setLoadedRanges(new Set());
    }
  }, [workbook.sheets, updateWorkbook]);

  const renameSheet = useCallback((sheetId: string, name: string) => {
    updateWorkbook(wb => {
      const sheet = wb.sheets.find(s => s.id === sheetId);
      if (sheet) {
        sheet.name = name;
      }
      return wb;
    });
  }, [updateWorkbook]);

  const deleteSheetById = useCallback((sheetId: string) => {
    updateWorkbook(wb => {
      const success = deleteSheet(wb, sheetId);
      if (success && currentSheetId === sheetId) {
        setCurrentSheetId(wb.sheets[0]?.id || '');
      }
      return wb;
    });
  }, [updateWorkbook, currentSheetId]);

  const resetWorkbook = useCallback((newWorkbook?: WorkbookJSON) => {
    const wb = newWorkbook || createWorkbook('Untitled');
    setWorkbook(wb);
    setCurrentSheetId(wb.sheets[0]?.id || '');
    setIsDirty(false);
    localCellCache.current.clear();
    setLoadedRanges(new Set());
  }, []);

  const undoLast = useCallback(() => {
    updateWorkbook(wb => {
      const result = undo(wb);
      if (!result.success && result.error) {
        console.warn('Undo failed:', result.error);
      }
      return wb;
    });
  }, [updateWorkbook]);
  
  const redoLast = useCallback(() => {
    updateWorkbook(wb => {
      const result = redo(wb);
      if (!result.success && result.error) {
        console.warn('Redo failed:', result.error);
      }
      return wb;
    });
  }, [updateWorkbook]);

  const recompute = useCallback(() => {
    if (!enableFormulas) return;

    const wb = workbookRef.current;
    setIsComputing(true);
    try {
      if (!hfRef.current) {
        hfRef.current = hydrateHFFromWorkbook(wb);
      }

      const result = recomputeAndPatchCache(wb, hfRef.current);

      try {
        console.debug('[HF-lazy] recompute result', { updatedCells: result.updatedCells, errors: result.errors, warnings: result.warnings });
      } catch (e) {}

      if (result.errors.length > 0) {
        console.warn('Formula computation errors:', result.errors);
      }

      setWorkbook({ ...wb });
      workbookRef.current = { ...wb } as WorkbookJSON;
    } catch (error) {
      console.error('Formula computation failed:', error);
    } finally {
      setIsComputing(false);
    }
  }, [enableFormulas]);

  // Initialize HF instance on mount
  useEffect(() => {
    if (enableFormulas) {
      try {
        hfRef.current = hydrateHFFromWorkbook(workbook);
        recompute();
      } catch (error) {
        console.error('Failed to initialize formula engine:', error);
      }
    }
    
    return () => {
      if (hfRef.current?.hf) {
        try {
          hfRef.current.hf.destroy();
        } catch (error) {
          console.warn('Failed to destroy formula engine:', error);
        }
        hfRef.current = null;
      }
    };
  }, []);

  // Recompute when workbook changes (debounced)
  useEffect(() => {
    if (!enableFormulas || !isDirty) return;
    
    const timer = setTimeout(() => {
      recompute();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [workbook, isDirty, enableFormulas, recompute]);

  return {
    workbook,
    currentSheetId,
    currentSheet,
    isLoading,
    error,
    loadedRanges,
    getCellData,
    getCellDataRange,
    setCell,
    getCellValue,
    clearCell,
    addNewSheet,
    switchSheet,
    renameSheet,
    deleteSheetById,
    updateWorkbook,
    resetWorkbook,
    loadRange,
    invalidateRange,
    undoLast,
    redoLast,
    canUndoAction,
    canRedoAction,
    recompute,
    isComputing,
    stats,
    isDirty,
  };
}

/**
 * Determine cell data type based on value
 */