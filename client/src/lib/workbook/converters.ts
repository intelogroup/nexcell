/**
 * Conversion utilities between WorkbookJSON and legacy formats
 */

import type { WorkbookJSON, Cell } from './types';
import { parseAddress, toAddress } from './utils';

export interface LegacyCellData {
  value: string | number | boolean | null;
  formula?: string;
  formatting?: any;
}

/**
 * Convert WorkbookJSON sheet to 2D array format for rendering
 */
export function workbookToCellArray(
  workbook: WorkbookJSON,
  sheetId: string,
  rows: number,
  cols: number
): LegacyCellData[][] {
  const sheet = workbook.sheets.find(s => s.id === sheetId);
  if (!sheet) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ value: null }))
    );
  }

  const result: LegacyCellData[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: null }))
  );

  // Populate cells from workbook
  for (const [address, cell] of Object.entries(sheet.cells || {})) {
    try {
      const { row, col } = parseAddress(address);
      if (row > 0 && row <= rows && col > 0 && col <= cols) {
        const rowIdx = row - 1; // Convert to 0-based
        const colIdx = col - 1;
        
        // Log formula cells specifically
        if (cell.formula) {
          console.log(`[Converter] ${sheet.name}!${address}: formula="${cell.formula}", computed.v=${cell.computed?.v}, raw=${cell.raw}`);
        }
        
  const rawVal = (cell.computed?.v ?? cell.raw ?? null) as unknown;
  const value = (typeof rawVal === 'string' && !isNaN(Date.parse(rawVal))) ? new Date(rawVal).toISOString() : (rawVal as string | number | boolean | null);
        
        if (cell.formula) {
          console.log(`[Converter]   └─ Will render value: ${value} (from ${cell.computed?.v !== undefined ? 'computed' : 'raw'})`);
        }
        
        result[rowIdx][colIdx] = {
          value,
          formula: cell.formula,
          formatting: (cell.style || cell.numFmt) ? {
              ...cell.style,
              numberFormat: cell.numFmt,
            } : undefined,
        };
      }
    } catch (e) {
      // Skip invalid addresses
    }
  }

  return result;
}

/**
 * Convert 2D cell array back to WorkbookJSON format
 */
export function cellArrayToWorkbook(
  cells: LegacyCellData[][],
  existingWorkbook?: WorkbookJSON
): WorkbookJSON {
  const workbook = existingWorkbook || {
    schemaVersion: '1.0',
    workbookId: crypto.randomUUID(),
    meta: {
      title: 'Untitled',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    sheets: [{
      id: crypto.randomUUID(),
      name: 'Sheet1',
      visible: true,
      grid: { rowCount: cells.length, colCount: cells[0]?.length || 0 },
      cells: {},
    }],
  };

  const sheet = workbook.sheets[0];
  sheet.cells = {};

  cells.forEach((row, r) => {
    row.forEach((cellData, c) => {
      if (cellData.value !== null || cellData.formula) {
        const address = toAddress(r + 1, c + 1); // Convert to 1-based
        const cell: Cell = {};

        if (cellData.formula) {
          cell.formula = cellData.formula;
          cell.dataType = 'formula';
          if (cellData.value !== null) {
            cell.computed = {
              v: cellData.value,
              ts: new Date().toISOString(),
            };
          }
        } else {
          // If value is a Date object or an ISO date string, normalize to ISO string
          const val = cellData.value;
          const isDateObj = typeof val === 'object' && val !== null && (val as any).toISOString && typeof (val as any).toISOString === 'function';
          const isIsoString = typeof val === 'string' && !isNaN(Date.parse(val));
          if (isDateObj) {
            cell.raw = (val as any).toISOString();
            cell.dataType = 'date';
          } else if (isIsoString) {
            cell.raw = val as string;
            cell.dataType = 'date';
          } else {
            cell.raw = cellData.value;
            if (typeof cellData.value === 'number') {
              cell.dataType = 'number';
            } else if (typeof cellData.value === 'boolean') {
              cell.dataType = 'boolean';
            } else {
              cell.dataType = 'string';
            }
          }
        }

        // Convert formatting
        if (cellData.formatting) {
          const { numberFormat, ...style } = cellData.formatting;
          if (numberFormat) cell.numFmt = numberFormat;
          if (Object.keys(style).length > 0) cell.style = style;
        }

        if (sheet.cells) {
          sheet.cells[address] = cell;
        }
      }
    });
  });

  return workbook;
}

/**
 * Get cell value for display (respects computed vs raw)
 */
export function getCellDisplayValue(cell: Cell): string | number | boolean | null | Date {
  // Prefer computed value when available (computed cache is the authoritative display value).
  if (cell.computed?.v !== undefined) {
    return cell.computed.v;
  }
  return cell.raw ?? null;
}

/**
 * Create a Cell object from user input
 */
export function createCellFromInput(input: string): Cell {
  const trimmed = input.trim();
  
  // Formula
  if (trimmed.startsWith('=')) {
    return {
      formula: trimmed,
      dataType: 'formula',
    };
  }
  
  // Number
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') {
    return {
      raw: num,
      dataType: 'number',
    };
  }
  
  // Boolean
  if (trimmed.toLowerCase() === 'true') {
    return { raw: true, dataType: 'boolean' };
  }
  if (trimmed.toLowerCase() === 'false') {
    return { raw: false, dataType: 'boolean' };
  }
  
  // String
  return {
    raw: trimmed,
    dataType: 'string',
  };
}
