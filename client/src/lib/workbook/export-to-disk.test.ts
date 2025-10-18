import { test, expect } from 'vitest';
import { createWorkbook, setCell } from './utils';
import { SheetJSAdapter } from './adapters/sheetjs';
import { precheckWorkbookForExport } from './export-precheck';
import fs from 'fs';
import path from 'path';

// This test is optional and only writes the XLSX file if WRITE_XLSX=1
const WRITE = process.env.WRITE_XLSX === '1';

test('optional: export XLSX to disk for manual Excel validation', async () => {
  const wb = createWorkbook('Manual Export Test');
  const sheet = wb.sheets[0];

  setCell(wb, sheet.id, 'A1', { raw: 'Hello', dataType: 'string' });
  setCell(wb, sheet.id, 'A2', { raw: 123.45, dataType: 'number', numFmt: '#,##0.00' });
  setCell(wb, sheet.id, 'A3', { formula: '=A2*2', dataType: 'formula', computed: { v: 246.9, t: 'n', ts: new Date().toISOString() } });

  const adapter = new SheetJSAdapter();
  const buffer = await adapter.export(wb);

  // If not writing to disk, assert buffer exists
  expect(buffer).toBeDefined();
  expect(buffer.byteLength).toBeGreaterThan(0);

  // Run export precheck example (non-destructive). Should return an array.
  const precheck = precheckWorkbookForExport(wb);
  expect(Array.isArray(precheck)).toBe(true);

  if (WRITE) {
    const outDir = path.resolve(__dirname, '../../../../tmp');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
    const filePath = path.join(outDir, `nexcell-manual-export-${Date.now()}.xlsx`);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    // Print path for developer
    // eslint-disable-next-line no-console
    console.log(`WROTE XLSX TO: ${filePath}`);
  }
});
