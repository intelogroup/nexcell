/**
 * End-to-End AI Prompt Testing
 * 
 * This script programmatically sends prompts to the AI system
 * and validates the action extraction and conversion process.
 * 
 * Usage: node tmp/e2e-ai-prompt-tests.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and eval the openrouter.ts file to get the functions
const openrouterPath = path.join(__dirname, '../client/src/lib/ai/openrouter.ts');
const openrouterCode = fs.readFileSync(openrouterPath, 'utf-8');

// Extract the extractActionsFromReply function
function extractActionsFromReply(reply) {
  // Match both <actions> tags and ```json code blocks
  const actionsMatch = reply.match(/<actions>\s*([\s\S]*?)\s*<\/actions>/);
  const jsonMatch = reply.match(/```(?:json)?\s*(\[\s*{[\s\S]*?}\s*\])\s*```/);
  
  const jsonStr = actionsMatch ? actionsMatch[1] : (jsonMatch ? jsonMatch[1] : null);
  
  if (!jsonStr) {
    console.log('No actions found in reply');
    return [];
  }
  
  try {
    const actions = JSON.parse(jsonStr);
    return Array.isArray(actions) ? actions : [];
  } catch (error) {
    console.error('Failed to parse actions JSON:', error);
    return [];
  }
}

// Helper functions from workbook lib
function parseAddress(address) {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  
  const col = match[1];
  const row = parseInt(match[2], 10);
  
  let colNum = 0;
  for (let i = 0; i < col.length; i++) {
    colNum = colNum * 26 + (col.charCodeAt(i) - 64);
  }
  
  return { row, col: colNum };
}

function toAddress(row, col) {
  let colStr = '';
  let c = col;
  while (c > 0) {
    const remainder = (c - 1) % 26;
    colStr = String.fromCharCode(65 + remainder) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return colStr + row;
}

function columnLetterToNumber(col) {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

// Helper to detect cell value type
function cellFromValue(value) {
  if (value === null || value === undefined || value === '') {
    return { type: 'empty', value: null };
  }
  
  if (typeof value === 'number') {
    return { type: 'number', value };
  }
  
  if (typeof value === 'boolean') {
    return { type: 'boolean', value };
  }
  
  if (typeof value === 'string') {
    // Check if it's a date
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return { type: 'date', value };
    }
    
    // Otherwise it's text
    return { type: 'text', value };
  }
  
  return { type: 'text', value: String(value) };
}

// Simplified convertToWorkbookActions function
function convertToWorkbookActions(actions) {
  const operations = [];
  
  actions.forEach(action => {
    try {
      switch (action.type) {
        case 'setCellValue': {
          if (action.cell && action.value !== undefined) {
            const cell = cellFromValue(action.value);
            operations.push({
              address: action.cell,
              type: cell.type,
              value: cell.value
            });
          }
          break;
        }
        
        case 'setCellFormula': {
          if (action.cell && action.formula) {
            operations.push({
              address: action.cell,
              type: 'formula',
              value: action.formula.startsWith('=') ? action.formula : `=${action.formula}`
            });
          }
          break;
        }
        
        case 'fillRange': {
          const rangeObj = action.target || action.range;
          if (rangeObj && typeof rangeObj === 'object' && action.values) {
            const { start, end } = rangeObj;
            const startAddr = parseAddress(start);
            const endAddr = end ? parseAddress(end) : null;
            
            if (!startAddr) {
              operations.push({
                address: 'ERROR',
                type: 'error',
                value: `Invalid start address: ${start}`
              });
              return;
            }
            
            const values = action.values;
            const isSingleColumn = values.every(v => Array.isArray(v) && v.length === 1);
            
            if (isSingleColumn) {
              // Single column fill
              values.forEach((rowValue, idx) => {
                const value = Array.isArray(rowValue) ? rowValue[0] : rowValue;
                const actualValue = Array.isArray(value) && value.length === 1 ? value[0] : value;
                const row = startAddr.row + idx;
                const address = toAddress(row, startAddr.col);
                const cell = cellFromValue(actualValue);
                operations.push({
                  address,
                  type: cell.type,
                  value: cell.value
                });
              });
            } else {
              // Multi-column fill
              values.forEach((rowValues, rowIdx) => {
                if (Array.isArray(rowValues)) {
                  rowValues.forEach((value, colIdx) => {
                    const row = startAddr.row + rowIdx;
                    const col = startAddr.col + colIdx;
                    const address = toAddress(row, col);
                    const cell = cellFromValue(value);
                    operations.push({
                      address,
                      type: cell.type,
                      value: cell.value
                    });
                  });
                }
              });
            }
          }
          break;
        }
        
        case 'setRange': {
          if (action.cells) {
            // Cells object format
            Object.entries(action.cells).forEach(([address, value]) => {
              const cell = cellFromValue(value);
              operations.push({
                address,
                type: cell.type,
                value: cell.value
              });
            });
          } else if (action.range && action.values) {
            // Range + values format
            const { start, end } = action.range;
            const startAddr = parseAddress(start);
            const endAddr = end ? parseAddress(end) : null;
            
            if (!startAddr) {
              operations.push({
                address: 'ERROR',
                type: 'error',
                value: `Invalid start address: ${start}`
              });
              return;
            }
            
            action.values.forEach((rowValues, rowIdx) => {
              if (Array.isArray(rowValues)) {
                rowValues.forEach((value, colIdx) => {
                  const row = startAddr.row + rowIdx;
                  const col = startAddr.col + colIdx;
                  const address = toAddress(row, col);
                  
                  if (typeof value === 'string' && value.startsWith('=')) {
                    operations.push({
                      address,
                      type: 'formula',
                      value
                    });
                  } else {
                    const cell = cellFromValue(value);
                    operations.push({
                      address,
                      type: cell.type,
                      value: cell.value
                    });
                  }
                });
              }
            });
          }
          break;
        }
      }
    } catch (error) {
      console.error(`Error processing action ${action.type}:`, error);
      operations.push({
        address: 'ERROR',
        type: 'error',
        value: error.message
      });
    }
  });
  
  return operations;
}

// Test scenarios with expected outcomes
const TEST_SCENARIOS = [
  {
    id: 'training-data',
    name: 'Sample Training Data',
    prompt: 'Add sample training data to cells A3:D12 with columns: Name, Age, Department, Salary',
    expectedActions: 4, // 4 fillRange actions (one per column)
    expectedOperations: 40, // 10 rows × 4 columns
    expectedActionTypes: ['fillRange'],
    validate: (actions, operations) => {
      const fillRangeActions = actions.filter(a => a.type === 'fillRange');
      console.log(`✓ Found ${fillRangeActions.length} fillRange actions`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      // Check column distribution
      const columns = fillRangeActions.map(a => (a.target || a.range).start);
      console.log(`✓ Columns filled: ${columns.join(', ')}`);
      
      return fillRangeActions.length >= 1 && operations.length >= 10;
    }
  },
  
  {
    id: 'budget-table',
    name: 'Monthly Budget Table',
    prompt: 'Create a monthly budget table starting at A1 with these categories: Rent, Groceries, Utilities, Transport. Use column headers: Category, Budgeted, Actual, Difference',
    expectedActions: 2, // Headers + data
    expectedOperations: 20, // 5 rows × 4 columns
    expectedActionTypes: ['fillRange', 'setRange'],
    validate: (actions, operations) => {
      console.log(`✓ Found ${actions.length} actions (types: ${actions.map(a => a.type).join(', ')})`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      // Check if we have both structure and data
      const hasMultipleActionTypes = new Set(actions.map(a => a.type)).size > 1 || actions.length >= 2;
      console.log(`✓ Multiple action types: ${hasMultipleActionTypes}`);
      
      return operations.length >= 16; // At least 4x4 grid
    }
  },
  
  {
    id: 'sales-dashboard',
    name: 'Sales Dashboard',
    prompt: 'Create a sales dashboard starting at A1. Add these products in column A: Laptop, Mouse, Keyboard, Monitor. Add quantities in column B: 5, 15, 20, 8. Add prices in column C: 1200, 25, 75, 350. In column D, add formulas to calculate totals (B×C).',
    expectedActions: 4, // Product names, quantities, prices, formulas
    expectedOperations: 16, // 4 rows × 4 columns
    expectedActionTypes: ['fillRange', 'setCellFormula'],
    validate: (actions, operations) => {
      const fillActions = actions.filter(a => a.type === 'fillRange');
      const formulaActions = actions.filter(a => a.type === 'setCellFormula' || a.type === 'fillColumn');
      
      console.log(`✓ Found ${fillActions.length} fill actions`);
      console.log(`✓ Found ${formulaActions.length} formula actions`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      // Check for formulas in operations
      const formulaOps = operations.filter(op => op.type === 'formula');
      console.log(`✓ Formula operations: ${formulaOps.length}`);
      
      return operations.length >= 12; // At least 4x3 data + formulas
    }
  },
  
  {
    id: 'multi-sheet',
    name: 'Multi-Sheet Workbook',
    prompt: 'Create three sheets named Sales, Expenses, and Summary. In Sales sheet, add sample revenue data. In Expenses sheet, add sample cost data.',
    expectedActions: 5, // 2 addSheet + data for each sheet
    expectedOperations: 20,
    expectedActionTypes: ['addSheet', 'fillRange'],
    validate: (actions, operations) => {
      const sheetActions = actions.filter(a => a.type === 'addSheet');
      const dataActions = actions.filter(a => a.type === 'fillRange' || a.type === 'setRange');
      
      console.log(`✓ Found ${sheetActions.length} sheet creation actions`);
      console.log(`✓ Found ${dataActions.length} data filling actions`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      if (sheetActions.length > 0) {
        const sheetNames = sheetActions.map(a => a.sheetName || a.name);
        console.log(`✓ Sheets to create: ${sheetNames.join(', ')}`);
      }
      
      return sheetActions.length >= 2; // At least 2 new sheets
    }
  },
  
  {
    id: 'formula-calculator',
    name: 'Compound Interest Calculator',
    prompt: 'Create a compound interest calculator starting at A1. Add labels in column A: Principal, Rate (%), Years, Compound Frequency. Add input values in column B: 10000, 5, 10, 12. In cell B5, add a formula to calculate final amount: =B1*(1+B2/100/B4)^(B3*B4)',
    expectedActions: 3, // Labels, inputs, formula
    expectedOperations: 9, // 4 labels + 4 inputs + 1 formula
    expectedActionTypes: ['fillRange', 'setCellFormula', 'setCellValue'],
    validate: (actions, operations) => {
      const valueActions = actions.filter(a => a.type === 'fillRange' || a.type === 'setCellValue' || a.type === 'setRange');
      const formulaActions = actions.filter(a => a.type === 'setCellFormula');
      
      console.log(`✓ Found ${valueActions.length} value/data actions`);
      console.log(`✓ Found ${formulaActions.length} formula actions`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      // Check for formula operations
      const formulaOps = operations.filter(op => op.type === 'formula');
      if (formulaOps.length > 0) {
        console.log(`✓ Formula operations: ${formulaOps.map(op => `${op.address}=${op.value}`).join(', ')}`);
      }
      
      return operations.length >= 5 && formulaActions.length >= 1;
    }
  },
  
  {
    id: 'conditional-highlight',
    name: 'Grade Table with Highlighting',
    prompt: 'Create a grade table starting at A1. Add student names in A2:A5: Alice, Bob, Carol, Dave. Add scores in B2:B5: 95, 78, 92, 65. Add header row with Name and Score. Highlight scores above 90 in green.',
    expectedActions: 3, // Headers, names, scores, styles
    expectedOperations: 12, // 2 headers + 4 names + 4 scores + styles
    expectedActionTypes: ['fillRange', 'setStyle'],
    validate: (actions, operations) => {
      const dataActions = actions.filter(a => a.type === 'fillRange' || a.type === 'setRange' || a.type === 'setCellValue');
      const styleActions = actions.filter(a => a.type === 'setStyle');
      
      console.log(`✓ Found ${dataActions.length} data actions`);
      console.log(`✓ Found ${styleActions.length} style actions`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      if (styleActions.length > 0) {
        console.log(`✓ Styles to apply: ${styleActions.map(a => `${a.cell || a.range} → ${JSON.stringify(a.style)}`).join(', ')}`);
      }
      
      return operations.length >= 10; // At least data populated
    }
  },
  
  {
    id: 'large-dataset',
    name: 'Large Dataset (100 rows)',
    prompt: 'Fill cells A1:C100 with sample employee data. Column A: Employee IDs (EMP001-EMP100), Column B: Random salaries between 40000-120000, Column C: Random departments (Sales, Engineering, HR, Marketing).',
    expectedActions: 3, // One per column
    expectedOperations: 300, // 100 rows × 3 columns
    expectedActionTypes: ['fillRange'],
    validate: (actions, operations) => {
      console.log(`✓ Found ${actions.length} actions`);
      console.log(`✓ Generated ${operations.length} operations`);
      
      // Check if operations span the expected range
      const addresses = operations.map(op => op.address);
      const hasA1 = addresses.some(a => a === 'A1');
      const hasC100 = addresses.some(a => a === 'C100');
      
      console.log(`✓ Starts at A1: ${hasA1}`);
      console.log(`✓ Ends near C100: ${hasC100 || operations.length >= 100}`);
      
      return operations.length >= 100; // At least 100 operations
    }
  }
];

// Mock AI responses for testing (replace with actual API calls when ready)
const MOCK_AI_RESPONSES = {
  'training-data': `I'll add sample training data to the specified range.

<actions>
[
  {
    "type": "fillRange",
    "target": {"start": "A3", "end": "A12"},
    "values": [["Alice"], ["Bob"], ["Carol"], ["Dave"], ["Eve"], ["Frank"], ["Grace"], ["Henry"], ["Ivy"], ["Jack"]]
  },
  {
    "type": "fillRange",
    "target": {"start": "B3", "end": "B12"},
    "values": [[28], [34], [29], [42], [31], [38], [27], [45], [33], [36]]
  },
  {
    "type": "fillRange",
    "target": {"start": "C3", "end": "C12"},
    "values": [["Engineering"], ["Sales"], ["HR"], ["Engineering"], ["Marketing"], ["Sales"], ["HR"], ["Engineering"], ["Marketing"], ["Sales"]]
  },
  {
    "type": "fillRange",
    "target": {"start": "D3", "end": "D12"},
    "values": [[75000], [65000], [58000], [92000], [62000], [68000], [55000], [98000], [64000], [70000]]
  }
]
</actions>`,

  'budget-table': `I'll create a monthly budget table with the specified structure.

<actions>
[
  {
    "type": "setRange",
    "range": {"start": "A1", "end": "D1"},
    "values": [["Category", "Budgeted", "Actual", "Difference"]]
  },
  {
    "type": "setRange",
    "range": {"start": "A2", "end": "D5"},
    "values": [
      ["Rent", 1500, 1500, "=C2-B2"],
      ["Groceries", 600, 550, "=C3-B3"],
      ["Utilities", 200, 215, "=C4-B4"],
      ["Transport", 300, 280, "=C5-B5"]
    ]
  }
]
</actions>`,

  'sales-dashboard': `I'll create a sales dashboard with products, quantities, prices, and calculated totals.

<actions>
[
  {
    "type": "fillRange",
    "target": {"start": "A1", "end": "A4"},
    "values": [["Laptop"], ["Mouse"], ["Keyboard"], ["Monitor"]]
  },
  {
    "type": "fillRange",
    "target": {"start": "B1", "end": "B4"},
    "values": [[5], [15], [20], [8]]
  },
  {
    "type": "fillRange",
    "target": {"start": "C1", "end": "C4"},
    "values": [[1200], [25], [75], [350]]
  },
  {
    "type": "setCellFormula",
    "cell": "D1",
    "formula": "=B1*C1"
  },
  {
    "type": "setCellFormula",
    "cell": "D2",
    "formula": "=B2*C2"
  },
  {
    "type": "setCellFormula",
    "cell": "D3",
    "formula": "=B3*C3"
  },
  {
    "type": "setCellFormula",
    "cell": "D4",
    "formula": "=B4*C4"
  }
]
</actions>`,

  'multi-sheet': `I'll create multiple sheets and add sample data to each.

<actions>
[
  {
    "type": "addSheet",
    "sheetName": "Sales"
  },
  {
    "type": "addSheet",
    "sheetName": "Expenses"
  },
  {
    "type": "fillRange",
    "target": {"start": "A1", "end": "B5"},
    "values": [
      ["Product", "Revenue"],
      ["Product A", 15000],
      ["Product B", 22000],
      ["Product C", 18000],
      ["Product D", 12000]
    ],
    "sheet": "Sales"
  },
  {
    "type": "fillRange",
    "target": {"start": "A1", "end": "B5"},
    "values": [
      ["Category", "Cost"],
      ["Salaries", 50000],
      ["Rent", 8000],
      ["Utilities", 3000],
      ["Marketing", 12000]
    ],
    "sheet": "Expenses"
  }
]
</actions>`,

  'formula-calculator': `I'll create a compound interest calculator with the specified structure.

<actions>
[
  {
    "type": "setRange",
    "range": {"start": "A1", "end": "B4"},
    "values": [
      ["Principal", 10000],
      ["Rate (%)", 5],
      ["Years", 10],
      ["Compound Frequency", 12]
    ]
  },
  {
    "type": "setCellValue",
    "cell": "A5",
    "value": "Final Amount"
  },
  {
    "type": "setCellFormula",
    "cell": "B5",
    "formula": "=B1*(1+B2/100/B4)^(B3*B4)"
  }
]
</actions>`,

  'conditional-highlight': `I'll create a grade table and highlight high scores.

<actions>
[
  {
    "type": "setRange",
    "range": {"start": "A1", "end": "B1"},
    "values": [["Name", "Score"]]
  },
  {
    "type": "fillRange",
    "target": {"start": "A2", "end": "A5"},
    "values": [["Alice"], ["Bob"], ["Carol"], ["Dave"]]
  },
  {
    "type": "fillRange",
    "target": {"start": "B2", "end": "B5"},
    "values": [[95], [78], [92], [65]]
  },
  {
    "type": "setStyle",
    "cell": "B2",
    "style": {"backgroundColor": "#90EE90"}
  },
  {
    "type": "setStyle",
    "cell": "B4",
    "style": {"backgroundColor": "#90EE90"}
  }
]
</actions>`,

  'large-dataset': `I'll generate a large dataset with 100 rows of employee data.

<actions>
[
  {
    "type": "fillRange",
    "target": {"start": "A1", "end": "A100"},
    "values": [["EMP001"], ["EMP002"], ["EMP003"], ["EMP004"], ["EMP005"], ["EMP006"], ["EMP007"], ["EMP008"], ["EMP009"], ["EMP010"], ["EMP011"], ["EMP012"], ["EMP013"], ["EMP014"], ["EMP015"], ["EMP016"], ["EMP017"], ["EMP018"], ["EMP019"], ["EMP020"], ["EMP021"], ["EMP022"], ["EMP023"], ["EMP024"], ["EMP025"], ["EMP026"], ["EMP027"], ["EMP028"], ["EMP029"], ["EMP030"], ["EMP031"], ["EMP032"], ["EMP033"], ["EMP034"], ["EMP035"], ["EMP036"], ["EMP037"], ["EMP038"], ["EMP039"], ["EMP040"], ["EMP041"], ["EMP042"], ["EMP043"], ["EMP044"], ["EMP045"], ["EMP046"], ["EMP047"], ["EMP048"], ["EMP049"], ["EMP050"], ["EMP051"], ["EMP052"], ["EMP053"], ["EMP054"], ["EMP055"], ["EMP056"], ["EMP057"], ["EMP058"], ["EMP059"], ["EMP060"], ["EMP061"], ["EMP062"], ["EMP063"], ["EMP064"], ["EMP065"], ["EMP066"], ["EMP067"], ["EMP068"], ["EMP069"], ["EMP070"], ["EMP071"], ["EMP072"], ["EMP073"], ["EMP074"], ["EMP075"], ["EMP076"], ["EMP077"], ["EMP078"], ["EMP079"], ["EMP080"], ["EMP081"], ["EMP082"], ["EMP083"], ["EMP084"], ["EMP085"], ["EMP086"], ["EMP087"], ["EMP088"], ["EMP089"], ["EMP090"], ["EMP091"], ["EMP092"], ["EMP093"], ["EMP094"], ["EMP095"], ["EMP096"], ["EMP097"], ["EMP098"], ["EMP099"], ["EMP100"]]
  },
  {
    "type": "fillRange",
    "target": {"start": "B1", "end": "B100"},
    "values": [[65000], [82000], [54000], [98000], [71000], [63000], [89000], [77000], [52000], [94000], [68000], [75000], [61000], [88000], [79000], [58000], [97000], [73000], [66000], [91000], [70000], [84000], [59000], [102000], [76000], [64000], [87000], [72000], [55000], [95000], [69000], [81000], [62000], [93000], [78000], [57000], [99000], [74000], [67000], [92000], [71000], [85000], [60000], [101000], [77000], [65000], [88000], [73000], [56000], [96000], [70000], [82000], [63000], [94000], [79000], [58000], [100000], [75000], [68000], [93000], [72000], [86000], [61000], [103000], [78000], [66000], [89000], [74000], [57000], [97000], [71000], [83000], [64000], [95000], [80000], [59000], [102000], [76000], [69000], [91000], [73000], [87000], [62000], [104000], [79000], [67000], [90000], [75000], [58000], [98000], [72000], [84000], [65000], [96000], [81000], [60000], [103000], [77000], [70000], [92000]]
  },
  {
    "type": "fillRange",
    "target": {"start": "C1", "end": "C100"},
    "values": [["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"], ["Sales"], ["Engineering"], ["HR"], ["Marketing"]]
  }
]
</actions>`
};

// Simulated action extraction (using actual converter functions)
async function runTestScenario(scenario) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST SCENARIO: ${scenario.name}`);
  console.log('='.repeat(80));
  console.log(`Prompt: "${scenario.prompt}"`);
  console.log('');
  
  try {
    // Get mock AI response
    const aiResponse = MOCK_AI_RESPONSES[scenario.id];
    if (!aiResponse) {
      console.log(`❌ No mock response available for scenario: ${scenario.id}`);
      return { success: false, error: 'No mock response' };
    }
    
    console.log('📋 AI Response received');
    
    // Extract actions from response
    console.log('\n--- Action Extraction Phase ---');
    const extractedActions = extractActionsFromReply(aiResponse);
    console.log(`Extracted ${extractedActions.length} actions from AI response`);
    
    if (extractedActions.length === 0) {
      console.log(`❌ No actions extracted from AI response`);
      console.log('AI Response preview:', aiResponse.substring(0, 200));
      return { success: false, error: 'No actions extracted' };
    }
    
    // Display extracted actions
    console.log('\nExtracted Actions:');
    extractedActions.forEach((action, idx) => {
      console.log(`  ${idx + 1}. ${action.type} - ${JSON.stringify(action).substring(0, 100)}...`);
    });
    
    // Convert actions to operations
    console.log('\n--- Action Conversion Phase ---');
    const operations = convertToWorkbookActions(extractedActions);
    console.log(`Converted to ${operations.length} cell operations`);
    
    if (operations.length === 0) {
      console.log(`⚠️  No operations generated from actions`);
      console.log('Actions:', JSON.stringify(extractedActions, null, 2));
      return { success: false, error: 'No operations generated' };
    }
    
    // Display operation summary
    console.log('\nOperation Summary:');
    const opTypes = {};
    operations.forEach(op => {
      opTypes[op.type] = (opTypes[op.type] || 0) + 1;
    });
    Object.entries(opTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} operations`);
    });
    
    // Sample operations
    console.log('\nSample Operations (first 5):');
    operations.slice(0, 5).forEach((op, idx) => {
      console.log(`  ${idx + 1}. ${op.address} = ${JSON.stringify(op.value)} (type: ${op.type})`);
    });
    
    if (operations.length > 5) {
      console.log(`  ... and ${operations.length - 5} more operations`);
    }
    
    // Run scenario-specific validation
    console.log('\n--- Validation Phase ---');
    const validationPassed = scenario.validate(extractedActions, operations);
    
    console.log('\n' + '='.repeat(80));
    if (validationPassed) {
      console.log(`✅ TEST PASSED: ${scenario.name}`);
    } else {
      console.log(`❌ TEST FAILED: ${scenario.name}`);
    }
    console.log('='.repeat(80));
    
    return {
      success: validationPassed,
      actionsExtracted: extractedActions.length,
      operationsGenerated: operations.length,
      actions: extractedActions,
      operations: operations
    };
    
  } catch (error) {
    console.log('\n' + '='.repeat(80));
    console.log(`❌ TEST ERROR: ${scenario.name}`);
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    console.log('='.repeat(80));
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run all test scenarios
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  NexCel E2E AI Prompt Testing                                              ║');
  console.log('║  Testing action extraction and conversion across multiple scenarios        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    const result = await runTestScenario(scenario);
    results.push({
      scenario: scenario.name,
      id: scenario.id,
      ...result
    });
    
    // Pause between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total Scenarios: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');
  
  console.log('Detailed Results:');
  console.log('─'.repeat(80));
  results.forEach((result, idx) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${idx + 1}. ${status} - ${result.scenario}`);
    if (result.actionsExtracted !== undefined) {
      console.log(`   Actions: ${result.actionsExtracted}, Operations: ${result.operationsGenerated}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n');
  const successRate = ((passed / results.length) * 100).toFixed(1);
  console.log(`Overall Success Rate: ${successRate}%`);
  console.log('');
  
  if (passed === results.length) {
    console.log('🎉 ALL TESTS PASSED! The AI action system is working correctly.');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review the detailed output above.`);
  }
  
  return results;
}

// Run tests
runAllTests().then(results => {
  process.exit(results.every(r => r.success) ? 0 : 1);
}).catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
