/**
 * OpenRouter AI Integration
 * Uses LLM to parse natural language into structured workbook actions
 */

import { parseAddress, toAddress } from '@/lib/workbook';

// Helper to normalise a value into a Cell-like object for operations
function cellFromValue(value: any) {
  // Treat strings that start with '=' as formulas
  if (typeof value === 'string' && value.startsWith('=')) {
    return { formula: value, dataType: 'formula' };
  }

  if (typeof value === 'number') {
    return { raw: value, dataType: 'number' };
  }

  if (typeof value === 'boolean') {
    return { raw: value, dataType: 'boolean' };
  }

  // Detect ISO-like dates (yyyy-mm-dd) and treat them as date type
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return { raw: value, dataType: 'date' };
  }

  // Fallback to string
  return { raw: value, dataType: 'string' };
}

export interface StructuredAction {
  type:
    | 'setCellValue'
    | 'setCellFormula'
    | 'fillRange'
    | 'fillColumn'
    | 'fillRow'
    | 'clearRange'
    | 'insertRow'
    | 'insertColumn'
    | 'setStyle'
    | 'setRange';
  target?: string; // Cell address like "A1" or column like "B" or row like "5"
  value?: string | number | boolean;
  formula?: string;
  range?: { start: string; end: string };
  values?: any[][];
  // For setRange actions the assistant might return a mapping of address -> value/cell
  cells?: Record<string, any>;
  // Style payload for setStyle
  style?: any;
  position?: number;
}

export interface AIResponse {
  success: boolean;
  actions: StructuredAction[];
  explanation: string;
  confidence: number;
}

/**
 * Send request to OpenRouter API
 */
async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Nexcell',
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      temperature: 0.3,
      max_tokens: parseInt(import.meta.env.VITE_OPENROUTER_MAX_TOKENS || '2000'),
      messages: [
        {
          role: 'system',
          content: `You are a spreadsheet AI assistant. Parse user commands into structured JSON actions.

Available actions:
- setCellValue: Set a single cell to a value
- setCellFormula: Set a cell to a formula (must start with =)
- fillRange: Fill a rectangular range with values or a formula
- fillColumn: Fill an entire column with value/formula
- fillRow: Fill an entire row with value/formula (use values array for varied data)
- clearRange: Clear cells in a range
- insertRow: Insert new row at position
- insertColumn: Insert new column at position

IMPORTANT RULES:
1. When user asks for "sample data" or "example data", create realistic, varied data
2. Use the values array for fillRow when each cell should have different data
3. Look at existing data context to match the pattern and data types
4. For formulas, always start with = symbol
5. Be generous with data - if asked for sample data, provide 5-10 columns worth

Respond ONLY with valid JSON in this exact format:
{
  "actions": [
    {
      "type": "setCellValue",
      "target": "B5",
      "value": 100
    }
  ],
  "explanation": "Set cell B5 to 100",
  "confidence": 0.95
}

For fillRow with sample data, use:
{
  "actions": [
    {
      "type": "fillRow",
      "target": "3",
      "values": ["John Doe", 25, "john@example.com", "New York", "Engineer"]
    }
  ],
  "explanation": "Filled row 3 with sample data",
  "confidence": 0.9
}

Column references: Use letters A-Z, AA-ZZ, etc.
Row references: Use numbers 1, 2, 3, etc.
Cell references: Combine like A1, B5, AA10

Examples:
- "set A1 to 5" → setCellValue on A1 with value 5
- "put 2 in column B" → fillColumn on B with value 2
- "add value 100 to next row" → setCellValue on first empty row
- "fill row 3 with sample data" → fillRow with diverse values: ["John", 25, "john@email.com", "NYC", "Active", 75000]
- "populate row 2 with customer info" → fillRow with: ["Alice Johnson", "alice@company.com", "+1-555-0123", "Premium", "2024-01-15"]
- "create employee record in row 5" → fillRow with: ["Bob Smith", "Engineering", "Senior", 95000, "2023-06-01", "Active"]
- "add product data to row 10" → fillRow with: ["Laptop Pro", "Electronics", 1299.99, 50, "In Stock", "SKU-12345"]
- "paste these values to B5:B8" → fillRange with values array
- "fill column C with =A*2" → fillColumn with formula
- "add sum formula in D10 for D1:D9" → setCellFormula with =SUM(D1:D9)
- "fill range A1:C3 with 0" → fillRange with value 0`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Parse user command using OpenRouter AI
 */
export async function parseCommandWithAI(
  command: string,
  apiKey: string,
  context?: {
    lastRow?: number;
    lastCol?: number;
    selectedCell?: string;
    clipboardData?: any[][];
    existingData?: string[];
  }
): Promise<AIResponse> {
  try {
    // Add context to prompt
    let enrichedPrompt = command;
    
    const contextInfo: string[] = [];
    
    if (context?.lastRow !== undefined) {
      contextInfo.push(`Last used row: ${context.lastRow}`);
    }
    if (context?.selectedCell) {
      contextInfo.push(`Selected cell: ${context.selectedCell}`);
    }
    if (context?.clipboardData) {
      contextInfo.push(`Clipboard contains ${context.clipboardData.length} rows of data`);
    }
    if (context?.existingData && context.existingData.length > 0) {
      contextInfo.push(`Existing data in sheet:\n${context.existingData.join('\n')}`);
    }
    
    if (contextInfo.length > 0) {
      enrichedPrompt += `\n\n--- Context ---\n${contextInfo.join('\n')}`;
    }

    const response = await callOpenRouter(enrichedPrompt, apiKey);
    
    // Parse JSON response with better error handling
    const cleaned = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{]*/, '') // Remove any text before first {
      .replace(/[^}]*$/, '') // Remove any text after last }
      .trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw response:', response);
      console.error('Cleaned response:', cleaned);
      throw new Error('AI returned invalid JSON format');
    }
    
    // Validate the response structure
    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      throw new Error('AI response missing actions array');
    }
    
    // Validate each action has required fields
    for (const action of parsed.actions) {
      if (!action.type) {
        throw new Error('Action missing required "type" field');
      }
    }
    
    return {
      success: true,
      actions: parsed.actions,
      explanation: parsed.explanation || 'Action completed',
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    console.error('AI parsing error:', error);
    return {
      success: false,
      actions: [],
      explanation: `Failed to parse command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      confidence: 0,
    };
  }
}

/**
 * Convert structured actions to workbook operations
 */
export function convertToWorkbookActions(
  structuredActions: StructuredAction[],
  workbookContext: {
    currentSheet: { cells: Record<string, any>; grid?: { rowCount: number; colCount: number } };
  }
): Array<{ address: string; cell: any }> {
  const operations: Array<{ address: string; cell: any }> = [];

  for (const action of structuredActions) {
    switch (action.type) {
      case 'setCellValue': {
        if (action.target && action.value !== undefined) {
          operations.push({
            address: action.target,
            cell: cellFromValue(action.value),
          });
        }
        break;
      }

      case 'setCellFormula': {
        if (action.target && action.formula) {
          let formula = action.formula;
          if (!formula.startsWith('=')) formula = '=' + formula;
          
          operations.push({
            address: action.target,
            cell: {
              formula,
              dataType: 'formula',
            },
          });
        }
        break;
      }

      case 'fillColumn': {
        if (action.target && (action.value !== undefined || action.formula)) {
          const col = columnLetterToNumber(action.target);
          const maxRow = workbookContext.currentSheet.grid?.rowCount || 100;
          
          for (let row = 1; row <= maxRow; row++) {
            const address = toAddress(row, col);
            
            if (action.formula) {
              let formula = action.formula;
              if (!formula.startsWith('=')) formula = '=' + formula;
              // Replace row references
              formula = formula.replace(/(\d+)/g, String(row));
              
              operations.push({
                address,
                cell: { formula, dataType: 'formula' },
              });
              } else if (action.value !== undefined) {
                operations.push({ address, cell: cellFromValue(action.value) });
              }
          }
        }
        break;
      }

      case 'fillRow': {
        if (action.target && (action.value !== undefined || action.formula || action.values)) {
          const row = parseInt(action.target);
          const maxCol = workbookContext.currentSheet.grid?.colCount || 26;
          
          // If we have an array of values, use them
          if (action.values && Array.isArray(action.values)) {
            action.values.forEach((value: any, colIndex: number) => {
              const address = toAddress(row, colIndex + 1);
              
              // Smart data type detection
              let dataType: string;
              let processedValue = value;
              
              if (typeof value === 'number') {
                dataType = 'number';
              } else if (typeof value === 'boolean') {
                dataType = 'boolean';
              } else if (typeof value === 'string') {
                // Check if it's a date string
                if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                  dataType = 'date';
                } else if (!isNaN(parseFloat(value)) && isFinite(value as any)) {
                  // String that looks like a number
                  processedValue = parseFloat(value);
                  dataType = 'number';
                } else {
                  dataType = 'string';
                }
              } else {
                dataType = 'string';
                processedValue = String(value);
              }
              
                operations.push({ address, cell: { raw: processedValue, dataType } });
            });
          } else {
            // Fill entire row with single value or formula
            for (let col = 1; col <= maxCol; col++) {
              const address = toAddress(row, col);
              
              if (action.formula) {
                let formula = action.formula;
                if (!formula.startsWith('=')) formula = '=' + formula;
                // Replace column references
                const colLetter = toAddress(1, col).replace(/\d+/g, '');
                formula = formula.replace(/[A-Z]+/g, colLetter);
                
                operations.push({
                  address,
                  cell: { formula, dataType: 'formula' },
                });
              } else if (action.value !== undefined) {
                operations.push({ address, cell: cellFromValue(action.value) });
              }
            }
          }
        }
        break;
      }

      case 'fillRange': {
        if (action.range && action.values) {
          const { start, end } = action.range;
          const startPos = parseAddress(start);
          const endPos = end ? parseAddress(end) : startPos;
          
          // Check if this is a single column (start and end have same column)
          const isSingleColumn = startPos.col === endPos.col;
          
          if (isSingleColumn) {
            // values is a 1D array for single column
            action.values.forEach((value: any, r: number) => {
              const address = toAddress(startPos.row + r, startPos.col);
              operations.push({ address, cell: cellFromValue(value) });
            });
          } else {
            // values is a 2D array for multi-column ranges
            action.values.forEach((row: any[], r: number) => {
              if (Array.isArray(row)) {
                row.forEach((value: any, c: number) => {
                  const address = toAddress(startPos.row + r, startPos.col + c);
                  operations.push({ address, cell: cellFromValue(value) });
                });
              }
            });
          }
        } else if (action.range && (action.value !== undefined || action.formula)) {
          const { start, end } = action.range;
          const startPos = parseAddress(start);
          const endPos = parseAddress(end);
          
          for (let row = startPos.row; row <= endPos.row; row++) {
            for (let col = startPos.col; col <= endPos.col; col++) {
              const address = toAddress(row, col);
              
              if (action.formula) {
                let formula = action.formula;
                if (!formula.startsWith('=')) formula = '=' + formula;
                // Replace {row} placeholder with actual row number
                formula = formula.replace(/\{row\}/g, row.toString());
                operations.push({ address, cell: { formula, dataType: 'formula' } });
              } else if (action.value !== undefined) {
                operations.push({ address, cell: cellFromValue(action.value) });
              }
            }
          }
        }
        break;
      }

      case 'setRange': {
        // Allow assistant to provide a mapping of addresses to raw values or cell objects
        if (action.cells && typeof action.cells === 'object') {
          for (const [addr, value] of Object.entries(action.cells)) {
            if (value && typeof value === 'object' && ('raw' in value || 'formula' in value || 'dataType' in value)) {
              // Assume value is already a partial Cell
              const cellObj: any = {};
              if ('formula' in value) {
                let formula = value.formula;
                if (typeof formula === 'string' && !formula.startsWith('=')) formula = '=' + formula;
                cellObj.formula = formula;
                cellObj.dataType = 'formula';
              }
              if ('raw' in value) {
                cellObj.raw = value.raw;
                if (value.dataType) cellObj.dataType = value.dataType;
                else cellObj.dataType = typeof value.raw === 'number' ? 'number' : 'string';
              }
              if (value.style) cellObj.style = value.style;

              operations.push({ address: addr, cell: cellObj });
            } else {
              // Simple raw value
              operations.push({ address: addr, cell: cellFromValue(value) });
            }
          }
        }
        break;
      }

      case 'setStyle': {
        if (action.target && action.style) {
          operations.push({
            address: action.target,
            cell: {
              // Only include style props so applyEditCell will merge with existing cell
              style: action.style,
            },
          });
        }
        break;
      }
      case 'clearRange': {
        if (action.range) {
          const { start, end } = action.range;
          const startPos = parseAddress(start);
          const endPos = parseAddress(end);
          
          for (let row = startPos.row; row <= endPos.row; row++) {
            for (let col = startPos.col; col <= endPos.col; col++) {
              const address = toAddress(row, col);
              operations.push({
                address,
                cell: null, // null means delete
              });
            }
          }
        }
        break;
      }
    }
  }

  return operations;
}

/**
 * Convert column letter to number (A=1, B=2, ... Z=26, AA=27, etc.)
 */
function columnLetterToNumber(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col;
}

/**
 * Find next empty row in a sheet
 */
export function findNextEmptyRow(cells: Record<string, any>): number {
  let maxRow = 0;
  for (const address of Object.keys(cells)) {
    try {
      const { row } = parseAddress(address);
      if (row > maxRow) maxRow = row;
    } catch (e) {
      // Skip invalid addresses
    }
  }
  return maxRow + 1;
}
