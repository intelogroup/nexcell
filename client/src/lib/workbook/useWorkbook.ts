/**
 * React hook for managing workbook state
 * Integrates with new WorkbookJSON schema
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
import { hydrateHFFromWorkbook, recomputeAndPatchCache, type HydrationResult } from './hyperformula';

export interface UseWorkbookOptions {
  initialWorkbook?: WorkbookJSON;
  autoSave?: boolean;
  onSave?: (workbook: WorkbookJSON) => void | Promise<void>;
  enableFormulas?: boolean; // Enable HyperFormula integration (default: true)
}

export interface UseWorkbookReturn {
  // State
  workbook: WorkbookJSON;
  currentSheetId: string;
  currentSheet: SheetJSON | undefined;
  
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
  save: () => Promise<void>;
}

export function useWorkbook(options: UseWorkbookOptions = {}): UseWorkbookReturn {
  const [workbook, setWorkbook] = useState<WorkbookJSON>(() => 
    options.initialWorkbook || createWorkbook('Untitled')
  );
  
  const [currentSheetId, setCurrentSheetId] = useState<string>(() => 
    workbook.sheets[0]?.id || ''
  );
  
  const [isDirty, setIsDirty] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  
  // HyperFormula instance (persistent across renders)
  const hfRef = useRef<HydrationResult | null>(null);
  const enableFormulas = options.enableFormulas !== false; // Default: true

  const currentSheet = useMemo(() => 
    workbook.sheets.find(s => s.id === currentSheetId),
    [workbook.sheets, currentSheetId]
  );

  const stats = useMemo(() => getWorkbookStats(workbook), [workbook]);
  
  // Undo/Redo state
  const canUndoAction = useMemo(() => canUndo(workbook), [workbook]);
  const canRedoAction = useMemo(() => canRedo(workbook), [workbook]);

  // Update workbook and mark as dirty
  const updateWorkbook = useCallback((updater: (wb: WorkbookJSON) => WorkbookJSON) => {
    setWorkbook(prev => {
      const updated = updater(cloneWorkbook(prev));
      updated.meta.modifiedAt = new Date().toISOString();
      return updated;
    });
    setIsDirty(true);
  }, []);

  // Set cell using operations for undo/redo support
  const setCell = useCallback((address: string, cell: Cell) => {
    if (!currentSheetId) return;
    updateWorkbook(wb => {
      const op: EditCellOp = {
        type: 'editCell',
        sheetId: currentSheetId,
        address,
        cell,
      };
      applyOperations(wb, [op]);
      return wb;
    });
  }, [currentSheetId, updateWorkbook]);

  // Get cell value
  const getCellValue = useCallback((address: string): Cell | undefined => {
    if (!currentSheetId) return undefined;
    return getCell(workbook, currentSheetId, address);
  }, [workbook, currentSheetId]);

  // Clear cell using operations for undo/redo support
  const clearCell = useCallback((address: string) => {
    if (!currentSheetId) return;
    updateWorkbook(wb => {
      const op: DeleteCellOp = {
        type: 'deleteCell',
        sheetId: currentSheetId,
        address,
      };
      applyOperations(wb, [op]);
      return wb;
    });
  }, [currentSheetId, updateWorkbook]);

  // Add new sheet
  const addNewSheet = useCallback((name?: string): SheetJSON => {
    let newSheet: SheetJSON | undefined;
    updateWorkbook(wb => {
      newSheet = addSheet(wb, name);
      return wb;
    });
    if (newSheet) {
      setCurrentSheetId(newSheet.id);
      return newSheet;
    }
    // Fallback to current sheet
    return currentSheet!;
  }, [currentSheet, updateWorkbook]);

  // Switch sheet
  const switchSheet = useCallback((sheetId: string) => {
    const sheetIndex = workbook.sheets.findIndex(s => s.id === sheetId);
    if (sheetIndex >= 0) {
      setCurrentSheetId(sheetId);
      
      // Update activeTab in workbookProperties for Excel compatibility
      updateWorkbook(wb => {
        if (wb.workbookProperties?.workbookView) {
          wb.workbookProperties.workbookView.activeTab = sheetIndex;
        }
        return wb;
      });
    }
  }, [workbook.sheets, updateWorkbook]);

  // Rename sheet
  const renameSheet = useCallback((sheetId: string, name: string) => {
    updateWorkbook(wb => {
      const sheet = wb.sheets.find(s => s.id === sheetId);
      if (sheet) {
        sheet.name = name;
      }
      return wb;
    });
  }, [updateWorkbook]);

  // Delete sheet
  const deleteSheetById = useCallback((sheetId: string) => {
    updateWorkbook(wb => {
      const success = deleteSheet(wb, sheetId);
      if (success && currentSheetId === sheetId) {
        // Switch to first sheet if we deleted the current one
        setCurrentSheetId(wb.sheets[0]?.id || '');
      }
      return wb;
    });
  }, [updateWorkbook, currentSheetId]);

  // Reset workbook
  const resetWorkbook = useCallback((newWorkbook?: WorkbookJSON) => {
    const wb = newWorkbook || createWorkbook('Untitled');
    setWorkbook(wb);
    setCurrentSheetId(wb.sheets[0]?.id || '');
    setIsDirty(false);
  }, []);

  // Undo last action
  const undoLast = useCallback(() => {
    updateWorkbook(wb => {
      const result = undo(wb);
      if (!result.success && result.error) {
        console.warn('Undo failed:', result.error);
      }
      return wb;
    });
  }, [updateWorkbook]);
  
  // Redo last action
  const redoLast = useCallback(() => {
    updateWorkbook(wb => {
      const result = redo(wb);
      if (!result.success && result.error) {
        console.warn('Redo failed:', result.error);
      }
      return wb;
    });
  }, [updateWorkbook]);

  // Recompute formulas
  const recompute = useCallback(() => {
    if (!enableFormulas) return;
    
    setIsComputing(true);
    try {
      // Hydrate or reuse HF instance
      if (!hfRef.current) {
        hfRef.current = hydrateHFFromWorkbook(workbook);
      }
      
      // Recompute and patch cache
      const result = recomputeAndPatchCache(workbook, hfRef.current);
      
      if (result.errors.length > 0) {
        console.warn('Formula computation errors:', result.errors);
      }
      
      // Trigger re-render with updated computed values
      setWorkbook({ ...workbook });
    } catch (error) {
      console.error('Formula computation failed:', error);
    } finally {
      setIsComputing(false);
    }
  }, [workbook, enableFormulas]);

  // Save workbook
  const save = useCallback(async () => {
    if (options.onSave) {
      await options.onSave(workbook);
    }
    setIsDirty(false);
  }, [workbook, options]);

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
    
    // Cleanup on unmount
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
  }, []); // Only run on mount/unmount
  
  // Recompute when workbook changes (debounced)
  useEffect(() => {
    if (!enableFormulas || !isDirty) return;
    
    const timer = setTimeout(() => {
      recompute();
    }, 300); // Debounce 300ms
    
    return () => clearTimeout(timer);
  }, [workbook, isDirty, enableFormulas, recompute]);

  // Auto-save
  // useEffect(() => {
  //   if (options.autoSave && isDirty) {
  //     const timer = setTimeout(() => {
  //       save();
  //     }, 2000); // Auto-save after 2s of inactivity
  //     return () => clearTimeout(timer);
  //   }
  // }, [isDirty, options.autoSave, save]);

  return {
    workbook,
    currentSheetId,
    currentSheet,
    setCell,
    getCellValue,
    clearCell,
    addNewSheet,
    switchSheet,
    renameSheet,
    deleteSheetById,
    updateWorkbook,
    resetWorkbook,
    undoLast,
    redoLast,
    canUndoAction,
    canRedoAction,
    recompute,
    isComputing,
    stats,
    isDirty,
    save,
  };
}
