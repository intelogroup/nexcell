import { describe, it, expect } from 'vitest';
import { SheetJSAdapter } from './sheetjs';
import { createWorkbook, addSheet } from '../utils';

// Note: tests run in Node context; SheetJS is dynamically imported inside adapter.

describe('SheetJS Adapter export mappings', () => {
  it('exports named ranges, freeze panes, column/row sizes, hyperlinks, and autofilter', async () => {
    const adapter = new SheetJSAdapter();
    const wb = createWorkbook('Test');

    // Add sheet and prepare features
    const sheet = addSheet(wb, 'Data');
    sheet.cells = sheet.cells || {};
    sheet.cells['A1'] = { raw: 100 } as any;
    sheet.cells['B1'] = { raw: 200, hyperlink: { url: 'https://example.com', tooltip: 'Example' } } as any;

    // Named ranges (workbook & sheet-scoped)
    wb.namedRanges = { 'TaxRate': 'Data!$A$1:$A$1' } as any;
    sheet.namedRanges = { 'LocalRange': 'B1:B1' } as any;

    // Freeze panes
    sheet.freezePanes = { row: 1, col: 1 } as any;

    // Column widths and row heights
    sheet.columnWidths = { A: 20, B: 30 } as any;
    sheet.rowHeights = { '1': 25 } as any;

    // AutoFilter
    sheet.autoFilter = { range: 'A1:B10' } as any;

    // Export using adapter and inspect the resulting workbook object via internal API
    // We call the adapter.export to get a buffer, but we need to inspect the intermediate
    // workbook produced by sheetjs. To avoid duplicating code, we'll call the private
    // sheetToWorksheet via casting (not ideal but sufficient for unit test purposes).

    // @ts-ignore access private method for testing
    const XLSX = await import('xlsx');
    // Build worksheet and workbook like the adapter
    // @ts-ignore
    const ws = (adapter as any).sheetToWorksheet(sheet, XLSX, []);

    // Check worksheet contains hyperlink on B1
    expect((ws as any)['B1'].l).toBeTruthy();
    expect((ws as any)['B1'].l.Target).toBe('https://example.com');

    // Check !autofilter present
    expect((ws as any)['!autofilter']).toBeTruthy();
    expect((ws as any)['!autofilter'].ref).toBe('A1:B10');

    // Check freeze set
    expect((ws as any)['!freeze']).toBeTruthy();
    expect((ws as any)['!freeze'].xSplit).toBe(1);
    expect((ws as any)['!freeze'].ySplit).toBe(1);

    // Check cols/rows mapping from columnWidths/rowHeights
    expect((ws as any)['!cols']).toBeTruthy();
    expect(Array.isArray((ws as any)['!cols'])).toBeTruthy();
    expect((ws as any)['!rows']).toBeTruthy();

    // Test named ranges export by calling adapter.export and reading written workbook Names
    const buffer = await adapter.export(wb);
    const read = XLSX.read(buffer, { type: 'array' });
    const names = (read as any).Workbook?.Names || [];
    // Expect both named ranges present
    const nameList = names.map((n: any) => n.Name);
    expect(nameList).toEqual(expect.arrayContaining(['TaxRate', 'LocalRange']));
  });
});
