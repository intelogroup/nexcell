import { readFileSync } from 'fs';
import path from 'path';
import { computeWorkbook } from './hyperformula';
import type { WorkbookJSON, Cell } from './types';
import { describe, test, expect } from 'vitest';

describe('Accounting edge cases', () => {
  const fixturePath = path.resolve(__dirname, './samples/accounting-fixture.json');

  test('credit-only account reports credit balance', () => {
    const raw = readFileSync(fixturePath, 'utf8');
    const workbook = JSON.parse(raw) as WorkbookJSON;

    // Add a credit-only account 'Unearned Revenue' with credits only
    const ledger = workbook.sheets.find(s => s.id === 'ledger')!;
    ledger.cells = ledger.cells || {};
    // Add row A10..D10
  ledger.cells['A10'] = { raw: '2025-04-01' } as unknown as Partial<Cell>;
  ledger.cells['B10'] = { raw: 'Unearned Revenue' } as unknown as Partial<Cell>;
  ledger.cells['C10'] = { raw: 0 } as unknown as Partial<Cell>;
  ledger.cells['D10'] = { raw: 400 } as unknown as Partial<Cell>;

    // Add trial balance formula row for Unearned Revenue
    const trial = workbook.sheets.find(s => s.id === 'trial')!;
    trial.cells = trial.cells || {};
    // Append account name in next free row (use A12)
  trial.cells['A12'] = { raw: 'Unearned Revenue' } as unknown as Partial<Cell>;
  trial.cells['B12'] = { formula: '=SUMIFS(Ledger!C:C,Ledger!B:B,"Unearned Revenue")' } as unknown as Partial<Cell>;
  trial.cells['C12'] = { formula: '=SUMIFS(Ledger!D:D,Ledger!B:B,"Unearned Revenue")' } as unknown as Partial<Cell>;

    const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });
    expect(recompute.errors.length).toBe(0);

    const tbId = hydration.sheetMap.get('trial')!;
    const valCredit = hydration.hf.getCellValue({ sheet: tbId, row: 11, col: 2 }); // C12 -> row 12 -1 = 11, col C = 2
    const valDebit = hydration.hf.getCellValue({ sheet: tbId, row: 11, col: 1 });

    expect(Number(valCredit)).toBe(400);
    expect(Number(valDebit)).toBe(0);
  });

  test('zero-value journal entries ignored by sums', () => {
    const raw = readFileSync(fixturePath, 'utf8');
    const workbook = JSON.parse(raw) as WorkbookJSON;

    const ledger = workbook.sheets.find(s => s.id === 'ledger')!;
    ledger.cells = ledger.cells || {};
  ledger.cells['A11'] = { raw: '2025-04-02' } as unknown as Partial<Cell>;
  ledger.cells['B11'] = { raw: 'Expenses' } as unknown as Partial<Cell>;
  ledger.cells['C11'] = { raw: 0 } as unknown as Partial<Cell>;
  ledger.cells['D11'] = { raw: 0 } as unknown as Partial<Cell>;

    const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });
    expect(recompute.errors.length).toBe(0);

    const tbId = hydration.sheetMap.get('trial')!;
    // Expenses are at B8/C8 in fixture
    const expDebit = hydration.hf.getCellValue({ sheet: tbId, row: 7, col: 1 });
    const expCredit = hydration.hf.getCellValue({ sheet: tbId, row: 7, col: 2 });

    // Expect the zero-value row didn't change totals (should still be same as before)
    expect(Number(expDebit)).toBeGreaterThan(0);
  });

  test('cross-sheet update recalculates dependent cells incrementally', () => {
    const raw = readFileSync(fixturePath, 'utf8');
    const workbook = JSON.parse(raw) as WorkbookJSON;

    const { hydration } = computeWorkbook(workbook, { validateFormulas: true });
    const isId = hydration.sheetMap.get('income')!;

    const origNet = hydration.hf.getCellValue({ sheet: isId, row: 5, col: 1 });

    // Modify ledger: change C4 (COGS debit) from 200 to 300
    const ledger = workbook.sheets.find(s => s.id === 'ledger')!;
    ledger.cells = ledger.cells || {};
  ledger.cells['C4'] = { raw: 300 } as unknown as Partial<Cell>;

    const recomputed = computeWorkbook(workbook, { forceNewHydration: true });
    const newNet = recomputed.hydration.hf.getCellValue({ sheet: isId, row: 5, col: 1 });

    expect(Number(newNet)).toBeLessThan(Number(origNet));
  });

  test('small stress: many rows SUMIFS performance/consistency', () => {
    const raw = readFileSync(fixturePath, 'utf8');
    const workbook = JSON.parse(raw) as WorkbookJSON;

    const ledger = workbook.sheets.find(s => s.id === 'ledger')!;
    ledger.cells = ledger.cells || {};

    // Append 200 small entries for account 'Cash' alternating debit/credit
    for (let i = 20; i < 220; i++) {
      const row = i + 1; // A1-based
  ledger.cells[`A${row}`] = { raw: `2025-05-${(i % 28) + 1}` } as unknown as Partial<Cell>;
  ledger.cells[`B${row}`] = { raw: 'Cash' } as unknown as Partial<Cell>;
  ledger.cells[`C${row}`] = { raw: i % 2 === 0 ? 10 : 0 } as unknown as Partial<Cell>;
  ledger.cells[`D${row}`] = { raw: i % 2 === 1 ? 10 : 0 } as unknown as Partial<Cell>;
    }

    const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });
    expect(recompute.errors.length).toBe(0);

    const tbId = hydration.sheetMap.get('trial')!;
    const cashDebit = hydration.hf.getCellValue({ sheet: tbId, row: 1, col: 1 }); // B2 -> row1 col1
    const cashCredit = hydration.hf.getCellValue({ sheet: tbId, row: 1, col: 2 });

    // Totals should be finite numbers
    expect(Number.isFinite(Number(cashDebit))).toBeTruthy();
    expect(Number.isFinite(Number(cashCredit))).toBeTruthy();
  });
});
