import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../hyperformula';
import { applyOperations } from '../operations';

// This test suite covers precise bulk insert/delete and asserts formula address updates, merged range behavior, and named range adjustments.
describe('Bulk insert/delete: formula, merged, named range updates', () => {
  it('updates formulas and named ranges after bulk row insert/delete', () => {
    const wb = createWorkbook('Bulk Insert/Delete');
    const sheet = wb.sheets[0];
    // Setup: formulas and named ranges
    sheet.cells = {
      'A1': { raw: 1 },
      'A2': { raw: 2 },
      'A3': { raw: 3 },
      'B1': { formula: '=SUM(A1:A3)' },
    } as any;
    wb.namedRanges = { RangeA: `${sheet.name}!A1:A3` };

    // Hydrate and compute
    const hydration = hydrateHFFromWorkbook(wb as any);
    recomputeAndPatchCache(wb as any, hydration);
    expect(wb.sheets[0].cells?.['B1']?.computed?.v).toBe(6);

    // Insert row at 2
    const ops = [{ type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 } as any];
  applyOperations(wb as any, ops, { skipRecompute: false, hydration } as any);
  // Named range should expand, formula should still sum correct cells
  expect(wb.namedRanges.RangeA).toMatch(/A1:A4/);
    recomputeAndPatchCache(wb as any, hydration);
    expect(wb.sheets[0].cells?.['B1']?.computed?.v).toBe(6);

    // Delete row at 2
    const opsDel = [{ type: 'deleteRow', sheetId: sheet.id, row: 2, count: 1 } as any];
    applyOperations(wb as any, opsDel, { skipRecompute: false, hydration } as any);
    expect(wb.namedRanges.RangeA).toMatch(/A1:A3/);
    recomputeAndPatchCache(wb as any, hydration);
    expect(wb.sheets[0].cells?.['B1']?.computed?.v).toBe(6);
  });

  it('preserves merged ranges and updates formulas after bulk column insert/delete', () => {
    const wb = createWorkbook('Bulk Col Ops');
    const sheet = wb.sheets[0];
    sheet.cells = {
      'A1': { raw: 'Title' },
      'B1': { raw: 1 },
      'C1': { raw: 2 },
      'D1': { formula: '=B1+C1' },
    } as any;
    sheet.mergedRanges = ['A1:D1'];

    const hydration = hydrateHFFromWorkbook(wb as any);
    recomputeAndPatchCache(wb as any, hydration);
    expect(wb.sheets[0].cells?.['D1']?.computed?.v).toBe(3);

    // Insert column at 2
    const ops = [{ type: 'insertCol', sheetId: sheet.id, col: 2, count: 1 } as any];
  applyOperations(wb as any, ops, { skipRecompute: false, hydration } as any);
  expect(wb.sheets[0].mergedRanges).toContain('A1:E1');
    recomputeAndPatchCache(wb as any, hydration);
    expect(wb.sheets[0].cells?.['E1']?.formula).toBe('=B1+C1');

    // Delete column at 2
    const opsDel = [{ type: 'deleteCol', sheetId: sheet.id, col: 2, count: 1 } as any];
    applyOperations(wb as any, opsDel, { skipRecompute: false, hydration } as any);
    expect(wb.sheets[0].mergedRanges).toContain('A1:D1');
    recomputeAndPatchCache(wb as any, hydration);
    expect(wb.sheets[0].cells?.['D1']?.formula).toBe('=B1+C1');
  });
});
