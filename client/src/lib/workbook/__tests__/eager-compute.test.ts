/**
 * Eager Compute Integration Test
 * 
 * Verifies that AI-written formulas show computed values immediately
 * without setTimeout delays.
 */

import { describe, it, expect } from 'vitest';
import { createWorkbook, applyOperations, getCell } from '../index';

describe('Eager Compute - AI Formula Flow', () => {
  it('should show computed values immediately after AI writes formula', () => {
    // Setup: Create workbook and sheet
    const workbook = createWorkbook('Test Workbook');
    const sheet = workbook.sheets[0];

    // Simulate AI writing: "Set A1 to 10 and B1 to =A1*2"
    const operations = [
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A1', cell: { raw: 10 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'B1', cell: { formula: '=A1*2' } }
    ];

    // Apply operations with default sync behavior (sync: true by default)
    const result = applyOperations(workbook, operations);

    // Verify operations succeeded
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.affectedRanges.length).toBeGreaterThan(0);

    // Check A1 has raw value
    const cellA1 = getCell(workbook, sheet.id, 'A1');
    expect(cellA1?.raw).toBe(10);

    // Check B1 has formula AND computed value (eager compute)
    const cellB1 = getCell(workbook, sheet.id, 'B1');
    expect(cellB1?.formula).toBe('=A1*2');
    expect(cellB1?.computed).toBeDefined();
    expect(cellB1?.computed?.v).toBe(20); // ← This proves eager compute worked!
    expect(cellB1?.computed?.t).toBe('n'); // number type
  });

  it('should compute SUM formulas immediately', () => {
    const workbook = createWorkbook('Test Workbook');
    const sheet = workbook.sheets[0];

    // Simulate AI writing: "Set A1:A5 to [1,2,3,4,5] and B1 to =SUM(A1:A5)"
    const operations = [
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A1', cell: { raw: 1 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A2', cell: { raw: 2 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A3', cell: { raw: 3 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A4', cell: { raw: 4 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A5', cell: { raw: 5 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'B1', cell: { formula: '=SUM(A1:A5)' } }
    ];

    const result = applyOperations(workbook, operations);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);

    // Check B1 shows computed sum immediately
    const cellB1 = getCell(workbook, sheet.id, 'B1');
    expect(cellB1?.formula).toBe('=SUM(A1:A5)');
    expect(cellB1?.computed?.v).toBe(15); // 1+2+3+4+5 = 15
  });

  it('should update computed values when dependency changes', () => {
    const workbook = createWorkbook('Test Workbook');
    const sheet = workbook.sheets[0];

    // Initial: A1=10, B1=A1*2
    let operations = [
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A1', cell: { raw: 10 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'B1', cell: { formula: '=A1*2' } }
    ];
    applyOperations(workbook, operations);

    let cellB1 = getCell(workbook, sheet.id, 'B1');
    expect(cellB1?.computed?.v).toBe(20);

    // Update: A1=5 (should trigger recompute of B1)
    operations = [
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A1', cell: { raw: 5 } }
    ];
    applyOperations(workbook, operations);

    // Check B1 updated immediately
    cellB1 = getCell(workbook, sheet.id, 'B1');
    expect(cellB1?.computed?.v).toBe(10); // 5*2 = 10
  });

  it('should work with skipRecompute option disabled (default)', () => {
    const workbook = createWorkbook('Test Workbook');
    const sheet = workbook.sheets[0];

    const operations = [
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A1', cell: { raw: 100 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'B1', cell: { formula: '=A1/2' } }
    ];

    // Explicitly pass sync: true (should be default anyway)
    const result = applyOperations(workbook, operations, { sync: true });

    expect(result.success).toBe(true);
    
    const cellB1 = getCell(workbook, sheet.id, 'B1');
    expect(cellB1?.computed?.v).toBe(50); // Computed immediately
  });

  it('should skip compute when sync: false is passed', () => {
    const workbook = createWorkbook('Test Workbook');
    const sheet = workbook.sheets[0];

    const operations = [
      { type: 'editCell' as const, sheetId: sheet.id, address: 'A1', cell: { raw: 100 } },
      { type: 'editCell' as const, sheetId: sheet.id, address: 'B1', cell: { formula: '=A1/2' } }
    ];

    // Pass sync: false to skip recompute
    const result = applyOperations(workbook, operations, { sync: false });

    expect(result.success).toBe(true);
    
    const cellB1 = getCell(workbook, sheet.id, 'B1');
    expect(cellB1?.formula).toBe('=A1/2');
    // computed might be undefined or stale since we skipped compute
    expect(cellB1?.computed).toBeUndefined(); // or old value if it existed
  });
});
