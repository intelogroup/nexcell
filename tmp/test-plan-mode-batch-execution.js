/**
 * Plan Mode Batch Execution Test
 * 
 * This script tests the plan mode workflow where multiple AI actions
 * are accumulated and then executed all at once when switching to act mode.
 * 
 * Usage: node tmp/test-plan-mode-batch-execution.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions (same as extended scenarios)
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
        
        case 'addSheet': {
          // Sheet operations don't generate cell operations
          // but we track them for validation
          operations.push({
            address: 'SHEET',
            type: 'metadata',
            value: `Create sheet: ${action.sheetName || action.name}`
          });
          break;
        }
        
        case 'setStyle': {
          // Style operations tracked separately
          operations.push({
            address: action.cell || action.range?.start,
            type: 'style',
            value: JSON.stringify(action.style)
          });
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

// Plan mode simulation
class PlanModeSimulator {
  constructor() {
    this.mode = 'plan'; // 'plan' or 'act'
    this.accumulatedActions = [];
    this.appliedOperations = [];
  }
  
  setMode(mode) {
    console.log(`\n🔄 Switching mode: ${this.mode} → ${mode}`);
    this.mode = mode;
    
    // When switching to act mode, prompt to execute accumulated plan
    if (mode === 'act' && this.accumulatedActions.length > 0) {
      console.log(`\n📋 Plan contains ${this.accumulatedActions.length} action groups`);
      console.log('💡 Would you like to execute the plan? (simulating YES)');
      return true; // Would prompt user in real app
    }
    
    return false;
  }
  
  processAIResponse(response, stepNumber) {
    console.log(`\n--- Step ${stepNumber}: Processing AI Response ---`);
    
    const actions = extractActionsFromReply(response);
    console.log(`Extracted ${actions.length} actions`);
    
    if (this.mode === 'plan') {
      // In plan mode: accumulate actions but don't apply
      console.log('📝 PLAN MODE: Actions accumulated (not applied)');
      this.accumulatedActions.push({
        step: stepNumber,
        actions: actions
      });
      
      console.log(`Total action groups in plan: ${this.accumulatedActions.length}`);
      return { accumulated: true, actions };
      
    } else {
      // In act mode: convert and apply immediately
      console.log('⚡ ACT MODE: Converting and applying actions');
      const operations = convertToWorkbookActions(actions);
      console.log(`Generated ${operations.length} operations`);
      
      this.appliedOperations.push(...operations);
      return { applied: true, operations };
    }
  }
  
  executePlan() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  EXECUTING ACCUMULATED PLAN                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    const allOperations = [];
    
    this.accumulatedActions.forEach((group, idx) => {
      console.log(`\nExecuting action group ${idx + 1}/${this.accumulatedActions.length}:`);
      console.log(`  Step: ${group.step}`);
      console.log(`  Actions: ${group.actions.length}`);
      
      const operations = convertToWorkbookActions(group.actions);
      console.log(`  Operations: ${operations.length}`);
      
      allOperations.push(...operations);
    });
    
    this.appliedOperations = allOperations;
    this.accumulatedActions = []; // Clear plan after execution
    
    console.log(`\n✅ Plan executed successfully!`);
    console.log(`Total operations applied: ${allOperations.length}`);
    
    return allOperations;
  }
  
  getState() {
    return {
      mode: this.mode,
      accumulatedActionGroups: this.accumulatedActions.length,
      totalAccumulatedActions: this.accumulatedActions.reduce((sum, g) => sum + g.actions.length, 0),
      appliedOperations: this.appliedOperations.length
    };
  }
}

// Test scenario: 5-step workflow in plan mode
const PLAN_MODE_WORKFLOW = {
  steps: [
    {
      prompt: 'Create three sheets: Sales, Expenses, Summary',
      response: `<actions>[{"type":"addSheet","sheetName":"Sales"},{"type":"addSheet","sheetName":"Expenses"},{"type":"addSheet","sheetName":"Summary"}]</actions>`
    },
    {
      prompt: 'In Sales sheet, add headers: Product, Q1, Q2, Q3, Q4, Total',
      response: `<actions>[{"type":"setRange","range":{"start":"A1","end":"F1"},"values":[["Product","Q1","Q2","Q3","Q4","Total"]]}]</actions>`
    },
    {
      prompt: 'Add 5 products with quarterly sales data',
      response: `<actions>[{"type":"setRange","range":{"start":"A2","end":"E6"},"values":[["Laptop",15000,18000,22000,25000],["Mouse",800,950,1100,1200],["Keyboard",1200,1400,1600,1800],["Monitor",9000,10000,11000,12000],["Webcam",600,700,800,900]]}]</actions>`
    },
    {
      prompt: 'Add formulas in Total column to sum quarterly sales',
      response: `<actions>[{"type":"setCellFormula","cell":"F2","formula":"=SUM(B2:E2)"},{"type":"setCellFormula","cell":"F3","formula":"=SUM(B3:E3)"},{"type":"setCellFormula","cell":"F4","formula":"=SUM(B4:E4)"},{"type":"setCellFormula","cell":"F5","formula":"=SUM(B5:E5)"},{"type":"setCellFormula","cell":"F6","formula":"=SUM(B6:E6)"}]</actions>`
    },
    {
      prompt: 'Apply bold formatting to headers',
      response: `<actions>[{"type":"setStyle","range":{"start":"A1","end":"F1"},"style":{"fontWeight":"bold","backgroundColor":"#E8E8E8"}}]</actions>`
    }
  ]
};

// Run the test
async function testPlanModeBatchExecution() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Plan Mode Batch Execution Test                                            ║');
  console.log('║  Simulating multi-step workflow with plan accumulation and batch execution ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  
  const simulator = new PlanModeSimulator();
  
  // Phase 1: Accumulate actions in PLAN mode
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('PHASE 1: PLAN MODE - Accumulating Actions');
  console.log('═══════════════════════════════════════════════════════════════');
  
  for (let i = 0; i < PLAN_MODE_WORKFLOW.steps.length; i++) {
    const step = PLAN_MODE_WORKFLOW.steps[i];
    console.log(`\n📝 User Prompt ${i + 1}: "${step.prompt}"`);
    
    const result = simulator.processAIResponse(step.response, i + 1);
    
    if (result.accumulated) {
      console.log(`✓ Actions accumulated in plan (not applied to workbook)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Check accumulated state
  console.log('\n\n--- Plan Mode State ---');
  const planState = simulator.getState();
  console.log(`Mode: ${planState.mode}`);
  console.log(`Action groups accumulated: ${planState.accumulatedActionGroups}`);
  console.log(`Total actions accumulated: ${planState.totalAccumulatedActions}`);
  console.log(`Operations applied: ${planState.appliedOperations} (should be 0)`);
  
  // Phase 2: Switch to ACT mode and execute plan
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('PHASE 2: SWITCH TO ACT MODE');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const shouldExecute = simulator.setMode('act');
  
  if (shouldExecute) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const operations = simulator.executePlan();
    
    // Analyze executed operations
    console.log('\n--- Operation Analysis ---');
    const opTypes = {};
    operations.forEach(op => {
      opTypes[op.type] = (opTypes[op.type] || 0) + 1;
    });
    
    console.log('Operations by type:');
    Object.entries(opTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Verify results
    console.log('\n--- Validation ---');
    const hasSheets = operations.some(op => op.type === 'metadata');
    const hasHeaders = operations.some(op => op.address === 'A1');
    const hasData = operations.some(op => op.type === 'number');
    const hasFormulas = operations.some(op => op.type === 'formula');
    const hasStyles = operations.some(op => op.type === 'style');
    
    console.log(`✓ Sheet creation: ${hasSheets ? 'YES' : 'NO'}`);
    console.log(`✓ Headers added: ${hasHeaders ? 'YES' : 'NO'}`);
    console.log(`✓ Data populated: ${hasData ? 'YES' : 'NO'}`);
    console.log(`✓ Formulas created: ${hasFormulas ? 'YES' : 'NO'}`);
    console.log(`✓ Styles applied: ${hasStyles ? 'YES' : 'NO'}`);
    
    const allPassed = hasSheets && hasHeaders && hasData && hasFormulas && hasStyles;
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    if (allPassed) {
      console.log('✅ TEST PASSED: Plan mode batch execution works correctly!');
      console.log(`   - Accumulated ${PLAN_MODE_WORKFLOW.steps.length} action groups`);
      console.log(`   - Executed ${operations.length} operations in batch`);
      console.log(`   - All operation types validated`);
    } else {
      console.log('❌ TEST FAILED: Some operations missing');
    }
    console.log('═══════════════════════════════════════════════════════════════');
    
    return allPassed;
  }
  
  return false;
}

// Phase 3: Test immediate ACT mode (no accumulation)
async function testImmediateActMode() {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  ACT Mode Immediate Execution Test                                         ║');
  console.log('║  Verifying that ACT mode applies operations immediately                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  
  const simulator = new PlanModeSimulator();
  simulator.setMode('act');
  
  console.log('\n📝 User Prompt: "Add sample data to A1:B3"');
  const response = `<actions>[{"type":"setRange","range":{"start":"A1","end":"B3"},"values":[["Name","Age"],["Alice",28],["Bob",34]]}]</actions>`;
  
  const result = simulator.processAIResponse(response, 1);
  
  if (result.applied && result.operations.length === 6) {
    console.log('\n✅ ACT MODE TEST PASSED: Operations applied immediately');
    console.log(`   - Generated ${result.operations.length} operations`);
    console.log(`   - No plan accumulation`);
    return true;
  } else {
    console.log('\n❌ ACT MODE TEST FAILED');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const test1 = await testPlanModeBatchExecution();
  const test2 = await testImmediateActMode();
  
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  FINAL RESULTS                                                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Plan Mode Batch Execution: ${test1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Act Mode Immediate Execution: ${test2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (test1 && test2) {
    console.log('🎉 ALL PLAN MODE TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed.');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
