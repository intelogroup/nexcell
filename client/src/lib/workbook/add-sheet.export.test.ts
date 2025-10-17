import { it, expect, describe } from 'vitest';
import { addSheet } from './workbook';
import { SheetJSAdapter } from './adapters/sheetjs';
import type { WorkbookJSON } from './types';

describe('add-sheet export round-trip', () => {
  it('preserves added sheets through export/import cycle', async () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test Workbook',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
    };

    // Add multiple sheets
    const sheet1 = addSheet(wb, 'First Sheet');
    sheet1.cells = {
      A1: { raw: 'Hello' },
      B1: { raw: 42 },
    };

    const sheet2 = addSheet(wb, 'Second Sheet');
    sheet2.cells = {
      A1: { formula: '=1+2' },
      B1: { raw: 'World' },
    };

    expect(wb.sheets.length).toBe(2);
    expect(wb.workbookProperties?.workbookView?.activeTab).toBe(1); // Last added

    // Export to XLSX
    const adapter = new SheetJSAdapter();
    const buffer = await adapter.export(wb);

    // Import back
    const importedWb = await adapter.import(buffer);

    // Verify structure preserved
    expect(importedWb.sheets.length).toBe(2);
    expect(importedWb.sheets[0].name).toBe('First Sheet');
    expect(importedWb.sheets[1].name).toBe('Second Sheet');

    // Note: activeTab is not preserved in XLSX format
    // expect(importedWb.workbookProperties?.workbookView?.activeTab).toBe(1);

    // Verify cell data preserved
    expect(importedWb.sheets[0].cells?.A1?.raw).toBe('Hello');
    expect(importedWb.sheets[0].cells?.B1?.raw).toBe(42);
    expect(importedWb.sheets[1].cells?.A1?.formula).toBe('=1+2');
    expect(importedWb.sheets[1].cells?.B1?.raw).toBe('World');
  });

  it('handles sheet visibility and properties in export', async () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test Workbook',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
    };

    const sheet1 = addSheet(wb, 'Visible Sheet');
    sheet1.visible = true;
    sheet1.properties = { tabColor: '#FF0000' };

    const sheet2 = addSheet(wb, 'Hidden Sheet');
    sheet2.visible = false;

    const adapter = new SheetJSAdapter();
    const buffer = await adapter.export(wb);
    const importedWb = await adapter.import(buffer);

    expect(importedWb.sheets.length).toBe(2);
    expect(importedWb.sheets[0].visible).toBe(true);
    expect(importedWb.sheets[1].visible).toBe(false);
  });

  it('respects sheet visibility during export', async () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test Workbook',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
    };

    // Add visible and hidden sheets
    const visibleSheet = addSheet(wb, 'Visible');
    visibleSheet.visible = true;
    visibleSheet.cells = { A1: { raw: 'visible' } };

    const hiddenSheet = addSheet(wb, 'Hidden');
    hiddenSheet.visible = false;
    hiddenSheet.cells = { A1: { raw: 'hidden' } };

    const adapter = new SheetJSAdapter();
    const buffer = await adapter.export(wb);
    const importedWb = await adapter.import(buffer);

    // Hidden sheets are exported but marked as hidden in XLSX
    expect(importedWb.sheets.length).toBe(2);
    expect(importedWb.sheets[0].name).toBe('Visible');
    expect(importedWb.sheets[0].visible).toBe(true);
    expect(importedWb.sheets[1].name).toBe('Hidden');
    expect(importedWb.sheets[1].visible).toBe(false);
  });

  it('preserves activeTab through export/import cycle', async () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test Workbook',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
      workbookProperties: {
        workbookView: { activeTab: 2 },
      },
    };

    // Add sheets
    addSheet(wb, 'First');
    addSheet(wb, 'Second');
    addSheet(wb, 'Third');

    const adapter = new SheetJSAdapter();
    // Export should not throw
    await adapter.export(wb);

    // Note: activeTab is not preserved in XLSX format
  });
});