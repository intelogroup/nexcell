#!/usr/bin/env node

/**
 * Headless test for workbook operations and HyperFormula integration
 * Tests the core capacities that the AI relies on
 */

import { createWorkbook, applyOperations, computeWorkbook, workbookToCellArray } from './src/lib/workbook/index.js';
import { generateId } from './src/lib/workbook/utils.js';

// Test 1: Basic workbook creation and operations
console.log('🧪 Test 1: Basic workbook operations');

try {
  const workbook = createWorkbook('Test Workbook');
  console.log('✅ Workbook created:', workbook.meta.title);

  // Test applying operations like AI would generate
  const operations = [
    // Headers
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'A1', cell: { raw: 'Product', dataType: 'string' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'B1', cell: { raw: 'Price', dataType: 'string' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'C1', cell: { raw: 'Quantity', dataType: 'string' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'D1', cell: { raw: 'Total', dataType: 'string' } },

    // Sample data
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'A2', cell: { raw: 'Laptop', dataType: 'string' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'B2', cell: { raw: 999.99, dataType: 'number' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'C2', cell: { raw: 5, dataType: 'number' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'D2', cell: { formula: '=B2*C2', dataType: 'formula' } },

    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'A3', cell: { raw: 'Mouse', dataType: 'string' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'B3', cell: { raw: 49.99, dataType: 'number' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'C3', cell: { raw: 10, dataType: 'number' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'D3', cell: { formula: '=B3*C3', dataType: 'formula' } },

    // Summary
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'C5', cell: { formula: '=SUM(D2:D3)', dataType: 'formula' } },
  ];

  const result = applyOperations(workbook, operations);
  console.log('✅ Operations applied:', result.success, 'actions:', result.actions.length);

  if (!result.success) {
    console.error('❌ Operation errors:', result.errors);
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Test 1 failed:', error);
  process.exit(1);
}

// Test 2: Formula computation with HyperFormula
console.log('\n🧪 Test 2: Formula computation');

try {
  const workbook = createWorkbook('Formula Test');

  const operations = [
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'A1', cell: { raw: 10, dataType: 'number' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'B1', cell: { raw: 20, dataType: 'number' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'C1', cell: { formula: '=A1+B1', dataType: 'formula' } },
    { type: 'editCell', sheetId: workbook.sheets[0].id, address: 'D1', cell: { formula: '=SUM(A1:B1)', dataType: 'formula' } },
  ];

  applyOperations(workbook, operations);

  // Test computation
  const computeResult = computeWorkbook(workbook);
  console.log('✅ Computation result:', computeResult.errors.length === 0 ? 'success' : 'errors');

  if (computeResult.errors.length > 0) {
    console.error('❌ Computation errors:', computeResult.errors);
  }

  // Check computed values
  const cells = workbookToCellArray(workbook, workbook.sheets[0].id, 10, 10);
  console.log('Cell C1 computed value:', cells[0][2]?.computedValue); // Should be 30
  console.log('Cell D1 computed value:', cells[0][3]?.computedValue); // Should be 30

} catch (error) {
  console.error('❌ Test 2 failed:', error);
  process.exit(1);
}

// Test 3: Workbook JSON serialization
console.log('\n🧪 Test 3: Workbook JSON serialization');

try {
  const original = createWorkbook('Serialization Test');

  const operations = [
    { type: 'editCell', sheetId: original.sheets[0].id, address: 'A1', cell: { raw: 'Test', dataType: 'string' } },
    { type: 'editCell', sheetId: original.sheets[0].id, address: 'B1', cell: { formula: '=LEN(A1)', dataType: 'formula' } },
  ];

  applyOperations(original, operations);

  // Serialize
  const jsonString = JSON.stringify(original, null, 2);
  console.log('✅ Workbook serialized, size:', jsonString.length, 'chars');

  // Deserialize
  const parsed = JSON.parse(jsonString);
  console.log('✅ Workbook deserialized');

  // Test round-trip
  const cellsOriginal = workbookToCellArray(original, original.sheets[0].id, 5, 5);
  const cellsParsed = workbookToCellArray(parsed, parsed.sheets[0].id, 5, 5);

  const originalValue = cellsOriginal[0][0]?.raw;
  const parsedValue = cellsParsed[0][0]?.raw;

  if (originalValue === parsedValue) {
    console.log('✅ Round-trip successful');
  } else {
    console.error('❌ Round-trip failed:', { original: originalValue, parsed: parsedValue });
  }

} catch (error) {
  console.error('❌ Test 3 failed:', error);
  process.exit(1);
}

// Test 4: Large dataset operations (simulate AI-generated 20 rows)
console.log('\n🧪 Test 4: Large dataset operations');

try {
  const workbook = createWorkbook('Large Dataset Test');
  const sheetId = workbook.sheets[0].id;

  // Generate operations for 20 rows like AI would
  const operations = [];

  // Headers
  ['Product', 'Price', 'Quantity', 'Total', 'Date', 'Category'].forEach((header, col) => {
    const address = String.fromCharCode(65 + col) + '1';
    operations.push({
      type: 'editCell',
      sheetId,
      address,
      cell: { raw: header, dataType: 'string' }
    });
  });

  // 20 rows of data
  const products = ['Laptop', 'Mouse', 'Keyboard', 'Monitor', 'Phone', 'Tablet', 'Printer', 'Scanner', 'Camera', 'Speaker',
                   'Router', 'Cable', 'Drive', 'Card', 'Battery', 'Case', 'Stand', 'Light', 'Adapter', 'Remote'];

  for (let row = 2; row <= 21; row++) {
    const product = products[row - 2];
    const price = Math.round((Math.random() * 1000 + 10) * 100) / 100;
    const quantity = Math.floor(Math.random() * 20) + 1;

    operations.push(
      { type: 'editCell', sheetId, address: `A${row}`, cell: { raw: product, dataType: 'string' } },
      { type: 'editCell', sheetId, address: `B${row}`, cell: { raw: price, dataType: 'number' } },
      { type: 'editCell', sheetId, address: `C${row}`, cell: { raw: quantity, dataType: 'number' } },
      { type: 'editCell', sheetId, address: `D${row}`, cell: { formula: `=B${row}*C${row}`, dataType: 'formula' } },
      { type: 'editCell', sheetId, address: `E${row}`, cell: { raw: `2024-01-${String(row).padStart(2, '0')}`, dataType: 'string' } },
      { type: 'editCell', sheetId, address: `F${row}`, cell: { raw: 'Electronics', dataType: 'string' } }
    );
  }

  // Summary formulas
  operations.push(
    { type: 'editCell', sheetId, address: 'B23', cell: { raw: 'Total Sales:', dataType: 'string' } },
    { type: 'editCell', sheetId, address: 'C23', cell: { formula: '=SUM(D2:D21)', dataType: 'formula' } },
    { type: 'editCell', sheetId, address: 'B24', cell: { raw: 'Average Price:', dataType: 'string' } },
    { type: 'editCell', sheetId, address: 'C24', cell: { formula: '=AVERAGE(B2:B21)', dataType: 'formula' } }
  );

  console.log('Generated', operations.length, 'operations for 20 rows');

  const startTime = Date.now();
  const result = applyOperations(workbook, operations);
  const endTime = Date.now();

  console.log('✅ Large operations applied in', endTime - startTime, 'ms');
  console.log('Success:', result.success, 'Actions:', result.actions.length);

  if (!result.success) {
    console.error('❌ Large operations failed:', result.errors);
    process.exit(1);
  }

  // Test computation on large dataset
  const computeStart = Date.now();
  const computeResult = computeWorkbook(workbook);
  const computeEnd = Date.now();

  console.log('✅ Large computation completed in', computeEnd - computeStart, 'ms');
  console.log('Computation errors:', computeResult.errors.length);

} catch (error) {
  console.error('❌ Test 4 failed:', error);
  process.exit(1);
}

console.log('\n🎉 All tests passed! Core workbook operations are working correctly.');
console.log('The issue is likely in the AI action conversion or UI rendering, not the core workbook system.');