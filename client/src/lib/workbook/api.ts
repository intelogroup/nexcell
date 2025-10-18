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
 * @param options - Creation options
 * @returns New workbook with one empty sheet
 * 
 * @example
 * ```typescript
 * const workbook = createWorkbook("My Spreadsheet");
 * const workbookWithHF = createWorkbook("My Spreadsheet", { enableFormulas: true });
 * ```
 */
export function createWorkbook(title?: string, options?: { enableFormulas?: boolean }): WorkbookJSON {
  const workbook = utils.createWorkbook(title);
  
  // Optionally create and attach HyperFormula instance
  if (options?.enableFormulas) {
    const hydration = hf.hydrateHFFromWorkbook(workbook);
    try {
      (workbook as any).hf = hydration;
    } catch {
      // ignore assignment failures in read-only contexts
    }
  }
  
  return workbook;
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
  const { hydration, recompute } = hf.computeWorkbook(workbook);
  try {
    // Attach runtime hydration to workbook for reuse by consumers
    (workbook as any).hf = hydration;
  } catch {
    // ignore if assignment fails in some contexts
  }
  return { hydration, recompute };
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
  const hydration = hf.hydrateHFFromWorkbook(workbook);
  try {
    (workbook as any).hf = hydration;
  } catch {
    // ignore
  }
  return hydration;
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

/**
 * Simulate applying operations to a workbook without mutating the original.
 *
 * Steps:
 * 1. Clone the workbook
 * 2. Apply operations to the clone (skip recompute during apply)
 * 3. Force a fresh HF hydration and recompute on the clone
 * 4. Return a deterministic diff describing changes
 *
 * @param workbook - Source workbook (not mutated)
 * @param operations - Operations to apply in the dry-run
 * @param options - Simulation options (planId, user, forceNewHydration)
 */
export async function simulateApply(
  workbook: WorkbookJSON,
  operations: AnyOperation[],
  options?: { planId?: string; user?: string; forceNewHydration?: boolean }
): Promise<{ success: boolean; error?: string; actualDiff?: any; hydration?: HydrationResult; recompute?: any }> {
  try {
    // 1. Clone workbook for immutable simulation
    const before = cloneWorkbook(workbook);
    const after = cloneWorkbook(workbook);

    // 2. Apply ops to the clone (skip recompute for performance and determinism)
    const applyResult = ops.applyOperations(after, operations, { skipRecompute: true, user: options?.user });

    if (!applyResult.success) {
      return { success: false, error: `Apply failed: ${applyResult.errors.join('; ') || 'unknown'}` };
    }

    // Ensure modifiedAt is bumped so hydration cache won't be reused accidentally
    after.meta = after.meta || { createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() };
    after.meta.modifiedAt = new Date().toISOString();

    // 3. Force fresh hydration & recompute on the clone
    const { hydration, recompute } = hf.computeWorkbook(after, { forceNewHydration: options?.forceNewHydration ?? true });

    // If a planId is provided, tag recomputed values for provenance
    if (options?.planId) {
      const tag = `simulate-${options.planId}`;
      if (after.computed && after.computed.hfCache) {
        for (const addr of Object.keys(after.computed.hfCache)) {
          const cv = (after.computed.hfCache as Record<string, any>)[addr];
          if (cv && typeof cv === 'object') {
            cv.computedBy = tag;
          }
        }
      }

      // Also tag per-cell computed metadata stored on the sheet cells
      for (const sheet of after.sheets) {
        for (const addr of Object.keys(sheet.cells || {})) {
          const cell = (sheet.cells as Record<string, any>)[addr];
          if (cell.computed && typeof cell.computed === 'object') {
            cell.computed.computedBy = tag;
          }
        }
      }
    }

    // Ensure per-sheet cells reflect hfCache entries so diffs include computed metadata
    // (some computed values are stored only in workbook.computed.hfCache; copy them
    // onto the corresponding sheet cell.computed when missing)
    if (after.computed && after.computed.hfCache) {
      for (const fullAddr of Object.keys(after.computed.hfCache)) {
        try {
          const cv = (after.computed.hfCache as Record<string, any>)[fullAddr];
          const parts = String(fullAddr).split('!');
          if (parts.length !== 2) continue;
          const sheetName = parts[0];
          const addr = parts[1];
          const sheet = after.sheets.find((s) => s.name === sheetName);
          if (!sheet) continue;
          sheet.cells = sheet.cells || {};
          const cell = sheet.cells[addr];
          if (!cell) continue;
          if (!cell.computed) {
            // Attach a shallow copy to avoid accidental mutations
            sheet.cells[addr] = { ...cell, computed: { ...cv } };
          }
        } catch (e) {
          // ignore malformed addresses
        }
      }
    }

    // 4. Build diffs between 'before' and 'after'
    const cellChanges: Array<any> = [];
    const formulaChanges: Array<any> = [];
    const structuralChanges: Array<any> = [];

    // Map sheets by id for easy lookup
    const beforeSheets = new Map(before.sheets.map((s) => [s.id, s]));
    const afterSheets = new Map(after.sheets.map((s) => [s.id, s]));

    // Structural changes: detect row/col inserts/deletes and compute movedCells mapping
    for (const op of operations) {
      if (op.type === 'insertRow' || op.type === 'deleteRow') {
        const o = op as any;
        const sheet = after.sheets.find(s => s.id === o.sheetId);
        if (!sheet) continue;

        const affected: { movedCells: Array<{ from: string; to: string }>; insertedRows?: number; deletedRows?: number } = { movedCells: [] };

        const count = o.count || 1;
        const rowIndex = o.row; // 1-based

        const beforeCells = (before.sheets.find(s => s.id === o.sheetId)?.cells) || {};
  // Build mapping of moved cells for insertRow (cells at or below rowIndex move down)
        if (op.type === 'insertRow') {
          affected.insertedRows = count;
          for (const [addr] of Object.entries(beforeCells)) {
            const parsed = parseAddress(addr);
            if (parsed.row >= rowIndex) {
              const newAddr = toAddress(parsed.row + count, parsed.col);
              affected.movedCells.push({ from: addr, to: newAddr });
            }
          }
        } else {
          // deleteRow: cells below deleted range move up
          affected.deletedRows = count;
          for (const [addr] of Object.entries(beforeCells)) {
            const parsed = parseAddress(addr);
            if (parsed.row > rowIndex + count - 1) {
              const newAddr = toAddress(parsed.row - count, parsed.col);
              affected.movedCells.push({ from: addr, to: newAddr });
            }
          }
        }

        structuralChanges.push({ type: op.type, sheetId: o.sheetId, details: affected });
      } else if (op.type === 'insertCol' || op.type === 'deleteCol') {
        const o = op as any;
        const sheet = after.sheets.find(s => s.id === o.sheetId);
        if (!sheet) continue;

        const affected: { movedCells: Array<{ from: string; to: string }>; insertedCols?: number; deletedCols?: number } = { movedCells: [] };

        const count = o.count || 1;
        const colIndex = o.col; // 1-based

        const beforeCells = (before.sheets.find(s => s.id === o.sheetId)?.cells) || {};

        if (op.type === 'insertCol') {
          affected.insertedCols = count;
          for (const [addr] of Object.entries(beforeCells)) {
            const parsed = parseAddress(addr);
            if (parsed.col >= colIndex) {
              const newAddr = toAddress(parsed.row, parsed.col + count);
              affected.movedCells.push({ from: addr, to: newAddr });
            }
          }
        } else {
          affected.deletedCols = count;
          for (const [addr] of Object.entries(beforeCells)) {
            const parsed = parseAddress(addr);
            if (parsed.col > colIndex + count - 1) {
              const newAddr = toAddress(parsed.row, parsed.col - count);
              affected.movedCells.push({ from: addr, to: newAddr });
            }
          }
        }

        structuralChanges.push({ type: op.type, sheetId: o.sheetId, details: affected });
      } else if (['merge', 'unmerge', 'addSheet', 'deleteSheet'].includes(op.type)) {
        structuralChanges.push({ type: op.type, sheetId: (op as any).sheetId || null, details: op });
      }
    }

    // Helper to sanitize cell objects for deterministic diffs
    function sanitizeCellForDiff(cell: any) {
      if (!cell) return cell;
      const c = JSON.parse(JSON.stringify(cell));
      if (c.computed && typeof c.computed === 'object') {
        // Remove transient timestamp to keep diffs deterministic
        delete c.computed.ts;
      }
      return c;
    }

    // Compare cell-level changes per sheet
    for (const [sheetId, afterSheet] of afterSheets.entries()) {
      const beforeSheet = beforeSheets.get(sheetId);
      const beforeCells = (beforeSheet && beforeSheet.cells) || {};
      const afterCells = afterSheet.cells || {};

      // Union of addresses
      const addresses = new Set<string>([...Object.keys(beforeCells), ...Object.keys(afterCells)]);

      for (const addr of addresses) {
        const b = sanitizeCellForDiff(beforeCells[addr]);
        const a = sanitizeCellForDiff(afterCells[addr]);
        if (JSON.stringify(b) !== JSON.stringify(a)) {
          cellChanges.push({ sheetId, address: addr, before: b, after: a });
          if ((b && b.formula) !== (a && a.formula)) {
            formulaChanges.push({ sheetId, address: addr, before: b?.formula || '', after: a?.formula || '' });
          }
        }
      }
    }

    const actualDiff: any = {
      cellChanges,
      formulaChanges,
      structuralChanges,
      totalAffectedCells: cellChanges.length,
    };

    // Build a provenance map when a planId is provided. This avoids mutating
    // per-cell computed metadata as a fallback and provides callers a single
    // place to look for provenance information produced by the simulation.
    if (options?.planId) {
      const computedProvenance: Record<string, string> = {};
      const tag = `simulate-${options.planId}`;

      if (after.computed && after.computed.hfCache) {
        for (const [fullAddr, cv] of Object.entries(after.computed.hfCache)) {
          try {
            const prov = (cv && (cv as any).computedBy) || tag;
            computedProvenance[fullAddr] = prov;
          } catch (e) {
            // ignore malformed entries
          }
        }
      }

      // Ensure any changed cells are included in the provenance map
      for (const cc of actualDiff.cellChanges) {
        try {
          const sheet = after.sheets.find(s => s.id === cc.sheetId);
          if (!sheet) continue;
          const fullAddr = `${sheet.name}!${cc.address}`;
          if (!(fullAddr in computedProvenance)) {
            computedProvenance[fullAddr] = tag;
          }
        } catch (e) {
          // ignore
        }
      }

      actualDiff.computedProvenance = computedProvenance;
    }

    return { success: true, actualDiff, hydration, recompute };
  } catch (error) {
    return { success: false, error: String(error) };
  }
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
// Named Ranges Helpers
// ============================================================================

/**
 * Add or update a workbook-scoped named range.
 *
 * - If `scope` is omitted or `"workbook"`, the named range is stored at workbook level.
 * - If `scope` is a sheet id, the named range is stored on that sheet's `namedRanges` map.
 */
export function addNamedRange(
  workbook: WorkbookJSON,
  name: string,
  ref: string,
  scope: "workbook" | string = "workbook",
  comment?: string
): void {
  if (!workbook) throw new Error('addNamedRange: workbook is required');

  // Create top-level map if missing
  if (!workbook.namedRanges) workbook.namedRanges = {};

  if (!scope || scope === "workbook") {
    workbook.namedRanges[name] = ref;
  } else {
    // sheet-scoped - find sheet by id
    const sheet = workbook.sheets?.find((s) => s.id === scope);
    if (!sheet) throw new Error(`addNamedRange: sheet with id ${scope} not found`);
    if (!sheet.namedRanges) sheet.namedRanges = {};
    sheet.namedRanges[name] = ref;
  }
  // keep parameter to preserve API; avoid unused param lint
  void comment;
}

/**
 * Remove a named range. If scope is provided, remove from that scope, otherwise try workbook scope first then sheets.
 */
export function removeNamedRange(
  workbook: WorkbookJSON,
  name: string,
  scope?: "workbook" | string
): boolean {
  if (!workbook) return false;

  if (scope === undefined || scope === "workbook") {
    if (workbook.namedRanges && name in workbook.namedRanges) {
      delete workbook.namedRanges[name];
      return true;
    }
    // try sheets if not found at workbook level and scope wasn't strictly workbook
    for (const sheet of workbook.sheets || []) {
      if (sheet.namedRanges && name in sheet.namedRanges) {
        delete sheet.namedRanges[name];
        return true;
      }
    }
    return false;
  }

  // scoped to a particular sheet id
  const sheet = workbook.sheets?.find((s) => s.id === scope);
  if (!sheet || !sheet.namedRanges) return false;
  if (name in sheet.namedRanges) {
    delete sheet.namedRanges[name];
    return true;
  }
  return false;
}

/**
 * Get a named range by name. Returns either a workbook-scoped or sheet-scoped value, preferring workbook scope.
 */
export function getNamedRange(
  workbook: WorkbookJSON,
  name: string
): string | undefined {
  if (!workbook) return undefined;
  if (workbook.namedRanges && name in workbook.namedRanges) return workbook.namedRanges[name] as string;
  for (const sheet of workbook.sheets || []) {
    if (sheet.namedRanges && name in sheet.namedRanges) return sheet.namedRanges[name] as string;
  }
  return undefined;
}

/**
 * List all named ranges in the workbook (both workbook- and sheet-scoped).
 */
export function listNamedRanges(workbook: WorkbookJSON): Array<{ name: string; ref: string; scope: "workbook" | string }> {
  const out: Array<{ name: string; ref: string; scope: "workbook" | string }> = [];
  if (!workbook) return out;
  if (workbook.namedRanges) {
    for (const [k, v] of Object.entries(workbook.namedRanges)) {
      out.push({ name: k, ref: String(v), scope: "workbook" });
    }
  }
  for (const sheet of workbook.sheets || []) {
    if (sheet.namedRanges) {
      for (const [k, v] of Object.entries(sheet.namedRanges)) {
        out.push({ name: k, ref: String(v), scope: sheet.id });
      }
    }
  }
  return out;
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
