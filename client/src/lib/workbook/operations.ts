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
import { recomputeAndPatchCache, getOrCreateHydration } from "./hyperformula";
import {
  generateId,
  getSheet,
  getCell,
  setCell,
  deleteCell,
  parseAddress,
  parseRange,
  normalizeNamedRangeRef,
  toAddress,
  getCellsInRange,
  addressToHf,
} from "./utils";
import { makeSheet } from "./workbook";

// Helper: update a single named range ref object (string or NamedRange) for a row insert/delete
function updateNamedRangeForRow(workbook: WorkbookJSON, sheetName: string, nameKey: string, ref: string | any, insertRow: number, count: number, isInsert: boolean) {
  if (typeof ref === 'string') {
    const norm = normalizeNamedRangeRef(ref);
    if (norm.sheet && norm.sheet !== sheetName) return ref;
    // Only handle simple A1:A10 shapes
    try {
      const { start, end } = parseRange(norm.range);
      const s = parseAddress(start);
      const e = parseAddress(end);
      let changed = false;
      if (isInsert) {
        if (insertRow >= s.row && insertRow <= e.row) { e.row += count; changed = true; }
        else { if (s.row >= insertRow) { s.row += count; changed = true; } if (e.row >= insertRow) { e.row += count; changed = true; } }
      } else {
        if (insertRow >= s.row && insertRow <= e.row) { e.row -= count; changed = true; }
        else { if (s.row >= insertRow) { s.row -= count; changed = true; } if (e.row >= insertRow) { e.row -= count; changed = true; } }
      }
      if (changed) {
        const newRef = (norm.sheet ? norm.sheet + '!' : '') + toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
        workbook.namedRanges = workbook.namedRanges || {};
        workbook.namedRanges[nameKey] = newRef;
      }
    } catch (e) {
      return ref;
    }
  } else if (ref && typeof ref === 'object' && ref.ref) {
    // NamedRange object
    const nr = ref as any;
    const norm = normalizeNamedRangeRef(nr.ref);
    if (norm.sheet && norm.sheet !== sheetName) return ref;
    try {
      const { start, end } = parseRange(norm.range);
      const s = parseAddress(start);
      const e = parseAddress(end);
      let changed = false;
      if (isInsert) {
        if (insertRow >= s.row && insertRow <= e.row) { e.row += count; changed = true; }
        else { if (s.row >= insertRow) { s.row += count; changed = true; } if (e.row >= insertRow) { e.row += count; changed = true; } }
      } else {
        if (insertRow >= s.row && insertRow <= e.row) { e.row -= count; changed = true; }
        else { if (s.row >= insertRow) { s.row -= count; changed = true; } if (e.row >= insertRow) { e.row -= count; changed = true; } }
      }
      if (changed) {
        nr.ref = (norm.sheet ? norm.sheet + '!' : '') + toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
      }
  
    } catch (e) {
      return ref;
    }
  }
}

// Helper: update a single named range ref object (string or NamedRange) for a column insert/delete
function updateNamedRangeForCol(workbook: WorkbookJSON, sheetName: string, nameKey: string, ref: string | any, insertCol: number, count: number, isInsert: boolean) {
  if (typeof ref === 'string') {
    const norm = normalizeNamedRangeRef(ref);
    if (norm.sheet && norm.sheet !== sheetName) return ref;
    try {
      const { start, end } = parseRange(norm.range);
      const s = parseAddress(start);
      const e = parseAddress(end);
      let changed = false;
      if (isInsert) {
        if (insertCol >= s.col && insertCol <= e.col) { e.col += count; changed = true; }
        else { if (s.col >= insertCol) { s.col += count; changed = true; } if (e.col >= insertCol) { e.col += count; changed = true; } }
      } else {
        if (insertCol >= s.col && insertCol <= e.col) { e.col -= count; changed = true; }
        else { if (s.col >= insertCol) { s.col -= count; changed = true; } if (e.col >= insertCol) { e.col -= count; changed = true; } }
      }
      if (changed) {
        const newRef = (norm.sheet ? norm.sheet + '!' : '') + toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
        workbook.namedRanges = workbook.namedRanges || {};
        workbook.namedRanges[nameKey] = newRef;
      }
    } catch (e) {
      return ref;
    }
  } else if (ref && typeof ref === 'object' && ref.ref) {
    const nr = ref as any;
    const norm = normalizeNamedRangeRef(nr.ref);
    if (norm.sheet && norm.sheet !== sheetName) return ref;
    try {
      const { start, end } = parseRange(norm.range);
      const s = parseAddress(start);
      const e = parseAddress(end);
      let changed = false;
      if (isInsert) {
        if (insertCol >= s.col && insertCol <= e.col) { e.col += count; changed = true; }
        else { if (s.col >= insertCol) { s.col += count; changed = true; } if (e.col >= insertCol) { e.col += count; changed = true; } }
      } else {
        if (insertCol >= s.col && insertCol <= e.col) { e.col -= count; changed = true; }
        else { if (s.col >= insertCol) { s.col -= count; changed = true; } if (e.col >= insertCol) { e.col -= count; changed = true; } }
      }
      if (changed) {
        nr.ref = (norm.sheet ? norm.sheet + '!' : '') + toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
      }
    } catch (e) {
      return ref;
    }
  }
}

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Base operation interface
 */
export interface Operation {
  type: string;
  sheetId: string;
  [key: string]: unknown;
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
 * Set partial style properties (merge with existing style)
 */
export interface SetStylePropsOp extends Operation {
  type: "setStyleProps";
  address: string;
  styleProps: Partial<CellStyle>;
}

/**
 * Set a single color value (bgColor or color) on a cell
 */
export interface SetColorOp extends Operation {
  type: "setColor";
  address: string;
  colorType: "bgColor" | "color";
  color: string | null; // null to clear
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
  | { type: 'addSheet'; name?: string }
  | { type: 'deleteSheet'; sheetId: string }
  | (EditCellOp | DeleteCellOp | InsertRowOp | DeleteRowOp | InsertColOp | DeleteColOp | MergeOp | UnmergeOp | SetStyleOp | SetStylePropsOp | SetColorOp | SetFormatOp | SetRangeOp);


// Note: addSheet/deleteSheet are higher-level operations that may be
// implemented by callers directly on the workbook model. We include
// lightweight handlers here for completeness.

// Apply addSheet/deleteSheet operations if present
function applyAddSheet(
  workbook: WorkbookJSON,
  op: { type: 'addSheet'; name?: string },
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Create sheet using provided name
  const name = op.name || 'Sheet';
  const sheet = makeSheet(name);
  workbook.sheets.push(sheet);

  const action: Action = {
    id: generateId(),
    type: 'addSheet',
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: sheet.id,
    payload: { sheet },
    inverse: {
      id: generateId(),
      type: 'deleteSheet',
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: sheet.id,
      payload: { sheetId: sheet.id },
    },
  };

  return { action, affectedRange: null, errors, warnings };
}

function applyDeleteSheet(
  workbook: WorkbookJSON,
  op: { type: 'deleteSheet'; sheetId: string },
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const idx = workbook.sheets.findIndex((s) => s.id === op.sheetId);
  if (idx === -1) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const [removed] = workbook.sheets.splice(idx, 1);

  const action: Action = {
    id: generateId(),
    type: 'deleteSheet',
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: removed.id,
    payload: { sheet: removed },
    inverse: {
      id: generateId(),
      type: 'addSheet',
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: removed.id,
      payload: { sheet: removed },
    },
  };

  return { action, affectedRange: null, errors, warnings };
}

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
  sync?: boolean; // Sync workbook computed cache after operations (default: true)
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

    // Trigger HF recompute if needed.
    // Behaviour:
    // - If caller passed `options.hydration`, use it.
    // - Otherwise, if sync is enabled (default) and no hydration provided,
    //   create a temporary hydration via hf.getOrCreateHydration and use it.
    console.log('[HF-ops] Checking recompute conditions:', {
      sync: options.sync,
      affectedRangesCount: affectedRanges.length,
      skipRecompute: options.skipRecompute,
      shouldRecompute: options.sync !== false && affectedRanges.length > 0 && !options.skipRecompute
    });
    if (options.sync !== false && affectedRanges.length > 0 && !options.skipRecompute) {
      console.log('[HF-ops] Starting recompute for affected ranges:', affectedRanges);
      try {
        let hydrationToUse = options.hydration as HydrationResult | undefined;
        if (!hydrationToUse) {
          console.log('[HF-ops] No hydration provided, creating new one...');
          // Use imported function instead of dynamic require to avoid module resolution issues
          hydrationToUse = getOrCreateHydration(workbook);
          console.log('[HF-ops] Hydration created:', {
            hasHF: !!hydrationToUse?.hf,
            sheetMapSize: hydrationToUse?.sheetMap?.size,
            warnings: hydrationToUse?.warnings
          });
          // DO NOT attach HF to workbook object - it gets cloned by React state updates
          // and the HF instance will be garbage collected, causing "sheetMapping undefined" errors.
          // The caller (useWorkbook) manages HF lifecycle via hfRef which persists across renders.
        }

        if (hydrationToUse) {
          try {
            // Before recomputing, sync any affected cells to HyperFormula
            console.log('[HF-ops] Syncing affected cells to HyperFormula...');
            for (const range of affectedRanges) {
              const sheet = getSheet(workbook, range.sheetId);
              if (!sheet) continue;

              const hfSheetId = hydrationToUse.sheetMap.get(range.sheetId);
              if (hfSheetId === undefined) continue;

              // Parse the range to get affected cells
              // For single cell addresses like "A1", just update that cell
              // For ranges like "A1:B10", we'd need to parse it properly
              // For simplicity, treat as single cell if no colon
              const addresses = range.range.includes(':') 
                ? [] // TODO: implement range parsing
                : [range.range];

              for (const address of addresses) {
                try {
                  const cell = getCell(workbook, range.sheetId, address);
                  const { row, col } = addressToHf(address);

                  // Update HyperFormula with the cell content
                  let hfValue: any;
                  if (!cell || (cell.raw === null && !cell.formula)) {
                    // Cell was deleted
                    hfValue = null;
                  } else if (cell.formula) {
                    hfValue = cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`;
                  } else {
                    hfValue = cell.raw;
                  }

                  console.log(`[HF-ops]   Syncing ${sheet.name}!${address} -> HF (row=${row}, col=${col})`, { 
                    hfValue,
                    hfSheetId,
                    hasHF: !!hydrationToUse.hf,
                    hfSheetName: hydrationToUse.hf?.getSheetName?.(hfSheetId),
                    sheetMapSize: hydrationToUse.sheetMap?.size
                  });
                  
                  // Verify HF instance and sheet exist before calling setCellContents
                  if (!hydrationToUse.hf) {
                    throw new Error('HyperFormula instance is undefined');
                  }
                  if (typeof hfSheetId !== 'number') {
                    throw new Error(`Invalid hfSheetId: ${hfSheetId}`);
                  }
                  if (hydrationToUse.hf.getSheetName(hfSheetId) === undefined) {
                    // Get count of sheets properly
                    const sheetNames: string[] = [];
                    try {
                      for (let i = 0; ; i++) {
                        const name = hydrationToUse.hf.getSheetName(i);
                        if (name === undefined) break;
                        sheetNames.push(`${i}:${name}`);
                      }
                    } catch (e) {
                      // Stop iterating
                    }
                    throw new Error(`HF sheet ${hfSheetId} does not exist. Available sheets: ${sheetNames.join(', ')}`);
                  }
                  
                  hydrationToUse.hf.setCellContents({ sheet: hfSheetId, row, col }, hfValue);
                } catch (err) {
                  console.error(`[HF-ops]   Failed to sync ${address}:`, err);
                }
              }
            }

            console.log('[HF-ops] Calling recomputeAndPatchCache...');
            const recomputeResult = recomputeAndPatchCache(workbook, hydrationToUse, { affectedRanges });
            console.log('[HF-ops] Recompute result:', { 
              updatedCells: recomputeResult.updatedCells, 
              errors: recomputeResult.errors, 
              warnings: recomputeResult.warnings 
            });
          } catch (err) {
            console.error('[HF-ops] Recompute error:', err);
            warnings.push(`Failed to recompute formulas: ${err}`);
          }
        } else {
          console.warn('[HF-ops] No hydration available for recompute');
        }
      } catch (error) {
        console.error('[HF-ops] Hydration creation error:', error);
        warnings.push(`Failed to recompute formulas: ${error}`);
      }
    } else {
      console.log('[HF-ops] Skipping recompute');
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
      case "addSheet":
        return applyAddSheet(workbook, op, options);
      case "deleteSheet":
        return applyDeleteSheet(workbook, op, options);
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
      case "setStyleProps":
        return applySetStyleProps(workbook, op as SetStylePropsOp, options);
      case "setColor":
        return applySetColor(workbook, op as SetColorOp, options);
      case "setFormat":
        return applySetFormat(workbook, op, options);
      case "setRange":
        return applySetRange(workbook, op, options);
      default:
        // Should be unreachable; avoid referencing `op` here because
        // TypeScript narrows it to `never` which makes accessing
        // properties a compile-time error. Use a generic message.
        errors.push(`Unknown operation type`);
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

    // Update mergedRanges
    if (sheet.mergedRanges) {
      sheet.mergedRanges = sheet.mergedRanges.map(range => {
        const { start, end } = parseRange(range);
        const s = parseAddress(start);
        const e = parseAddress(end);
        // Expand merged range if insert is inside (inclusive)
        if (insertRow >= s.row && insertRow <= e.row) {
          e.row += count;
        } else {
          if (s.row >= insertRow) s.row += count;
          if (e.row >= insertRow) e.row += count;
        }
        return toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
      });
    }

    // Update conditionalFormats ranges
    if (sheet.conditionalFormats && sheet.conditionalFormats.length > 0) {
      sheet.conditionalFormats = sheet.conditionalFormats.map(cf => {
        const { start, end } = parseRange(cf.range);
        const s = parseAddress(start);
        const e = parseAddress(end);
        // Expand conditional format range if insert is inside (inclusive)
        if (insertRow >= s.row && insertRow <= e.row) {
          e.row += count;
        } else {
          if (s.row >= insertRow) s.row += count;
          if (e.row >= insertRow) e.row += count;
        }
        return {
          ...cf,
          range: toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col),
        };
      });
    }

  // Update workbook-level namedRanges using helper (handles strings and NamedRange objects)
  if (workbook.namedRanges) {
    for (const [name, ref] of Object.entries(workbook.namedRanges)) {
      updateNamedRangeForRow(workbook, sheet.name, name, ref, insertRow, count, true);
    }
  }
  // Also update sheet-level namedRanges if present
  if (sheet.namedRanges) {
    for (const [name, ref] of Object.entries(sheet.namedRanges)) {
      updateNamedRangeForRow(workbook, sheet.name, name, ref, insertRow, count, true);
    }
  }

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

    // Update mergedRanges
    if (sheet.mergedRanges) {
      sheet.mergedRanges = sheet.mergedRanges.map(range => {
        const { start, end } = parseRange(range);
        const s = parseAddress(start);
        const e = parseAddress(end);
        if (s.row >= deleteRow) s.row -= count;
        if (e.row >= deleteRow) e.row -= count;
        return toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
      });
    }

    // Update conditionalFormats ranges
    if (sheet.conditionalFormats && sheet.conditionalFormats.length > 0) {
      sheet.conditionalFormats = sheet.conditionalFormats
        .map(cf => {
          const { start, end } = parseRange(cf.range);
          const s = parseAddress(start);
          const e = parseAddress(end);
          
          // Shrink range if delete is inside
          if (deleteRow >= s.row && deleteRow < s.row + (e.row - s.row + 1)) {
            // Delete overlaps with range
            if (deleteRow <= s.row && deleteRow + count > e.row) {
              // Entire range is deleted
              return null;
            }
            // Adjust the range
            if (s.row >= deleteRow && s.row < deleteRow + count) {
              s.row = deleteRow;
            }
            if (e.row >= deleteRow && e.row < deleteRow + count) {
              e.row = deleteRow - 1;
            }
          }
          
          // Shift range if delete is above
          if (s.row >= deleteRow + count) s.row -= count;
          if (e.row >= deleteRow + count) e.row -= count;
          
          // Ensure valid range
          if (s.row > e.row) return null;
          
          return {
            ...cf,
            range: toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col),
          };
        })
        .filter((cf): cf is NonNullable<typeof cf> => cf !== null);
    }

    if (workbook.namedRanges) {
      for (const [name, ref] of Object.entries(workbook.namedRanges)) {
        updateNamedRangeForRow(workbook, sheet.name, name, ref, deleteRow, count, false);
      }
    }

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

    // Update mergedRanges on column insert to keep ranges consistent
    if (sheet.mergedRanges) {
      sheet.mergedRanges = sheet.mergedRanges.map(range => {
        const { start, end } = parseRange(range);
        const s = parseAddress(start);
        const e = parseAddress(end);
        // Expand merged range if insert is inside (inclusive)
        if (insertCol >= s.col && insertCol <= e.col) {
          e.col += count;
        } else {
          if (s.col >= insertCol) s.col += count;
          if (e.col >= insertCol) e.col += count;
        }
        return toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
      });
    }

    // Update conditionalFormats ranges
    if (sheet.conditionalFormats && sheet.conditionalFormats.length > 0) {
      sheet.conditionalFormats = sheet.conditionalFormats.map(cf => {
        const { start, end } = parseRange(cf.range);
        const s = parseAddress(start);
        const e = parseAddress(end);
        // Expand conditional format range if insert is inside (inclusive)
        if (insertCol >= s.col && insertCol <= e.col) {
          e.col += count;
        } else {
          if (s.col >= insertCol) s.col += count;
          if (e.col >= insertCol) e.col += count;
        }
        return {
          ...cf,
          range: toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col),
        };
      });
    }

    if (workbook.namedRanges) {
      for (const [name, ref] of Object.entries(workbook.namedRanges)) {
        updateNamedRangeForCol(workbook, sheet.name, name, ref, insertCol, count, true);
      }
    }

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

    // Update mergedRanges
    if (sheet.mergedRanges) {
      sheet.mergedRanges = sheet.mergedRanges.map(range => {
        const { start, end } = parseRange(range);
        const s = parseAddress(start);
        const e = parseAddress(end);
        if (s.col >= deleteCol) s.col -= count;
        if (e.col >= deleteCol) e.col -= count;
        return toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col);
      });
    }

    // Update conditionalFormats ranges
    if (sheet.conditionalFormats && sheet.conditionalFormats.length > 0) {
      sheet.conditionalFormats = sheet.conditionalFormats
        .map(cf => {
          const { start, end } = parseRange(cf.range);
          const s = parseAddress(start);
          const e = parseAddress(end);
          
          // Shrink range if delete is inside
          if (deleteCol >= s.col && deleteCol < s.col + (e.col - s.col + 1)) {
            // Delete overlaps with range
            if (deleteCol <= s.col && deleteCol + count > e.col) {
              // Entire range is deleted
              return null;
            }
            // Adjust the range
            if (s.col >= deleteCol && s.col < deleteCol + count) {
              s.col = deleteCol;
            }
            if (e.col >= deleteCol && e.col < deleteCol + count) {
              e.col = deleteCol - 1;
            }
          }
          
          // Shift range if delete is to the left
          if (s.col >= deleteCol + count) s.col -= count;
          if (e.col >= deleteCol + count) e.col -= count;
          
          // Ensure valid range
          if (s.col > e.col) return null;
          
          return {
            ...cf,
            range: toAddress(s.row, s.col) + ':' + toAddress(e.row, e.col),
          };
        })
        .filter((cf): cf is NonNullable<typeof cf> => cf !== null);
    }

    if (workbook.namedRanges) {
      for (const [name, ref] of Object.entries(workbook.namedRanges)) {
        updateNamedRangeForCol(workbook, sheet.name, name, ref, deleteCol, count, false);
      }
    }

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

  // Handle operations that don't require sheetId
  if (op.type === 'addSheet') {
    // No validation needed for addSheet
    return { valid: true, errors: [] };
  }

  if (op.type === 'deleteSheet') {
    const sheet = getSheet(workbook, op.sheetId);
    if (!sheet) {
      errors.push(`Sheet not found: ${op.sheetId}`);
    }
    return { valid: errors.length === 0, errors };
  }

  // For operations that require sheetId, validate it exists
  const sheetId = 'sheetId' in op ? (op as { sheetId: string }).sheetId : '';
  if (!sheetId) {
    errors.push('Sheet ID required for this operation');
    return { valid: false, errors };
  }
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${sheetId}`);
    return { valid: false, errors };
  }

  // Type-specific validation
  switch (op.type) {
    case "editCell":
    case "deleteCell":
    case "setStyle":
    case "setStyleProps":
    case "setColor":
    case "setFormat": {
      // Validate address
      try {
        const addressOp = op as { address: string };
        parseAddress(addressOp.address);
      } catch {
        const addressOp = op as { address: string };
        errors.push(`Invalid address: ${addressOp.address}`);
      }
      break;
    }

    case "merge":
    case "unmerge":
    case "setRange": {
      // Validate range
      try {
        const rangeOp = op as { range: string };
        const addresses = getCellsInRange(rangeOp.range);
        if (addresses.length === 0) {
          errors.push(`Invalid range: ${rangeOp.range}`);
        }
      } catch {
        const rangeOp = op as { range: string };
        errors.push(`Invalid range: ${rangeOp.range}`);
      }
      break;
    }

    case "insertRow":
    case "deleteRow": {
      // Validate row number
      const rowOp = op as { row: number };
      if (rowOp.row < 1) {
        errors.push(`Invalid row number: ${rowOp.row}`);
      }
      break;
    }

    case "insertCol":
    case "deleteCol": {
      // Validate column number
      const colOp = op as { col: number };
      if (colOp.col < 1) {
        errors.push(`Invalid column number: ${colOp.col}`);
      }
      break;
    }
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

/**
 * Create setStyleProps operation
 */
export function createSetStylePropsOp(
  sheetId: string,
  address: string,
  styleProps: Partial<CellStyle>
): SetStylePropsOp {
  return {
    type: 'setStyleProps',
    sheetId,
    address,
    styleProps,
  };
}

/**
 * Create setColor operation
 */
export function createSetColorOp(
  sheetId: string,
  address: string,
  colorType: 'bgColor' | 'color',
  color: string | null
): SetColorOp {
  return {
    type: 'setColor',
    sheetId,
    address,
    colorType,
    color,
  };
}

// Apply partial style properties by shallow merging with existing style
function applySetStyleProps(
  workbook: WorkbookJSON,
  op: SetStylePropsOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const oldCell = getCell(workbook, op.sheetId, op.address);
  const oldStyle = oldCell?.style;

  const newStyle = { ...(oldStyle || {}), ...op.styleProps };
  const newCell: Cell = {
    ...oldCell,
    style: newStyle,
  };
  setCell(workbook, op.sheetId, op.address, newCell);

  const action: Action = {
    id: generateId(),
    type: 'setStyleProps',
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      address: op.address,
      styleProps: op.styleProps,
    },
    inverse: {
      id: generateId(),
      type: 'setStyle',
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        address: op.address,
        style: oldStyle || {},
      },
    },
  };

  const affectedRange = { sheetId: op.sheetId, range: op.address };

  return { action, affectedRange, errors, warnings };
}

// Apply setColor operation which sets either bgColor or color property
function applySetColor(
  workbook: WorkbookJSON,
  op: SetColorOp,
  options: ApplyOptions
): ReturnType<typeof applyOperation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sheet = getSheet(workbook, op.sheetId);
  if (!sheet) {
    errors.push(`Sheet not found: ${op.sheetId}`);
    return { action: null, affectedRange: null, errors, warnings };
  }

  const oldCell = getCell(workbook, op.sheetId, op.address);
  const oldStyle = oldCell?.style;

  const newStyle = { ...(oldStyle || {}) } as CellStyle;
  if (op.color === null) {
    // delete the property
    delete (newStyle as any)[op.colorType];
  } else {
    (newStyle as any)[op.colorType] = op.color;
  }

  const newCell: Cell = {
    ...oldCell,
    style: newStyle,
  };
  setCell(workbook, op.sheetId, op.address, newCell);

  const action: Action = {
    id: generateId(),
    type: 'setColor',
    timestamp: new Date().toISOString(),
    user: options.user,
    sheetId: op.sheetId,
    payload: {
      address: op.address,
      colorType: op.colorType,
      color: op.color,
    },
    inverse: {
      id: generateId(),
      type: 'setStyle',
      timestamp: new Date().toISOString(),
      user: options.user,
      sheetId: op.sheetId,
      payload: {
        address: op.address,
        style: oldStyle || {},
      },
    },
  };

  const affectedRange = { sheetId: op.sheetId, range: op.address };

  return { action, affectedRange, errors, warnings };
}
