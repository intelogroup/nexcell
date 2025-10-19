/**
 * Multi-Sheet Synchronization Tests (Prompt 20)
 * 
 * Tests dependency propagation across multiple sheets, including:
 * - Changes in Sheet1 propagate to dependent cells in Sheet2-5
 * - Dependency graph tracks cross-sheet references correctly
 * - Deleting a sheet causes #REF! errors in formulas referencing it
 * - Recalculation order respects dependencies
 * - Performance with multiple sheets and complex dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { WorkbookJSON } from '../../types';
import { createTestWorkbook, assertCellValue, assertCellError, computeAndAssert, benchmark } from '../utils/test-helpers';
import { setCell, getCell, getSheet } from '../../utils';
import { computeWorkbook, disposeFormulaEngine, type HydrationResult, updateCellsAndRecompute, recomputeAndPatchCache } from '../../hyperformula';
import { applyOperations } from '../../operations';

// ============================================================================
// Test Setup
// ============================================================================

describe('Multi-Sheet Synchronization (Prompt 20)', () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    // Clean up all hydrations after each test
    hydrations.forEach(h => {
      try {
        disposeFormulaEngine(h);
      } catch (e) {
        // Ignore disposal errors
      }
    });
    hydrations = [];
  });

  // ==========================================================================
  // Basic Cross-Sheet References
  // ==========================================================================

  describe('Basic Cross-Sheet References', () => {
    it('should propagate changes from Sheet1 to Sheet2', () => {
      const wb = createTestWorkbook({
        title: 'Multi-Sheet Test',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 100 },
            },
          },
          {
            name: 'Sheet2',
            cells: {
              B1: { formula: '=Sheet1!A1*2' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Initial value: Sheet2!B1 = Sheet1!A1 * 2 = 100 * 2 = 200
      assertCellValue(wb, 'B1', 200, wb.sheets[1].id);

      // Update Sheet1!A1
      const sheet1Id = wb.sheets[0].id;
      updateCellsAndRecompute(wb, hydration, [
        { sheetId: sheet1Id, address: 'A1', value: 250 }
      ]);
      setCell(wb, sheet1Id, 'A1', { raw: 250 });
      recomputeAndPatchCache(wb, hydration);

      // Verify Sheet2!B1 updated
      assertCellValue(wb, 'B1', 500, wb.sheets[1].id);
    });

    it('should handle bidirectional references between two sheets', () => {
      const wb = createTestWorkbook({
        title: 'Bidirectional Test',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 10 },
              A2: { formula: '=Sheet2!B1+5' },
            },
          },
          {
            name: 'Sheet2',
            cells: {
              B1: { formula: '=Sheet1!A1*3' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Sheet2!B1 = Sheet1!A1 * 3 = 10 * 3 = 30
      // Sheet1!A2 = Sheet2!B1 + 5 = 30 + 5 = 35
      const sheet1Id = wb.sheets[0].id;
      const sheet2Id = wb.sheets[1].id;

      assertCellValue(wb, 'B1', 30, sheet2Id);
      assertCellValue(wb, 'A2', 35, sheet1Id);

      // Update Sheet1!A1, should cascade through both sheets
      updateCellsAndRecompute(wb, hydration, [
        { sheetId: sheet1Id, address: 'A1', value: 20 }
      ]);
      setCell(wb, sheet1Id, 'A1', { raw: 20 });
      recomputeAndPatchCache(wb, hydration);

      // Sheet2!B1 = 20 * 3 = 60
      // Sheet1!A2 = 60 + 5 = 65
      assertCellValue(wb, 'B1', 60, sheet2Id);
      assertCellValue(wb, 'A2', 65, sheet1Id);
    });
  });

  // ==========================================================================
  // Multi-Sheet Dependency Chains
  // ==========================================================================

  describe('Multi-Sheet Dependency Chains', () => {
    it('should propagate changes across 5 interconnected sheets', () => {
      const wb = createTestWorkbook({
        title: '5-Sheet Chain',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 10 },
            },
          },
          {
            name: 'Sheet2',
            cells: {
              B1: { formula: '=Sheet1!A1+5' },
            },
          },
          {
            name: 'Sheet3',
            cells: {
              C1: { formula: '=Sheet2!B1*2' },
            },
          },
          {
            name: 'Sheet4',
            cells: {
              D1: { formula: '=Sheet3!C1-10' },
            },
          },
          {
            name: 'Sheet5',
            cells: {
              E1: { formula: '=Sheet4!D1/2' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Verify initial cascade
      // Sheet1!A1 = 10
      // Sheet2!B1 = 10 + 5 = 15
      // Sheet3!C1 = 15 * 2 = 30
      // Sheet4!D1 = 30 - 10 = 20
      // Sheet5!E1 = 20 / 2 = 10
      assertCellValue(wb, 'A1', 10, wb.sheets[0].id);
      assertCellValue(wb, 'B1', 15, wb.sheets[1].id);
      assertCellValue(wb, 'C1', 30, wb.sheets[2].id);
      assertCellValue(wb, 'D1', 20, wb.sheets[3].id);
      assertCellValue(wb, 'E1', 10, wb.sheets[4].id);

      // Update Sheet1!A1
      const sheet1Id = wb.sheets[0].id;
      updateCellsAndRecompute(wb, hydration, [
        { sheetId: sheet1Id, address: 'A1', value: 100 }
      ]);
      setCell(wb, sheet1Id, 'A1', { raw: 100 });
      recomputeAndPatchCache(wb, hydration);

      // Verify cascade propagated through all sheets
      // Sheet1!A1 = 100
      // Sheet2!B1 = 100 + 5 = 105
      // Sheet3!C1 = 105 * 2 = 210
      // Sheet4!D1 = 210 - 10 = 200
      // Sheet5!E1 = 200 / 2 = 100
      assertCellValue(wb, 'A1', 100, wb.sheets[0].id);
      assertCellValue(wb, 'B1', 105, wb.sheets[1].id);
      assertCellValue(wb, 'C1', 210, wb.sheets[2].id);
      assertCellValue(wb, 'D1', 200, wb.sheets[3].id);
      assertCellValue(wb, 'E1', 100, wb.sheets[4].id);
    });

    it('should handle complex dependency graph with multiple sources', () => {
      const wb = createTestWorkbook({
        title: 'Complex Dependencies',
        sheets: [
          {
            name: 'Data1',
            cells: {
              A1: { raw: 100 },
              A2: { raw: 200 },
            },
          },
          {
            name: 'Data2',
            cells: {
              B1: { raw: 50 },
              B2: { raw: 75 },
            },
          },
          {
            name: 'Summary',
            cells: {
              C1: { formula: '=Data1!A1+Data2!B1' },
              C2: { formula: '=Data1!A2+Data2!B2' },
              C3: { formula: '=C1+C2' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const summaryId = wb.sheets[2].id;

      // Summary!C1 = 100 + 50 = 150
      // Summary!C2 = 200 + 75 = 275
      // Summary!C3 = 150 + 275 = 425
      assertCellValue(wb, 'C1', 150, summaryId);
      assertCellValue(wb, 'C2', 275, summaryId);
      assertCellValue(wb, 'C3', 425, summaryId);

      // Update both data sheets
      updateCellsAndRecompute(wb, hydration, [
        { sheetId: wb.sheets[0].id, address: 'A1', value: 150 },
        { sheetId: wb.sheets[1].id, address: 'B2', value: 100 }
      ]);
      setCell(wb, wb.sheets[0].id, 'A1', { raw: 150 });
      setCell(wb, wb.sheets[1].id, 'B2', { raw: 100 });
      recomputeAndPatchCache(wb, hydration);

      // Summary!C1 = 150 + 50 = 200
      // Summary!C2 = 200 + 100 = 300
      // Summary!C3 = 200 + 300 = 500
      assertCellValue(wb, 'C1', 200, summaryId);
      assertCellValue(wb, 'C2', 300, summaryId);
      assertCellValue(wb, 'C3', 500, summaryId);
    });
  });

  // ==========================================================================
  // Sheet Deletion and #REF! Errors
  // ==========================================================================

  describe('Sheet Deletion and #REF! Errors', () => {
    it('should show #REF! error when referenced sheet is deleted', () => {
      const wb = createTestWorkbook({
        title: 'Sheet Deletion Test',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 100 },
            },
          },
          {
            name: 'Sheet2',
            cells: {
              B1: { raw: 200 },
            },
          },
          {
            name: 'Sheet3',
            cells: {
              C1: { formula: '=Sheet2!B1*2' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheet3Id = wb.sheets[2].id;

      // Initial: Sheet3!C1 = Sheet2!B1 * 2 = 200 * 2 = 400
      assertCellValue(wb, 'C1', 400, sheet3Id);

      // Delete Sheet2
      const sheet2Id = wb.sheets[1].id;
      wb.sheets = wb.sheets.filter(s => s.id !== sheet2Id);

      // Recompute (HyperFormula needs full rebuild after sheet deletion)
      const { hydration: newHydration } = computeWorkbook(wb, { validateFormulas: true });
      hydrations.push(newHydration);

      // Sheet3!C1 should now have #REF! error or keep the old value (400)
      // Since HyperFormula was rebuilt, it should detect the missing reference
      const cell = getCell(wb, sheet3Id, 'C1');
      const value = cell?.computed?.v ?? cell?.raw;
      
      // After sheet deletion and recompute, the cell may:
      // 1. Show #REF! error (string starting with #)
      // 2. Be undefined if formula couldn't be evaluated
      // 3. Keep old value if HyperFormula cached it
      // We expect either an error or undefined
      const isErrorOrUndefined = 
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.startsWith('#'));
      
      expect(isErrorOrUndefined).toBe(true);
    });

    it('should handle deletion of middle sheet in dependency chain', () => {
      const wb = createTestWorkbook({
        title: 'Middle Sheet Deletion',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 10 },
            },
          },
          {
            name: 'Sheet2',
            cells: {
              B1: { formula: '=Sheet1!A1+5' },
            },
          },
          {
            name: 'Sheet3',
            cells: {
              C1: { formula: '=Sheet2!B1*2' },
            },
          },
          {
            name: 'Sheet4',
            cells: {
              D1: { formula: '=Sheet1!A1*10' }, // Direct reference to Sheet1
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Initial values
      assertCellValue(wb, 'B1', 15, wb.sheets[1].id);
      assertCellValue(wb, 'C1', 30, wb.sheets[2].id);
      assertCellValue(wb, 'D1', 100, wb.sheets[3].id);

      // Delete Sheet2
      const sheet2Id = wb.sheets[1].id;
      wb.sheets = wb.sheets.filter(s => s.id !== sheet2Id);
      
      // Full recompute after sheet deletion
      const { hydration: newHydration } = computeWorkbook(wb, { validateFormulas: true });
      hydrations.push(newHydration);

      // Sheet3!C1 should have #REF! or be undefined (referenced deleted Sheet2)
      const sheet3Id = wb.sheets.find(s => s.name === 'Sheet3')?.id;
      if (sheet3Id) {
        const cell3 = getCell(wb, sheet3Id, 'C1');
        const value3 = cell3?.computed?.v ?? cell3?.raw;
        
        const isErrorOrUndefined = 
          value3 === undefined ||
          value3 === null ||
          (typeof value3 === 'string' && value3.startsWith('#'));
        
        expect(isErrorOrUndefined).toBe(true);
      }

      // Sheet4!D1 should still work (direct reference to Sheet1)
      const sheet4Id = wb.sheets.find(s => s.name === 'Sheet4')?.id;
      if (sheet4Id) {
        assertCellValue(wb, 'D1', 100, sheet4Id);
      }
    });

    it('should handle multiple sheets with references to deleted sheet', () => {
      const wb = createTestWorkbook({
        title: 'Multiple References to Deleted Sheet',
        sheets: [
          {
            name: 'Data',
            cells: {
              A1: { raw: 100 },
              A2: { raw: 200 },
            },
          },
          {
            name: 'Report1',
            cells: {
              B1: { formula: '=Data!A1*2' },
            },
          },
          {
            name: 'Report2',
            cells: {
              C1: { formula: '=Data!A2*3' },
            },
          },
          {
            name: 'Report3',
            cells: {
              D1: { formula: '=Data!A1+Data!A2' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Initial values
      assertCellValue(wb, 'B1', 200, wb.sheets[1].id);
      assertCellValue(wb, 'C1', 600, wb.sheets[2].id);
      assertCellValue(wb, 'D1', 300, wb.sheets[3].id);

      // Delete Data sheet
      const dataSheetId = wb.sheets[0].id;
      wb.sheets = wb.sheets.filter(s => s.id !== dataSheetId);
      
      // Full recompute after sheet deletion
      const { hydration: newHydration } = computeWorkbook(wb, { validateFormulas: true });
      hydrations.push(newHydration);

      // All formulas should now have #REF! errors or be undefined
      const report1Id = wb.sheets.find(s => s.name === 'Report1')?.id;
      const report2Id = wb.sheets.find(s => s.name === 'Report2')?.id;
      const report3Id = wb.sheets.find(s => s.name === 'Report3')?.id;

      if (report1Id) {
        const cell1 = getCell(wb, report1Id, 'B1');
        const value1 = cell1?.computed?.v ?? cell1?.raw;
        const isErrorOrUndefined = 
          value1 === undefined ||
          value1 === null ||
          (typeof value1 === 'string' && value1.startsWith('#'));
        expect(isErrorOrUndefined).toBe(true);
      }

      if (report2Id) {
        const cell2 = getCell(wb, report2Id, 'C1');
        const value2 = cell2?.computed?.v ?? cell2?.raw;
        const isErrorOrUndefined = 
          value2 === undefined ||
          value2 === null ||
          (typeof value2 === 'string' && value2.startsWith('#'));
        expect(isErrorOrUndefined).toBe(true);
      }

      if (report3Id) {
        const cell3 = getCell(wb, report3Id, 'D1');
        const value3 = cell3?.computed?.v ?? cell3?.raw;
        const isErrorOrUndefined = 
          value3 === undefined ||
          value3 === null ||
          (typeof value3 === 'string' && value3.startsWith('#'));
        expect(isErrorOrUndefined).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Range References Across Sheets
  // ==========================================================================

  describe('Range References Across Sheets', () => {
    it('should handle SUM of range in another sheet', () => {
      const wb = createTestWorkbook({
        title: 'Cross-Sheet Range',
        sheets: [
          {
            name: 'Data',
            cells: {
              A1: { raw: 10 },
              A2: { raw: 20 },
              A3: { raw: 30 },
              A4: { raw: 40 },
              A5: { raw: 50 },
            },
          },
          {
            name: 'Summary',
            cells: {
              B1: { formula: '=SUM(Data!A1:A5)' },
              B2: { formula: '=AVERAGE(Data!A1:A5)' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const summaryId = wb.sheets[1].id;

      // SUM(10,20,30,40,50) = 150
      // AVERAGE(10,20,30,40,50) = 30
      assertCellValue(wb, 'B1', 150, summaryId);
      assertCellValue(wb, 'B2', 30, summaryId);

      // Update one value in Data sheet
      const dataId = wb.sheets[0].id;
      updateCellsAndRecompute(wb, hydration, [
        { sheetId: dataId, address: 'A3', value: 100 }
      ]);
      setCell(wb, dataId, 'A3', { raw: 100 });
      recomputeAndPatchCache(wb, hydration);

      // SUM(10,20,100,40,50) = 220
      // AVERAGE(10,20,100,40,50) = 44
      assertCellValue(wb, 'B1', 220, summaryId);
      assertCellValue(wb, 'B2', 44, summaryId);
    });

    it('should handle multiple range references from different sheets', () => {
      const wb = createTestWorkbook({
        title: 'Multiple Range References',
        sheets: [
          {
            name: 'Q1',
            cells: {
              A1: { raw: 100 },
              A2: { raw: 150 },
              A3: { raw: 200 },
            },
          },
          {
            name: 'Q2',
            cells: {
              A1: { raw: 120 },
              A2: { raw: 180 },
              A3: { raw: 220 },
            },
          },
          {
            name: 'Annual',
            cells: {
              B1: { formula: '=SUM(Q1!A1:A3)+SUM(Q2!A1:A3)' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const annualId = wb.sheets[2].id;

      // SUM(Q1) = 100+150+200 = 450
      // SUM(Q2) = 120+180+220 = 520
      // Total = 970
      assertCellValue(wb, 'B1', 970, annualId);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Department Budget Consolidation
  // ==========================================================================

  describe('Real-World: Department Budget Consolidation', () => {
    it('should consolidate budgets from 4 department sheets', () => {
      const wb = createTestWorkbook({
        title: 'Budget Consolidation',
        sheets: [
          {
            name: 'Sales',
            cells: {
              A1: { raw: 50000 }, // Salaries
              A2: { raw: 10000 }, // Travel
              A3: { raw: 5000 },  // Equipment
            },
          },
          {
            name: 'Engineering',
            cells: {
              A1: { raw: 120000 }, // Salaries
              A2: { raw: 3000 },   // Travel
              A3: { raw: 25000 },  // Equipment
            },
          },
          {
            name: 'Marketing',
            cells: {
              A1: { raw: 80000 }, // Salaries
              A2: { raw: 15000 }, // Travel
              A3: { raw: 30000 }, // Equipment
            },
          },
          {
            name: 'Operations',
            cells: {
              A1: { raw: 60000 }, // Salaries
              A2: { raw: 5000 },  // Travel
              A3: { raw: 10000 }, // Equipment
            },
          },
          {
            name: 'Consolidated',
            cells: {
              // Total salaries
              B1: { formula: '=Sales!A1+Engineering!A1+Marketing!A1+Operations!A1' },
              // Total travel
              B2: { formula: '=Sales!A2+Engineering!A2+Marketing!A2+Operations!A2' },
              // Total equipment
              B3: { formula: '=Sales!A3+Engineering!A3+Marketing!A3+Operations!A3' },
              // Grand total
              B4: { formula: '=B1+B2+B3' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const consolidatedId = wb.sheets[4].id;

      // Total salaries: 50000+120000+80000+60000 = 310000
      // Total travel: 10000+3000+15000+5000 = 33000
      // Total equipment: 5000+25000+30000+10000 = 70000
      // Grand total: 413000
      assertCellValue(wb, 'B1', 310000, consolidatedId);
      assertCellValue(wb, 'B2', 33000, consolidatedId);
      assertCellValue(wb, 'B3', 70000, consolidatedId);
      assertCellValue(wb, 'B4', 413000, consolidatedId);

      // Update Sales department salaries
      const salesId = wb.sheets[0].id;
      updateCellsAndRecompute(wb, hydration, [
        { sheetId: salesId, address: 'A1', value: 55000 }
      ]);
      setCell(wb, salesId, 'A1', { raw: 55000 });
      recomputeAndPatchCache(wb, hydration);

      // Total salaries: 55000+120000+80000+60000 = 315000
      // Grand total: 315000+33000+70000 = 418000
      assertCellValue(wb, 'B1', 315000, consolidatedId);
      assertCellValue(wb, 'B4', 418000, consolidatedId);
    });
  });

  // ==========================================================================
  // Performance Benchmarks
  // ==========================================================================

  describe('Performance Benchmarks', () => {
    it('should handle 5 sheets with 100 cells each efficiently', () => {
      const sheets = [];
      
      // Create 5 sheets with 100 cells each
      for (let sheetNum = 0; sheetNum < 5; sheetNum++) {
        const cells: Record<string, any> = {};
        
        // Create 10x10 grid
        for (let row = 1; row <= 10; row++) {
          for (let col = 0; col < 10; col++) {
            const address = `${String.fromCharCode(65 + col)}${row}`;
            cells[address] = { raw: sheetNum * 100 + row * 10 + col };
          }
        }
        
        sheets.push({
          name: `Sheet${sheetNum + 1}`,
          cells,
        });
      }

      // Add summary sheet with cross-sheet formulas
      sheets.push({
        name: 'Summary',
        cells: {
          A1: { formula: '=SUM(Sheet1!A1:J10)' },
          A2: { formula: '=SUM(Sheet2!A1:J10)' },
          A3: { formula: '=SUM(Sheet3!A1:J10)' },
          A4: { formula: '=SUM(Sheet4!A1:J10)' },
          A5: { formula: '=SUM(Sheet5!A1:J10)' },
          A6: { formula: '=A1+A2+A3+A4+A5' },
        },
      });

      const wb = createTestWorkbook({
        title: '5-Sheet Performance Test',
        sheets,
      });

      const stats = benchmark(() => {
        const { hydration } = computeWorkbook(wb);
        hydrations.push(hydration);
      });

      console.log(`5 sheets (500+ cells) computation time: ${stats.mean}ms (mean), ${stats.min}ms (min), ${stats.max}ms (max)`);
      
      // Should compute within reasonable time (using mean)
      expect(stats.mean).toBeLessThan(2000); // 2 seconds max average
    });

    it('should efficiently propagate changes across 5-sheet dependency chain', () => {
      const wb = createTestWorkbook({
        title: 'Chain Performance',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 10 },
            },
          },
          {
            name: 'Sheet2',
            cells: {
              B1: { formula: '=Sheet1!A1+1' },
            },
          },
          {
            name: 'Sheet3',
            cells: {
              C1: { formula: '=Sheet2!B1+1' },
            },
          },
          {
            name: 'Sheet4',
            cells: {
              D1: { formula: '=Sheet3!C1+1' },
            },
          },
          {
            name: 'Sheet5',
            cells: {
              E1: { formula: '=Sheet4!D1+1' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheet1Id = wb.sheets[0].id;

      // Measure time for update to propagate through all sheets
      const stats = benchmark(() => {
        updateCellsAndRecompute(wb, hydration, [
          { sheetId: sheet1Id, address: 'A1', value: 100 }
        ]);
        setCell(wb, sheet1Id, 'A1', { raw: 100 });
        recomputeAndPatchCache(wb, hydration);
      });

      console.log(`5-sheet cascade update time: ${stats.mean}ms (mean), ${stats.min}ms (min), ${stats.max}ms (max)`);
      
      // Verify final value
      assertCellValue(wb, 'E1', 104, wb.sheets[4].id);
      
      // Should be very fast (only 4 dependent cells)
      expect(stats.mean).toBeLessThan(100); // 100ms max average
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle self-referencing sheet (same sheet reference)', () => {
      const wb = createTestWorkbook({
        title: 'Self Reference',
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { raw: 10 },
              A2: { formula: '=Sheet1!A1*2' }, // Same sheet reference
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      assertCellValue(wb, 'A2', 20, wb.sheets[0].id);
    });

    it('should handle empty sheet references', () => {
      const wb = createTestWorkbook({
        title: 'Empty Sheet Reference',
        sheets: [
          {
            name: 'Data',
            cells: {},
          },
          {
            name: 'Summary',
            cells: {
              A1: { formula: '=Data!A1+10' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Empty cell typically treated as 0
      const summaryId = wb.sheets[1].id;
      const cell = getCell(wb, summaryId, 'A1');
      const value = cell?.computed?.v ?? cell?.raw;
      
      // Should be 0 + 10 = 10 or #N/A depending on HyperFormula behavior
      expect(value === 10 || (typeof value === 'string' && value.startsWith('#'))).toBe(true);
    });

    it('should handle reference to non-existent cell in another sheet', () => {
      const wb = createTestWorkbook({
        title: 'Non-existent Cell',
        sheets: [
          {
            name: 'Data',
            cells: {
              A1: { raw: 100 },
            },
          },
          {
            name: 'Summary',
            cells: {
              B1: { formula: '=Data!Z99+Data!A1' },
            },
          },
        ],
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      // Data!Z99 is empty (0), Data!A1 is 100, so result should be 100
      const summaryId = wb.sheets[1].id;
      assertCellValue(wb, 'B1', 100, summaryId);
    });
  });
});
