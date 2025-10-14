/**
 * AI Service for processing chat instructions and generating workbook actions
 */

import type { WorkbookAction } from '@/lib/types';
import { parseCellReference } from '@/lib/db/jsonWorkbook';

export interface AICommand {
  intent: string;
  parameters: Record<string, any>;
  actions: WorkbookAction[];
}

/**
 * Parses user chat message and generates workbook actions
 */
export function parseAICommand(message: string, sheetId: string = 'sheet-1'): AICommand {
  const lowerMsg = message.toLowerCase().trim();
  
  // Pattern: Set cell A1 to [value]
  const setCellMatch = lowerMsg.match(/set (?:cell )?([a-z]+\d+) (?:to|=) (.+)/i);
  if (setCellMatch) {
    const cellRef = setCellMatch[1].toUpperCase();
    const value = setCellMatch[2].trim();
    const pos = parseCellReference(cellRef);
    
    if (pos) {
      // Check if it's a formula (starts with =)
      if (value.startsWith('=')) {
        return {
          intent: 'setCellFormula',
          parameters: { cell: cellRef, formula: value },
          actions: [{
            type: 'setCellFormula',
            sheetId,
            row: pos.row,
            col: pos.col,
            formula: value,
          }],
        };
      } else {
        // Try to parse as number
        const numValue = parseFloat(value);
        const finalValue = !isNaN(numValue) ? numValue : value;
        
        return {
          intent: 'setCellValue',
          parameters: { cell: cellRef, value: finalValue },
          actions: [{
            type: 'setCellValue',
            sheetId,
            row: pos.row,
            col: pos.col,
            value: finalValue,
          }],
        };
      }
    }
  }
  
  // Pattern: Add formula [formula] to [cell]
  const addFormulaMatch = lowerMsg.match(/add formula (.+) (?:to|in) (?:cell )?([a-z]+\d+)/i);
  if (addFormulaMatch) {
    let formula = addFormulaMatch[1].trim();
    const cellRef = addFormulaMatch[2].toUpperCase();
    const pos = parseCellReference(cellRef);
    
    if (pos) {
      // Ensure formula starts with =
      if (!formula.startsWith('=')) {
        formula = '=' + formula;
      }
      
      return {
        intent: 'setCellFormula',
        parameters: { cell: cellRef, formula },
        actions: [{
          type: 'setCellFormula',
          sheetId,
          row: pos.row,
          col: pos.col,
          formula,
        }],
      };
    }
  }
  
  // Pattern: Clear cell [cell] or Clear [cell]
  const clearCellMatch = lowerMsg.match(/clear (?:cell )?([a-z]+\d+)/i);
  if (clearCellMatch) {
    const cellRef = clearCellMatch[1].toUpperCase();
    const pos = parseCellReference(cellRef);
    
    if (pos) {
      return {
        intent: 'clearCell',
        parameters: { cell: cellRef },
        actions: [{
          type: 'clearRange',
          sheetId,
          startRow: pos.row,
          startCol: pos.col,
          endRow: pos.row,
          endCol: pos.col,
        }],
      };
    }
  }
  
  // Pattern: Clear range [start]:[end] or Clear [start] to [end]
  const clearRangeMatch = lowerMsg.match(/clear (?:range )?([a-z]+\d+)(?::| to )([a-z]+\d+)/i);
  if (clearRangeMatch) {
    const startRef = clearRangeMatch[1].toUpperCase();
    const endRef = clearRangeMatch[2].toUpperCase();
    const startPos = parseCellReference(startRef);
    const endPos = parseCellReference(endRef);
    
    if (startPos && endPos) {
      return {
        intent: 'clearRange',
        parameters: { start: startRef, end: endRef },
        actions: [{
          type: 'clearRange',
          sheetId,
          startRow: Math.min(startPos.row, endPos.row),
          startCol: Math.min(startPos.col, endPos.col),
          endRow: Math.max(startPos.row, endPos.row),
          endCol: Math.max(startPos.col, endPos.col),
        }],
      };
    }
  }
  
  // Pattern: Create sum formula in [cell] for [range]
  const sumMatch = lowerMsg.match(/(?:create |add )?sum (?:formula )?(?:in |to )?(?:cell )?([a-z]+\d+) (?:for|of) (?:range )?([a-z]+\d+):([a-z]+\d+)/i);
  if (sumMatch) {
    const targetRef = sumMatch[1].toUpperCase();
    const startRef = sumMatch[2].toUpperCase();
    const endRef = sumMatch[3].toUpperCase();
    const pos = parseCellReference(targetRef);
    
    if (pos) {
      const formula = `=SUM(${startRef}:${endRef})`;
      return {
        intent: 'createSumFormula',
        parameters: { cell: targetRef, range: `${startRef}:${endRef}` },
        actions: [{
          type: 'setCellFormula',
          sheetId,
          row: pos.row,
          col: pos.col,
          formula,
        }],
      };
    }
  }
  
  // Pattern: Fill [range] with [value]
  const fillMatch = lowerMsg.match(/fill (?:range )?([a-z]+\d+):([a-z]+\d+) with (.+)/i);
  if (fillMatch) {
    const startRef = fillMatch[1].toUpperCase();
    const endRef = fillMatch[2].toUpperCase();
    const value = fillMatch[3].trim();
    const startPos = parseCellReference(startRef);
    const endPos = parseCellReference(endRef);
    
    if (startPos && endPos) {
      const numValue = parseFloat(value);
      const finalValue = !isNaN(numValue) ? numValue : value;
      
      const actions: WorkbookAction[] = [];
      for (let row = Math.min(startPos.row, endPos.row); row <= Math.max(startPos.row, endPos.row); row++) {
        for (let col = Math.min(startPos.col, endPos.col); col <= Math.max(startPos.col, endPos.col); col++) {
          actions.push({
            type: 'setCellValue',
            sheetId,
            row,
            col,
            value: finalValue,
          });
        }
      }
      
      return {
        intent: 'fillRange',
        parameters: { start: startRef, end: endRef, value: finalValue },
        actions,
      };
    }
  }
  
  // No recognized pattern
  return {
    intent: 'unknown',
    parameters: {},
    actions: [],
  };
}

/**
 * Generates a human-readable description of the action
 */
export function describeAction(action: WorkbookAction): string {
  switch (action.type) {
    case 'setCellValue':
      return `Set ${formatCell(action.row, action.col)} to ${action.value}`;
    case 'setCellFormula':
      return `Add formula ${action.formula} to ${formatCell(action.row, action.col)}`;
    case 'clearRange':
      if (action.startRow === action.endRow && action.startCol === action.endCol) {
        return `Clear ${formatCell(action.startRow, action.startCol)}`;
      }
      return `Clear range ${formatCell(action.startRow, action.startCol)}:${formatCell(action.endRow, action.endCol)}`;
    case 'setRange':
      return `Set range ${formatCell(action.startRow, action.startCol)}:${formatCell(action.endRow, action.endCol)}`;
    case 'setFormulaRange':
      return `Add formulas to range ${formatCell(action.startRow, action.startCol)}:${formatCell(action.endRow, action.endCol)}`;
    default:
      return 'Unknown action';
  }
}

function formatCell(row: number, col: number): string {
  let colStr = '';
  let c = col + 1;
  while (c > 0) {
    const mod = (c - 1) % 26;
    colStr = String.fromCharCode(65 + mod) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return `${colStr}${row + 1}`;
}

/**
 * Example commands for user reference
 */
export const EXAMPLE_COMMANDS = [
  'Set A1 to 100',
  'Set cell B2 = Hello World',
  'Add formula =A1*2 to C1',
  'Create sum in D10 for range A1:A9',
  'Fill A1:A10 with 0',
  'Clear cell B5',
  'Clear range C1:E5',
];
