/**
 * Dependency Propagation Test
 * 
 * This test PROVES that HyperFormula performs dependency-aware recalculation.
 * When the AI (or user) touches a single cell, HyperFormula automatically
 * recomputes ALL downstream formulas that depend on that cell.
 * 
 * This mimics Excel/Google Sheets behavior and keeps the workbook consistent.
 */

import { describe, it, expect } from 'vitest';
import { createWorkbook, getCell, applyOperations } from '../index';

describe('Dependency-Aware Recalculation', () => {
  it('should automatically recompute ALL downstream formulas when a single cell changes', () => {
    // Create a workbook with a dependency chain
    const workbook = createWorkbook('Dependency Test');
    const sheetId = workbook.sheets[0].id;

    // Build a dependency graph:
    // A1 (raw value)
    //  ├─> B1 = A1 * 2
    //  │    └─> C1 = B1 + 10
    //  │         └─> D1 = C1 * 3
    //  └─> E1 = A1 + 100
    //       └─> F1 = E1 / 2

    // Initial setup - create all cells with formulas
    const initialOps = [
      { type: 'editCell' as const, sheetId, address: 'A1', cell: { raw: 10 } },
      { type: 'editCell' as const, sheetId, address: 'B1', cell: { formula: '=A1*2' } },
      { type: 'editCell' as const, sheetId, address: 'C1', cell: { formula: '=B1+10' } },
      { type: 'editCell' as const, sheetId, address: 'D1', cell: { formula: '=C1*3' } },
      { type: 'editCell' as const, sheetId, address: 'E1', cell: { formula: '=A1+100' } },
      { type: 'editCell' as const, sheetId, address: 'F1', cell: { formula: '=E1/2' } },
    ];
    const result = applyOperations(workbook, initialOps);
    expect(result.success).toBe(true);

    // Verify initial values
    console.log('\n📊 Initial values:');
    console.log('  A1 (raw):', getCell(workbook, sheetId, 'A1')?.raw);
    console.log('  B1 (=A1*2):', getCell(workbook, sheetId, 'B1')?.computed?.v);
    console.log('  C1 (=B1+10):', getCell(workbook, sheetId, 'C1')?.computed?.v);
    console.log('  D1 (=C1*3):', getCell(workbook, sheetId, 'D1')?.computed?.v);
    console.log('  E1 (=A1+100):', getCell(workbook, sheetId, 'E1')?.computed?.v);
    console.log('  F1 (=E1/2):', getCell(workbook, sheetId, 'F1')?.computed?.v);

    expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(10);
    expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);  // 10 * 2
    expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(30);  // 20 + 10
    expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(90);  // 30 * 3
    expect(getCell(workbook, sheetId, 'E1')?.computed?.v).toBe(110); // 10 + 100
    expect(getCell(workbook, sheetId, 'F1')?.computed?.v).toBe(55);  // 110 / 2

    // ⚡ THE CRITICAL TEST: Change A1 and verify ALL downstream cells update
    console.log('\n⚡ Updating A1 from 10 to 50...');
    
    const updateOps = [
      { type: 'editCell' as const, sheetId, address: 'A1', cell: { raw: 50 } }
    ];

    // Apply the single operation - HF should automatically propagate changes
    const updateResult = applyOperations(workbook, updateOps);
    expect(updateResult.success).toBe(true);

    // Verify ALL downstream formulas recalculated automatically
    console.log('\n📊 Values after A1 update:');
    console.log('  A1 (raw):', getCell(workbook, sheetId, 'A1')?.raw);
    console.log('  B1 (=A1*2):', getCell(workbook, sheetId, 'B1')?.computed?.v);
    console.log('  C1 (=B1+10):', getCell(workbook, sheetId, 'C1')?.computed?.v);
    console.log('  D1 (=C1*3):', getCell(workbook, sheetId, 'D1')?.computed?.v);
    console.log('  E1 (=A1+100):', getCell(workbook, sheetId, 'E1')?.computed?.v);
    console.log('  F1 (=E1/2):', getCell(workbook, sheetId, 'F1')?.computed?.v);

    expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(50);
    expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(100); // 50 * 2 ✅
    expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(110); // 100 + 10 ✅
    expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(330); // 110 * 3 ✅
    expect(getCell(workbook, sheetId, 'E1')?.computed?.v).toBe(150); // 50 + 100 ✅
    expect(getCell(workbook, sheetId, 'F1')?.computed?.v).toBe(75);  // 150 / 2 ✅

    console.log('\n✅ SUCCESS: HyperFormula automatically recomputed ALL 5 downstream formulas!');
    console.log('   This proves dependency-aware recalculation works correctly.');
  });

  it('should handle complex diamond dependency patterns', () => {
    // Diamond pattern:
    //       A1
    //      /  \
    //    B1    C1
    //      \  /
    //       D1

    const workbook = createWorkbook('Diamond Test');
    const sheetId = workbook.sheets[0].id;

    const initialOps = [
      { type: 'editCell' as const, sheetId, address: 'A1', cell: { raw: 10 } },
      { type: 'editCell' as const, sheetId, address: 'B1', cell: { formula: '=A1*2' } },
      { type: 'editCell' as const, sheetId, address: 'C1', cell: { formula: '=A1+5' } },
      { type: 'editCell' as const, sheetId, address: 'D1', cell: { formula: '=B1+C1' } },
    ];
    applyOperations(workbook, initialOps);

    // Initial: A1=10, B1=20, C1=15, D1=35
    expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(35);

    // Update A1 - should propagate through BOTH B1 and C1 to D1
    const updateOps = [
      { type: 'editCell' as const, sheetId, address: 'A1', cell: { raw: 20 } }
    ];
    applyOperations(workbook, updateOps);

    // After: A1=20, B1=40, C1=25, D1=65
    expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(40);
    expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(25);
    expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(65); // ✅ Both paths updated

    console.log('✅ Diamond dependency pattern handled correctly!');
  });

  it('should handle wide fan-out (one source, many dependents)', () => {
    const workbook = createWorkbook('Fan-out Test');
    const sheetId = workbook.sheets[0].id;

    // A1 feeds into B1, B2, B3, B4, B5
    const initialOps = [
      { type: 'editCell' as const, sheetId, address: 'A1', cell: { raw: 5 } },
      { type: 'editCell' as const, sheetId, address: 'B1', cell: { formula: '=A1*1' } },
      { type: 'editCell' as const, sheetId, address: 'B2', cell: { formula: '=A1*2' } },
      { type: 'editCell' as const, sheetId, address: 'B3', cell: { formula: '=A1*3' } },
      { type: 'editCell' as const, sheetId, address: 'B4', cell: { formula: '=A1*4' } },
      { type: 'editCell' as const, sheetId, address: 'B5', cell: { formula: '=A1*5' } },
    ];
    applyOperations(workbook, initialOps);

    // Initial values
    expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(5);
    expect(getCell(workbook, sheetId, 'B2')?.computed?.v).toBe(10);
    expect(getCell(workbook, sheetId, 'B3')?.computed?.v).toBe(15);
    expect(getCell(workbook, sheetId, 'B4')?.computed?.v).toBe(20);
    expect(getCell(workbook, sheetId, 'B5')?.computed?.v).toBe(25);

    // Change A1 - ALL 5 formulas should update
    const updateOps = [
      { type: 'editCell' as const, sheetId, address: 'A1', cell: { raw: 10 } }
    ];
    applyOperations(workbook, updateOps);

    // All 5 dependents should reflect new value
    expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(10);  // ✅
    expect(getCell(workbook, sheetId, 'B2')?.computed?.v).toBe(20);  // ✅
    expect(getCell(workbook, sheetId, 'B3')?.computed?.v).toBe(30);  // ✅
    expect(getCell(workbook, sheetId, 'B4')?.computed?.v).toBe(40);  // ✅
    expect(getCell(workbook, sheetId, 'B5')?.computed?.v).toBe(50);  // ✅

    console.log('✅ Fan-out: All 5 dependents updated from single source change!');
  });
});
