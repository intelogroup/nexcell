import { describe, it, expect } from 'vitest';
import { createWorkbook, createEditCellOp, addSheet } from './api';
import { simulateApply } from './api';

// Edge-case tests for computedProvenance map returned by simulateApply

describe('simulateApply provenance edge cases', () => {
  it('includes spilled-array formula provenance (array-spill)', async () => {
    const wb = createWorkbook('SpillTest');
    const sheet = wb.sheets[0];

    // Setup a spilled array formula in A1 that spills to A1:A2
    // Using a simple array-like formula via HyperFormula e.g., {=TRANSPOSE({1,2})}
    // We emulate by placing a formula that HyperFormula will return as array
    sheet.cells = {
      A1: { formula: '=SPLIT("1,2", ",")' }, // SPLIT returns array-like in HF (if supported)
      B1: { raw: 10 },
    };

    // Simulate an edit that triggers recompute (change B1 doesn't matter but exercise recompute)
    const ops = [createEditCellOp(sheet.id, 'B1', { raw: 20 })];

    const res = await simulateApply(wb, ops, { forceNewHydration: true, planId: 'spill-1' });
    expect(res.success).toBe(true);
    expect(res.actualDiff).toBeDefined();
    expect(res.actualDiff.computedProvenance).toBeDefined();

    // At least one key should reference the sheet and an address starting with 'A'
    const keys = Object.keys(res.actualDiff.computedProvenance || {});
    expect(keys.some(k => k.startsWith(`${sheet.name}!A`))).toBe(true);
    // Provenance values should start with simulate-
    const hasSim = keys.some(k => String((res.actualDiff.computedProvenance || {})[k]).startsWith('simulate-'));
    expect(hasSim).toBe(true);
  });

  it('includes provenance for cross-sheet structural ops (insertRow affecting formulas in other sheets)', async () => {
    const wb = createWorkbook('CrossSheet');
    const sheet1 = wb.sheets[0];
    // Add a second sheet named Data
    const newSheet = addSheet(wb, 'Data');

    // Put values on Data.A1..A2 and a formula on Sheet1 referencing Data
    newSheet.cells = { A1: { raw: 1 }, A2: { raw: 2 } };
    sheet1.cells = { B1: { formula: '=Data!A1 + Data!A2' } };

    // Insert a row in Data at row 1 which will shift A1->A2, A2->A3
    const ops: any[] = [{ type: 'insertRow', sheetId: newSheet.id, row: 1, count: 1 }];

    const res = await simulateApply(wb, ops, { forceNewHydration: true, planId: 'cross-1' });
    expect(res.success).toBe(true);
    expect(res.actualDiff).toBeDefined();
    expect(res.actualDiff.computedProvenance).toBeDefined();

    const keys = Object.keys(res.actualDiff.computedProvenance || {});
    // Should include the formula cell on Sheet1
    expect(keys.some(k => k === `${sheet1.name}!B1`)).toBe(true);
    // Should include data sheet addresses (Data!A2 or Data!A3 depending on hf mapping)
    expect(keys.some(k => k.startsWith(`${newSheet.name}!A`))).toBe(true);

    // Provenance values should include our simulate tag
    const hasSim = keys.some(k => String((res.actualDiff.computedProvenance || {})[k]).startsWith('simulate-'));
    expect(hasSim).toBe(true);
  });
});
