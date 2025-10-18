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
import { hydrateHFFromWorkbook, recomputeAndPatchCache, type HydrationResult, hydrateHFFromWorkbookPatch } from './hyperformula';

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
  // Keep a ref to the latest workbook so callbacks (like recompute) don't capture stale closures
  const workbookRef = useRef<WorkbookJSON>(workbook);
  
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
      // update ref immediately to keep latest workbook available to async callbacks
      workbookRef.current = updated;
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
      applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
      return wb;
    });
    // Removed microtask recompute - applyOperations already handles it with sync:true
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
      applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
      return wb;
    });
    // Removed microtask recompute - applyOperations already handles it with sync:true
  }, [currentSheetId, updateWorkbook]);

  // Add new sheet
  // Centralized action to add a new sheet. This records an inverse action suitable for undo.
  const addNewSheet = useCallback((name?: string): SheetJSON => {
    let newSheet: SheetJSON | undefined;
    updateWorkbook(wb => {
      newSheet = addSheet(wb, name);

      // Update workbookProperties activeTab to the new sheet index
      if (wb.workbookProperties?.workbookView) {
        wb.workbookProperties.workbookView.activeTab = wb.sheets.length - 1;
      }

      // Push minimal inverse action into actionLog for undo (delete the created sheet)
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
        // Non-critical if action log cannot be written
        console.warn('Failed to push add-sheet inverse action:', e);
      }

      return wb;
    });

    if (newSheet) {
      setCurrentSheetId(newSheet.id);

      // Patch HyperFormula instance if present to avoid full rebuild
      try {
        if (enableFormulas && hfRef.current && hfRef.current.hf) {
          const warnings = hydrateHFFromWorkbookPatch(hfRef.current, newSheet);
          if (warnings && warnings.length > 0) console.warn('HF patch warnings:', warnings);
          // Ensure workbook.hf is up to date with patched hydration
          try { (workbook as any).hf = hfRef.current; } catch {}
        }
      } catch (err) {
        console.warn('Error while patching HF for new sheet:', err);
        // Fallback: mark HF for rebuild on next recompute
        if (hfRef.current) {
          try {
            hfRef.current.hf.destroy();
          } catch (e) {
            // swallow
          }
          hfRef.current = null;
        }
      }

      return newSheet;
    }

    // Fallback to current sheet
    return currentSheet!;
  }, [currentSheet, updateWorkbook, enableFormulas]);

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

    const wb = workbookRef.current;
    setIsComputing(true);
    try {
      // Hydrate or reuse HF instance
      if (!hfRef.current) {
        // Reuse workbook.hf if present to avoid rehydration
        if ((wb as any).hf) {
          hfRef.current = (wb as any).hf as HydrationResult;
        } else {
          hfRef.current = hydrateHFFromWorkbook(wb);
          // Persist hydration onto workbook for other consumers
          try { (wb as any).hf = hfRef.current; } catch {}
        }
      }

      // Recompute and patch cache
      const result = recomputeAndPatchCache(wb, hfRef.current as HydrationResult);

      if (result.errors.length > 0) {
        console.warn('Formula computation errors:', result.errors);
      }
        // Debug: surface recompute stats for easier tracing in UI flows
        try {
          console.debug('[HF] recompute result', { updatedCells: result.updatedCells, errors: result.errors, warnings: result.warnings });
        } catch (e) {
          // swallow
        }

      // Ensure workbook.hf is up to date with current hydration
      try { (wb as any).hf = hfRef.current; } catch {}

      // Trigger re-render with updated computed values (use ref value)
      setWorkbook({ ...wb });
      // update ref again since we just shallow-copied
      workbookRef.current = { ...wb } as WorkbookJSON;
    } catch (error) {
      console.error('Formula computation failed:', error);
    } finally {
      setIsComputing(false);
    }
  }, [enableFormulas]);

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
        // Use existing workbook.hf when available
        if ((workbook as any).hf) {
          hfRef.current = (workbook as any).hf as HydrationResult;
        } else {
          hfRef.current = hydrateHFFromWorkbook(workbook);
          try { (workbook as any).hf = hfRef.current; } catch {}
        }
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
  
  // Removed debounced recompute effect - eager compute in applyOperations handles all formula updates

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
