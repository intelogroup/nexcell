import { describe, it, expect } from 'vitest';
import { SheetJSAdapter } from './adapters/sheetjs';
import { createWorkbook, addSheet, setCell } from './utils';

// Comprehensive roundtrip test for critical Excel features
// Note: keep this test focused on structural fields; heavy visual/style assertions
// should be done manually with a reference XLSX fixture.

describe('Comprehensive roundtrip import/export', () => {
  it('preserves named ranges, freeze panes, column/row sizes, hyperlinks, autofilter and formulas', async () => {
    const adapter = new SheetJSAdapter();

    // Build workbook
    const wb = createWorkbook('Roundtrip');
    const sheet = addSheet(wb, 'Sheet1');
    sheet.cells = sheet.cells || {};

    // Put values
    sheet.cells['A1'] = { raw: 10 } as any;
    sheet.cells['A2'] = { raw: 20 } as any;

    // Named ranges
    wb.namedRanges = { 'MyRange': 'Sheet1!$A$1:$A$2' } as any;
    sheet.namedRanges = { 'Local': 'A1:A2' } as any;

    // formula that uses workbook named range
    sheet.cells['B1'] = { formula: '=SUM(MyRange)' } as any;

    // Freeze panes
    sheet.freezePanes = { row: 1, col: 1 } as any;

    // Column widths/row heights via new fields
    sheet.columnWidths = { A: 15, B: 20 } as any;
    sheet.rowHeights = { '1': 24, '2': 18 } as any;

    // Hyperlink
    sheet.cells['C1'] = { raw: 'Link', hyperlink: { url: 'https://example.com', tooltip: 'go' } } as any;

    // AutoFilter
    sheet.autoFilter = { range: 'A1:C10' } as any;

    // Export
    const buffer = await adapter.export(wb);

    // Import back
    const imported = await adapter.import(buffer);

    // Assertions
    // Named ranges: workbook-level
    expect(imported.namedRanges).toBeTruthy();
    expect(Object.keys(imported.namedRanges || {})).toEqual(expect.arrayContaining(['MyRange']));

    // Sheet-scoped named range should be present
    const impSheet = imported.sheets.find(s => s.name === 'Sheet1');
    expect(impSheet).toBeTruthy();
    expect(Object.keys(impSheet!.namedRanges || {})).toEqual(expect.arrayContaining(['Local']));

    // Freeze panes persisted (either via freezePanes or properties)
    expect(impSheet!.freezePanes || impSheet!.properties?.freeze).toBeTruthy();

    // Column widths/row heights presence
    // Import may map to sheet.cols/sheet.rows; check either
    expect((impSheet!.columnWidths && Object.keys(impSheet!.columnWidths).length > 0) || (impSheet!.cols && Object.keys(impSheet!.cols).length > 0)).toBeTruthy();
    expect((impSheet!.rowHeights && Object.keys(impSheet!.rowHeights).length > 0) || (impSheet!.rows && Object.keys(impSheet!.rows).length > 0)).toBeTruthy();

    // Hyperlink exists
    expect(impSheet!.cells!['C1'].hyperlink).toBeTruthy();
    expect((impSheet!.cells!['C1'].hyperlink as any).url).toBe('https://example.com');

    // Autofilter present
    expect(impSheet!.autoFilter || (impSheet! as any).filters).toBeTruthy();

    // Formula preserved
    expect(impSheet!.cells!['B1'].formula).toBeDefined();

  });
});
