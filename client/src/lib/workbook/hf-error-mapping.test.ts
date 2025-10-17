import { test, expect } from 'vitest';
import { createWorkbook, setCell } from './utils';
import { computeWorkbook } from './hyperformula';

test('HyperFormula error mapping: division by zero -> computed.t === "e"', () => {
  const wb = createWorkbook('HF Error Mapping Test');
  const sheet = wb.sheets[0];

  // A1 = 1
  setCell(wb, sheet.id, 'A1', { raw: 1, dataType: 'number' });
  // A2 = 0
  setCell(wb, sheet.id, 'A2', { raw: 0, dataType: 'number' });
  // B1 = A1 / A2 -> #DIV/0!
  setCell(wb, sheet.id, 'B1', { formula: '=A1/A2', dataType: 'formula' });

  const { recompute } = computeWorkbook(wb);

  // Ensure recompute found updated cell
  expect(recompute.updatedCells).toBeGreaterThanOrEqual(1);

  const b1 = wb.sheets[0].cells?.['B1'];
  expect(b1).toBeDefined();
  expect(b1?.computed).toBeDefined();
  expect(b1?.computed?.t).toBe('e');
  expect(typeof b1?.computed?.v === 'string' && b1?.computed?.v?.startsWith('#')).toBeTruthy();
});
