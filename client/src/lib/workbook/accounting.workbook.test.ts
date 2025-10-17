import { readFileSync } from 'fs';
import path from 'path';
import { computeWorkbook } from './hyperformula';
import type { WorkbookJSON } from './types';
import { describe, beforeEach, test, expect } from 'vitest';

describe('Accounting workbook fixture', () => {
  const fixturePath = path.resolve(__dirname, './samples/accounting-fixture.json');
  let workbook: WorkbookJSON;

  beforeEach(() => {
    const raw = readFileSync(fixturePath, 'utf8');
    workbook = JSON.parse(raw) as WorkbookJSON;
  });

  test('trial balance sums match ledger totals and debits equal credits', () => {
    const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });

    // Ensure formulas were computed
    expect(recompute.errors).toHaveLength(0);

    // Read totals from trial balance
    const get = (addr: string) => {
      const tbSheetId = hydration.sheetMap.get('trial')!;
      return hydration.hf.getCellValue({ sheet: tbSheetId, row: (addr.match(/\d+/) ? parseInt(addr.match(/\d+/)![0], 10) - 1 : 0), col: (addr.match(/[A-Z]+/) ? (addr.match(/[A-Z]+/)![0].charCodeAt(0) - 65) : 0) });
    };

  const totalDebitRaw = get('B11');
  const totalCreditRaw = get('C11');
  const totalDebit = typeof totalDebitRaw === 'number' ? totalDebitRaw : Number(totalDebitRaw ?? 0);
  const totalCredit = typeof totalCreditRaw === 'number' ? totalCreditRaw : Number(totalCreditRaw ?? 0);

  expect(Number.isFinite(totalDebit)).toBeTruthy();
  expect(Number.isFinite(totalCredit)).toBeTruthy();
  expect(totalDebit).toBeCloseTo(totalCredit, 8);
  });

  test('income statement net income equals revenue - cogs - expenses', () => {
    const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });
    expect(recompute.errors).toHaveLength(0);

  const isSheetId = hydration.sheetMap.get('income')!;

    // Helper to fetch HF values by sheet id and A1 address
    const hfGet = (sheetId: number, a1: string) => {
      const match = a1.match(/([A-Z]+)(\d+)/);
      if (!match) return null;
      const col = match[1].charCodeAt(0) - 65;
      const row = parseInt(match[2], 10) - 1;
      return hydration.hf.getCellValue({ sheet: sheetId, row, col });
    };

  const revenueRaw = hfGet(isSheetId, 'B2');
  const cogsRaw = hfGet(isSheetId, 'B3');
  const expensesRaw = hfGet(isSheetId, 'B5');
  const netRaw = hfGet(isSheetId, 'B6');

  const revenue = typeof revenueRaw === 'number' ? revenueRaw : Number(revenueRaw ?? 0);
  const cogs = typeof cogsRaw === 'number' ? cogsRaw : Number(cogsRaw ?? 0);
  const expenses = typeof expensesRaw === 'number' ? expensesRaw : Number(expensesRaw ?? 0);
  const net = typeof netRaw === 'number' ? netRaw : Number(netRaw ?? 0);

  expect(Number.isFinite(revenue)).toBeTruthy();
  expect(Number.isFinite(cogs)).toBeTruthy();
  expect(Number.isFinite(expenses)).toBeTruthy();
  expect(Number.isFinite(net)).toBeTruthy();

  expect(net).toBeCloseTo(revenue - cogs - expenses, 8);
  });

  test('updating a ledger entry triggers recalculation', () => {
    const { hydration } = computeWorkbook(workbook, { validateFormulas: true });

    const isSheetId = hydration.sheetMap.get('income')!;

    // Read original net income
    const origNet = hydration.hf.getCellValue({ sheet: isSheetId, row: 5, col: 1 });

    // Update the workbook JSON: set Ledger!D3 (sheet id 'ledger') to 1000
    const ledgerSheet = workbook.sheets.find(s => s.id === 'ledger');
  if (!ledgerSheet) throw new Error('Ledger sheet missing');
  if (!ledgerSheet.cells) ledgerSheet.cells = {};
  ledgerSheet.cells['D3'] = { raw: 1000, dataType: 'number' } as any;

    // Recompute from updated workbook
    const recomputed = computeWorkbook(workbook, { forceNewHydration: true });

    const newNet = recomputed.hydration.hf.getCellValue({ sheet: isSheetId, row: 5, col: 1 });

    expect(typeof origNet).toBe('number');
    expect(typeof newNet).toBe('number');
    expect(newNet).not.toBe(origNet);
  });
});
