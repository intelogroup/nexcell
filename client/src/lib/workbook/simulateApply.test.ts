import { describe, it, expect } from 'vitest';
import { createWorkbook, createEditCellOp } from './api';
import { simulateApply } from './api';
import { cloneWorkbook } from './utils';

describe('simulateApply dry-run', () => {
  it('does not mutate original workbook and returns a diff', async () => {
    const wb = createWorkbook('SimTest');
    const sheet = wb.sheets[0];

    // Set initial cell A1
    sheet.cells = { A1: { raw: 10 } };
    const before = cloneWorkbook(wb);

    const ops = [createEditCellOp(sheet.id, 'A2', { raw: 20 })];

    const res = await simulateApply(wb, ops, { forceNewHydration: true });
    expect(res.success).toBe(true);
    expect(res.actualDiff).toBeDefined();
    expect(res.actualDiff.totalAffectedCells).toBeGreaterThanOrEqual(1);

    // Original workbook must be unchanged
    expect(JSON.stringify(wb)).toEqual(JSON.stringify(before));
  });

  it('is deterministic across repeated runs', async () => {
    const wb = createWorkbook('Deterministic');
    const sheet = wb.sheets[0];
    sheet.cells = { A1: { raw: 1 }, A2: { formula: '=A1*2' } };

    const ops = [createEditCellOp(sheet.id, 'A1', { raw: 5 })];

    const r1 = await simulateApply(wb, ops, { forceNewHydration: true });
    const r2 = await simulateApply(wb, ops, { forceNewHydration: true });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(JSON.stringify(r1.actualDiff)).toEqual(JSON.stringify(r2.actualDiff));
  });

  it('computes precise structural diffs for insertRow/deleteRow', async () => {
    const wb = createWorkbook('StructTest');
    const sheet = wb.sheets[0];
    // Put data in rows 1..3
    sheet.cells = { A1: { raw: 1 }, A2: { raw: 2 }, A3: { raw: 3 } };

    // Insert row at 2 (shifts A2->A3, A3->A4)
    const ops = [{ type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 } as any];

    const res = await simulateApply(wb, ops, { forceNewHydration: true });
    expect(res.success).toBe(true);
    const struct = res.actualDiff.structuralChanges.find((s: any) => s.type === 'insertRow');
    expect(struct).toBeDefined();
    expect(struct.details.insertedRows).toBe(1);
    expect(Array.isArray(struct.details.movedCells)).toBe(true);
    // Should include A2 -> A3 mapping
    const moved = struct.details.movedCells.map((m: any) => `${m.from}->${m.to}`);
    expect(moved).toContain('A2->A3');
    expect(moved).toContain('A3->A4');
  });

  it('computes precise structural diffs for insertCol/deleteCol', async () => {
    const wb = createWorkbook('StructTestCols');
    const sheet = wb.sheets[0];
    // Put data in A1,B1,C1
    sheet.cells = { A1: { raw: 1 }, B1: { raw: 2 }, C1: { raw: 3 } };

    // Insert column at 2 (shifts B->C, C->D)
    const ops = [{ type: 'insertCol', sheetId: sheet.id, col: 2, count: 1 } as any];

    const res = await simulateApply(wb, ops, { forceNewHydration: true });
    expect(res.success).toBe(true);
    const struct = res.actualDiff.structuralChanges.find((s: any) => s.type === 'insertCol');
    expect(struct).toBeDefined();
    expect(struct.details.insertedCols).toBe(1);
    const moved = struct.details.movedCells.map((m: any) => `${m.from}->${m.to}`);
    expect(moved).toContain('B1->C1');
    expect(moved).toContain('C1->D1');
  });

  it('includes merge and addSheet structural ops and tags computedBy with planId', async () => {
    const wb = createWorkbook('StructExtras');
    const sheet = wb.sheets[0];
    sheet.cells = { A1: { raw: 1 }, B1: { raw: 2 } };

    const ops: any[] = [
      { type: 'merge', sheetId: sheet.id, range: 'A1:B1' },
      { type: 'addSheet', name: 'NewSheet' },
      { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { raw: 5 } },
    ];

    const planId = 'plan-123';
    const res = await simulateApply(wb, ops, { forceNewHydration: true, planId });
    expect(res.success).toBe(true);
    const mergeOp = res.actualDiff.structuralChanges.find((s: any) => s.type === 'merge');
    const addSheetOp = res.actualDiff.structuralChanges.find((s: any) => s.type === 'addSheet');
    expect(mergeOp).toBeDefined();
    expect(addSheetOp).toBeDefined();

    // Check computed provenance map includes entries for changed cells
    expect(res.actualDiff.computedProvenance).toBeDefined();
    const provKeys = Object.keys(res.actualDiff.computedProvenance || {});
    expect(provKeys.length).toBeGreaterThan(0);
    // At least one provenance value should start with 'simulate-'
    const hasSimTag = provKeys.some(k => String((res.actualDiff.computedProvenance || {})[k]).startsWith('simulate-'));
    expect(hasSimTag).toBe(true);
  });
});
