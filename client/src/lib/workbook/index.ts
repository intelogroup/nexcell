/**
 * Workbook JSON module
 * Single source of truth for spreadsheet data
 * 
 * This module provides a clean, cohesive API for working with workbooks.
 * All core functionality is exposed through the api module.
 */

// ============================================================================
// Clean Public API (Recommended for most use cases)
// ============================================================================

export {
  // Workbook Creation & Loading
  createWorkbook,
  loadWorkbook,
  cloneWorkbook,
  
  // Workbook Export & Saving
  exportWorkbook,
  saveWorkbook,
  
  // Cell Operations
  setCell,
  getCell,
  deleteCell,
  
  // Operations & Undo/Redo
  applyOperations,
  undoOperation,
  canUndoOperation,
  
  // Formula Computation
  computeFormulas,
  createFormulaEngine,
  disposeFormulaEngine,
  
  // Validation & Utilities
  validateWorkbook,
  getStats,
  getActionHistory,
  
  // Helper Functions
  createEditCellOp,
  createDeleteCellOp,
  createSetRangeOp,
  
  // Re-exports for convenience
  addSheet,
  getSheet,
  getSheetByName,
  generateId,
  parseAddress,
  toAddress,
  parseRange,
  getCellsInRange,
  isInRange,
  hfToAddress,
  addressToHf,
} from "./api";

// ============================================================================
// Type Exports
// ============================================================================

export type {
  WorkbookJSON,
  SheetJSON,
  Cell,
  CellDataType,
  CellStyle,
  ComputedValue,
  HyperFormulaInternal,
  DataValidation,
  ConditionalFormat,
  Comment,
  ChartMetadata,
  PivotTableMetadata,
  ImageMetadata,
  SheetProperties,
  SheetProtection,
  RowMetadata,
  ColMetadata,
  WorkbookMeta,
  GlobalSettings,
  ComputedCache,
  Action,
  ActionLog,
  ExportAdapter,
  BorderStyle,
  SheetJSType,
} from "./types";

export type {
  Operation,
  AnyOperation,
  EditCellOp,
  DeleteCellOp,
  InsertRowOp,
  DeleteRowOp,
  InsertColOp,
  DeleteColOp,
  MergeOp,
  UnmergeOp,
  SetStyleOp,
  SetFormatOp,
  SetRangeOp,
  ApplyResult,
  ApplyOptions,
} from "./operations";

export type {
  HydrationResult,
  RecomputeResult,
  HydrationOptions,
  RecomputeOptions,
} from "./hyperformula";

export type {
  UndoRedoResult,
} from "./undo";

export type {
  UseWorkbookOptions,
  UseWorkbookReturn,
} from "./useWorkbook";

export type {
  LegacyCellData,
} from "./converters";

// ============================================================================
// Adapter Exports
// ============================================================================

export { SheetJSAdapter } from "./adapters/sheetjs";
export { ExcelJSAdapter } from "./adapters/exceljs";

// ============================================================================
// Validation Exports
// ============================================================================

export {
  validateWorkbookFile,
  validateWorkbookString,
  validateWorkbookObject,
} from "./validator";
export type { ValidationResult, ValidationError } from "./validator";

// ============================================================================
// React Hook
// ============================================================================
export { useWorkbook } from "./useWorkbook";
export { useWorkbookLazy } from "./useWorkbookLazy";

// ============================================================================
// Advanced / Low-level Exports
// (Use these only if you need fine-grained control)
// ============================================================================

// Converters
export {
  workbookToCellArray,
  cellArrayToWorkbook,
  getCellDisplayValue,
  createCellFromInput,
} from "./converters";

// HyperFormula Integration (low-level)
export {
  hydrateHFFromWorkbook,
  recomputeAndPatchCache,
  computeWorkbook,
  updateCellsAndRecompute,
  getCellValueFromHF,
  isCellFormula,
  getCellFormulaFromHF,
  formatHFError,
  getHFStats,
  disposeHF,
  DEFAULT_HF_CONFIG,
} from "./hyperformula";

// Undo/Redo (low-level)
export {
  undo,
  redo,
  canUndo,
  canRedo,
  getUndoDepth,
  clearActionLog,
  getRecentActions,
  getActionById,
  getActionsBySheet,
  getActionsByUser,
  getActionLogStats,
} from "./undo";

// ============================================================================
// Test Utilities
// ============================================================================
