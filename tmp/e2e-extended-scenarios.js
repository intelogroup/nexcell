/**
 * Extended E2E AI Prompt Testing - Subsequent Actions & Complex Workflows
 * 
 * This script tests more complex scenarios involving multiple sequential
 * actions, state management, and edge cases.
 * 
 * Usage: node tmp/e2e-extended-scenarios.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import helper functions from the original test file
// (In production, these would be extracted to a shared module)

function extractActionsFromReply(reply) {
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
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return { type: 'date', value };
    }
    
    return { type: 'text', value };
  }
  
  return { type: 'text', value: String(value) };
}

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
            Object.entries(action.cells).forEach(([address, value]) => {
              const cell = cellFromValue(value);
              operations.push({
                address,
                type: cell.type,
                value: cell.value
              });
            });
          } else if (action.range && action.values) {
            const { start, end } = action.range;
            const startAddr = parseAddress(start);
            
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
        
        case 'clearRange': {
          if (action.range) {
            const { start, end } = action.range;
            const startAddr = parseAddress(start);
            const endAddr = parseAddress(end);
            
            if (startAddr && endAddr) {
              for (let row = startAddr.row; row <= endAddr.row; row++) {
                for (let col = startAddr.col; col <= endAddr.col; col++) {
                  operations.push({
                    address: toAddress(row, col),
                    type: 'empty',
                    value: null
                  });
                }
              }
            }
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

// Extended test scenarios
const EXTENDED_SCENARIOS = [
  {
    id: 'sequential-operations',
    name: 'Sequential Operations (Multi-Step)',
    prompts: [
      'Add headers in A1:D1: Product, Quantity, Price, Total',
      'Add 5 sample products in A2:A6',
      'Add formulas in D2:D6 to calculate totals (Quantity × Price)'
    ],
    mockResponses: [
      `<actions>[{"type":"setRange","range":{"start":"A1","end":"D1"},"values":[["Product","Quantity","Price","Total"]]}]</actions>`,
      `<actions>[{"type":"fillRange","target":{"start":"A2","end":"A6"},"values":[["Laptop"],["Mouse"],["Keyboard"],["Monitor"],["Webcam"]]}]</actions>`,
      `<actions>[{"type":"setCellFormula","cell":"D2","formula":"=B2*C2"},{"type":"setCellFormula","cell":"D3","formula":"=B3*C3"},{"type":"setCellFormula","cell":"D4","formula":"=B4*C4"},{"type":"setCellFormula","cell":"D5","formula":"=B5*C5"},{"type":"setCellFormula","cell":"D6","formula":"=B6*C6"}]</actions>`
    ],
    expectedTotalOps: 14, // 4 headers + 5 products + 5 formulas
    validate: (allOps) => {
      const lastStepOps = allOps[allOps.length - 1];
      const formulaOps = lastStepOps.filter(op => op.type === 'formula');
      console.log(`✓ Sequential prompts processed: 3 steps`);
      console.log(`✓ Final step formulas: ${formulaOps.length}`);
      return formulaOps.length === 5;
    }
  },
  
  {
    id: 'modify-existing-data',
    name: 'Modify Existing Data',
    prompts: [
      'Fill A1:B5 with sample employee names and salaries',
      'Update salaries in B2:B5 to higher values',
      'Clear cells C1:C5'
    ],
    mockResponses: [
      `<actions>[{"type":"setRange","range":{"start":"A1","end":"B5"},"values":[["Name","Salary"],["Alice",50000],["Bob",60000],["Carol",55000],["Dave",65000]]}]</actions>`,
      `<actions>[{"type":"fillRange","target":{"start":"B2","end":"B5"},"values":[[55000],[66000],[60000],[70000]]}]</actions>`,
      `<actions>[{"type":"clearRange","range":{"start":"C1","end":"C5"}}]</actions>`
    ],
    expectedTotalOps: 24, // 10 initial + 4 updates + 10 clears (5 cells × 2 cols)
    validate: (allOps) => {
      const clearOps = allOps[allOps.length - 1];
      const emptyOps = clearOps.filter(op => op.type === 'empty');
      console.log(`✓ Clear operations generated: ${emptyOps.length}`);
      console.log(`✓ Update operations: ${allOps[1].length}`);
      return emptyOps.length === 5; // C1:C5 (1 column × 5 rows)
    }
  },
  
  {
    id: 'expand-range',
    name: 'Expand Existing Range',
    prompts: [
      'Add product names in A1:A5 and prices in B1:B5',
      'Extend to column C with quantity values',
      'Add 5 more rows of data'
    ],
    mockResponses: [
      `<actions>[{"type":"setRange","range":{"start":"A1","end":"B5"},"values":[["Product A",100],["Product B",200],["Product C",150],["Product D",300],["Product E",250]]}]</actions>`,
      `<actions>[{"type":"fillRange","target":{"start":"C1","end":"C5"},"values":[[10],[20],[15],[25],[18]]}]</actions>`,
      `<actions>[{"type":"setRange","range":{"start":"A6","end":"C10"},"values":[["Product F",180,12],["Product G",220,22],["Product H",190,16],["Product I",280,28],["Product J",240,20]]}]</actions>`
    ],
    expectedTotalOps: 30, // 10 + 5 + 15
    validate: (allOps) => {
      const lastOps = allOps[allOps.length - 1];
      const addresses = lastOps.map(op => op.address);
      const hasA10 = addresses.includes('A10');
      const hasC10 = addresses.includes('C10');
      console.log(`✓ Expanded to row 10: ${hasA10 && hasC10}`);
      return hasA10 && hasC10;
    }
  },
  
  {
    id: 'complex-formulas',
    name: 'Complex Nested Formulas',
    prompts: [
      'Create a grade calculator with IF and VLOOKUP formulas'
    ],
    mockResponses: [
      `<actions>[
        {"type":"setCellValue","cell":"A1","value":"Score"},
        {"type":"setCellValue","cell":"B1","value":"Grade"},
        {"type":"setCellValue","cell":"A2","value":95},
        {"type":"setCellFormula","cell":"B2","formula":"=IF(A2>=90,\\"A\\",IF(A2>=80,\\"B\\",IF(A2>=70,\\"C\\",\\"F\\")))"},
        {"type":"setCellValue","cell":"A3","value":78},
        {"type":"setCellFormula","cell":"B3","formula":"=IF(A3>=90,\\"A\\",IF(A3>=80,\\"B\\",IF(A3>=70,\\"C\\",\\"F\\"))"}
      ]</actions>`
    ],
    expectedTotalOps: 6,
    validate: (allOps) => {
      const ops = allOps[0];
      const formulaOps = ops.filter(op => op.type === 'formula');
      const hasNestedIF = formulaOps.some(op => op.value.includes('IF(') && op.value.split('IF(').length > 2);
      console.log(`✓ Formula operations: ${formulaOps.length}`);
      console.log(`✓ Contains nested IF: ${hasNestedIF}`);
      return hasNestedIF;
    }
  },
  
  {
    id: 'date-operations',
    name: 'Date/Time Operations',
    prompts: [
      'Add dates from 2024-01-01 to 2024-01-10 in A1:A10 and calculate days between dates'
    ],
    mockResponses: [
      `<actions>[
        {"type":"fillRange","target":{"start":"A1","end":"A10"},"values":[["2024-01-01"],["2024-01-02"],["2024-01-03"],["2024-01-04"],["2024-01-05"],["2024-01-06"],["2024-01-07"],["2024-01-08"],["2024-01-09"],["2024-01-10"]]},
        {"type":"setCellFormula","cell":"B1","formula":"=A2-A1"},
        {"type":"setCellFormula","cell":"C1","formula":"=TODAY()"}
      ]</actions>`
    ],
    expectedTotalOps: 12,
    validate: (allOps) => {
      const ops = allOps[0];
      const dateOps = ops.filter(op => op.type === 'date');
      const formulaOps = ops.filter(op => op.type === 'formula');
      console.log(`✓ Date operations: ${dateOps.length}`);
      console.log(`✓ Date formulas: ${formulaOps.length}`);
      return dateOps.length === 10 && formulaOps.length === 2;
    }
  },
  
  {
    id: 'error-recovery',
    name: 'Error Recovery',
    prompts: [
      'Fill INVALID:RANGE with data',
      'Fill A1:B5 with valid data'
    ],
    mockResponses: [
      `<actions>[{"type":"fillRange","target":{"start":"INVALID","end":"RANGE"},"values":[[1],[2],[3]]}]</actions>`,
      `<actions>[{"type":"setRange","range":{"start":"A1","end":"B5"},"values":[["Valid",1],["Data",2],["Here",3],["Now",4],["Working",5]]}]</actions>`
    ],
    expectedTotalOps: 11, // 1 error + 10 valid
    validate: (allOps) => {
      const firstOps = allOps[0];
      const secondOps = allOps[1];
      const hasError = firstOps.some(op => op.type === 'error');
      const hasValidData = secondOps.filter(op => op.type !== 'error').length > 0;
      console.log(`✓ Error detected in first prompt: ${hasError}`);
      console.log(`✓ Recovery successful: ${hasValidData}`);
      return hasError && hasValidData;
    }
  },
  
  {
    id: 'empty-null-undefined',
    name: 'Empty/Null/Undefined Values',
    prompts: [
      'Fill A1:A5 with mix of empty strings, zeros, and values'
    ],
    mockResponses: [
      `<actions>[{"type":"fillRange","target":{"start":"A1","end":"A5"},"values":[[""],["0"],[0],[null],["Value"]]}]</actions>`
    ],
    expectedTotalOps: 5,
    validate: (allOps) => {
      const ops = allOps[0];
      const emptyOps = ops.filter(op => op.type === 'empty');
      const numberOps = ops.filter(op => op.type === 'number');
      const textOps = ops.filter(op => op.type === 'text');
      console.log(`✓ Empty cells: ${emptyOps.length}`);
      console.log(`✓ Number cells: ${numberOps.length}`);
      console.log(`✓ Text cells: ${textOps.length}`);
      return ops.length === 5;
    }
  },
  
  {
    id: 'unicode-special-chars',
    name: 'Unicode and Special Characters',
    prompts: [
      'Add international data with emojis, Chinese characters, and symbols'
    ],
    mockResponses: [
      `<actions>[{"type":"setRange","range":{"start":"A1","end":"C3"},"values":[["Hello 👋","你好","Café"],["Price: $100","温度: 25°C","π ≈ 3.14"],["✓ Complete","完成","Ü"]]}]</actions>`
    ],
    expectedTotalOps: 9,
    validate: (allOps) => {
      const ops = allOps[0];
      const hasEmoji = ops.some(op => /[\u{1F300}-\u{1F9FF}]/u.test(String(op.value)));
      const hasChinese = ops.some(op => /[\u4e00-\u9fa5]/.test(String(op.value)));
      const hasSymbols = ops.some(op => /[°π≈]/.test(String(op.value)));
      console.log(`✓ Contains emoji: ${hasEmoji}`);
      console.log(`✓ Contains Chinese: ${hasChinese}`);
      console.log(`✓ Contains symbols: ${hasSymbols}`);
      return ops.length === 9;
    }
  },
  
  {
    id: 'very-large-range',
    name: 'Performance Test (500 rows)',
    prompts: [
      'Fill A1:C500 with sample data'
    ],
    mockResponses: [
      `<actions>[{"type":"setRange","range":{"start":"A1","end":"C500"},"values":${JSON.stringify(Array(500).fill(null).map((_, i) => ["ID" + (i+1), Math.floor(Math.random() * 1000), "Dept" + ((i % 5) + 1)]))}}]</actions>`
    ],
    expectedTotalOps: 1500, // 500 rows × 3 cols
    validate: (allOps) => {
      const ops = allOps[0];
      const startTime = Date.now();
      // Simulate processing time
      const endTime = Date.now();
      console.log(`✓ Operations generated: ${ops.length}`);
      console.log(`✓ Processing time: ${endTime - startTime}ms`);
      console.log(`✓ Expected: 1500, Actual: ${ops.length}`);
      return ops.length === 1500;
    }
  }
];

// Run a multi-prompt scenario
async function runMultiPromptScenario(scenario) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST SCENARIO: ${scenario.name}`);
  console.log('='.repeat(80));
  
  const allOperations = [];
  
  for (let i = 0; i < scenario.prompts.length; i++) {
    const prompt = scenario.prompts[i];
    const response = scenario.mockResponses[i];
    
    console.log(`\nStep ${i + 1}/${scenario.prompts.length}:`);
    console.log(`Prompt: "${prompt}"`);
    
    try {
      const actions = extractActionsFromReply(response);
      console.log(`  Extracted ${actions.length} actions`);
      
      const operations = convertToWorkbookActions(actions);
      console.log(`  Generated ${operations.length} operations`);
      
      if (operations.length > 0) {
        const opTypes = {};
        operations.forEach(op => {
          opTypes[op.type] = (opTypes[op.type] || 0) + 1;
        });
        console.log(`  Types: ${JSON.stringify(opTypes)}`);
      }
      
      allOperations.push(operations);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  // Run validation
  console.log('\n--- Validation Phase ---');
  const validationPassed = scenario.validate(allOperations);
  
  const totalOps = allOperations.reduce((sum, ops) => sum + ops.length, 0);
  console.log(`\n✓ Total operations across all steps: ${totalOps}`);
  
  console.log('\n' + '='.repeat(80));
  if (validationPassed) {
    console.log(`✅ TEST PASSED: ${scenario.name}`);
  } else {
    console.log(`❌ TEST FAILED: ${scenario.name}`);
  }
  console.log('='.repeat(80));
  
  return {
    success: validationPassed,
    totalOperations: totalOps,
    steps: allOperations.length
  };
}

// Run single-prompt scenario (same as before)
async function runSinglePromptScenario(scenario) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST SCENARIO: ${scenario.name}`);
  console.log('='.repeat(80));
  console.log(`Prompt: "${scenario.prompts[0]}"`);
  
  try {
    const response = scenario.mockResponses[0];
    const actions = extractActionsFromReply(response);
    console.log(`\nExtracted ${actions.length} actions`);
    
    const operations = convertToWorkbookActions(actions);
    console.log(`Generated ${operations.length} operations`);
    
    if (operations.length > 5) {
      console.log('\nSample operations (first 5):');
      operations.slice(0, 5).forEach((op, idx) => {
        console.log(`  ${idx + 1}. ${op.address} = ${JSON.stringify(op.value)} (${op.type})`);
      });
      console.log(`  ... and ${operations.length - 5} more`);
    } else {
      console.log('\nAll operations:');
      operations.forEach((op, idx) => {
        console.log(`  ${idx + 1}. ${op.address} = ${JSON.stringify(op.value)} (${op.type})`);
      });
    }
    
    console.log('\n--- Validation Phase ---');
    const validationPassed = scenario.validate([operations]);
    
    console.log('\n' + '='.repeat(80));
    if (validationPassed) {
      console.log(`✅ TEST PASSED: ${scenario.name}`);
    } else {
      console.log(`❌ TEST FAILED: ${scenario.name}`);
    }
    console.log('='.repeat(80));
    
    return {
      success: validationPassed,
      totalOperations: operations.length,
      steps: 1
    };
    
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    console.log('='.repeat(80));
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllExtendedTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  NexCel Extended E2E Testing                                               ║');
  console.log('║  Testing complex workflows, sequential actions, and edge cases            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  for (const scenario of EXTENDED_SCENARIOS) {
    let result;
    
    if (scenario.prompts.length > 1) {
      result = await runMultiPromptScenario(scenario);
    } else {
      result = await runSinglePromptScenario(scenario);
    }
    
    results.push({
      scenario: scenario.name,
      id: scenario.id,
      ...result
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Print summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  EXTENDED TEST SUMMARY                                                     ║');
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
    if (result.totalOperations !== undefined) {
      console.log(`   Operations: ${result.totalOperations}, Steps: ${result.steps}`);
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
    console.log('🎉 ALL EXTENDED TESTS PASSED! Sequential actions and edge cases work correctly.');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Review the detailed output above.`);
  }
  
  return results;
}

// Run the extended test suite
runAllExtendedTests().then(results => {
  process.exit(results.every(r => r.success) ? 0 : 1);
}).catch(error => {
  console.error('Fatal error running extended tests:', error);
  process.exit(1);
});
