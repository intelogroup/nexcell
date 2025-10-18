/**
 * Workbook JSON Schema v1.0
 * Single source of truth for spreadsheet data, formulas, and metadata
 * 
 * MVP Focus: Core spreadsheet functionality (cells, formulas, merges, styles)
 * Phase 2: Charts, pivots, images, advanced conditional formatting
 */

// ============================================================================
// Core Cell Types
// ============================================================================

export type CellDataType = "string" | "number" | "boolean" | "date" | "formula" | "error";
export type SheetJSType = "n" | "s" | "b" | "e" | "d"; // number, string, bool, error, date

// Column keys are Excel-style letters (A, B, ... AA, AB) used by adapters for mapping to SheetJS '!cols'
export type ColumnKey = string;
// Row keys are 1-based row numbers represented as strings to map to SheetJS '!rows'
export type RowKey = string;

export interface BorderStyle {
  style?: "thin" | "medium" | "thick" | "dashed" | "dotted" | "double";
  color?: string;
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  bgColor?: string;
  fontSize?: number;
  fontFamily?: string;
  alignment?: {
    horizontal?: "left" | "center" | "right" | "justify";
    vertical?: "top" | "middle" | "bottom";
    // (named ranges are implemented)
    wrapText?: boolean;
    indent?: number;
  };
  border?: {
    top?: BorderStyle;
    bottom?: BorderStyle;
    left?: BorderStyle;
    right?: BorderStyle;
  };
}

export interface ComputedValue {
  v: string | number | boolean | null | Date; // computed result (dates allowed)
  t?: SheetJSType; // SheetJS type hint
  ts: string; // timestamp (ISO)
  hfVersion?: string; // HyperFormula version used
  stale?: boolean; // true if computed value is stale due to hfVersion mismatch
  computedBy?: string; // "client-uuid" | "server" | "hf-x.y.z"
  error?: string; // error message if formula failed
}

export interface HyperFormulaInternal {
  sheetId: number; // HF's internal sheet ID (0-based)
  row: number; // 0-based row index
  col: number; // 0-based col index
  formulaId?: string; // optional HF formula ID for batch updates
}

export interface Cell {
  // User input
  raw?: string | number | boolean | null; // what user typed
  dataType?: CellDataType; // explicit data type

  // Formula info
  formula?: string; // formula string (canonical source of truth)
  hfInternal?: HyperFormulaInternal; // HyperFormula's internal representation

  // Computed cache (optional but recommended)
  computed?: ComputedValue;

  // Formatting
  numFmt?: string; // number format code: "#,##0.00", "mm/dd/yyyy"
  style?: CellStyle; // visual styling
  hyperlink?: { url: string; tooltip?: string };
  /**
   * Rich text runs inside a single cell. Each run can specify its own styling.
   * This is optional and preserved when exporting to formats that support rich text.
   */
  richText?: RichTextRun[];

  // Metadata
  notes?: string; // plain note (not rendered as comment)
  metadata?: Record<string, any>; // extensible metadata
  readOnly?: boolean;

  // Advanced features (optional)
  validation?: DataValidation; // cell-level validation reference
  conditionalFormatRuleId?: string; // reference to sheet-level rule
  arrayFormula?: boolean; // true if anchor of spilled array
  spilledFrom?: string; // "A1" — if part of spilled range
  /**
   * Full spill range for array formulas (stored on the anchor cell).
   * Example: "A1:C10". Used to block edits on spilled-over cells and
   * for correct roundtrip export to XLSX.
   */
  arrayRange?: string; // "A1:C10" — full spill range (only on anchor cell)
  /**
   * Whether the cell is locked for editing when the sheet is protected.
   */
  locked?: boolean;
}

export interface RichTextRun {
  text: string;
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;
    fontFamily?: string;
    fontSize?: number;
  };
}

// ============================================================================
// Sheet-level Types
// ============================================================================

export interface RowMetadata {
  height?: number;
  hidden?: boolean;
}

export interface ColMetadata {
  width?: number;
  hidden?: boolean;
}

export interface DataValidation {
  id?: string;
  range?: string; // "A1:B10"
  type: "list" | "whole" | "decimal" | "date" | "textLength" | "custom";
  operator?: "between" | "notBetween" | "equal" | "notEqual" | "greaterThan" | "lessThan" | "greaterThanOrEqual" | "lessThanOrEqual";
  values?: string[]; // for list validation
  formula1?: string;
  formula2?: string;
  showError?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  showInputMessage?: boolean;
  inputTitle?: string;
  inputMessage?: string;
}

/**
 * Conditional formatting rule (Phase 2)
 * @experimental - Defer to Phase 2 for MVP
 */
export interface ConditionalFormat {
  id: string;
  range: string; // "A1:C10"
  type: "expression" | "cellIs" | "colorScale" | "dataBar" | "iconSet" | "top10" | "duplicateValues" | "uniqueValues";
  priority?: number;
  stopIfTrue?: boolean;
  // Rule-specific config
  formula?: string;
  operator?: string;
  values?: any[];
  colorScale?: { min?: string; mid?: string; max?: string };
  style?: CellStyle;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  modifiedAt?: string;
  resolved?: boolean;
  replies?: Comment[];
}

/**
 * Chart metadata (Phase 2)
 * @experimental - Defer to Phase 2 for MVP
 * Note: When implementing, consider server-side PNG generation for XLSX export
 */
export interface ChartMetadata {
  id: string;
  type: "line" | "bar" | "pie" | "scatter" | "area" | "combo";
  title?: string;
  dataRange: string; // "Sheet1!A1:C10"
  xAxis?: { title?: string; range?: string };
  yAxis?: { title?: string; range?: string };
  series?: Array<{ name: string; range: string; color?: string }>;
  position?: { anchor: string; width?: number; height?: number };
  options?: Record<string, any>;
}

/**
 * Pivot table metadata (Phase 2)
 * @experimental - Defer to Phase 2 for MVP
 */
export interface PivotTableMetadata {
  id: string;
  name: string;
  sourceRange: string; // "Sheet1!A1:D100"
  targetCell: string; // "A1"
  rows?: string[];
  cols?: string[];
  values?: Array<{ field: string; aggregation: "sum" | "count" | "average" | "min" | "max" }>;
  filters?: Record<string, any>;
}

/**
 * Image metadata (Phase 2)
 * @experimental - Defer to Phase 2 for MVP
 */
export interface ImageMetadata {
  id: string;
  anchor: {
    type: "oneCell" | "twoCell";
    from: string; // "A1"
    to?: string; // "C3" for twoCell
  };
  dataUrl?: string; // base64 or external URL
  alt?: string;
  metadata?: Record<string, any>;
}

export interface SheetProperties {
  tabColor?: string;
  defaultRowHeight?: number;
  defaultColWidth?: number;
  freeze?: { row?: number; col?: number }; // freeze rows above/cols left of
  zoom?: number; // 100 = 100%
  gridLines?: boolean;
  showHeaders?: boolean;
  rtl?: boolean; // right-to-left
}

/**
 * Freeze panes helper (explicitly stored on sheet for easier export mapping)
 */
export interface FreezePanes {
  row?: number; // number of frozen rows (rows above this index are frozen)
  col?: number; // number of frozen columns (cols left of this index are frozen)
}

export interface FilterCriteria {
  column: string; // e.g. "A"
  operator: "equals" | "contains" | "greaterThan" | "lessThan" | "in" | "notIn";
  value?: any;
}

export interface AutoFilter {
  range: string; // "A1:D100"
  filters?: FilterCriteria[];
}

export interface SheetProtection {
  enabled: boolean;
  passwordHash?: string; // hashed password (server-side verification recommended)
  allowFormatCells?: boolean;
  allowFormatColumns?: boolean;
  allowFormatRows?: boolean;
  allowInsertColumns?: boolean;
  allowInsertRows?: boolean;
  allowDeleteColumns?: boolean;
  allowDeleteRows?: boolean;
  allowSort?: boolean;
  allowFilter?: boolean;
}

export interface SheetJSON {
  id: string; // Persistent UUID
  name: string;
  /**
   * Sheet visibility. `visible` is kept for backward compatibility; prefer `visibility`.
   */
  visible?: boolean; // Default: true (DEPRECATED: prefer `visibility`)
  visibility?: "visible" | "hidden" | "veryHidden"; // Excel supports veryHidden
  grid?: { rowCount: number; colCount: number }; // Default: 1000x50
  
  // Cell data (sparse storage - only non-empty cells)
  rows?: Record<number, RowMetadata>; // 1-based row numbers
  cols?: Record<number, ColMetadata>; // 1-based col numbers
  cells?: Record<string, Cell>; // "A1", "B2", etc. (address-based for Excel compat)
  
  // Core features (MVP)
  mergedRanges?: string[]; // ["A1:B2", "C3:D4"]
  /**
   * Sheet-scoped named ranges. Kept as string for compatibility but may be a richer
   * NamedRange object for future-proofing.
   */
  namedRanges?: Record<string, string | NamedRange>; // Sheet-scoped: { "MyRange": "A1:B10" }
  comments?: Record<string, Comment[]>; // { "A1": [comment1, comment2] }
  
  // Advanced features (MVP - basic support)
  filters?: { range?: string; columns?: Record<number, any> };
  sorts?: Array<{ column: string; ascending: boolean }>;
  dataValidations?: DataValidation[];
  // Explicit column/row sizing for export parity with Excel
  // Map keys use column letters for `columnWidths` and 1-based row numbers as strings for `rowHeights`.
  // These map directly to SheetJS sheet['!cols'] (wch) and sheet['!rows'] (hpx) when exporting.
  columnWidths?: Record<ColumnKey, number>; // { "A": 120, "B": 80 } in characters (wch)
  rowHeights?: Record<RowKey, number>; // { "1": 25, "2": 30 } in pixels (hpx)

  // Freeze panes and autofilter
  freezePanes?: FreezePanes;
  autoFilter?: AutoFilter;
  
  // Phase 2 features (deferred)
  conditionalFormats?: ConditionalFormat[]; // @experimental
  charts?: ChartMetadata[]; // @experimental
  pivots?: PivotTableMetadata[]; // @experimental
  images?: ImageMetadata[]; // @experimental
  
  // Sheet settings
  protection?: SheetProtection;
  properties?: SheetProperties;
}

// ============================================================================
// Workbook-level Types
// ============================================================================

export interface WorkbookMeta {
  title?: string;
  author?: string;
  company?: string;
  createdAt: string; // ISO 8601 timestamp
  modifiedAt: string; // ISO 8601 timestamp
  description?: string;
  tags?: string[];
  locale?: string; // e.g., "en-US" for date/number formatting
  timezone?: string; // e.g., "America/New_York" for date serialization
  /**
   * Excel date system used when exporting/importing workbooks.
   * "1900" is the default for Windows Excel; "1904" is used by older Mac
   * workbooks. Affects numeric date serialization.
   */
  dateSystem?: "1900" | "1904";
}

export interface WorkbookProperties {
  defaultRowHeight?: number; // Default: 21
  defaultColWidth?: number; // Default: 100
  workbookView?: {
    firstSheet?: number; // 0-based index
    activeTab?: number; // 0-based index
  };
}

/**
 * Workbook-scoped named ranges and settings
 */
export interface GlobalSettings {
  /**
   * Workbook-scoped named ranges. Keys are the friendly names and values are
   * either a string formula/ref or a richer NamedRange object.
   */
  namedRanges?: Record<string, string | NamedRange>; // workbook-scoped: { "TaxRate": "Sheet1!$A$1" }
  externalLinks?: Array<{ id: string; path: string; type: string }>; // @experimental Phase 2
  scripts?: Array<{ id: string; name: string; code: string }>; // @experimental Phase 2
  theme?: Record<string, any>; // @experimental Phase 2
}

export type CalculationMode = "auto" | "manual" | "autoNoTable";

export interface NamedRange {
  name: string;
  scope?: "workbook" | string; // if string, should be sheet id
  ref: string; // e.g., "Sheet1!$A$1:$A$10" or a formula like "=Sheet1!$A$1"
  comment?: string;
  /**
   * Whether the named range is hidden from the UI. Excel supports hidden
   * named ranges which are not shown in the Name Manager.
   */
  hidden?: boolean;
}

export interface ExternalReference {
  id: string;
  path: string; // file path or workbook name e.g., "[OtherBook.xlsx]"
  sheets?: string[]; // referenced sheet names
}

/**
 * HyperFormula computed cache and dependency tracking
 * Critical for performance - avoids recomputing entire workbook on every change
 */
export interface ComputedCache {
  hfCache?: Record<string, ComputedValue>; // "Sheet1!A1" -> computed value
  dependencyGraph?: Record<string, string[]>; // "Sheet1!A1" -> ["Sheet1!B1", "Sheet1!C1"]
}

/**
 * Action for undo/redo system
 * Each action is atomic and includes its inverse for rollback
 */
export interface Action {
  id: string; // UUID
  type: "editCell" | "deleteCell" | "insertRow" | "deleteRow" | "insertCol" | "deleteCol" | "merge" | "unmerge" | "setStyle" | "setFormat" | "setRange" | "addSheet" | "deleteSheet" | "setStyleProps" | "setColor";
  timestamp: string; // ISO 8601
  user?: string; // User ID or session ID
  sheetId: string; // Which sheet was affected
  payload: any; // Type-specific data (row, col, value, etc.)
  inverse?: Action; // Inverse action for undo (same structure, opposite effect)
}

/**
 * Action log for undo/redo stack
 * Maintains pointer for current position in history
 */
export interface ActionLog {
  actions: Action[]; // Ordered list of actions (oldest to newest)
  currentIndex: number; // Pointer for undo/redo (-1 = no actions, 0 = first action)
  maxSize?: number; // Max actions to keep in memory (default: 100, archive older)
}

/**
 * Root workbook structure
 * This is the single source of truth for all spreadsheet data
 */
export interface WorkbookJSON {
  schemaVersion: string; // "1.0" - bump on breaking changes
  workbookId: string; // Persistent UUID
  meta: WorkbookMeta; // Metadata (title, author, timestamps, etc.)
  sheets: SheetJSON[]; // Array of sheets (at least one required)
  workbookProperties?: WorkbookProperties; // Workbook-level settings
  /**
   * Workbook-level named ranges (rich objects). Keys are the friendly names.
   */
  namedRanges?: Record<string, string | NamedRange>;
  calculationMode?: CalculationMode;
  externalReferences?: ExternalReference[];
  computed?: ComputedCache; // HyperFormula cache and dependency graph
  actionLog?: Action[]; // Undo/redo stack (simplified from nested ActionLog for easier iteration)
  // Optional runtime HyperFormula hydration reference. Kept as `any` to avoid
  // circular type dependencies; consumers should treat this as opaque and use
  // the helper functions in the `hyperformula` module to manage lifecycle.
  hf?: any | null;

  // Export metadata
  exportWarnings?: string[]; // Warnings from export operations about unsupported features

  // Phase 2 features (deferred)
  aiPlans?: Record<string, any>; // @experimental - Plan/Act design integration
  global?: GlobalSettings; // @experimental - External links, scripts, themes
}

// ============================================================================
// Export Adapter Interface
// ============================================================================

/**
 * Result of export validation
 * Tracks which features were successfully exported and which were skipped
 */
export interface ExportResult {
  buffer: ArrayBuffer;
  warnings?: string[]; // Features that couldn't be exported
  metadata?: {
    exportedSheets: number;
    exportedCells: number;
    exportedFormulas: number;
    skippedFeatures?: string[]; // e.g., ["charts", "pivots"]
  };
}

/**
 * Options to control export behavior
 */
export interface ExportOptions {
  /**
   * If true, when precheck detects missing computed values the adapter may
   * trigger a recompute (recomputeAndPatchCache) before performing the export.
   * Default: false (opt-in because recompute can be expensive).
   */
  autoRecomputeOnExportWarning?: boolean;
}

/**
 * Export adapter interface for different file formats
 * Allows swapping export engines without touching core code
 */
export interface ExportAdapter {
  /**
   * Export workbook to binary format (XLSX, CSV, etc.)
   * Should preserve formulas (f) and computed values (v) for Excel compatibility
   */
  export(workbook: WorkbookJSON, options?: ExportOptions): Promise<ArrayBuffer>;

  /**
   * Import binary format to workbook JSON
   * Should preserve formulas and attempt to extract computed values
   */
  import(data: Blob | ArrayBuffer): Promise<WorkbookJSON>;

  /**
   * Adapter name for debugging and UI display
   */
  readonly name: string;

  /**
   * File extension (e.g., "xlsx", "csv")
   */
  readonly extension: string;

  /**
   * MIME type for downloads
   */
  readonly mimeType: string;

  /**
   * Supported features (for capability detection and UI hints)
   * MVP focus: formulas, merges, basic styles
   */
  readonly features: {
    formulas: boolean; // Can preserve formula strings
    formulaCache: boolean; // Can write computed values alongside formulas
    styles: boolean; // Font, fill, borders, alignment
    merges: boolean; // Merged cell ranges
    comments: boolean; // Cell comments/notes
    dataValidations: boolean; // Data validation rules
    conditionalFormats: boolean; // Conditional formatting (Phase 2)
    charts: boolean; // Chart objects (Phase 2)
    images: boolean; // Embedded images (Phase 2)
    namedRanges: boolean; // Named range support
    columnWidths: boolean; // Column width preservation
    rowHeights: boolean; // Row height preservation
  };
}

// ============================================================================
// Validation and Error Types
// ============================================================================

/**
 * Validation result for workbook structure
 * Used by basic TypeScript validation (no JSON Schema for MVP)
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string; // JSONPath-like: "sheets[0].cells.A1.formula"
  message: string;
  severity: "error" | "warning";
}

// ============================================================================
// Type Summary & Usage Guidelines
// ============================================================================

/**
 * MVP TYPE HIERARCHY
 * 
 * WorkbookJSON (root)
 * ├── schemaVersion: "1.0"
 * ├── workbookId: UUID
 * ├── meta: WorkbookMeta (title, author, timestamps, locale)
 * ├── sheets: SheetJSON[] (at least one required)
 * │   └── SheetJSON
 * │       ├── id: UUID (persistent)
 * │       ├── name: string
 * │       ├── cells: Record<string, Cell> (address-based: "A1", "B2")
 * │       │   └── Cell
 * │       │       ├── raw?: user input
 * │       │       ├── formula?: "=SUM(A1:A10)"
 * │       │       ├── computed?: ComputedValue (HF cache)
 * │       │       ├── numFmt?: Excel format code
 * │       │       ├── style?: CellStyle
 * │       │       └── hfInternal?: HyperFormula coords
 * │       ├── mergedRanges?: ["A1:B2"]
 * │       ├── rows?: Record<number, RowMetadata>
 * │       ├── cols?: Record<number, ColMetadata>
 * │       └── properties?: SheetProperties
 * ├── computed?: ComputedCache (HF cache + dependency graph)
 * ├── actionLog?: Action[] (undo/redo stack)
 * └── namedRanges?: Record<string, string>
 * 
 * CRITICAL PATTERNS FOR MVP:
 * 
 * 1. Formula + Computed Cache Pattern
 *    - ALWAYS store user formula in `cell.formula`
 *    - ALWAYS store computed result in `cell.computed.v`
 *    - ALWAYS write both `f` and `v` to XLSX for Excel compatibility
 *    - Track `hfVersion` and `computedBy` for cache invalidation
 * 
 * 2. Address-Based Cell Keys
 *    - Use Excel notation: "A1", "B2", "AA100"
 *    - Direct mapping to SheetJS/ExcelJS APIs
 *    - No coordinate translation overhead
 * 
 * 3. HyperFormula Integration
 *    - Store HF internals in `cell.hfInternal` for fast rehydration
 *    - Maintain workbook-level cache in `computed.hfCache`
 *    - Track dependencies in `computed.dependencyGraph`
 * 
 * 4. Action Log for Undo/Redo
 *    - Each Action includes `payload` and optional `inverse`
 *    - Array of actions (oldest to newest)
 *    - Apply inverse to undo, reapply forward to redo
 * 
 * 5. Sparse Storage
 *    - Only store non-empty cells in `cells` Record
 *    - Only store non-default row heights in `rows`
 *    - Only store non-default col widths in `cols`
 * 
 * DEFERRED TO PHASE 2:
 * - Charts, pivots, images (marked @experimental)
 * - Advanced conditional formatting
 * - External links and scripts
 * - JSON Schema validation (use TypeScript only for MVP)
 * - Server-side validation and permissions
 * - Compression and performance optimization
 * 
 * EXPORT ADAPTER CONTRACTS:
 * - SheetJS: Basic export (formulas, merges, widths, heights)
 * - ExcelJS: Rich export (styles, comments, validations) - Phase 2
 * - Must preserve formula strings AND computed values
 * - Must handle features gracefully (skip unsupported, add warnings)
 */
