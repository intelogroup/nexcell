import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../utils';
import { SheetJSAdapter } from '../adapters/sheetjs';

describe('Conditional formatting roundtrip', () => {
  it('exports warnings when conditional formats are present (SheetJS limitations)', async () => {
    const wb = createWorkbook('CF Test');
    const sheet = wb.sheets[0];
    sheet.conditionalFormats = [ { id: 'cf1', range: 'A1:A10', rule: { type: 'cellIs', operator: 'greaterThan', formula: '10', style: { fill: '#FF0000' } } } ] as any;

    const adapter = new SheetJSAdapter();
    const buffer = await adapter.export(wb as any);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    // If SheetJS doesn't support CF it should add exportWarnings
    expect(Array.isArray((wb as any).exportWarnings)).toBeTruthy();
  });
});
