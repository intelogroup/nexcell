import { test, expect } from 'vitest';
import { createWorkbook, addSheet } from './api';
import { createEditCellOp } from './operations';
import { applyOperations } from './operations';
import { computeWorkbook } from './hyperformula';

// Performance stress test - skipped by default to avoid slowing CI
test.skip('performance: large range recompute (100x10)', () => {
  const wb = createWorkbook('Perf Test');
  const sheet = addSheet(wb, 'Perf');

  const rows = 100; // rows
  const cols = 10; // columns A..J

  // Fill A1..J100 with numbers and set a formula in K1 summing A1:J100
  const ops: any[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const colLetter = String.fromCharCode(64 + c); // 1->A
      ops.push(createEditCellOp(sheet.id, `${colLetter}${r}`, { raw: r * c }));
    }
  }

  // Add a formula that sums the entire block into cell L1
  ops.push(createEditCellOp(sheet.id, 'L1', { formula: `=SUM(A1:${String.fromCharCode(64 + cols)}${rows})` }));

  // Apply operations
  const applyRes = applyOperations(wb, ops, { user: 'perf' });
  expect(applyRes.success).toBe(true);

  // Measure compute time
  const start = Date.now();
  const { hydration, recompute } = computeWorkbook(wb as any, { forceNewHydration: true });
  const duration = Date.now() - start;

  // Log metrics (test runner will show console output when verbose)
  // eslint-disable-next-line no-console
  console.log(`Perf recompute: updatedCells=${recompute.updatedCells} durationMs=${duration}`);

  // Basic sanity checks
  expect(typeof recompute.updatedCells).toBe('number');
  expect(duration).toBeGreaterThanOrEqual(0);
});
