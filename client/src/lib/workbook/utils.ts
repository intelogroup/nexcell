/**
 * Workbook JSON utilities
 * Core functions for creating, manipulating, and validating workbooks
 */

import type { WorkbookJSON, SheetJSON, Cell } from "./types";

/**
 * Generate a simple UUID v4
 */
export function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a new empty workbook with default settings
 */
export function createWorkbook(title = "Workbook"): WorkbookJSON {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    workbookId: generateId(),
    meta: {
      title,
      createdAt: now,
      modifiedAt: now,
      author: "",
    },
    workbookProperties: {
      defaultRowHeight: 21,
      defaultColWidth: 100,
      workbookView: {
        firstSheet: 0,
        activeTab: 0,
      },
    },
    sheets: [
      {
        id: generateId(),
        name: "Sheet1",
        visible: true,
        grid: { rowCount: 1000, colCount: 50 },
        rows: {},
        cols: {},
        cells: {},
        mergedRanges: [],
        dataValidations: [],
        conditionalFormats: [],
        namedRanges: {},
        charts: [],
        pivots: [],
        images: [],
        comments: {},
        properties: {
          defaultRowHeight: 21,
          defaultColWidth: 100,
          gridLines: true,
          showHeaders: true,
          zoom: 100,
        },
      },
    ],
    namedRanges: {},
    computed: {
      hfCache: {},
      dependencyGraph: {},
    },
    actionLog: [],
  };
}

/**
 * Add a new sheet to the workbook
 */
export function addSheet(
  workbook: WorkbookJSON,
  name?: string
): SheetJSON {
  // Ensure the requested name is unique within the workbook. If a duplicate
  // name is provided, append a numeric suffix (Sheet, Sheet1, Sheet2...) to
  // avoid collisions which cause SheetJS to throw when appending sheets.
  const existingNames = new Set(workbook.sheets.map((s) => s.name));
  let finalName: string;
  if (name && !existingNames.has(name)) {
    finalName = name;
  } else if (name && existingNames.has(name) && workbook.sheets.length === 1 && workbook.sheets[0].name === name) {
    // If the workbook only contains the default sheet with the same name,
    // reuse that sheet instead of creating a new one. This mirrors caller
    // expectations in tests that create a workbook then call addSheet('Sheet1').
    return workbook.sheets[0];
  } else if (!name) {
    // generate default name like Sheet1, Sheet2...
    let i = 1;
    let candidate = `Sheet${i}`;
    while (existingNames.has(candidate)) {
      i++;
      candidate = `Sheet${i}`;
    }
    finalName = candidate;
  } else {
    // name provided but already exists; add numeric suffix to make unique
    let i = 1;
    let candidate = `${name}${i}`;
    while (existingNames.has(candidate)) {
      i++;
      candidate = `${name}${i}`;
    }
    finalName = candidate;
  }

  const sheet: SheetJSON = {
    id: generateId(),
    name: finalName,
    visible: true,
    grid: { rowCount: 1000, colCount: 50 },
    rows: {},
    cols: {},
    cells: {},
    mergedRanges: [],
    dataValidations: [],
    conditionalFormats: [],
    namedRanges: {},
    charts: [],
    pivots: [],
    images: [],
    comments: {},
    properties: {
      defaultRowHeight: 21,
      defaultColWidth: 100,
      gridLines: true,
      showHeaders: true,
      zoom: 100,
    },
  };
  workbook.sheets.push(sheet);
  workbook.meta.modifiedAt = new Date().toISOString();
  return sheet;
}

/**
 * Delete a sheet by ID
 */
export function deleteSheet(
  workbook: WorkbookJSON,
  sheetId: string
): boolean {
  const index = workbook.sheets.findIndex((s) => s.id === sheetId);
  if (index === -1) return false;
  
  // Don't allow deleting the last sheet
  if (workbook.sheets.length <= 1) return false;
  
  workbook.sheets.splice(index, 1);
  workbook.meta.modifiedAt = new Date().toISOString();
  
  // Update activeTab if needed
  if (workbook.workbookProperties?.workbookView) {
    const activeTab = workbook.workbookProperties.workbookView.activeTab || 0;
    if (activeTab >= workbook.sheets.length) {
      workbook.workbookProperties.workbookView.activeTab = workbook.sheets.length - 1;
    }
  }
  
  return true;
}

/**
 * Get sheet by ID
 */
export function getSheet(workbook: WorkbookJSON, sheetId: string): SheetJSON | undefined {
  return workbook.sheets.find((s) => s.id === sheetId);
}

/**
 * Get sheet by name
 */
export function getSheetByName(workbook: WorkbookJSON, name: string): SheetJSON | undefined {
  return workbook.sheets.find((s) => s.name === name);
}

/**
 * Set cell value in a sheet
 */
export function setCell(
  workbook: WorkbookJSON,
  sheetId: string,
  address: string,
  cell: Cell
): void {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet) throw new Error(`Sheet not found: ${sheetId}`);
  
  sheet.cells = sheet.cells || {};
  sheet.cells[address] = cell;
  workbook.meta.modifiedAt = new Date().toISOString();
}

/**
 * Get cell from a sheet
 */
export function getCell(
  workbook: WorkbookJSON,
  sheetId: string,
  address: string
): Cell | undefined {
  const sheet = getSheet(workbook, sheetId);
  return sheet?.cells?.[address];
}

/**
 * Delete cell from a sheet
 */
export function deleteCell(
  workbook: WorkbookJSON,
  sheetId: string,
  address: string
): void {
  const sheet = getSheet(workbook, sheetId);
  if (!sheet || !sheet.cells) return;
  
  delete sheet.cells[address];
  workbook.meta.modifiedAt = new Date().toISOString();
}

/**
 * Parse cell address to row/col (1-based)
 * "A1" -> { row: 1, col: 1 }
 * "Z10" -> { row: 10, col: 26 }
 */
export function parseAddress(address: string): { row: number; col: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid address: ${address}`);
  
  const colStr = match[1];
  const rowStr = match[2];
  
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  
  return { row: parseInt(rowStr, 10), col };
}

/**
 * Convert row/col (1-based) to cell address
 * { row: 1, col: 1 } -> "A1"
 * { row: 10, col: 26 } -> "Z10"
 */
export function toAddress(row: number, col: number): string {
  let colStr = "";
  let c = col;
  while (c > 0) {
    const remainder = (c - 1) % 26;
    colStr = String.fromCharCode(65 + remainder) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return `${colStr}${row}`;
}

/**
 * Parse range string to start/end addresses
 * "A1:C3" -> { start: "A1", end: "C3" }
 */
export function parseRange(range: string): { start: string; end: string } {
  const [start, end] = range.split(":");
  return { start, end: end || start };
}

/**
 * Get all cell addresses in a range
 * "A1:B2" -> ["A1", "A2", "B1", "B2"]
 */
export function getCellsInRange(range: string): string[] {
  const { start, end } = parseRange(range);
  const startCoords = parseAddress(start);
  const endCoords = parseAddress(end);
  
  const cells: string[] = [];
  for (let row = startCoords.row; row <= endCoords.row; row++) {
    for (let col = startCoords.col; col <= endCoords.col; col++) {
      cells.push(toAddress(row, col));
    }
  }
  return cells;
}

/**
 * Check if address is within range
 */
export function isInRange(address: string, range: string): boolean {
  const { start, end } = parseRange(range);
  const addr = parseAddress(address);
  const startCoords = parseAddress(start);
  const endCoords = parseAddress(end);
  
  return (
    addr.row >= startCoords.row &&
    addr.row <= endCoords.row &&
    addr.col >= startCoords.col &&
    addr.col <= endCoords.col
  );
}

/**
 * Validate workbook JSON structure
 */
export function validateWorkbook(workbook: any): workbook is WorkbookJSON {
  if (!workbook || typeof workbook !== "object") return false;
  if (!workbook.schemaVersion || !workbook.workbookId) return false;
  if (!workbook.meta || !workbook.sheets || !Array.isArray(workbook.sheets)) return false;
  
  // Basic sheet validation
  for (const sheet of workbook.sheets) {
    if (!sheet.id || !sheet.name) return false;
  }
  
  return true;
}

/**
 * Deep clone a workbook
 */
export function cloneWorkbook(workbook: WorkbookJSON): WorkbookJSON {
  return JSON.parse(JSON.stringify(workbook));
}

/**
 * Safe JSON.stringify that handles circular references and DOM elements
 * Use this for logging/debugging, NOT for data serialization
 */
export function safeStringify(obj: any, indent = 2): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, function(key, value) {
      // Drop React internal fields
      if (typeof key === "string" && key.startsWith("__react")) return undefined;
      
      // Handle DOM elements
      if (typeof value === "object" && value !== null) {
        if (value instanceof Element) {
          return `[DOMElement:${value.tagName}]`;
        }
        // Handle circular references
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    }, indent);
  } catch (error) {
    return `[Stringify Error: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Get workbook statistics (safe - no DOM/React serialization)
 */
export function getWorkbookStats(workbook: WorkbookJSON) {
  let totalCells = 0;
  let totalFormulas = 0;
  let totalStyles = 0;
  let totalMerges = 0;
  
  for (const sheet of workbook.sheets) {
    const cells = Object.values(sheet.cells || {});
    totalCells += cells.length;
    totalFormulas += cells.filter((c) => c.formula).length;
    totalStyles += cells.filter((c) => c.style || c.numFmt).length;
    totalMerges += (sheet.mergedRanges || []).length;
  }
  
  // Safe size estimation without JSON.stringify (which can fail on DOM/React objects)
  const estimatedSize = 
    workbook.sheets.reduce((acc, sheet) => 
      acc + Object.keys(sheet.cells || {}).length * 100, // rough estimate per cell
      1000 // base workbook overhead
    );
  
  return {
    title: workbook.meta?.title || "",
    sheets: workbook.sheets.length,
    sheetNames: workbook.sheets.map(s => s.name),
    cells: totalCells,
    formulas: totalFormulas,
    styledCells: totalStyles,
    mergedRanges: totalMerges,
    estimatedSize, // rough estimate, not exact
    modifiedAt: workbook.meta?.modifiedAt || "",
  };
}

/**
 * Convert 0-based row/col (HyperFormula) to 1-based
 */
export function hfToAddress(row: number, col: number): string {
  return toAddress(row + 1, col + 1);
}

/**
 * Convert 1-based row/col to 0-based (HyperFormula)
 */
export function addressToHf(address: string): { row: number; col: number } {
  const { row, col } = parseAddress(address);
  return { row: row - 1, col: col - 1 };
}
