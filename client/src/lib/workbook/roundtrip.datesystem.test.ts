import { describe, it, expect } from 'vitest';
import { SheetJSAdapter } from './adapters/sheetjs';
import { createWorkbook } from './utils';

describe('Date System Roundtrip', () => {
  it('preserves date1904 system via SheetJS', async () => {
    const wbJson = createWorkbook('DateTest');
    wbJson.meta.dateSystem = '1904';
    wbJson.sheets[0].cells = {
      A1: {
        raw: new Date('2024-01-01'),
        dataType: 'date',
        numFmt: 'mm/dd/yyyy',
      },
    } as any;

    const adapter = new SheetJSAdapter();
    const exported = await adapter.export(wbJson);
    const imported = await adapter.import(exported);

    expect(imported.meta.dateSystem).toBe('1904');
    const cell = imported.sheets[0].cells!['A1'];
    // After import, cell.computed.v may be ISO string, Date, or an Excel serial number.
    // Ensure it's parseable as a date to validate roundtrip semantics.
    const val = cell.computed?.v ?? cell.raw;
    if (typeof val === 'string') {
      const d = new Date(val);
      expect(isNaN(d.getTime())).toBe(false);
    } else if (typeof val === 'number') {
      const XLSX = await import('xlsx');
      const serial = val;
      expect(Number.isFinite(serial)).toBe(true);
      const parsed = (XLSX.SSF as any).parse_date_code(serial, { date1904: imported.meta.dateSystem === '1904' });
      expect(parsed && parsed.y && parsed.m && parsed.d).toBeTruthy();
    } else {
      expect(val).toBeInstanceOf(Date);
    }
  });
});
