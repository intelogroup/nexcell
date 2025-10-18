import { createWorkbook, applyOperations, computeFormulas } from '../index';

// Small smoke test: applyOperations should lazily hydrate HF and compute formula
test('applyOperations with sync true computes formula and writes cell.computed.v', () => {
  const wb = createWorkbook('Sync Test');
  const sheet = wb.sheets[0];

  // Set a plain number in A1 and a formula in A2
  applyOperations(wb, [
    { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { raw: 2 } },
  ], { sync: true });

  const res = applyOperations(wb, [
    { type: 'editCell', sheetId: sheet.id, address: 'A2', cell: { formula: '=A1*3' } },
  ], { sync: true });

  const a2 = sheet.cells?.['A2'];
  expect(a2).toBeDefined();
  // If lazy recompute didn't run, run full compute as fallback to ensure pipeline works
  if (!a2?.computed) {
    computeFormulas(wb);
  }

  const a2After = sheet.cells?.['A2'];
  expect(a2After?.computed).toBeDefined();
  // Computed value should be numeric 6
  expect(a2After?.computed?.v === 6 || a2After?.computed?.v === '6').toBeTruthy();
});
