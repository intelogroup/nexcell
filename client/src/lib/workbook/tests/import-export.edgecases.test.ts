import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../utils';
import { SheetJSAdapter } from '../adapters/sheetjs';

describe('Import/Export edge cases', () => {
  it('roundtrips merged cells and formulas', async () => {
    const wb = createWorkbook('Edge Cases');
    const sheet = wb.sheets[0];
    sheet.cells = { 'A1': { raw: 'Header' }, 'B1': { raw: 1 }, 'B2': { raw: 2 }, 'C1': { formula: '=SUM(B1:B2)' } } as any;
    sheet.mergedRanges = ['A1:C1'];

    const adapter = new SheetJSAdapter();
    const buf = await adapter.export(wb as any);
    const imported = await adapter.import(buf as any);

    const importedSheet = imported.sheets?.[0];
    expect(importedSheet).toBeDefined();
    expect((importedSheet?.mergedRanges || []).length).toBeGreaterThan(0);
    // formulas should be present after import
    expect(importedSheet?.cells?.['C1']?.formula).toBeTruthy();
  });
});
