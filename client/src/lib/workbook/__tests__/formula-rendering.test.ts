/**
 * Test to verify formulas are computed and rendered correctly
 * This test reproduces the issue where formulas display as text instead of computed values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkbook } from '../utils';
import { applyOperations } from '../operations';
import { workbookToCellArray } from '../converters';
import { computeWorkbook } from '../hyperformula';
import type { WorkbookJSON } from '../types';

describe('Formula Rendering Issue', () => {
  let workbook: WorkbookJSON;
  let sheetId: string;

  beforeEach(() => {
    workbook = createWorkbook('Test Workbook');
    sheetId = workbook.sheets[0].id;
  });

  it('should compute formulas and display computed values, not formula strings', () => {
    console.log('\n=== Test: Formula Rendering ===\n');
    
    // Step 1: Set A1 to 100
    console.log('Step 1: Set A1 to 100');
    applyOperations(workbook, [{
      type: 'editCell',
      sheetId,
      address: 'A1',
      cell: { raw: 100, dataType: 'number' }
    }]);
    
    // Step 2: Set B2 to "Hello World"
    console.log('Step 2: Set B2 to "Hello World"');
    applyOperations(workbook, [{
      type: 'editCell',
      sheetId,
      address: 'B2',
      cell: { raw: 'Hello World', dataType: 'string' }
    }]);
    
    // Step 3: Set C1 to formula =A1*2
    console.log('Step 3: Set C1 to formula =A1*2');
    applyOperations(workbook, [{
      type: 'editCell',
      sheetId,
      address: 'C1',
      cell: { formula: '=A1*2', dataType: 'formula' }
    }], { sync: true }); // Force synchronous recompute
    
    // Step 4: Check workbook state
    console.log('\n=== Workbook State After Operations ===');
    const sheet = workbook.sheets[0];
    console.log('A1:', JSON.stringify(sheet.cells?.A1, null, 2));
    console.log('B2:', JSON.stringify(sheet.cells?.B2, null, 2));
    console.log('C1:', JSON.stringify(sheet.cells?.C1, null, 2));
    
    // Step 5: Verify C1 has computed value
    const c1Cell = sheet.cells?.C1;
    expect(c1Cell).toBeDefined();
    expect(c1Cell?.formula).toBe('=A1*2');
    expect(c1Cell?.computed).toBeDefined();
    expect(c1Cell?.computed?.v).toBe(200);
    
    // Step 6: Convert to cell array (what canvas uses)
    console.log('\n=== Converting to Cell Array ===');
    const cells = workbookToCellArray(workbook, sheetId, 10, 10);
    
    // Step 7: Check rendered values
    console.log('\n=== Rendered Values ===');
    console.log('A1 value:', cells[0][0].value, '(expected: 100)');
    console.log('B2 value:', cells[1][1].value, '(expected: "Hello World")');
    console.log('C1 value:', cells[0][2].value, '(expected: 200, NOT "=A1*2")');
    console.log('C1 formula:', cells[0][2].formula, '(expected: "=A1*2")');
    
    // Assertions
    expect(cells[0][0].value).toBe(100);
    expect(cells[1][1].value).toBe('Hello World');
    
    // This is the critical assertion - C1 should show computed value, not formula
    expect(cells[0][2].value).toBe(200);
    expect(cells[0][2].value).not.toBe('=A1*2');
    expect(cells[0][2].formula).toBe('=A1*2');
  });

  it('should handle formula computation after manual recompute call', () => {
    console.log('\n=== Test: Manual Recompute ===\n');
    
    // Set cells WITHOUT sync
    console.log('Setting cells without sync...');
    applyOperations(workbook, [
      {
        type: 'editCell',
        sheetId,
        address: 'A1',
        cell: { raw: 50, dataType: 'number' }
      },
      {
        type: 'editCell',
        sheetId,
        address: 'A2',
        cell: { formula: '=A1*3', dataType: 'formula' }
      }
    ], { sync: false, skipRecompute: true });
    
    // Check before recompute
    console.log('\n=== Before Manual Recompute ===');
    let cells = workbookToCellArray(workbook, sheetId, 10, 10);
    console.log('A1:', cells[0][0].value);
    console.log('A2:', cells[1][0].value);
    console.log('A2 computed:', workbook.sheets[0].cells?.A2?.computed);
    
    // Manually trigger computation
    console.log('\n=== Triggering Manual Recompute ===');
    const result = computeWorkbook(workbook);
    console.log('Recompute result:', {
      updatedCells: result.recompute.updatedCells,
      errors: result.recompute.errors,
      warnings: result.recompute.warnings
    });
    
    // Check after recompute
    console.log('\n=== After Manual Recompute ===');
    cells = workbookToCellArray(workbook, sheetId, 10, 10);
    console.log('A1:', cells[0][0].value);
    console.log('A2:', cells[1][0].value, '(expected: 150)');
    console.log('A2 computed:', workbook.sheets[0].cells?.A2?.computed);
    
    expect(cells[1][0].value).toBe(150);
  });

  it('should show immediate computation with sync=true', () => {
    console.log('\n=== Test: Sync Computation ===\n');
    
    // Apply with sync=true (default)
    applyOperations(workbook, [
      {
        type: 'editCell',
        sheetId,
        address: 'D1',
        cell: { raw: 25, dataType: 'number' }
      },
      {
        type: 'editCell',
        sheetId,
        address: 'D2',
        cell: { formula: '=D1*4', dataType: 'formula' }
      }
    ]); // sync defaults to true
    
    // Check immediately
    const cells = workbookToCellArray(workbook, sheetId, 10, 10);
    console.log('D1:', cells[0][3].value, '(expected: 25)');
    console.log('D2:', cells[1][3].value, '(expected: 100)');
    console.log('D2 cell:', JSON.stringify(workbook.sheets[0].cells?.D2, null, 2));
    
    expect(cells[0][3].value).toBe(25);
    expect(cells[1][3].value).toBe(100);
  });
});
