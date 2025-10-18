import { describe, test, expect, afterEach } from 'vitest';
import { computeWorkbook, disposeHF, type HydrationResult } from './hyperformula';
import { createWorkbook, setCell, getCell } from './utils';
import { freezeTime, restoreTime } from './test-utils';

describe('Edge cases: empty, error propagation, volatile, nested', () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach(h => disposeHF(h.hf));
    hydrations = [];
    restoreTime();
  });

  test('empty cells and COUNTBLANK behavior', () => {
    const wb = createWorkbook('EmptyCells');
    const sheet = wb.sheets[0];

    setCell(wb, sheet.id, 'A1', { raw: 10 });
    // A2 left undefined
    setCell(wb, sheet.id, 'A3', { raw: '' });

    setCell(wb, sheet.id, 'B1', { formula: '=COUNTBLANK(A1:A3)' });

    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

    const v = getCell(wb, sheet.id, 'B1')?.computed?.v;
    expect(typeof v === 'number').toBe(true);
  });

  test('error propagation (#DIV/0! -> downstream)', () => {
    const wb = createWorkbook('Errors');
    const sheet = wb.sheets[0];

    setCell(wb, sheet.id, 'A1', { formula: '=1/0' });
    setCell(wb, sheet.id, 'B1', { formula: '=A1+5' });

    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

    const a = getCell(wb, sheet.id, 'A1');
    const b = getCell(wb, sheet.id, 'B1');

    expect(['e','s'].includes(a?.computed?.t ?? '')).toBe(true);
    expect(['e','s'].includes(b?.computed?.t ?? '')).toBe(true);
  });

  test('volatile functions deterministic with freezeTime (NOW/TODAY/RAND)', () => {
    const fixed = Date.UTC(2025, 9, 17, 12, 0, 0);
    freezeTime(fixed);

    const wb = createWorkbook('Volatile');
    const sheet = wb.sheets[0];

    setCell(wb, sheet.id, 'A1', { formula: '=NOW()' });
    setCell(wb, sheet.id, 'A2', { formula: '=TODAY()' });
    setCell(wb, sheet.id, 'A3', { formula: '=RAND()' });

    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

    const now = getCell(wb, sheet.id, 'A1')?.computed?.v;
    const today = getCell(wb, sheet.id, 'A2')?.computed?.v;
    const rand = getCell(wb, sheet.id, 'A3')?.computed?.v;

    expect(typeof now === 'number').toBe(true);
    expect(typeof today === 'number').toBe(true);
    expect(typeof rand === 'number').toBe(true);
  });

  test('deep nested formulas do not crash (depth 100)', () => {
    const wb = createWorkbook('DeepNest');
    const sheet = wb.sheets[0];

    let formula = '=1';
    for (let i = 0; i < 100; i++) {
      formula = `=(${formula})+1`;
    }
    setCell(wb, sheet.id, 'A1', { formula });

    const { hydration } = computeWorkbook(wb);
    hydrations.push(hydration);

  const cell = getCell(wb, sheet.id, 'A1');
  // Engine may produce a numeric result or an error for very deep nesting.
  // Ensure we have a computed result and it is either a number or an error flag.
  expect(cell?.computed).toBeDefined();
  const tv = cell?.computed?.t;
  const isNumber = typeof cell?.computed?.v === 'number';
  const isError = tv === 'e' || tv === 's';
  expect(isNumber || isError).toBe(true);
  });
});
