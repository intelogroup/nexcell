// Core types for Nexcell - Comprehensive Excel/Google Sheets compatible format

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  action?: WorkbookAction; // Optional action that modifies workbook
}

export interface CellData {
  value: string | number | boolean | null;
  formula?: string;
  formatting?: CellFormatting;
  dataType?: CellDataType;
}

export type CellDataType = 'string' | 'number' | 'boolean' | 'date' | 'error' | 'formula';

export interface CellFormatting {
  // Font styling
  bold?: boolean;
  italic?: boolean;
  underline?: boolean | 'single' | 'double';
  strikethrough?: boolean;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  
  // Background
  backgroundColor?: string;
  
  // Alignment
  horizontalAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrapText?: boolean;
  textRotation?: number; // degrees
  
  // Borders
  borderTop?: BorderStyle;
  borderRight?: BorderStyle;
  borderBottom?: BorderStyle;
  borderLeft?: BorderStyle;
  
  // Number formatting
  numberFormat?: string; // e.g., "0.00", "#,##0", "mm/dd/yyyy"
  
  // Cell protection
  locked?: boolean;
  hidden?: boolean;
}

export interface BorderStyle {
  style?: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';
  color?: string;
}

export interface Viewport {
  scrollTop: number;
  scrollLeft: number;
  width: number;
  height: number;
}

export interface WorkbookData {
  id: string;
  name: string;
  cells: CellData[][];
  lastModified: Date;
}

export type CellPosition = {
  row: number;
  col: number;
};

// ===== Comprehensive JSON Workbook Format =====
// Excel/Google Sheets compatible structure

export interface JSONWorkbook {
  version: string;
  id: string;
  name: string;
  author?: string;
  created: string;
  modified: string;
  application?: string; // e.g., "Nexcell", "Excel", "Google Sheets"
  
  // Workbook-level settings
  settings?: WorkbookSettings;
  
  // Named ranges (e.g., "SalesData" = "Sheet1!A1:D10")
  namedRanges?: Record<string, NamedRange>;
  
  // Sheets
  sheets: JSONSheet[];
  
  // Metadata
  metadata?: WorkbookMetadata;
}

export interface WorkbookSettings {
  calcMode?: 'auto' | 'manual'; // Calculation mode
  calcOnSave?: boolean;
  precision?: number; // Decimal precision
  date1904?: boolean; // Mac Excel date system
  defaultFontFamily?: string;
  defaultFontSize?: number;
}

export interface WorkbookMetadata {
  tags?: string[];
  category?: string;
  keywords?: string[];
  description?: string;
  company?: string;
  lastModifiedBy?: string;
}

export interface NamedRange {
  name: string;
  reference: string; // e.g., "Sheet1!A1:D10"
  scope?: string; // 'workbook' or sheet ID for sheet-level names
  comment?: string;
}

export interface JSONSheet {
  id: string;
  name: string;
  position: number;
  visible?: boolean;
  color?: string; // Tab color
  
  // Sheet protection
  protected?: boolean;
  protectionPassword?: string; // Hashed
  
  // Grid settings
  gridlines?: boolean;
  showHeaders?: boolean;
  rightToLeft?: boolean;
  
  // Frozen panes
  frozenRows?: number;
  frozenColumns?: number;
  
  // Zoom level (percentage)
  zoom?: number;
  
  // Default row height and column width
  defaultRowHeight?: number;
  defaultColumnWidth?: number;
  
  // Custom row heights (sparse storage)
  rowHeights?: Record<number, number>;
  
  // Custom column widths (sparse storage)
  columnWidths?: Record<number, number>;
  
  // Hidden rows and columns
  hiddenRows?: number[];
  hiddenColumns?: number[];
  
  // Cells (sparse storage - only non-empty cells)
  cells: Record<string, JSONCell>; // Key format: "R0C0" (row 0, col 0)
  
  // Merged cells
  mergedCells?: MergedCellRange[];
  
  // Conditional formatting rules
  conditionalFormats?: ConditionalFormat[];
  
  // Data validations
  dataValidations?: DataValidation[];
  
  // Filters
  autoFilter?: AutoFilter;
  
  // Charts
  charts?: Chart[];
  
  // Comments/Notes
  comments?: Record<string, CellComment>; // Key format: "R0C0"
  
  // Print settings
  printSettings?: PrintSettings;
}

export interface JSONCell {
  // Value (for display)
  value?: string | number | boolean | null;
  
  // Formula (starts with '=')
  formula?: string;
  
  // Data type
  dataType?: CellDataType;
  
  // Formatting
  formatting?: CellFormatting;
  
  // Hyperlink
  hyperlink?: string;
  
  // Note/Comment reference
  note?: string;
}

export interface MergedCellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface ConditionalFormat {
  id: string;
  priority: number;
  ranges: CellRange[];
  rule: ConditionalFormatRule;
  formatting: CellFormatting;
  stopIfTrue?: boolean;
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export type ConditionalFormatRule = 
  | { type: 'cellValue'; operator: 'greaterThan' | 'lessThan' | 'equal' | 'notEqual' | 'between'; values: (string | number)[] }
  | { type: 'formula'; formula: string }
  | { type: 'colorScale'; minColor: string; midColor?: string; maxColor: string }
  | { type: 'dataBar'; color: string; showValue?: boolean }
  | { type: 'iconSet'; iconSet: string; showValue?: boolean }
  | { type: 'top10'; rank: number; bottom?: boolean }
  | { type: 'aboveAverage'; aboveAverage: boolean }
  | { type: 'duplicateValues'; unique?: boolean }
  | { type: 'textContains'; text: string };

export interface DataValidation {
  ranges: CellRange[];
  rule: DataValidationRule;
  showInputMessage?: boolean;
  inputTitle?: string;
  inputMessage?: string;
  showErrorMessage?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  errorStyle?: 'stop' | 'warning' | 'information';
}

export type DataValidationRule =
  | { type: 'list'; source: string[]; allowBlank?: boolean }
  | { type: 'number'; operator: 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'; values: number[]; allowBlank?: boolean }
  | { type: 'date'; operator: string; values: string[]; allowBlank?: boolean }
  | { type: 'textLength'; operator: string; values: number[]; allowBlank?: boolean }
  | { type: 'custom'; formula: string };

export interface AutoFilter {
  range: CellRange;
  filters: Record<number, ColumnFilter>; // Column index to filter
}

export interface ColumnFilter {
  type: 'values' | 'custom';
  values?: (string | number)[];
  customFilter?: {
    operator: 'and' | 'or';
    conditions: FilterCondition[];
  };
}

export interface FilterCondition {
  operator: 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'contains' | 'startsWith' | 'endsWith';
  value: string | number;
}

export interface Chart {
  id: string;
  type: 'line' | 'bar' | 'column' | 'pie' | 'scatter' | 'area' | 'doughnut' | 'radar';
  title?: string;
  position: ChartPosition;
  dataRanges: ChartDataRange[];
  xAxisTitle?: string;
  yAxisTitle?: string;
  legend?: {
    position: 'top' | 'bottom' | 'left' | 'right' | 'none';
  };
  style?: ChartStyle;
}

export interface ChartPosition {
  row: number;
  col: number;
  width: number;
  height: number;
}

export interface ChartDataRange {
  name?: string;
  xValues?: string; // Range reference
  yValues: string; // Range reference
  color?: string;
}

export interface ChartStyle {
  colors?: string[];
  fontSize?: number;
  fontFamily?: string;
}

export interface CellComment {
  author: string;
  text: string;
  timestamp: string;
  replies?: CellComment[];
}

export interface PrintSettings {
  paperSize?: string;
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    header: number;
    footer: number;
  };
  scaling?: number; // percentage
  fitToPage?: {
    width: number;
    height: number;
  };
  printArea?: CellRange;
  printTitles?: {
    rows?: string; // e.g., "1:2"
    columns?: string; // e.g., "A:B"
  };
  gridlines?: boolean;
  blackAndWhite?: boolean;
  draftQuality?: boolean;
  pageOrder?: 'downThenOver' | 'overThenDown';
  headerFooter?: {
    header?: string;
    footer?: string;
  };
}

// AI Actions
export type WorkbookAction = 
  | { type: 'setCellValue'; sheetId: string; row: number; col: number; value: string | number | boolean }
  | { type: 'setCellFormula'; sheetId: string; row: number; col: number; formula: string }
  | { type: 'setRange'; sheetId: string; startRow: number; startCol: number; endRow: number; endCol: number; values: (string | number | boolean)[][] }
  | { type: 'setFormulaRange'; sheetId: string; startRow: number; startCol: number; endRow: number; endCol: number; formulas: string[][] }
  | { type: 'clearRange'; sheetId: string; startRow: number; startCol: number; endRow: number; endCol: number }
  | { type: 'formatCells'; sheetId: string; ranges: CellRange[]; formatting: CellFormatting }
  | { type: 'mergeCells'; sheetId: string; range: MergedCellRange }
  | { type: 'unmergeCells'; sheetId: string; range: MergedCellRange }
  | { type: 'addSheet'; name: string; position?: number }
  | { type: 'deleteSheet'; sheetId: string }
  | { type: 'renameSheet'; sheetId: string; name: string }
  | { type: 'insertRows'; sheetId: string; startRow: number; count: number }
  | { type: 'deleteRows'; sheetId: string; startRow: number; count: number }
  | { type: 'insertColumns'; sheetId: string; startCol: number; count: number }
  | { type: 'deleteColumns'; sheetId: string; startCol: number; count: number }
  | { type: 'setColumnWidth'; sheetId: string; col: number; width: number }
  | { type: 'setRowHeight'; sheetId: string; row: number; height: number }
  | { type: 'addConditionalFormat'; sheetId: string; format: ConditionalFormat }
  | { type: 'addDataValidation'; sheetId: string; validation: DataValidation }
  | { type: 'addChart'; sheetId: string; chart: Chart }
  | { type: 'addComment'; sheetId: string; row: number; col: number; comment: CellComment };
