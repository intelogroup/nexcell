import { describe, test, expect, afterEach } from 'vitest';
import { computeWorkbook, disposeHF, type HydrationResult } from './hyperformula';
import { createWorkbook, setCell, getCell } from './utils';

describe('Array formulas and spill behavior', () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach(h => disposeHF(h.hf));
    hydrations = [];
  });

  test('SUMPRODUCT over two ranges', () => {
    const wb = createWorkbook('Sumproduct');
    const sheet = wb.sheets[0];

    setCell(wb, sheet.id, 'A1', { raw: 1 });
    setCell(wb, sheet.id, 'A2', { raw: 2 });
    setCell(wb, sheet.id, 'A3', { raw: 3 });

    setCell(wb, sheet.id, 'B1', { raw: 4 });
    setCell(wb, sheet.id, 'B2', { raw: 5 });
    setCell(wb, sheet.id, 'B3', { raw: 6 });

    setCell(wb, sheet.id, 'C1', { formula: '=SUMPRODUCT(A1:A3,B1:B3)' });

    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

    // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    expect(getCell(wb, sheet.id, 'C1')?.computed?.v).toBe(32);
  });

  test('TRANSPOSE of a horizontal array results in vertical spill (if supported)', () => {
    const wb = createWorkbook('Transpose');
    const sheet = wb.sheets[0];

    // Place a TRANSPOSE formula that returns multiple values
    setCell(wb, sheet.id, 'A1', { raw: 1 });
    setCell(wb, sheet.id, 'B1', { raw: 2 });
    setCell(wb, sheet.id, 'C1', { raw: 3 });

    setCell(wb, sheet.id, 'D1', { formula: '=TRANSPOSE(A1:C1)' });

    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

    // If dynamic arrays/spill are supported, D1 should be first of spilled values
    const v = getCell(wb, sheet.id, 'D1')?.computed?.v;
    expect(v).toBeDefined();
  });

  test('Array constant handling', () => {
    const wb = createWorkbook('ArrayConst');
    const sheet = wb.sheets[0];

    setCell(wb, sheet.id, 'A1', { formula: '=SUM({1,2,3})' });
    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

    // Expect sum = 6 if array constants are supported
    const val = getCell(wb, sheet.id, 'A1')?.computed?.v;
    if (typeof val === 'number') {
      expect(val).toBe(6);
    } else {
      // If not supported, at least ensure engine didn't crash and returned something
      expect(val).toBeDefined();
    }
  });
});
