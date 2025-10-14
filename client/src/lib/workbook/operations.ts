/**
 * Operations Module - Undo/Redo System
 * 
 * This module provides atomic operations for workbook mutations with:
 * - Automatic inverse action generation for undo
 * - Action log management
 * - HyperFormula integration for formula recomputation
 * - Validation and error handling
 * 
 * Design principles:
 * - All mutations go through applyOperations() for consistency
 * - Each operation generates its inverse automatically
 * - Operations are atomic (all or nothing)
 * - HF recompute is triggered only for affected ranges
 */

import type {
  WorkbookJSON,
  Cell,
  Action,
  CellStyle,
} from "./types";
import type { HydrationResult } from "./hyperformula";
import { recomputeAndPatchCache } from "./hyperformula";
import {
  generateId,
  getSheet,
  getCell,
  setCell,
  deleteCell,
  parseAddress,
  toAddress,
  getCellsInRange,
} from "./utils";

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Base operation interface
 */
export interface Operation {
  type: string;
  sheetId: string;
  [key: string]: any;
}

/**
 * Edit or create a cell
 */
export interface EditCellOp extends Operation {
  type: "editCell";
  address: string;
  cell: Partial<Cell>;
}

/**
 * Delete a cell
 */
export interface DeleteCellOp extends Operation {
  type: "deleteCell";
  address: string;
}

/**
 * Insert row(s)
 */
export interface InsertRowOp extends Operation {
  type: "insertRow";
  row: number; // 1-based row number
  count?: number; // Default: 1
}

/**
 * Delete row(s)
 */
export interface DeleteRowOp extends Operation {
  type: "deleteRow";
  row: number; // 1-based row number
  count?: number; // Default: 1
}

/**
 * Insert column(s)
 */
export interface InsertColOp extends Operation {
  type: "insertCol";
  col: number; // 1-based column number
  count?: number; // Default: 1
}

/**
 * Delete column(s)
 */
export interface DeleteColOp extends Operation {
  type: "deleteCol";
  col: number; // 1-based column number
  count?: number; // Default: 1
}

/**
 * Merge cell range
 */
export interface MergeOp extends Operation {
  type: "merge";
  range: string; // "A1:B2"
}

/**
 * Unmerge cell range
 */
export interface UnmergeOp extends Operation {
  type: "unmerge";
  range: string; // "A1:B2"
}

/**
 * Set cell style
 */
export interface SetStyleOp extends Operation {
  type: "setStyle";
  address: string;
  style: CellStyle;
}

/**
 * Set number format
 */
export interface SetFormatOp extends Operation {
  type: "setFormat";
  address: string;
  numFmt: string;
}

/**
 * Set range of cells (batch edit)
 */
export interface SetRangeOp extends Operation {
  type: "setRange";
  range: string; // "A1:B10"
  cells: Record<string, Partial<Cell>>; // Address -> cell data
}

/**
 * Union of all operation types
 */
export type AnyOperation =
  | EditCellOp
  | DeleteCellOp
  | InsertRowOp
  | DeleteRowOp
  | InsertColOp
  | DeleteColOp
  | MergeOp
  | UnmergeOp
  | SetStyleOp
  | SetFormatOp
  | SetRangeOp;

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of applying operations
 */
export interface ApplyResult {
  success: boolean;
  actions: Action[]; // Actions added to log
  affectedRanges: Array<{ sheetId: string; range: string }>; // Ranges that need recompute
  errors: string[];
  warnings: string[];
}

/**
 * Options for applying operations
 */
export interface ApplyOptions {
  user?: string; // User ID for action attribution
  skipValidation?: boolean; // Skip validation (use with caution)
  skipRecompute?: boolean; // Skip HF recompute (useful for batch operations)
  hydration?: HydrationResult; // Existing HF instance (for recompute)
}

// ============================================================================
// Main Apply Function
// ============================================================================

/**
 * Apply operations atomically to workbook
 * 
 * This is the main entry point for all workbook mutations.
 * 
 * Features:
 * - Validates operations before applying
 * - Generates inverse actions for undo
 * - Updates action log
 * - Triggers HF recompute for affected ranges
 * - Rolls back on error (all-or-nothing)
 * 
 * @param workbook - Target workbook (modified in place)
 * @param operations - Array of operations to apply
 * @param options - Apply options
 * @returns ApplyResult with actions and affected ranges
 */
export function applyOperations(
  workbook: WorkbookJSON,
  operations: AnyOperation[],
  options: ApplyOptions = {}
): ApplyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const actions: Action[] = [];
  const affectedRanges: Array<{ sheetId: string; range: string }> = [];

  // Validate operations first
  if (!options.skipValidation) {
    for (const op of operations) {
      const validation = validateOperation(workbook, op);
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        actions: [],
        affectedRanges: [],
        errors,
        warnings,
      };
    }
  }

  // Create snapshot for rollback
  const snapshot = JSON.stringify(workbook);

  try {
    // Apply each operation
    for (const op of operations) {
      const result = applyOperation(workbook, op, options);
      
      if (result.action) {
        actions.push(result.action);
      }

      if (result.affectedRange) {
        affectedRanges.push(result.affectedRange);
      }

      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    // If any errors occurred, rollback
    if (errors.length > 0) {
      Object.assign(workbook, JSON.parse(snapshot));
      return {
        success: false,
        actions: [],
        affectedRanges: [],
        errors,
        warnings,
      };
    }

    // Add actions to log
    if (actions.length > 0) {
      workbook.actionLog = workbook.actionLog || [];
      workbook.actionLog.push(...actions);

      // Trim action log if it exceeds max size
      const maxSize = 100; // Default max size
      if (workbook.actionLog.length > maxSize) {
        workbook.actionLog = workbook.actionLog.slice(-maxSize);
      }
    }

    // Update metadata
    workbook.meta.modifiedAt = new Date().toISOString();

    // Trigger HF recompute if needed
    if (!options.skipRecompute && options.hydration && affectedRanges.length > 0) {
      try {
        recomputeAndPatchCache(workbook, options.hydration, {
          affectedRanges,
        });
      } catch (error) {
        warnings.push(`Failed to recompute formulas: ${error}`);
      }
    }

    return {
      success: true,
      actions,
      affectedRanges,
      errors: [],
      warnings,
    };
  } catch (error) {
    // Rollback on unexpected error
    Object.assign(workbook, JSON.parse(snapshot));
    return {
      success: false,
      actions: [],
      affectedRanges: [],
      errors: [`Unexpected error: ${error}`],
      warnings,
    };
  }
}

// ============================================================================
// Operation Handlers
// ============================================================================

/**
 * Apply single operation and generate inverse
 */
function applyOperation(
  workbook: WorkbookJSON,
  op: AnyOperation,
  options: ApplyOptions
): {
  action: Action | null;
  affectedRange: { sheetId: string; range: string } | null;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    switch (op.type) {
      case "editCell":
        return applyEditCell(workbook, op, options);
      case "deleteCell":
        return applyDeleteCell(workbook, op, options);
      case "insertRow":
        return applyInsertRow(workbook, op, options);
      case "deleteRow":
        return applyDeleteRow(workbook, op, options);
      case "insertCol":
        return applyInsertCol(workbook, op, options);
      case "deleteCol":
        return applyDeleteCol(workbook, op, options);
      case "merge":
        return applyMerge(workbook, op, options);
      case "unmerge":
        return applyUnmerge(workbook, op, options);
      case "setStyle":
        return applySetStyle(workbook, op, options);
      case "setFormat":
        return applySetFormat(workbook, op, options);
      case "setRange":
        return applySetRange(workbook, op, options);
      default:
        errors.push(`Unknown operation type: ${(op as any).type}`);
        return { action: null, affectedRange: null, errors, warnings };
    }
  } catch (error) {
    errors.push(`Failed to apply ${op.type}: ${error}`);
    return { action: null, affectedRange: null, errors, warnings };
  }
}

/**
 * Apply editCell operation
 */
function applyEditCell(
  workbook: WorkbookJSON,
  op: EditCellOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Get old cell value for inverse
  const oldCell = getCell(workbook, op.sheetId, op.address);

  // Apply new cell
  const newCell: Cell = {
    ...oldCell,
    ...op.cell,
  };
  setCell(workbook, op.sheetId, op.address, newCell);

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "editCell",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      address: op.address,
      cell: op.cell,
    },
    inverse: oldCell
      ? {
          id: generateId(),
          type: "editCell",
          timestamp: new Date().toISOString(),
          user: options.user,
          sheetId: op.sheetId,
          payload: {
            address: op.address,
            cell: oldCell,
          },
        }
      : {
          id: generateId(),
          type: "deleteCell",
          timestamp: new Date().toISOString(),
          user: options.user,
          sheetId: op.sheetId,
          payload: {
            address: op.address,
          },
        },
  };

  // Mark affected range
  const affectedRange = {
    sheetId: op.sheetId,
    range: op.address,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply deleteCell operation
 */
function applyDeleteCell(
  workbook: WorkbookJSON,
  op: DeleteCellOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Get old cell for inverse
  const oldCell = getCell(workbook, op.sheetId, op.address);

  if (!oldCell) {
    warnings.push(`Cell ${op.address} already empty`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Delete cell
  deleteCell(workbook, op.sheetId, op.address);

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "deleteCell",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      address: op.address,
    },
    inverse: {
      id: generateId(),
      type: "editCell",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        address: op.address,
        cell: oldCell,
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: op.address,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply insertRow operation
 */
function applyInsertRow(
  workbook: WorkbookJSON,
  op: InsertRowOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const count = op.count || 1;
  const insertRow = op.row;

  // Shift cells down
  const cells = sheet.cells || {};
  const newCells: Record<string, Cell> = {};

  for (const [address, cell] of Object.entries(cells)) {
    const { row, col } = parseAddress(address);
    if (row >= insertRow) {
      // Move cell down
      const newAddress = toAddress(row + count, col);
      newCells[newAddress] = cell;
    } else {
      // Keep cell in place
      newCells[address] = cell;
    }
  }

  sheet.cells = newCells;

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "insertRow",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      row: insertRow,
      count,
    },
    inverse: {
      id: generateId(),
      type: "deleteRow",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        row: insertRow,
        count,
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: `A${insertRow}:ZZ${insertRow + count}`,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply deleteRow operation
 */
function applyDeleteRow(
  workbook: WorkbookJSON,
  op: DeleteRowOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const count = op.count || 1;
  const deleteRow = op.row;

  // Save cells in deleted rows for inverse
  const deletedCells: Record<string, Cell> = {};
  const cells = sheet.cells || {};
  const newCells: Record<string, Cell> = {};

  for (const [address, cell] of Object.entries(cells)) {
    const { row, col } = parseAddress(address);
    if (row >= deleteRow && row < deleteRow + count) {
      // Save for inverse
      deletedCells[address] = cell;
    } else if (row >= deleteRow + count) {
      // Move cell up
      const newAddress = toAddress(row - count, col);
      newCells[newAddress] = cell;
    } else {
      // Keep cell in place
      newCells[address] = cell;
    }
  }

  sheet.cells = newCells;

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "deleteRow",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      row: deleteRow,
      count,
      deletedCells, // Store for inverse
    },
    inverse: {
      id: generateId(),
      type: "insertRow",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        row: deleteRow,
        count,
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: `A${deleteRow}:ZZ${deleteRow + count}`,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply insertCol operation
 */
function applyInsertCol(
  workbook: WorkbookJSON,
  op: InsertColOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const count = op.count || 1;
  const insertCol = op.col;

  // Shift cells right
  const cells = sheet.cells || {};
  const newCells: Record<string, Cell> = {};

  for (const [address, cell] of Object.entries(cells)) {
    const { row, col } = parseAddress(address);
    if (col >= insertCol) {
      // Move cell right
      const newAddress = toAddress(row, col + count);
      newCells[newAddress] = cell;
    } else {
      // Keep cell in place
      newCells[address] = cell;
    }
  }

  sheet.cells = newCells;

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "insertCol",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      col: insertCol,
      count,
    },
    inverse: {
      id: generateId(),
      type: "deleteCol",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        col: insertCol,
        count,
      },
    },
  };

  const colName = toAddress(1, insertCol).replace("1", "");
  const endColName = toAddress(1, insertCol + count - 1).replace("1", "");
  const affectedRange = {
    sheetId: op.sheetId,
    range: `${colName}1:${endColName}1000`,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply deleteCol operation
 */
function applyDeleteCol(
  workbook: WorkbookJSON,
  op: DeleteColOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const count = op.count || 1;
  const deleteCol = op.col;

  // Save cells in deleted columns for inverse
  const deletedCells: Record<string, Cell> = {};
  const cells = sheet.cells || {};
  const newCells: Record<string, Cell> = {};

  for (const [address, cell] of Object.entries(cells)) {
    const { row, col } = parseAddress(address);
    if (col >= deleteCol && col < deleteCol + count) {
      // Save for inverse
      deletedCells[address] = cell;
    } else if (col >= deleteCol + count) {
      // Move cell left
      const newAddress = toAddress(row, col - count);
      newCells[newAddress] = cell;
    } else {
      // Keep cell in place
      newCells[address] = cell;
    }
  }

  sheet.cells = newCells;

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "deleteCol",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      col: deleteCol,
      count,
      deletedCells, // Store for inverse
    },
    inverse: {
      id: generateId(),
      type: "insertCol",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        col: deleteCol,
        count,
      },
    },
  };

  const colName = toAddress(1, deleteCol).replace("1", "");
  const endColName = toAddress(1, deleteCol + count - 1).replace("1", "");
  const affectedRange = {
    sheetId: op.sheetId,
    range: `${colName}1:${endColName}1000`,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply merge operation
 */
function applyMerge(
  workbook: WorkbookJSON,
  op: MergeOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Add to merged ranges if not already present
  sheet.mergedRanges = sheet.mergedRanges || [];
  if (!sheet.mergedRanges.includes(op.range)) {
    sheet.mergedRanges.push(op.range);
  }

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "merge",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      range: op.range,
    },
    inverse: {
      id: generateId(),
      type: "unmerge",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        range: op.range,
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: op.range,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply unmerge operation
 */
function applyUnmerge(
  workbook: WorkbookJSON,
  op: UnmergeOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Remove from merged ranges
  sheet.mergedRanges = (sheet.mergedRanges || []).filter((r) => r !== op.range);

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "unmerge",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      range: op.range,
    },
    inverse: {
      id: generateId(),
      type: "merge",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        range: op.range,
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: op.range,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply setStyle operation
 */
function applySetStyle(
  workbook: WorkbookJSON,
  op: SetStyleOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Get existing cell or create new one
  const oldCell = getCell(workbook, op.sheetId, op.address);
  const oldStyle = oldCell?.style;

  const newCell: Cell = {
    ...oldCell,
    style: op.style,
  };
  setCell(workbook, op.sheetId, op.address, newCell);

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "setStyle",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      address: op.address,
      style: op.style,
    },
    inverse: {
      id: generateId(),
      type: "setStyle",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        address: op.address,
        style: oldStyle || {},
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: op.address,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply setFormat operation
 */
function applySetFormat(
  workbook: WorkbookJSON,
  op: SetFormatOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Get existing cell or create new one
  const oldCell = getCell(workbook, op.sheetId, op.address);
  const oldFormat = oldCell?.numFmt;

  const newCell: Cell = {
    ...oldCell,
    numFmt: op.numFmt,
  };
  setCell(workbook, op.sheetId, op.address, newCell);

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "setFormat",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      address: op.address,
      numFmt: op.numFmt,
    },
    inverse: {
      id: generateId(),
      type: "setFormat",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        address: op.address,
        numFmt: oldFormat || "",
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: op.address,
  };

  return { action, affectedRange, errors, warnings };
}

/**
 * Apply setRange operation (batch edit)
 */
function applySetRange(
  workbook: WorkbookJSON,
  op: SetRangeOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  // Save old cells for inverse
  const oldCells: Record<string, Cell> = {};
  for (const address of Object.keys(op.cells)) {
    const oldCell = getCell(workbook, op.sheetId, address);
    if (oldCell) {
      oldCells[address] = oldCell;
    }
  }

  // Apply new cells
  for (const [address, cell] of Object.entries(op.cells)) {
    const oldCell = getCell(workbook, op.sheetId, address);
    const newCell: Cell = {
      ...oldCell,
      ...cell,
    };
    setCell(workbook, op.sheetId, address, newCell);
  }

  // Create action with inverse
  const action: Action = {
    id: generateId(),
    type: "setRange",
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      range: op.range,
      cells: op.cells,
    },
    inverse: {
      id: generateId(),
      type: "setRange",
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        range: op.range,
        cells: oldCells,
      },
    },
  };

  const affectedRange = {
    sheetId: op.sheetId,
    range: op.range,
  };

  return { action, affectedRange, errors, warnings };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate operation before applying
 */
function validateOperation(
  workbook: WorkbookJSON,
  op: AnyOperation
): ValidationResult {
  const errors: string[] = [];

  // Validate sheet exists
  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { valid: false, errors };
  }

  // Type-specific validation
  switch (op.type) {
    case "editCell":
    case "deleteCell":
    case "setStyle":
    case "setFormat":
      // Validate address
      try {
        parseAddress((op as any).address);
      } catch (error) {
        errors.push(`Invalid address: ${(op as any).address}`);
      }
      break;

    case "merge":
    case "unmerge":
    case "setRange":
      // Validate range
      try {
        const addresses = getCellsInRange((op as any).range);
        if (addresses.length === 0) {
          errors.push(`Invalid range: ${(op as any).range}`);
        }
      } catch (error) {
        errors.push(`Invalid range: ${(op as any).range}`);
      }
      break;

    case "insertRow":
    case "deleteRow":
      // Validate row number
      if ((op as any).row < 1) {
        errors.push(`Invalid row number: ${(op as any).row}`);
      }
      break;

    case "insertCol":
    case "deleteCol":
      // Validate column number
      if ((op as any).col < 1) {
        errors.push(`Invalid column number: ${(op as any).col}`);
      }
      break;
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create editCell operation
 */
export function createEditCellOp(
  sheetId: string,
  address: string,
  cell: Partial<Cell>
): EditCellOp {
  return {
    type: "editCell",
    sheetId,
    address,
    cell,
  };
}

/**
 * Create deleteCell operation
 */
export function createDeleteCellOp(
  sheetId: string,
  address: string
): DeleteCellOp {
  return {
    type: "deleteCell",
    sheetId,
    address,
  };
}

/**
 * Create setRange operation
 */
export function createSetRangeOp(
  sheetId: string,
  range: string,
  cells: Record<string, Partial<Cell>>
): SetRangeOp {
  return {
    type: "setRange",
    sheetId,
    range,
    cells,
  };
}
