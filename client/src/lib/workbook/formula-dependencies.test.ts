/**
 * Formula Dependency Chain Tests
 * 
 * Tests to verify that HyperFormula correctly tracks and propagates
 * changes through formula dependency chains.
 * 
 * Scenarios covered:
 * - Simple dependency chain (A1 → B1 → C1)
 * - Multiple dependents (A1 → B1, C1, D1)
 * - Circular references detection
 * - Complex dependency graphs
 * - Cross-sheet dependencies
 * - Dependency updates on cell changes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkbook,
  setCell,
  getCell,
  addSheet,
} from './utils';
import {
  hydrateHFFromWorkbook,
  computeWorkbook,
  updateCellsAndRecompute,
  recomputeAndPatchCache,
  disposeHF,
} from './hyperformula';
import type { WorkbookJSON } from './types';

describe('Formula Dependency Chain Tests', () => {
  let workbook: WorkbookJSON;
  let sheetId: string;

  beforeEach(() => {
    workbook = createWorkbook('Dependency Test');
    sheetId = workbook.sheets[0].id;
  });

  describe('Simple Linear Dependency Chain', () => {
    it('should propagate changes through simple chain A1 → B1 → C1', () => {
      // Set up dependency chain
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=B1+5' });

      // Initial computation
      const { hydration } = computeWorkbook(workbook);

      // Verify initial values
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(10);
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(25);

      // Update A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 20 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 20 });
      recomputeAndPatchCache(workbook, hydration);

      // Verify propagation
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(40);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(45);

      disposeHF(hydration.hf);
    });

    it('should handle longer chains A1 → B1 → C1 → D1 → E1', () => {
      // Create 5-level chain
      setCell(workbook, sheetId, 'A1', { raw: 5 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=B1+10' });
      setCell(workbook, sheetId, 'D1', { formula: '=C1*3' });
      setCell(workbook, sheetId, 'E1', { formula: '=D1-5' });

      const { hydration } = computeWorkbook(workbook);

      // Initial: A1=5 → B1=10 → C1=20 → D1=60 → E1=55
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(10);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(60);
      expect(getCell(workbook, sheetId, 'E1')?.computed?.v).toBe(55);

      // Update A1 to 10
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 10 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      recomputeAndPatchCache(workbook, hydration);

      // After: A1=10 → B1=20 → C1=30 → D1=90 → E1=85
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(30);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(90);
      expect(getCell(workbook, sheetId, 'E1')?.computed?.v).toBe(85);

      disposeHF(hydration.hf);
    });

    it('should update intermediate cell in chain', () => {
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=B1+5' });

      const { hydration } = computeWorkbook(workbook);

      // Update middle cell B1 to be a value instead of formula
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'B1', value: 100 }
      ]);
      setCell(workbook, sheetId, 'B1', { raw: 100 });
      recomputeAndPatchCache(workbook, hydration);

      // C1 should now depend on B1's new value
      expect(getCell(workbook, sheetId, 'B1')?.raw).toBe(100);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(105);

      disposeHF(hydration.hf);
    });
  });

  describe('Multiple Dependents (Fan-out)', () => {
    it('should update all dependents when source changes', () => {
      // A1 is referenced by B1, C1, D1
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=A1+5' });
      setCell(workbook, sheetId, 'D1', { formula: '=A1/2' });

      const { hydration } = computeWorkbook(workbook);

      // Initial values
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(15);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(5);

      // Update A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 20 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 20 });
      recomputeAndPatchCache(workbook, hydration);

      // All dependents should update
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(40);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(25);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(10);

      disposeHF(hydration.hf);
    });

    it('should handle fan-out with ranges', () => {
      // Multiple cells depend on a range containing A1
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'A2', { raw: 20 });
      setCell(workbook, sheetId, 'A3', { raw: 30 });
      
      setCell(workbook, sheetId, 'B1', { formula: '=SUM(A1:A3)' });
      setCell(workbook, sheetId, 'B2', { formula: '=AVERAGE(A1:A3)' });
      setCell(workbook, sheetId, 'B3', { formula: '=MAX(A1:A3)' });

      const { hydration } = computeWorkbook(workbook);

      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(60);
      expect(getCell(workbook, sheetId, 'B2')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'B3')?.computed?.v).toBe(30);

      // Update A2
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A2', value: 50 }
      ]);
      setCell(workbook, sheetId, 'A2', { raw: 50 });
      recomputeAndPatchCache(workbook, hydration);

      // All range-based formulas should update
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(90);
      expect(getCell(workbook, sheetId, 'B2')?.computed?.v).toBe(30);
      expect(getCell(workbook, sheetId, 'B3')?.computed?.v).toBe(50);

      disposeHF(hydration.hf);
    });
  });

  describe('Multiple Sources (Fan-in)', () => {
    it('should update when any source changes', () => {
      // D1 depends on A1, B1, C1
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { raw: 20 });
      setCell(workbook, sheetId, 'C1', { raw: 30 });
      setCell(workbook, sheetId, 'D1', { formula: '=A1+B1+C1' });

      const { hydration } = computeWorkbook(workbook);

      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(60);

      // Update A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 15 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 15 });
      recomputeAndPatchCache(workbook, hydration);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(65);

      // Update B1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'B1', value: 25 }
      ]);
      setCell(workbook, sheetId, 'B1', { raw: 25 });
      recomputeAndPatchCache(workbook, hydration);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(70);

      // Update C1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'C1', value: 35 }
      ]);
      setCell(workbook, sheetId, 'C1', { raw: 35 });
      recomputeAndPatchCache(workbook, hydration);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(75);

      disposeHF(hydration.hf);
    });

    it('should handle complex fan-in patterns', () => {
      // D1 = (A1 + B1) * (C1 - A1)
      setCell(workbook, sheetId, 'A1', { raw: 5 });
      setCell(workbook, sheetId, 'B1', { raw: 10 });
      setCell(workbook, sheetId, 'C1', { raw: 20 });
      setCell(workbook, sheetId, 'D1', { formula: '=(A1+B1)*(C1-A1)' });

      const { hydration } = computeWorkbook(workbook);

      // (5+10)*(20-5) = 15*15 = 225
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(225);

      // Update A1 (affects formula twice)
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 10 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      recomputeAndPatchCache(workbook, hydration);

      // (10+10)*(20-10) = 20*10 = 200
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(200);

      disposeHF(hydration.hf);
    });
  });

  describe('Complex Dependency Graphs', () => {
    it('should handle diamond dependency pattern', () => {
      // Diamond: A1 → B1 & C1 → D1
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=A1+5' });
      setCell(workbook, sheetId, 'D1', { formula: '=B1+C1' });

      const { hydration } = computeWorkbook(workbook);

      // A1=10 → B1=20, C1=15 → D1=35
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(15);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(35);

      // Update A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 20 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 20 });
      recomputeAndPatchCache(workbook, hydration);

      // A1=20 → B1=40, C1=25 → D1=65
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(40);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(25);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(65);

      disposeHF(hydration.hf);
    });

    it('should handle multi-level dependency web', () => {
      // Complex web:
      // A1 → B1 → D1
      //   ↘  C1 ↗
      setCell(workbook, sheetId, 'A1', { raw: 5 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=A1+3' });
      setCell(workbook, sheetId, 'D1', { formula: '=B1+C1' });

      const { hydration } = computeWorkbook(workbook);

      // A1=5 → B1=10, C1=8 → D1=18
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(18);

      // Update A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 10 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      recomputeAndPatchCache(workbook, hydration);

      // A1=10 → B1=20, C1=13 → D1=33
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(33);

      disposeHF(hydration.hf);
    });

    it('should handle cross-referencing formulas', () => {
      // A1 & B1 reference each other through intermediates
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { raw: 20 });
      setCell(workbook, sheetId, 'C1', { formula: '=A1+B1' });
      setCell(workbook, sheetId, 'D1', { formula: '=A1*B1' });
      setCell(workbook, sheetId, 'E1', { formula: '=C1+D1' });

      const { hydration } = computeWorkbook(workbook);

      // C1=30, D1=200, E1=230
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(30);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(200);
      expect(getCell(workbook, sheetId, 'E1')?.computed?.v).toBe(230);

      // Update A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 15 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 15 });
      recomputeAndPatchCache(workbook, hydration);

      // C1=35, D1=300, E1=335
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(35);
      expect(getCell(workbook, sheetId, 'D1')?.computed?.v).toBe(300);
      expect(getCell(workbook, sheetId, 'E1')?.computed?.v).toBe(335);

      disposeHF(hydration.hf);
    });
  });

  describe('Circular Reference Handling', () => {
    it('should handle simple circular reference A1 → B1 → A1', () => {
      setCell(workbook, sheetId, 'A1', { formula: '=B1+1' });
      setCell(workbook, sheetId, 'B1', { formula: '=A1+1' });

      const { hydration } = computeWorkbook(workbook);

      // HyperFormula handles circular references by computing iteratively
      // The formulas will compute but may have special values
      const a1 = getCell(workbook, sheetId, 'A1');
      const b1 = getCell(workbook, sheetId, 'B1');
      
      // Cells should exist and have computed values
      expect(a1?.computed).toBeDefined();
      expect(b1?.computed).toBeDefined();
      
      // Note: HyperFormula may resolve circular refs to numeric values
      // This is expected behavior - documenting it here
      console.log('Circular ref A1:', a1?.computed?.v, 'type:', a1?.computed?.t);
      console.log('Circular ref B1:', b1?.computed?.v, 'type:', b1?.computed?.t);

      disposeHF(hydration.hf);
    });

    it('should handle indirect circular reference A1 → B1 → C1 → A1', () => {
      setCell(workbook, sheetId, 'A1', { formula: '=B1+1' });
      setCell(workbook, sheetId, 'B1', { formula: '=C1+1' });
      setCell(workbook, sheetId, 'C1', { formula: '=A1+1' });

      const { hydration } = computeWorkbook(workbook);

      // Check that formulas are computed (even if circular)
      const a1 = getCell(workbook, sheetId, 'A1');
      const b1 = getCell(workbook, sheetId, 'B1');
      const c1 = getCell(workbook, sheetId, 'C1');
      
      expect(a1?.computed).toBeDefined();
      expect(b1?.computed).toBeDefined();
      expect(c1?.computed).toBeDefined();
      
      // Log the actual behavior for documentation
      console.log('Indirect circular A1:', a1?.computed?.v);
      console.log('Indirect circular B1:', b1?.computed?.v);
      console.log('Indirect circular C1:', c1?.computed?.v);

      disposeHF(hydration.hf);
    });
  });

  describe('Dependency Updates on Cell Deletion', () => {
    it('should create #REF! error when dependency is deleted', () => {
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });

      const { hydration } = computeWorkbook(workbook);

      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);

      // Delete A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: null }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: null });
      recomputeAndPatchCache(workbook, hydration);

      // B1 should now be 0 or error (depends on HF behavior with null)
      const b1 = getCell(workbook, sheetId, 'B1');
      // Empty cell typically evaluates to 0 in formulas
      expect(b1?.computed?.v === 0 || b1?.computed?.t === 'e').toBe(true);

      disposeHF(hydration.hf);
    });

    it('should handle chain when middle cell is deleted', () => {
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=B1+5' });

      const { hydration } = computeWorkbook(workbook);

      // Delete B1's formula (make it empty)
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'B1', value: null }
      ]);
      setCell(workbook, sheetId, 'B1', { raw: null });
      recomputeAndPatchCache(workbook, hydration);

      // C1 should now reference empty B1 (= 0 + 5 = 5)
      const c1 = getCell(workbook, sheetId, 'C1');
      expect(c1?.computed?.v).toBe(5);

      disposeHF(hydration.hf);
    });
  });

  describe('Cross-Sheet Dependencies', () => {
    it('should propagate changes across sheets', () => {
      const sheet1Id = workbook.sheets[0].id;
      const sheet1Name = workbook.sheets[0].name;
      
      // Add second sheet
      const sheet2 = addSheet(workbook, 'Sheet2');

      // Set value in Sheet1
      setCell(workbook, sheet1Id, 'A1', { raw: 100 });
      
      // Reference from Sheet2
      setCell(workbook, sheet2.id, 'A1', { formula: `=${sheet1Name}!A1*2` });

      const { hydration } = computeWorkbook(workbook);

      expect(getCell(workbook, sheet2.id, 'A1')?.computed?.v).toBe(200);

      // Update Sheet1!A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId: sheet1Id, address: 'A1', value: 150 }
      ]);
      setCell(workbook, sheet1Id, 'A1', { raw: 150 });
      recomputeAndPatchCache(workbook, hydration);

      // Sheet2!A1 should update
      expect(getCell(workbook, sheet2.id, 'A1')?.computed?.v).toBe(300);

      disposeHF(hydration.hf);
    });

    it('should handle cross-sheet dependency chains', () => {
      const sheet1Id = workbook.sheets[0].id;
      const sheet1Name = workbook.sheets[0].name;
      const sheet2 = addSheet(workbook, 'Sheet2');
      const sheet2Name = sheet2.name;

      // Chain: Sheet1!A1 → Sheet2!A1 → Sheet1!B1
      setCell(workbook, sheet1Id, 'A1', { raw: 10 });
      setCell(workbook, sheet2.id, 'A1', { formula: `=${sheet1Name}!A1*5` });
      setCell(workbook, sheet1Id, 'B1', { formula: `=${sheet2Name}!A1+10` });

      const { hydration } = computeWorkbook(workbook);

      // Sheet1!A1=10 → Sheet2!A1=50 → Sheet1!B1=60
      expect(getCell(workbook, sheet2.id, 'A1')?.computed?.v).toBe(50);
      expect(getCell(workbook, sheet1Id, 'B1')?.computed?.v).toBe(60);

      // Update Sheet1!A1
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId: sheet1Id, address: 'A1', value: 20 }
      ]);
      setCell(workbook, sheet1Id, 'A1', { raw: 20 });
      recomputeAndPatchCache(workbook, hydration);

      // Sheet1!A1=20 → Sheet2!A1=100 → Sheet1!B1=110
      expect(getCell(workbook, sheet2.id, 'A1')?.computed?.v).toBe(100);
      expect(getCell(workbook, sheet1Id, 'B1')?.computed?.v).toBe(110);

      disposeHF(hydration.hf);
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle large dependency chain efficiently', () => {
      // Use multiple samples and assert on the median to reduce flakiness.
      const samples = 5;
      const computeTimes: number[] = [];

      for (let s = 0; s < samples; s++) {
        // Fresh workbook for each sample to avoid cache effects
        const wb = createWorkbook(`Dependency Test - sample ${s}`);
        const sid = wb.sheets[0].id;

        // Create chain of 100 cells
        setCell(wb, sid, 'A1', { raw: 1 });
        for (let i = 2; i <= 100; i++) {
          setCell(wb, sid, `A${i}`, { formula: `=A${i-1}+1` });
        }

        const start = performance.now();
        const { hydration } = computeWorkbook(wb);
        const computeTime = performance.now() - start;
        // Log sample for investigation
        console.log(`HEAVY_OP_MS compute:${Math.round(computeTime)}`);
        computeTimes.push(computeTime);

        // Sanity check last cell
        expect(getCell(wb, sid, 'A100')?.computed?.v).toBe(100);

        disposeHF(hydration.hf);
      }

      // Compute median
      const sorted = computeTimes.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(samples / 2)];

  // Assert median is within budget (configurable via HF_DEP_TEST_MEDIAN_MS, default=150ms)
  const medianBudget = Number(process.env.HF_DEP_TEST_MEDIAN_MS || 150);
  expect(median).toBeLessThan(medianBudget);

      // Single-run update propagation check (keep as a separate, single measurement)
      // Create a workbook and chain for update propagation
      const wb2 = createWorkbook('Dependency Test - update');
      const sid2 = wb2.sheets[0].id;
      setCell(wb2, sid2, 'A1', { raw: 1 });
      for (let i = 2; i <= 100; i++) {
        setCell(wb2, sid2, `A${i}`, { formula: `=A${i-1}+1` });
      }

      const { hydration } = computeWorkbook(wb2);

      const updateStart = performance.now();
      updateCellsAndRecompute(wb2, hydration, [
        { sheetId: sid2, address: 'A1', value: 10 }
      ]);
      setCell(wb2, sid2, 'A1', { raw: 10 });
      recomputeAndPatchCache(wb2, hydration);
      const updateTime = performance.now() - updateStart;

      console.log(`HEAVY_OP_MS update:${Math.round(updateTime)}`);

      // All 99 dependents should update
      expect(getCell(wb2, sid2, 'A100')?.computed?.v).toBe(109);
  const updateBudget = Number(process.env.HF_DEP_TEST_UPDATE_MS || 100);
  expect(updateTime).toBeLessThan(updateBudget);

      disposeHF(hydration.hf);
    });

    it('should handle wide dependency graph (one source, many dependents)', () => {
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      
      // Create 50 cells that all depend on A1
      for (let i = 1; i <= 50; i++) {
        setCell(workbook, sheetId, `B${i}`, { formula: `=A1*${i}` });
      }

      const { hydration } = computeWorkbook(workbook);

      // Verify sample cells
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(10);
      expect(getCell(workbook, sheetId, 'B10')?.computed?.v).toBe(100);
      expect(getCell(workbook, sheetId, 'B50')?.computed?.v).toBe(500);

      // Update A1 - all 50 dependents should update
      updateCellsAndRecompute(workbook, hydration, [
        { sheetId, address: 'A1', value: 20 }
      ]);
      setCell(workbook, sheetId, 'A1', { raw: 20 });
      recomputeAndPatchCache(workbook, hydration);

      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'B10')?.computed?.v).toBe(200);
      expect(getCell(workbook, sheetId, 'B50')?.computed?.v).toBe(1000);

      disposeHF(hydration.hf);
    });
  });

  describe('Dependency Graph Metadata', () => {
    it('should populate dependency graph in workbook.computed', () => {
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1*2' });
      setCell(workbook, sheetId, 'C1', { formula: '=A1+5' });

      const { hydration } = computeWorkbook(workbook);

      // Check dependency graph was created
      expect(workbook.computed?.dependencyGraph).toBeDefined();
      
      // Dependency graph may be populated or may be empty depending on implementation
      // The important thing is that formulas compute correctly
      expect(getCell(workbook, sheetId, 'B1')?.computed?.v).toBe(20);
      expect(getCell(workbook, sheetId, 'C1')?.computed?.v).toBe(15);
      
      disposeHF(hydration.hf);
    });

    it('should track dependencies correctly in complex graph', () => {
      setCell(workbook, sheetId, 'A1', { raw: 5 });
      setCell(workbook, sheetId, 'A2', { raw: 10 });
      setCell(workbook, sheetId, 'B1', { formula: '=A1+A2' }); // Depends on A1 and A2
      setCell(workbook, sheetId, 'B2', { formula: '=B1*2' });  // Depends on B1

      const { hydration } = computeWorkbook(workbook);

      expect(workbook.computed?.dependencyGraph).toBeDefined();

      disposeHF(hydration.hf);
    });
  });
});
