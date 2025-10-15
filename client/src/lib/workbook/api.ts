/**
 * Workbook API - High-level interface
 * 
 * This module provides a clean, cohesive API for working with workbooks.
 * All the core functionality exposed in one place for easy consumption.
 * 
 * Design principles:
 * - Simple, intuitive function names
 * - Consistent error handling
 * - TypeScript type safety
 * - No external dependencies (except adapters)
 * - React-friendly (immutable operations)
 */

import type {
  WorkbookJSON,
  Cell,
  ExportAdapter,
  Action,
} from "./types";
import * as utils from "./utils";
import { SheetJSAdapter } from "./adapters/sheetjs";
import * as hf from "./hyperformula";
import type { HydrationResult } from "./hyperformula";
import * as ops from "./operations";
import type { AnyOperation, ApplyOptions, ApplyResult } from "./operations";
import * as undoModule from "./undo";
import type { UndoRedoResult } from "./undo";

// ============================================================================
// Workbook Creation & Loading
// ============================================================================

/**
 * Create a new empty workbook
 * 
 * @param title - Workbook title (default: "Untitled")
 * @returns New workbook with one empty sheet
 * 
 * @example
 * ```typescript
 * const workbook = createWorkbook("My Spreadsheet");
 * ```
 */
export function createWorkbook(title?: string): WorkbookJSON {
  return utils.createWorkbook(title);
}

/**
 * Load workbook from file
 * 
 * Uses SheetJS adapter by default to import XLSX/XLS/CSV files.
 * 
 * @param file - File blob or ArrayBuffer
 * @param adapter - Optional custom adapter (default: SheetJSAdapter)
 * @returns Loaded workbook
 * 
 * @example
 * ```typescript
 * const file = await fetch('/data.xlsx').then(r => r.blob());
 * const workbook = await loadWorkbook(file);
 * ```
 */
export async function loadWorkbook(
  file: Blob | ArrayBuffer,
  adapter: ExportAdapter = new SheetJSAdapter()
): Promise<WorkbookJSON> {
  return await adapter.import(file);
}

/**
 * Clone (deep copy) a workbook
 * 
 * Useful for creating snapshots or implementing undo/redo.
 * 
 * @param workbook - Source workbook
 * @returns Deep copy of workbook
 * 
 * @example
 * ```typescript
 * const snapshot = cloneWorkbook(workbook);
 * ```
 */
export function cloneWorkbook(workbook: WorkbookJSON): WorkbookJSON {
  return utils.cloneWorkbook(workbook);
}

// ============================================================================
// Workbook Export & Saving
// ============================================================================

/**
 * Export workbook to file format
 * 
 * Uses SheetJS adapter by default to export as XLSX.
 * 
 * @param workbook - Source workbook
 * @param adapter - Optional custom adapter (default: SheetJSAdapter)
 * @returns ArrayBuffer ready for download
 * 
 * @example
 * ```typescript
 * const buffer = await exportWorkbook(workbook);
 * const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 * const url = URL.createObjectURL(blob);
 * // Trigger download...
 * ```
 */
export async function exportWorkbook(
  workbook: WorkbookJSON,
  adapter: ExportAdapter = new SheetJSAdapter()
): Promise<ArrayBuffer> {
  return await adapter.export(workbook);
}

/**
 * Save workbook to file (browser download)
 * 
 * Convenience function that exports and triggers browser download.
 * 
 * @param workbook - Source workbook
 * @param filename - Download filename (default: workbook title)
 * @param adapter - Optional custom adapter
 * 
 * @example
 * ```typescript
 * await saveWorkbook(workbook, "my-spreadsheet.xlsx");
 * ```
 */
export async function saveWorkbook(
  workbook: WorkbookJSON,
  filename?: string,
  adapter: ExportAdapter = new SheetJSAdapter()
): Promise<void> {
  const buffer = await exportWorkbook(workbook, adapter);
  const blob = new Blob([buffer], { type: adapter.mimeType });
  const url = URL.createObjectURL(blob);

  const requestedName = (filename || workbook.meta.title || "workbook").trim() || "workbook";
  const safeName = requestedName.replace(/[\\/:*?"<>|]/g, "_");
  const extension = adapter.extension.startsWith(".") ? adapter.extension : `.${adapter.extension}`;
  const downloadName = safeName.toLowerCase().endsWith(extension.toLowerCase())
    ? safeName
    : `${safeName}${extension}`;

  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.click();

  URL.revokeObjectURL(url);
}

// ============================================================================
// Cell Operations
// ============================================================================

/**
 * Set cell value in workbook
 * 
 * This is a low-level function. For production use, prefer `applyOperations()`.
 * 
 * @param workbook - Target workbook (modified in place)
 * @param sheetId - Sheet ID
 * @param address - Cell address (e.g., "A1")
 * @param cell - Cell data
 * 
 * @example
 * ```typescript
 * setCell(workbook, sheet.id, "A1", { raw: 42 });
 * ```
 */
export function setCell(
  workbook: WorkbookJSON,
  sheetId: string,
  address: string,
  cell: Cell
): void {
  utils.setCell(workbook, sheetId, address, cell);
}

/**
 * Get cell from workbook
 * 
 * @param workbook - Source workbook
 * @param sheetId - Sheet ID
 * @param address - Cell address (e.g., "A1")
 * @returns Cell data or undefined
 * 
 * @example
 * ```typescript
 * const cell = getCell(workbook, sheet.id, "A1");
 * console.log(cell?.raw); // 42
 * ```
 */
export function getCell(
  workbook: WorkbookJSON,
  sheetId: string,
  address: string
): Cell | undefined {
  return utils.getCell(workbook, sheetId, address);
}

/**
 * Delete cell from workbook
 * 
 * This is a low-level function. For production use, prefer `applyOperations()`.
 * 
 * @param workbook - Target workbook (modified in place)
 * @param sheetId - Sheet ID
 * @param address - Cell address (e.g., "A1")
 * 
 * @example
 * ```typescript
 * deleteCell(workbook, sheet.id, "A1");
 * ```
 */
export function deleteCell(
  workbook: WorkbookJSON,
  sheetId: string,
  address: string
): void {
  utils.deleteCell(workbook, sheetId, address);
}

// ============================================================================
// Operations & Undo/Redo
// ============================================================================

/**
 * Apply operations to workbook
 * 
 * This is the recommended way to mutate workbooks. Provides:
 * - Automatic undo/redo support
 * - Validation
 * - Formula recomputation
 * - Error handling with rollback
 * 
 * @param workbook - Target workbook (modified in place)
 * @param operations - Array of operations to apply
 * @param options - Apply options (hydration, user, etc.)
 * @returns ApplyResult with success status and actions
 * 
 * @example
 * ```typescript
 * const result = applyOperations(workbook, [
 *   createEditCellOp(sheet.id, "A1", { raw: 100 }),
 *   createEditCellOp(sheet.id, "A2", { formula: "=A1*2" })
 * ], { hydration });
 * 
 * if (result.success) {
 *   console.log("Applied", result.actions.length, "actions");
 * }
 * ```
 */
export function applyOperations(
  workbook: WorkbookJSON,
  operations: AnyOperation[],
  options?: ApplyOptions
): ApplyResult {
  return ops.applyOperations(workbook, operations, options);
}

/**
 * Undo last operation
 * 
 * @param workbook - Target workbook (modified in place)
 * @param options - Options (hydration for recompute)
 * @returns UndoRedoResult with success status
 * 
 * @example
 * ```typescript
 * if (canUndo(workbook)) {
 *   const result = undo(workbook, { hydration });
 *   console.log("Undone:", result.action?.type);
 * }
 * ```
 */
export function undoOperation(
  workbook: WorkbookJSON,
  options?: { hydration?: HydrationResult }
): UndoRedoResult {
  return undoModule.undo(workbook, options);
}

/**
 * Check if undo is available
 * 
 * @param workbook - Source workbook
 * @returns True if undo is possible
 * 
 * @example
 * ```typescript
 * const canUndo = canUndoOperation(workbook);
 * ```
 */
export function canUndoOperation(workbook: WorkbookJSON): boolean {
  return undoModule.canUndo(workbook);
}

// ============================================================================
// Formula Computation
// ============================================================================

/**
 * Compute all formulas in workbook
 * 
 * Creates HyperFormula instance, computes all formulas,
 * and caches results in workbook.
 * 
 * @param workbook - Target workbook (modified in place with computed values)
 * @returns Hydration result with HF instance (remember to dispose!)
 * 
 * @example
 * ```typescript
 * const { hydration, recompute } = computeFormulas(workbook);
 * console.log("Computed", recompute.updatedCells, "cells");
 * 
 * // Don't forget to dispose!
 * disposeHF(hydration.hf);
 * ```
 */
export function computeFormulas(workbook: WorkbookJSON): {
  hydration: HydrationResult;
  recompute: ReturnType<typeof hf.recomputeAndPatchCache>;
} {
  return hf.computeWorkbook(workbook);
}

/**
 * Create HyperFormula instance from workbook
 * 
 * Lower-level function for manual HF management.
 * Don't forget to call `disposeHF()` when done!
 * 
 * @param workbook - Source workbook
 * @returns Hydration result with HF instance
 * 
 * @example
 * ```typescript
 * const hydration = createFormulaEngine(workbook);
 * // Use hydration.hf...
 * disposeHF(hydration.hf);
 * ```
 */
export function createFormulaEngine(workbook: WorkbookJSON): HydrationResult {
  return hf.hydrateHFFromWorkbook(workbook);
}

/**
 * Dispose HyperFormula instance
 * 
 * Call this when done with HF to free resources.
 * 
 * @param hydration - Hydration result or HF instance
 * 
 * @example
 * ```typescript
 * const hydration = createFormulaEngine(workbook);
 * // ... use HF ...
 * disposeFormulaEngine(hydration);
 * ```
 */
export function disposeFormulaEngine(
  hydration: HydrationResult | { hf: any }
): void {
  hf.disposeHF(hydration.hf);
}

// ============================================================================
// Validation & Utilities
// ============================================================================

/**
 * Validate workbook structure
 * 
 * Performs basic TypeScript-level validation.
 * Does NOT validate JSON Schema (deferred to Phase 2).
 * 
 * @param workbook - Workbook to validate
 * @returns True if valid
 * 
 * @example
 * ```typescript
 * if (!validateWorkbook(workbook)) {
 *   console.error("Invalid workbook structure");
 * }
 * ```
 */
export function validateWorkbook(workbook: any): workbook is WorkbookJSON {
  return utils.validateWorkbook(workbook);
}

/**
 * Get workbook statistics
 * 
 * Returns counts of sheets, cells, formulas, etc.
 * 
 * @param workbook - Source workbook
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const stats = getWorkbookStats(workbook);
 * console.log(`${stats.sheets} sheets, ${stats.cells} cells, ${stats.formulas} formulas`);
 * ```
 */
export function getStats(workbook: WorkbookJSON): ReturnType<typeof utils.getWorkbookStats> {
  return utils.getWorkbookStats(workbook);
}

/**
 * Get action history
 * 
 * Returns all actions in the log for inspection or replay.
 * 
 * @param workbook - Source workbook
 * @returns Array of actions
 * 
 * @example
 * ```typescript
 * const history = getActionHistory(workbook);
 * history.forEach(action => {
 *   console.log(action.type, action.timestamp);
 * });
 * ```
 */
export function getActionHistory(workbook: WorkbookJSON): Action[] {
  return workbook.actionLog || [];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create edit cell operation
 * 
 * Helper for creating editCell operations.
 * 
 * @param sheetId - Sheet ID
 * @param address - Cell address
 * @param cell - Cell data
 * @returns EditCellOp
 */
export const createEditCellOp = ops.createEditCellOp;

/**
 * Create delete cell operation
 * 
 * Helper for creating deleteCell operations.
 * 
 * @param sheetId - Sheet ID
 * @param address - Cell address
 * @returns DeleteCellOp
 */
export const createDeleteCellOp = ops.createDeleteCellOp;

/**
 * Create set range operation
 * 
 * Helper for creating setRange operations.
 * 
 * @param sheetId - Sheet ID
 * @param range - Range (e.g., "A1:B10")
 * @param cells - Cell data by address
 * @returns SetRangeOp
 */
export const createSetRangeOp = ops.createSetRangeOp;

// ============================================================================
// Re-exports for convenience
// ============================================================================

export const addSheet = utils.addSheet;
export const deleteSheet = utils.deleteSheet;
export const getSheet = utils.getSheet;
export const getSheetByName = utils.getSheetByName;
export const generateId = utils.generateId;
export const safeStringify = utils.safeStringify;

export const parseAddress = utils.parseAddress;
export const toAddress = utils.toAddress;
export const parseRange = utils.parseRange;
export const getCellsInRange = utils.getCellsInRange;
export const isInRange = utils.isInRange;
export const hfToAddress = utils.hfToAddress;
export const addressToHf = utils.addressToHf;

// Type re-exports
export type {
  WorkbookJSON,
  SheetJSON,
  Cell,
  CellStyle,
  ComputedValue,
  Action,
  ExportAdapter,
} from "./types";

export type {
  AnyOperation,
  EditCellOp,
  DeleteCellOp,
  ApplyResult,
  ApplyOptions,
} from "./operations";

export type {
  HydrationResult,
} from "./hyperformula";
