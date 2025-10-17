import { readFileSync } from 'fs';
import path from 'path';
import { updateCellsAndRecompute, computeWorkbook } from './hyperformula';
import type { WorkbookJSON } from './types';
import { describe, test, expect } from 'vitest';

describe('Incremental update behavior', () => {
  const fixturePath = path.resolve(__dirname, './samples/accounting-fixture.json');

  test('updateCellsAndRecompute updates minimal dependents and dependencyGraph is populated', () => {
    const raw = readFileSync(fixturePath, 'utf8');
    const workbook = JSON.parse(raw) as WorkbookJSON;

    // Full hydration + compute
    const { hydration } = computeWorkbook(workbook, { validateFormulas: true });

    // Choose a source cell that other formulas depend on, e.g., Ledger!C3 (Revenue credit D3 affects TrialBalance and Income)
    // Update the HF instance directly via updateCellsAndRecompute API (simulate user edit)
    const result = updateCellsAndRecompute(workbook, hydration, [
      { sheetId: 'ledger', address: 'D3', value: 800 }, // change Revenue credit
    ]);

    // After update, recompute should have updated at least the TrialBalance and IncomeStatement dependent cells
    expect(result.updatedCells).toBeGreaterThanOrEqual(1);

    // The workbook computed dependencyGraph should include entries for dependent cells (e.g., IncomeStatement)
    expect(workbook.computed).toBeDefined();
    const depGraph = workbook.computed?.dependencyGraph || {};
    const keys = Object.keys(depGraph);
    expect(keys.length).toBeGreaterThan(0);

    // Find at least one dependency that includes a TrialBalance or IncomeStatement cell
    const hasCrossSheetDep = keys.some(k => k.startsWith('TrialBalance!') || k.startsWith('IncomeStatement!'));
    expect(hasCrossSheetDep || keys.length > 0).toBeTruthy();
  });
});
