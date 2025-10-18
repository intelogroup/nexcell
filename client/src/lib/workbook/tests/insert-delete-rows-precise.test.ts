import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../hyperformula';
import { applyOperations } from '../operations';

describe('Precise bulk operations via applyOperations', () => {
  it('insertRow shifts cells and affects computed values and action log', () => {
    const wb = createWorkbook('Precise Bulk Ops');
    const sheet = wb.sheets[0];

    // Setup: A1=10, A2=20, B2 = formula referencing A2
    sheet.cells = {
      'A1': { raw: 10 },
      'A2': { raw: 20 },
      'B2': { formula: '=A2' },
    } as any;

    // Initial compute
    const hydration = hydrateHFFromWorkbook(wb as any);
    const recompute1 = recomputeAndPatchCache(wb as any, hydration);
    // B2 should equal 20 initially
    expect(wb.sheets[0].cells?.['B2']?.computed?.v).toBe(20);

    // Apply insertRow at row 2 -> A2 should move to A3
    const ops = [{ type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 } as any];
    const res = applyOperations(wb as any, ops, { skipRecompute: false, hydration } as any);

    // Operation should succeed and be logged
    expect(res.success).toBe(true);
    expect(Array.isArray(wb.actionLog)).toBeTruthy();
    const lastAction = wb.actionLog?.[wb.actionLog.length - 1];
    expect(lastAction?.type).toBe('insertRow');

    // After insert, previous A2 moved to A3; B2 formula still references A2 (no auto-adjust)
    // Recompute now: B2 should no longer equal 20 (A2 is now empty)
    const valAfter = wb.sheets[0].cells?.['B2']?.computed?.v;
    expect(valAfter === 20).toBe(false);

    // Now undo by applying deleteRow at same position using inverse action
    const undoOps = [{ type: 'deleteRow', sheetId: sheet.id, row: 2, count: 1 } as any];
    const res2 = applyOperations(wb as any, undoOps, { skipRecompute: false, hydration } as any);
    expect(res2.success).toBe(true);

    // Recompute again; B2 should be restored to 20
    const recompute2 = recomputeAndPatchCache(wb as any, hydration as any);
    expect(wb.sheets[0].cells?.['B2']?.computed?.v).toBe(20);
  });

  it('insertCol shifts cells right and preserves mergedRanges but does not auto-update formulas', () => {
    const wb = createWorkbook('Precise Bulk Col Ops');
    const sheet = wb.sheets[0];

    sheet.cells = {
      'A1': { raw: 'Title' },
      'B1': { raw: 1 },
      'C1': { raw: 2 },
      'D1': { formula: '=B1+C1' },
    } as any;
    sheet.mergedRanges = ['A1:D1'];

    const hydration = hydrateHFFromWorkbook(wb as any);
    recomputeAndPatchCache(wb as any, hydration as any);

    expect(wb.sheets[0].cells?.['D1']?.computed?.v).toBeDefined();

    const ops = [{ type: 'insertCol', sheetId: sheet.id, col: 2, count: 1 } as any];
    const res = applyOperations(wb as any, ops, { skipRecompute: false, hydration } as any);
    expect(res.success).toBe(true);

  // After insertCol mergedRanges should expand and formulas move to the right
  expect(wb.sheets[0].mergedRanges).toContain('A1:E1');

  // Formula moved from D1 to E1
  expect(wb.sheets[0].cells?.['E1']?.formula).toBe('=B1+C1');
  });
});
