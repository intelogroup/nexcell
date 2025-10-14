/**
 * JSON Workbook utilities
 * Comprehensive Excel/Google Sheets compatible workbook operations
 */

import type {
  JSONWorkbook,
  JSONSheet,
  JSONCell,
  CellData,
  CellRange,
  CellFormatting,
  MergedCellRange,
  ConditionalFormat,
  DataValidation,
  Chart,
  CellComment,
} from '@/lib/types';

/**
 * Creates a blank JSON workbook with comprehensive settings
 */
export function createBlankWorkbook(name: string = 'Untitled Workbook'): JSONWorkbook {
  const now = new Date().toISOString();
  const workbookId = crypto.randomUUID();
  const sheetId = crypto.randomUUID();
  
  return {
    version: '1.0.0',
    id: workbookId,
    name,
    author: 'Nexcell User',
    created: now,
    modified: now,
    application: 'Nexcell',
    settings: {
      calcMode: 'auto',
      calcOnSave: true,
      precision: 15,
      date1904: false,
      defaultFontFamily: 'Inter, system-ui, sans-serif',
      defaultFontSize: 11,
    },
    namedRanges: {},
    sheets: [
      {
        id: sheetId,
        name: 'Sheet1',
        position: 0,
        visible: true,
        gridlines: true,
        showHeaders: true,
        rightToLeft: false,
        frozenRows: 0,
        frozenColumns: 0,
        zoom: 100,
        defaultRowHeight: 21,
        defaultColumnWidth: 100,
        rowHeights: {},
        columnWidths: {},
        hiddenRows: [],
        hiddenColumns: [],
        cells: {}, // Sparse storage - only non-empty cells
        mergedCells: [],
        conditionalFormats: [],
        dataValidations: [],
        comments: {},
        charts: [],
        printSettings: {
          paperSize: 'A4',
          orientation: 'portrait',
          margins: {
            top: 0.75,
            right: 0.7,
            bottom: 0.75,
            left: 0.7,
            header: 0.3,
            footer: 0.3,
          },
          scaling: 100,
          gridlines: false,
          blackAndWhite: false,
          draftQuality: false,
          pageOrder: 'downThenOver',
        },
      },
    ],
    metadata: {
      tags: [],
      keywords: [],
      description: '',
    },
  };
}

/**
 * Converts JSON workbook to cell array format for rendering
 */
export function jsonWorkbookToCellArray(
  workbook: JSONWorkbook,
  sheetIndex: number = 0,
  rows: number = 100,
  cols: number = 20
): CellData[][] {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ value: null }))
    );
  }

  const result: CellData[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: null }))
  );

  // Populate cells from sparse JSON storage
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const match = key.match(/^R(\d+)C(\d+)$/);
    if (match) {
      const row = parseInt(match[1], 10);
      const col = parseInt(match[2], 10);
      if (row < rows && col < cols) {
        result[row][col] = {
          value: cell.value ?? null,
          formula: cell.formula,
          formatting: cell.formatting,
        };
      }
    }
  }

  return result;
}

/**
 * Updates a cell in the JSON workbook
 */
export function updateCell(
  workbook: JSONWorkbook,
  sheetIndex: number,
  row: number,
  col: number,
  update: Partial<JSONCell>
): JSONWorkbook {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) return workbook;

  const key = `R${row}C${col}`;
  const existingCell = sheet.cells[key] || {};
  
  // Merge update with existing cell
  const updatedCell: JSONCell = {
    ...existingCell,
    ...update,
  };

  // If cell is now empty, remove it (sparse storage)
  if (!updatedCell.value && !updatedCell.formula && !updatedCell.formatting) {
    delete sheet.cells[key];
  } else {
    sheet.cells[key] = updatedCell;
  }

  return {
    ...workbook,
    modified: new Date().toISOString(),
    sheets: workbook.sheets.map((s, i) => (i === sheetIndex ? sheet : s)),
  };
}

/**
 * Sets a formula in a cell
 */
export function setCellFormula(
  workbook: JSONWorkbook,
  sheetIndex: number,
  row: number,
  col: number,
  formula: string
): JSONWorkbook {
  return updateCell(workbook, sheetIndex, row, col, {
    formula: formula.startsWith('=') ? formula : `=${formula}`,
    value: null, // Clear value when formula is set
  });
}

/**
 * Sets a value in a cell (clears formula)
 */
export function setCellValue(
  workbook: JSONWorkbook,
  sheetIndex: number,
  row: number,
  col: number,
  value: string | number | null
): JSONWorkbook {
  return updateCell(workbook, sheetIndex, row, col, {
    value,
    formula: undefined, // Clear formula when value is set directly
  });
}

/**
 * Clears a range of cells
 */
export function clearRange(
  workbook: JSONWorkbook,
  sheetIndex: number,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): JSONWorkbook {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) return workbook;

  const updatedCells = { ...sheet.cells };
  
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const key = `R${row}C${col}`;
      delete updatedCells[key];
    }
  }

  return {
    ...workbook,
    modified: new Date().toISOString(),
    sheets: workbook.sheets.map((s, i) =>
      i === sheetIndex ? { ...s, cells: updatedCells } : s
    ),
  };
}

/**
 * Exports workbook to JSON string
 */
export function exportWorkbook(workbook: JSONWorkbook): string {
  return JSON.stringify(workbook, null, 2);
}

/**
 * Imports workbook from JSON string
 */
export function importWorkbook(json: string): JSONWorkbook {
  const workbook = JSON.parse(json) as JSONWorkbook;
  
  // Validate basic structure
  if (!workbook.id || !workbook.sheets || !Array.isArray(workbook.sheets)) {
    throw new Error('Invalid workbook format');
  }
  
  return workbook;
}

/**
 * Gets a cell from the workbook
 */
export function getCell(
  workbook: JSONWorkbook,
  sheetIndex: number,
  row: number,
  col: number
): JSONCell | null {
  const sheet = workbook.sheets[sheetIndex];
  if (!sheet) return null;
  
  const key = `R${row}C${col}`;
  return sheet.cells[key] || null;
}

/**
 * Parses a cell reference like "A1" to row/col indices
 */
export function parseCellReference(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  
  const colStr = match[1];
  const rowStr = match[2];
  
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1; // Convert to 0-indexed
  
  const row = parseInt(rowStr, 10) - 1; // Convert to 0-indexed
  
  return { row, col };
}

/**
 * Formats row/col indices to cell reference like "A1"
 */
export function formatCellReference(row: number, col: number): string {
  let colStr = '';
  let c = col + 1; // Convert to 1-indexed
  
  while (c > 0) {
    const mod = (c - 1) % 26;
    colStr = String.fromCharCode(65 + mod) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  
  return `${colStr}${row + 1}`;
}

// ===== Sheet Management =====

/**
 * Adds a new sheet to the workbook
 */
export function addSheet(
  workbook: JSONWorkbook,
  name?: string,
  position?: number
): JSONWorkbook {
  const sheetId = crypto.randomUUID();
  const sheetCount = workbook.sheets.length;
  const sheetName = name || `Sheet${sheetCount + 1}`;
  const sheetPosition = position !== undefined ? position : sheetCount;
  
  const newSheet: JSONSheet = {
    id: sheetId,
    name: sheetName,
    position: sheetPosition,
    visible: true,
    gridlines: true,
    showHeaders: true,
    rightToLeft: false,
    zoom: 100,
    defaultRowHeight: 21,
    defaultColumnWidth: 100,
    rowHeights: {},
    columnWidths: {},
    hiddenRows: [],
    hiddenColumns: [],
    cells: {},
    mergedCells: [],
    conditionalFormats: [],
    dataValidations: [],
    comments: {},
    charts: [],
  };
  
  const sheets = [...workbook.sheets];
  sheets.splice(sheetPosition, 0, newSheet);
  
  // Update positions
  sheets.forEach((sheet, idx) => {
    sheet.position = idx;
  });
  
  return {
    ...workbook,
    sheets,
    modified: new Date().toISOString(),
  };
}

/**
 * Deletes a sheet from the workbook
 */
export function deleteSheet(workbook: JSONWorkbook, sheetId: string): JSONWorkbook {
  if (workbook.sheets.length === 1) {
    throw new Error('Cannot delete the last sheet');
  }
  
  const sheets = workbook.sheets
    .filter((s) => s.id !== sheetId)
    .map((sheet, idx) => ({ ...sheet, position: idx }));
  
  return {
    ...workbook,
    sheets,
    modified: new Date().toISOString(),
  };
}

/**
 * Renames a sheet
 */
export function renameSheet(
  workbook: JSONWorkbook,
  sheetId: string,
  newName: string
): JSONWorkbook {
  const sheets = workbook.sheets.map((sheet) =>
    sheet.id === sheetId ? { ...sheet, name: newName } : sheet
  );
  
  return {
    ...workbook,
    sheets,
    modified: new Date().toISOString(),
  };
}

/**
 * Gets a sheet by ID
 */
export function getSheet(workbook: JSONWorkbook, sheetId: string): JSONSheet | null {
  return workbook.sheets.find((s) => s.id === sheetId) || null;
}

/**
 * Gets a sheet by index
 */
export function getSheetByIndex(workbook: JSONWorkbook, index: number): JSONSheet | null {
  return workbook.sheets[index] || null;
}

// ===== Cell Formatting =====

/**
 * Applies formatting to a range of cells
 */
export function formatCells(
  workbook: JSONWorkbook,
  sheetId: string,
  ranges: CellRange[],
  formatting: CellFormatting
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells = { ...sheet.cells };
  
  ranges.forEach((range) => {
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const key = `R${row}C${col}`;
        const cell = updatedCells[key] || {};
        updatedCells[key] = {
          ...cell,
          formatting: {
            ...cell.formatting,
            ...formatting,
          },
        };
      }
    }
  });
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Clears formatting from a range
 */
export function clearFormatting(
  workbook: JSONWorkbook,
  sheetId: string,
  range: CellRange
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells = { ...sheet.cells };
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const key = `R${row}C${col}`;
      if (updatedCells[key]) {
        const { formatting, ...rest } = updatedCells[key];
        if (Object.keys(rest).length === 0) {
          delete updatedCells[key];
        } else {
          updatedCells[key] = rest;
        }
      }
    }
  }
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Merged Cells =====

/**
 * Merges cells in a range
 */
export function mergeCells(
  workbook: JSONWorkbook,
  sheetId: string,
  range: MergedCellRange
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const mergedCells = [...(sheet.mergedCells || []), range];
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, mergedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Unmerges cells in a range
 */
export function unmergeCells(
  workbook: JSONWorkbook,
  sheetId: string,
  range: MergedCellRange
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const mergedCells = (sheet.mergedCells || []).filter(
    (m) =>
      !(
        m.startRow === range.startRow &&
        m.startCol === range.startCol &&
        m.endRow === range.endRow &&
        m.endCol === range.endCol
      )
  );
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, mergedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Row and Column Operations =====

/**
 * Sets the height of a row
 */
export function setRowHeight(
  workbook: JSONWorkbook,
  sheetId: string,
  row: number,
  height: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const rowHeights = { ...sheet.rowHeights, [row]: height };
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, rowHeights } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Sets the width of a column
 */
export function setColumnWidth(
  workbook: JSONWorkbook,
  sheetId: string,
  col: number,
  width: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const columnWidths = { ...sheet.columnWidths, [col]: width };
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, columnWidths } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Inserts rows at a position
 */
export function insertRows(
  workbook: JSONWorkbook,
  sheetId: string,
  startRow: number,
  count: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells: Record<string, JSONCell> = {};
  
  // Shift existing cells down
  Object.entries(sheet.cells).forEach(([key, cell]) => {
    const match = key.match(/^R(\d+)C(\d+)$/);
    if (match) {
      const row = parseInt(match[1], 10);
      const col = parseInt(match[2], 10);
      
      if (row >= startRow) {
        const newKey = `R${row + count}C${col}`;
        updatedCells[newKey] = cell;
      } else {
        updatedCells[key] = cell;
      }
    }
  });
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Deletes rows at a position
 */
export function deleteRows(
  workbook: JSONWorkbook,
  sheetId: string,
  startRow: number,
  count: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells: Record<string, JSONCell> = {};
  const endRow = startRow + count - 1;
  
  // Remove deleted rows and shift remaining cells up
  Object.entries(sheet.cells).forEach(([key, cell]) => {
    const match = key.match(/^R(\d+)C(\d+)$/);
    if (match) {
      const row = parseInt(match[1], 10);
      const col = parseInt(match[2], 10);
      
      if (row < startRow) {
        updatedCells[key] = cell;
      } else if (row > endRow) {
        const newKey = `R${row - count}C${col}`;
        updatedCells[newKey] = cell;
      }
      // Cells in deleted range are omitted
    }
  });
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Inserts columns at a position
 */
export function insertColumns(
  workbook: JSONWorkbook,
  sheetId: string,
  startCol: number,
  count: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells: Record<string, JSONCell> = {};
  
  // Shift existing cells right
  Object.entries(sheet.cells).forEach(([key, cell]) => {
    const match = key.match(/^R(\d+)C(\d+)$/);
    if (match) {
      const row = parseInt(match[1], 10);
      const col = parseInt(match[2], 10);
      
      if (col >= startCol) {
        const newKey = `R${row}C${col + count}`;
        updatedCells[newKey] = cell;
      } else {
        updatedCells[key] = cell;
      }
    }
  });
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Deletes columns at a position
 */
export function deleteColumns(
  workbook: JSONWorkbook,
  sheetId: string,
  startCol: number,
  count: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells: Record<string, JSONCell> = {};
  const endCol = startCol + count - 1;
  
  // Remove deleted columns and shift remaining cells left
  Object.entries(sheet.cells).forEach(([key, cell]) => {
    const match = key.match(/^R(\d+)C(\d+)$/);
    if (match) {
      const row = parseInt(match[1], 10);
      const col = parseInt(match[2], 10);
      
      if (col < startCol) {
        updatedCells[key] = cell;
      } else if (col > endCol) {
        const newKey = `R${row}C${col - count}`;
        updatedCells[newKey] = cell;
      }
      // Cells in deleted range are omitted
    }
  });
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Conditional Formatting =====

/**
 * Adds a conditional format rule
 */
export function addConditionalFormat(
  workbook: JSONWorkbook,
  sheetId: string,
  format: ConditionalFormat
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const conditionalFormats = [...(sheet.conditionalFormats || []), format];
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, conditionalFormats } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Removes a conditional format rule
 */
export function removeConditionalFormat(
  workbook: JSONWorkbook,
  sheetId: string,
  formatId: string
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const conditionalFormats = (sheet.conditionalFormats || []).filter(
    (f) => f.id !== formatId
  );
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, conditionalFormats } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Data Validation =====

/**
 * Adds a data validation rule
 */
export function addDataValidation(
  workbook: JSONWorkbook,
  sheetId: string,
  validation: DataValidation
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const dataValidations = [...(sheet.dataValidations || []), validation];
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, dataValidations } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Charts =====

/**
 * Adds a chart to the sheet
 */
export function addChart(
  workbook: JSONWorkbook,
  sheetId: string,
  chart: Chart
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const charts = [...(sheet.charts || []), chart];
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, charts } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Removes a chart from the sheet
 */
export function removeChart(
  workbook: JSONWorkbook,
  sheetId: string,
  chartId: string
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const charts = (sheet.charts || []).filter((c) => c.id !== chartId);
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, charts } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Comments =====

/**
 * Adds a comment to a cell
 */
export function addComment(
  workbook: JSONWorkbook,
  sheetId: string,
  row: number,
  col: number,
  comment: CellComment
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const key = `R${row}C${col}`;
  const comments = { ...sheet.comments, [key]: comment };
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, comments } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Removes a comment from a cell
 */
export function removeComment(
  workbook: JSONWorkbook,
  sheetId: string,
  row: number,
  col: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const key = `R${row}C${col}`;
  const comments = { ...sheet.comments };
  delete comments[key];
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, comments } : s
    ),
    modified: new Date().toISOString(),
  };
}

// ===== Utility Functions =====

/**
 * Parses a range reference like "A1:B10" to row/col indices
 */
export function parseRangeReference(ref: string): CellRange | null {
  const parts = ref.split(':');
  if (parts.length !== 2) return null;
  
  const start = parseCellReference(parts[0]);
  const end = parseCellReference(parts[1]);
  
  if (!start || !end) return null;
  
  return {
    startRow: start.row,
    startCol: start.col,
    endRow: end.row,
    endCol: end.col,
  };
}

/**
 * Formats a range to reference format like "A1:B10"
 */
export function formatRangeReference(range: CellRange): string {
  const start = formatCellReference(range.startRow, range.startCol);
  const end = formatCellReference(range.endRow, range.endCol);
  return `${start}:${end}`;
}

/**
 * Gets all cells in a range
 */
export function getCellsInRange(
  workbook: JSONWorkbook,
  sheetId: string,
  range: CellRange
): Array<{ row: number; col: number; cell: JSONCell | null }> {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return [];
  
  const cells: Array<{ row: number; col: number; cell: JSONCell | null }> = [];
  
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      const key = `R${row}C${col}`;
      cells.push({
        row,
        col,
        cell: sheet.cells[key] || null,
      });
    }
  }
  
  return cells;
}

/**
 * Copies a range of cells
 */
export function copyRange(
  workbook: JSONWorkbook,
  sheetId: string,
  sourceRange: CellRange,
  targetRow: number,
  targetCol: number
): JSONWorkbook {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) return workbook;
  
  const updatedCells = { ...sheet.cells };
  const rowOffset = targetRow - sourceRange.startRow;
  const colOffset = targetCol - sourceRange.startCol;
  
  const sourceCells = getCellsInRange(workbook, sheetId, sourceRange);
  
  sourceCells.forEach(({ row, col, cell }) => {
    if (cell) {
      const newRow = row + rowOffset;
      const newCol = col + colOffset;
      const newKey = `R${newRow}C${newCol}`;
      updatedCells[newKey] = { ...cell };
    }
  });
  
  return {
    ...workbook,
    sheets: workbook.sheets.map((s) =>
      s.id === sheetId ? { ...s, cells: updatedCells } : s
    ),
    modified: new Date().toISOString(),
  };
}

/**
 * Gets workbook statistics
 */
export function getWorkbookStats(workbook: JSONWorkbook): {
  sheetCount: number;
  totalCells: number;
  totalFormulas: number;
  fileSize: number;
} {
  const totalCells = workbook.sheets.reduce(
    (sum, sheet) => sum + Object.keys(sheet.cells).length,
    0
  );
  
  const totalFormulas = workbook.sheets.reduce(
    (sum, sheet) =>
      sum +
      Object.values(sheet.cells).filter((cell) => cell.formula).length,
    0
  );
  
  const fileSize = new Blob([JSON.stringify(workbook)]).size;
  
  return {
    sheetCount: workbook.sheets.length,
    totalCells,
    totalFormulas,
    fileSize,
  };
}
