/**
 * Debug test for formula computation issue
 * Tests: A1=100, C1==A1*2 should compute to 200
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkbook } from '../utils';
import { createCellFromInput } from '../converters';
import { applyOperations, type EditCellOp } from '../operations';
import { computeWorkbook } from '../hyperformula';
import { workbookToCellArray } from '../converters';

describe('Formula Computation Debug', () => {
  it('should compute A1*2 formula correctly', () => {
    // Step 1: Create workbook
    const workbook = createWorkbook('Test Workbook');
    const sheet = workbook.sheets[0];
    
    console.log('\n=== STEP 1: Created workbook ===');
    console.log('Sheet ID:', sheet.id);
    console.log('Initial cells:', JSON.stringify(sheet.cells, null, 2));

    // Step 2: Set A1 = 100
    const a1Cell = createCellFromInput('100');
    const a1Op: EditCellOp = {
      type: 'editCell',
      sheetId: sheet.id,
      address: 'A1',
      cell: a1Cell,
    };
    
    console.log('\n=== STEP 2: Setting A1 = 100 ===');
    console.log('A1 cell:', JSON.stringify(a1Cell, null, 2));
    
    const a1Result = applyOperations(workbook, [a1Op], { sync: true });
    console.log('A1 apply result:', JSON.stringify(a1Result, null, 2));
    console.log('A1 after apply:', JSON.stringify(sheet.cells['A1'], null, 2));

    // Step 3: Set C1 = =A1*2
    const c1Cell = createCellFromInput('=A1*2');
    const c1Op: EditCellOp = {
      type: 'editCell',
      sheetId: sheet.id,
      address: 'C1',
      cell: c1Cell,
    };
    
    console.log('\n=== STEP 3: Setting C1 = =A1*2 ===');
    console.log('C1 cell:', JSON.stringify(c1Cell, null, 2));
    
    const c1Result = applyOperations(workbook, [c1Op], { sync: true });
    console.log('C1 apply result:', JSON.stringify(c1Result, null, 2));
    console.log('C1 after apply:', JSON.stringify(sheet.cells['C1'], null, 2));

    // Step 4: Force compute (should already be done by applyOperations with sync:true)
    console.log('\n=== STEP 4: Explicit computeWorkbook call ===');
    const computeResult = computeWorkbook(workbook);
    console.log('Compute result:', JSON.stringify({
      updatedCells: computeResult.recompute.updatedCells,
      errors: computeResult.recompute.errors,
      warnings: computeResult.recompute.warnings,
    }, null, 2));

    // Step 5: Check cell values after computation
    console.log('\n=== STEP 5: Cell values after computation ===');
    console.log('A1 cell:', JSON.stringify(sheet.cells['A1'], null, 2));
    console.log('C1 cell:', JSON.stringify(sheet.cells['C1'], null, 2));

    // Step 6: Convert to cell array (what UI sees)
    console.log('\n=== STEP 6: Converting to cell array (UI format) ===');
    const cellArray = workbookToCellArray(workbook, sheet.id, 5, 5);
    console.log('A1 in cell array:', JSON.stringify(cellArray[0][0], null, 2));
    console.log('C1 in cell array:', JSON.stringify(cellArray[0][2], null, 2));

    // Assertions
    console.log('\n=== STEP 7: Running assertions ===');
    
    // A1 should have raw value 100
    expect(sheet.cells['A1']).toBeDefined();
    expect(sheet.cells['A1'].raw).toBe(100);
    console.log('✓ A1.raw = 100');

    // C1 should have formula
    expect(sheet.cells['C1']).toBeDefined();
    expect(sheet.cells['C1'].formula).toBe('=A1*2');
    console.log('✓ C1.formula = =A1*2');

    // C1 should have computed value of 200
    expect(sheet.cells['C1'].computed).toBeDefined();
    console.log('C1.computed:', sheet.cells['C1'].computed);
    expect(sheet.cells['C1'].computed?.v).toBe(200);
    console.log('✓ C1.computed.v = 200');

    // Cell array should show computed value for C1
    expect(cellArray[0][2].value).toBe(200);
    console.log('✓ cellArray[0][2].value = 200 (UI will show computed value)');

    console.log('\n=== TEST PASSED ===\n');
  });

  it('should compute formula chain A1->B1->C1 correctly', () => {
    const workbook = createWorkbook('Test Chain');
    const sheet = workbook.sheets[0];
    
    console.log('\n=== Testing formula chain: A1=2, B1==A1*2, C1==B1*2 ===');

    // Set all cells
    const ops: EditCellOp[] = [
      {
        type: 'editCell',
        sheetId: sheet.id,
        address: 'A1',
        cell: createCellFromInput('2'),
      },
      {
        type: 'editCell',
        sheetId: sheet.id,
        address: 'B1',
        cell: createCellFromInput('=A1*2'),
      },
      {
        type: 'editCell',
        sheetId: sheet.id,
        address: 'C1',
        cell: createCellFromInput('=B1*2'),
      },
    ];

    const result = applyOperations(workbook, ops, { sync: true });
    console.log('Apply result:', JSON.stringify(result, null, 2));

    // Force compute
    computeWorkbook(workbook);

    console.log('A1:', JSON.stringify(sheet.cells['A1'], null, 2));
    console.log('B1:', JSON.stringify(sheet.cells['B1'], null, 2));
    console.log('C1:', JSON.stringify(sheet.cells['C1'], null, 2));

    // Convert to cell array
    const cellArray = workbookToCellArray(workbook, sheet.id, 5, 5);
    console.log('Cell array:');
    console.log('  A1 value:', cellArray[0][0].value);
    console.log('  B1 value:', cellArray[0][1].value);
    console.log('  C1 value:', cellArray[0][2].value);

    // Assertions
    expect(sheet.cells['A1'].raw).toBe(2);
    expect(sheet.cells['B1'].computed?.v).toBe(4);
    expect(sheet.cells['C1'].computed?.v).toBe(8);
    
    expect(cellArray[0][0].value).toBe(2);
    expect(cellArray[0][1].value).toBe(4);
    expect(cellArray[0][2].value).toBe(8);

    console.log('✓ Formula chain computed correctly\n');
  });
});
