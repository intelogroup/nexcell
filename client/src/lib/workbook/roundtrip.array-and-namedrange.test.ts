import { test, expect } from 'vitest';
import { SheetJSAdapter } from './adapters/sheetjs';
import { createWorkbook, addSheet } from './utils';

test('roundtrip preserves arrayRange and hidden named ranges via SheetJS', async () => {
  const wb = createWorkbook('Test');
  const sheet = addSheet(wb, 'Sheet1');
  // Set up cells for an array formula anchor at A1 that spills to A1:A3
  sheet.cells = sheet.cells || {};
  sheet.cells['A1'] = { formula: '=SEQUENCE(3)', arrayFormula: true, arrayRange: 'A1:A3', computed: { v: 1, ts: new Date().toISOString() } } as any;
  sheet.cells['A2'] = { raw: null, spilledFrom: 'A1' } as any;
  sheet.cells['A3'] = { raw: null, spilledFrom: 'A1' } as any;

  // Add a hidden workbook named range
  wb.namedRanges = wb.namedRanges || {};
  wb.namedRanges['HiddenRange'] = { name: 'HiddenRange', ref: 'Sheet1!$A$1:$A$3', hidden: true } as any;

  const adapter = new SheetJSAdapter();
  const buffer = await adapter.export(wb);
  const imported = await adapter.import(buffer as ArrayBuffer);

  // Verify arrayRange on anchor preserved
  const impSheet = imported.sheets.find(s => s.name === 'Sheet1');
  expect(impSheet).toBeTruthy();
  const impA1 = impSheet!.cells!['A1'];
  expect(impA1).toBeTruthy();
  // arrayRange should be preserved on the anchor (or be present in imported model)
  expect(impA1.arrayRange || impSheet!.cells!['A1']?.arrayRange).toBeTruthy();

  // Verify named range imported and hidden flag preserved
  expect(imported.namedRanges).toBeTruthy();
  const nr = imported.namedRanges!['HiddenRange'] as any;
  expect(nr).toBeTruthy();
  expect(nr.hidden || nr.hidden === true).toBeTruthy();
});
