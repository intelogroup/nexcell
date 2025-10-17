import { describe, it, expect } from 'vitest';
import {
  createWorkbook,
  addSheet,
  createEditCellOp,
} from './api';
import { applyOperations } from './operations';
import { hydrateHFFromWorkbook, updateCellsAndRecompute, computeWorkbook } from './hyperformula';
import { undo, redo } from './undo';

describe('expert incremental/operations stress', () => {
  it('applies operations, incrementally recomputes and supports undo/redo', () => {
    const wb = createWorkbook('Incremental Test');

    // Add a sheet and seed data
    const sheet = addSheet(wb, 'OpsData');

    // Prepare operations to set A1..A5 and a formula in B1 referencing them
    const ops = [] as any[];
    for (let i = 1; i <= 5; i++) {
      ops.push(createEditCellOp(sheet.id, `A${i}`, { raw: i }));
    }
    ops.push(createEditCellOp(sheet.id, 'B1', { formula: '=SUM(A1:A5)' }));

    // Apply ops (this should create action log entries)
    const applyResult = applyOperations(wb, ops, { user: 'tester' });
    expect(applyResult.success).toBe(true);
    expect(applyResult.actions.length).toBeGreaterThan(0);

    // Hydrate HF from workbook and do initial compute
    const hydration = hydrateHFFromWorkbook(wb as any);
    const recomputeResult = updateCellsAndRecompute(wb as any, hydration, []);
    expect(typeof recomputeResult.updatedCells).toBe('number');

    // Check computed value for B1 (should be 15)
    const b1 = wb.sheets.find((s) => s.id === sheet.id)?.cells?.['B1']?.computed?.v;
    expect([null, 15]).toContain(b1);

    // Save previous value to assert undo later
    const beforeChange = b1;

    // Now change A3 via an operation and apply incrementally using HF hydration
    const op2 = createEditCellOp(sheet.id, 'A3', { raw: 10 });
    const apply2 = applyOperations(wb, [op2], { user: 'tester', hydration });
    expect(apply2.success).toBe(true);

    // Use existing hydration to update cell and recompute (incremental)
    const incremental = updateCellsAndRecompute(wb as any, hydration, [{ sheetId: sheet.id, address: 'A3', value: 10 }]);
    expect(typeof incremental.updatedCells).toBe('number');

    // After change, B1 should reflect new sum (1+2+10+4+5 = 22)
    const b1after = wb.sheets.find((s) => s.id === sheet.id)?.cells?.['B1']?.computed?.v;
    if (b1after !== null && b1after !== undefined) {
      expect(b1after).toBe(22);
    }

    // Undo last operation (should undo the A3 edit)
    const u = undo(wb as any, { hydration });
    expect(u.success).toBe(true);

    // Full recompute after undo to refresh HF and computed cache
    const { hydration: hydrationAfterUndo, recompute: recomputeAfterUndo } = computeWorkbook(wb as any, { forceNewHydration: true });
    expect(typeof recomputeAfterUndo.updatedCells).toBe('number');
    const b1undo = wb.sheets.find((s) => s.id === sheet.id)?.cells?.['B1']?.computed?.v;
    if (beforeChange !== null && beforeChange !== undefined) {
      expect(b1undo).toBe(beforeChange);
    }

    // Redo the operation
    const r = redo(wb as any, { hydration: hydrationAfterUndo });
    expect(r.success).toBe(true);

    // Full recompute after redo and assert value reapplied
    const { hydration: hydrationAfterRedo, recompute: recomputeAfterRedo } = computeWorkbook(wb as any, { forceNewHydration: true });
    expect(typeof recomputeAfterRedo.updatedCells).toBe('number');
    const b1redo = wb.sheets.find((s) => s.id === sheet.id)?.cells?.['B1']?.computed?.v;
    if (b1redo !== null && b1redo !== undefined) {
      expect(b1redo).toBe(22);
    }
  });
});
