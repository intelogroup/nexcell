/**
 * Demo Test Using Test Utilities
 * 
 * Demonstrates how to use the test-utils.js module for creating
 * reusable, maintainable tests.
 * 
 * Usage: node tmp/test-utils-demo.js
 */

import TestUtils from './test-utils.js';

const {
  DataGenerators,
  MockResponses,
  Validators,
  TestScenarioBuilder,
  WorkbookStateSimulator,
  PerformanceTimer,
  extractActionsFromReply,
  convertToWorkbookActions
} = TestUtils;

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║  Test Utilities Demo                                                       ║');
console.log('║  Demonstrating reusable test fixtures and helpers                         ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

// ============================================================================
// DEMO 1: Data Generators
// ============================================================================

console.log('═══════════════════════════════════════════════════════════════');
console.log('DEMO 1: Data Generators');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Generate 5 employee names:');
const names = DataGenerators.names(5);
console.log(names);

console.log('\nGenerate 5 random salaries (40k-120k):');
const salaries = DataGenerators.numbers(5, 40000, 120000);
console.log(salaries);

console.log('\nGenerate 5 consecutive dates:');
const dates = DataGenerators.dates(5, '2024-10-15');
console.log(dates);

console.log('\nGenerate 3 employee records:');
const employees = DataGenerators.employees(3);
console.table(employees);

console.log('Generate 4 products:');
const products = DataGenerators.products(4);
console.table(products);

// ============================================================================
// DEMO 2: Mock Response Builders
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 2: Mock Response Builders');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Build fillRange mock response:');
const fillRangeMock = MockResponses.fillRange('A1', 'A5', [['Alice'], ['Bob'], ['Carol'], ['Dave'], ['Eve']]);
console.log(fillRangeMock.substring(0, 100) + '...\n');

console.log('Build setRange mock response:');
const setRangeMock = MockResponses.setRange('A1', 'B3', [['Name', 'Age'], ['Alice', 28], ['Bob', 34]]);
console.log(setRangeMock.substring(0, 100) + '...\n');

console.log('Build formula mock response:');
const formulaMock = MockResponses.setCellFormula('C1', '=SUM(A1:B1)');
console.log(formulaMock);

// ============================================================================
// DEMO 3: Test Scenario Builder
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 3: Test Scenario Builder');
console.log('═══════════════════════════════════════════════════════════════\n');

const scenario = new TestScenarioBuilder('Employee List Creation')
  .addFillRange(
    'Add employee names',
    'A1',
    'A5',
    employees.map(e => [e.name]),
    (ops) => ops.length === 3
  )
  .addFillRange(
    'Add salaries',
    'B1',
    'B5',
    employees.map(e => [e.salary]),
    (ops) => ops.length === 3
  )
  .addFormula(
    'Add total formula',
    'B6',
    '=SUM(B1:B5)',
    (ops) => ops.some(op => op.type === 'formula')
  )
  .build();

console.log('Built scenario:', scenario.name);
console.log('Steps:', scenario.prompts.length);
console.log('Prompts:');
scenario.prompts.forEach((prompt, i) => {
  console.log(`  ${i + 1}. ${prompt}`);
});

// ============================================================================
// DEMO 4: Validators
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 4: Validation Helpers');
console.log('═══════════════════════════════════════════════════════════════\n');

// Create some test operations
const testActions = extractActionsFromReply(setRangeMock);
const testOps = convertToWorkbookActions(testActions);

console.log('Test operations:', testOps.length);
console.table(testOps);

console.log('\nValidation Results:');
console.log('✓ Operation count (6):', Validators.operationCount(testOps, 6));
console.log('✓ Has address A1:', Validators.addressRange(testOps, 'A1', 'B3'));
console.log('✓ No errors:', Validators.noErrors(testOps));
console.log('✓ Cell A1 = "Name":', Validators.cellValue(testOps, 'A1', 'Name'));
console.log('✓ Cell B2 = 28:', Validators.cellValue(testOps, 'B2', 28));

// ============================================================================
// DEMO 5: Workbook State Simulator
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 5: Workbook State Simulator');
console.log('═══════════════════════════════════════════════════════════════\n');

const workbook = new WorkbookStateSimulator();

console.log('Initial state:', workbook.getStats());

console.log('\nApplying operations...');
workbook.applyOperations(testOps);

console.log('After operations:', workbook.getStats());

console.log('\nCell values:');
console.log('A1:', workbook.getCellValue('A1'));
console.log('B1:', workbook.getCellValue('B1'));
console.log('A2:', workbook.getCellValue('A2'));
console.log('B2:', workbook.getCellValue('B2'));

console.log('\nGet range A1:B3:');
const rangeValues = workbook.getRange('A1', 'B3');
console.table(rangeValues);

// ============================================================================
// DEMO 6: Performance Measurement
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 6: Performance Measurement');
console.log('═══════════════════════════════════════════════════════════════\n');

const timer = new PerformanceTimer('Operation Conversion');

// Simulate multiple conversions
for (let i = 0; i < 10; i++) {
  const largeData = DataGenerators.numbers(100, 0, 1000);
  const mockResponse = MockResponses.fillRange('A1', 'A100', largeData.map(n => [n]));
  
  timer.start();
  const actions = extractActionsFromReply(mockResponse);
  const operations = convertToWorkbookActions(actions);
  timer.stop();
}

timer.report();

// ============================================================================
// DEMO 7: Complex Workflow Test
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 7: Complete Workflow Test');
console.log('═══════════════════════════════════════════════════════════════\n');

// Generate sales data
const salesData = DataGenerators.salesData(3);
console.log('Generated sales data:');
console.table(salesData);

// Build test scenario
const salesScenario = new TestScenarioBuilder('Quarterly Sales Report');

// Step 1: Headers
const headers = ['Product', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'];
salesScenario.addSetRange(
  'Add headers',
  'A1',
  'F1',
  [headers],
  (ops) => ops.length === 6
);

// Step 2: Product names and quarterly data
const productData = salesData.map(s => [s.product, s.Q1, s.Q2, s.Q3, s.Q4]);
salesScenario.addSetRange(
  'Add product data',
  'A2',
  'E4',
  productData,
  (ops) => ops.length === 15 // 3 rows × 5 columns
);

// Step 3: Total formulas
for (let row = 2; row <= 4; row++) {
  salesScenario.addFormula(
    `Add total formula for row ${row}`,
    `F${row}`,
    `=SUM(B${row}:E${row})`,
    (ops) => ops.some(op => op.type === 'formula')
  );
}

const builtScenario = salesScenario.build();

console.log('\nExecuting scenario:', builtScenario.name);
console.log('Total steps:', builtScenario.prompts.length);

const workbook2 = new WorkbookStateSimulator();
let totalOperations = 0;

builtScenario.responses.forEach((response, i) => {
  console.log(`\nStep ${i + 1}: ${builtScenario.prompts[i]}`);
  
  const actions = extractActionsFromReply(response);
  const operations = convertToWorkbookActions(actions);
  
  console.log(`  Actions: ${actions.length}, Operations: ${operations.length}`);
  
  const validationPassed = builtScenario.validations[i](operations);
  console.log(`  Validation: ${validationPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  workbook2.applyOperations(operations);
  totalOperations += operations.length;
});

console.log('\n--- Final Workbook State ---');
console.log('Total operations applied:', totalOperations);
console.log('Workbook stats:', workbook2.getStats());

console.log('\nFinal data (A1:F4):');
const finalRange = workbook2.getRange('A1', 'F4');
console.table(finalRange);

// ============================================================================
// Summary
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║  DEMO COMPLETE                                                             ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

console.log('Test Utilities Demonstrated:');
console.log('✅ DataGenerators - Generate realistic test data');
console.log('✅ MockResponses - Build AI response mocks');
console.log('✅ TestScenarioBuilder - Create complex test scenarios');
console.log('✅ Validators - Validate operation results');
console.log('✅ WorkbookStateSimulator - Simulate workbook state changes');
console.log('✅ PerformanceTimer - Measure execution performance');
console.log('\nThese utilities make tests:');
console.log('  • More maintainable (reusable components)');
console.log('  • More readable (declarative scenario building)');
console.log('  • More reliable (consistent validation)');
console.log('  • More performant (built-in profiling)');
console.log('\n');
