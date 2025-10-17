/**
 * Undo/Redo System
 * 
 * This module implements undo/redo functionality using the action log.
 * 
 * Design:
 * - Action log is a flat array of actions
 * - Each action has an optional inverse for undo
 * - Undo applies the inverse action
 * - Redo reapplies the forward action
 * - Branch on new action after undo (discard redo stack)
 */

import type { WorkbookJSON, Action } from "./types";
import type { HydrationResult } from "./hyperformula";
import { applyOperations } from "./operations";
import type { AnyOperation, ApplyOptions } from "./operations";

// ============================================================================
// Undo/Redo Functions
// ============================================================================

/**
 * Result of undo/redo operation
 */
export interface UndoRedoResult {
  success: boolean;
  action: Action | null; // The action that was undone/redone
  error?: string;
}

/**
 * Undo the last action
 * 
 * Applies the inverse of the last action in the log.
 * 
 * @param workbook - Target workbook (modified in place)
 * @param options - Apply options (hydration for recompute)
 * @returns UndoRedoResult
 */
export function undo(
  workbook: WorkbookJSON,
  options: { hydration?: HydrationResult } = {}
): UndoRedoResult {
  // Initialize action log if needed
  if (!workbook.actionLog) {
    workbook.actionLog = [];
  }

  // Check if there are actions to undo
  if (workbook.actionLog.length === 0) {
    return {
      success: false,
      action: null,
      error: "Nothing to undo",
    };
  }

  // Determine which action to undo based on head pointer. If no head pointer
  // exists, default to the last action in the log.
  const headIndex = (workbook as any)._actionHeadIndex !== undefined ? (workbook as any)._actionHeadIndex : (workbook.actionLog.length - 1);
  const lastAction = workbook.actionLog[headIndex];

  // Check if action has inverse
  if (!lastAction.inverse) {
    return {
      success: false,
      action: null,
      error: "Action has no inverse (cannot undo)",
    };
  }

  // Apply inverse action
  try {
    // Convert inverse action to operation and handle known action types directly
    const applyOptions: ApplyOptions = {
      skipValidation: true,
      hydration: options.hydration,
    };

    // Move the selected action to redo stack before applying inverse so redo can restore it
    (workbook as any)._redoStack = (workbook as any)._redoStack || [];
    (workbook as any)._redoStack.push(lastAction);
    // Initialize head pointer if missing
    if ((workbook as any)._actionHeadIndex === undefined) {
      (workbook as any)._actionHeadIndex = workbook.actionLog.length - 1;
    }
    // Set head to the index of the action we just undid
    (workbook as any)._actionHeadIndex = headIndex - 1;

    // If inverse is a simple sheet add/delete, handle directly to avoid touching operations.ts
    if (lastAction.inverse && ((lastAction.inverse as any).type === 'deleteSheet' || (lastAction.inverse as any).type === 'addSheet')) {
      const inv = lastAction.inverse as any;
  if (inv.type === 'deleteSheet') {
        // Remove sheet with id from payload.sheetId
        const sheetIdToRemove = (inv.payload && inv.payload.sheetId) || inv.sheetId;
        const idx = workbook.sheets.findIndex((s) => s.id === sheetIdToRemove);
        if (idx !== -1) {
          workbook.sheets.splice(idx, 1);
        }
  } else if (inv.type === 'addSheet') {
        // Re-add sheet object from inverse payload (if present)
        const sheetObj = (inv.payload && inv.payload.sheet) || null;
        if (sheetObj) {
          workbook.sheets.push(sheetObj as any);
        }
      }
    } else {
      // Apply inverse without creating new action
      const result = applyInverseDirectly(workbook, lastAction.inverse, applyOptions);

      if (!result.success) {
        // Restore redo stack pointer if failed
          (workbook as any)._redoStack.pop();
        return {
          success: false,
          action: null,
          error: result.error || "Failed to apply inverse action",
        };
      }
    }

    // Update metadata
    workbook.meta.modifiedAt = new Date().toISOString();

    return {
      success: true,
      action: lastAction,
    };
  } catch (error) {
    return {
      success: false,
      action: null,
      error: `Undo failed: ${error}`,
    };
  }
}

/**
 * Redo the last undone action
 * 
 * Note: In the simplified action log, we don't track redo stack separately.
 * This implementation would need enhancement for a full redo system.
 * For MVP, we focus on undo.
 * 
 * @param workbook - Target workbook
 * @param options - Apply options
 * @returns UndoRedoResult
 */
export function redo(
  workbook: WorkbookJSON,
  options: { hydration?: HydrationResult } = {}
): UndoRedoResult {
  // Simple redo implementation using a redo stack placed on the workbook object
  const redoStack: Action[] = (workbook as any)._redoStack || [];
  if (!redoStack || redoStack.length === 0) {
    return { success: false, action: null, error: 'Nothing to redo' };
  }

  const actionToRedo = redoStack.pop() as Action;

  // Reapply the forward action
  try {
    // Handle sheet add/delete directly
    if ((actionToRedo as any).type === 'addSheet') {
      const sheetObj = (actionToRedo as any).payload && (actionToRedo as any).payload.sheet;
      if (sheetObj) {
        workbook.sheets.push(sheetObj as any);
      }
    } else if ((actionToRedo as any).type === 'deleteSheet') {
      const sheetId = (actionToRedo as any).payload && (actionToRedo as any).payload.sheetId;
      const idx = workbook.sheets.findIndex((s) => s.id === sheetId);
      if (idx !== -1) workbook.sheets.splice(idx, 1);
    } else {
      // For other actions, convert to operation and apply via applyOperations
      const op = actionToOperation(actionToRedo);
      if (!op) return { success: false, action: null, error: 'Failed to convert action to operation' };
      applyOperations(workbook, [op], { skipValidation: true, hydration: options.hydration });
    }

  // Push action back onto actionLog only if it's not already present
  workbook.actionLog = workbook.actionLog || [];
  const exists = workbook.actionLog.find((a) => a.id === actionToRedo.id);
  if (!exists) workbook.actionLog.push(actionToRedo);

    workbook.meta.modifiedAt = new Date().toISOString();

    return { success: true, action: actionToRedo };
  } catch (error) {
    return { success: false, action: null, error: String(error) };
  }
}

/**
 * Check if undo is available
 */
export function canUndo(workbook: WorkbookJSON): boolean {
  return Boolean(
    workbook.actionLog &&
      workbook.actionLog.length > 0 &&
      workbook.actionLog[workbook.actionLog.length - 1].inverse !== undefined
  );
}

/**
 * Check if redo is available
 */
export function canRedo(workbook: WorkbookJSON): boolean {
  return Boolean((workbook as any)._redoStack && (workbook as any)._redoStack.length > 0);
}

/**
 * Get undo stack depth
 */
export function getUndoDepth(workbook: WorkbookJSON): number {
  return workbook.actionLog?.length || 0;
}

/**
 * Clear action log (cannot undo after this)
 */
export function clearActionLog(workbook: WorkbookJSON): void {
  workbook.actionLog = [];
  workbook.meta.modifiedAt = new Date().toISOString();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Action to Operation
 * 
 * This bridges the Action log format to the Operation format
 * used by applyOperations().
 */
function actionToOperation(action: Action): AnyOperation | null {
  try {
    const op: any = {
      type: action.type,
      sheetId: action.sheetId,
      ...action.payload,
    };

    return op as AnyOperation;
  } catch (error) {
    console.error("Failed to convert action to operation:", error);
    return null;
  }
}

/**
 * Apply inverse action directly without creating new action
 * 
 * This is used by undo() to avoid adding inverse actions to the log.
 */
function applyInverseDirectly(
  workbook: WorkbookJSON,
  inverseAction: Action,
  options: ApplyOptions
): { success: boolean; error?: string } {
  try {
    // Convert to operation
    const op = actionToOperation(inverseAction);
    if (!op) {
      return { success: false, error: "Failed to convert inverse to operation" };
    }

    // Apply operation without adding to log
    // We do this by temporarily saving and restoring the action log
    const savedLog = workbook.actionLog;
    workbook.actionLog = [];

    const result = applyOperations(workbook, [op], {
      ...options,
      skipValidation: true, // Skip validation for inverse
    });

    // Restore log (but don't add the inverse action)
    workbook.actionLog = savedLog;

    if (!result.success) {
      return { success: false, error: result.errors.join(", ") };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// Action Log Management
// ============================================================================

/**
 * Get recent actions from log
 */
export function getRecentActions(
  workbook: WorkbookJSON,
  limit: number = 10
): Action[] {
  if (!workbook.actionLog) return [];
  
  const actions = workbook.actionLog;
  const start = Math.max(0, actions.length - limit);
  return actions.slice(start);
}

/**
 * Get action by ID
 */
export function getActionById(
  workbook: WorkbookJSON,
  actionId: string
): Action | null {
  if (!workbook.actionLog) return null;
  
  return workbook.actionLog.find((a) => a.id === actionId) || null;
}

/**
 * Get actions by sheet
 */
export function getActionsBySheet(
  workbook: WorkbookJSON,
  sheetId: string,
  limit?: number
): Action[] {
  if (!workbook.actionLog) return [];
  
  const actions = workbook.actionLog.filter((a) => a.sheetId === sheetId);
  
  if (limit) {
    const start = Math.max(0, actions.length - limit);
    return actions.slice(start);
  }
  
  return actions;
}

/**
 * Get actions by user
 */
export function getActionsByUser(
  workbook: WorkbookJSON,
  user: string,
  limit?: number
): Action[] {
  if (!workbook.actionLog) return [];
  
  const actions = workbook.actionLog.filter((a) => a.user === user);
  
  if (limit) {
    const start = Math.max(0, actions.length - limit);
    return actions.slice(start);
  }
  
  return actions;
}

/**
 * Get action log statistics
 */
export function getActionLogStats(workbook: WorkbookJSON): {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsBySheet: Record<string, number>;
  actionsByUser: Record<string, number>;
  oldestAction?: string; // timestamp
  newestAction?: string; // timestamp
} {
  const stats = {
    totalActions: 0,
    actionsByType: {} as Record<string, number>,
    actionsBySheet: {} as Record<string, number>,
    actionsByUser: {} as Record<string, number>,
    oldestAction: undefined as string | undefined,
    newestAction: undefined as string | undefined,
  };

  if (!workbook.actionLog || workbook.actionLog.length === 0) {
    return stats;
  }

  stats.totalActions = workbook.actionLog.length;

  for (const action of workbook.actionLog) {
    // Count by type
    stats.actionsByType[action.type] = (stats.actionsByType[action.type] || 0) + 1;

    // Count by sheet
    stats.actionsBySheet[action.sheetId] =
      (stats.actionsBySheet[action.sheetId] || 0) + 1;

    // Count by user
    if (action.user) {
      stats.actionsByUser[action.user] = (stats.actionsByUser[action.user] || 0) + 1;
    }
  }

  // Get timestamps
  if (workbook.actionLog.length > 0) {
    stats.oldestAction = workbook.actionLog[0].timestamp;
    stats.newestAction = workbook.actionLog[workbook.actionLog.length - 1].timestamp;
  }

  return stats;
}
