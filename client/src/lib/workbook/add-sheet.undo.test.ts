import { it, expect, describe } from 'vitest';
import { addSheet } from './workbook';
import { undo, redo } from './undo';
import type { WorkbookJSON } from './types';

describe('add-sheet undo/redo', () => {
  it('can undo adding a sheet', () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
      actionLog: [],
    };

    // Add a sheet (this should create an inverse action)
    addSheet(wb, 'TestSheet');
    expect(wb.sheets.length).toBe(1);
    expect(wb.actionLog?.length).toBe(1);

    // Undo the add operation
    const undoResult = undo(wb);
    expect(undoResult.success).toBe(true);
    expect(wb.sheets.length).toBe(0);
    expect(wb.actionLog?.length).toBe(1); // Action log remains, but pointer moves
  });

  it('can redo adding a sheet after undo', () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
      actionLog: [],
    };

    // Add and undo
    addSheet(wb, 'TestSheet');
    undo(wb);
    expect(wb.sheets.length).toBe(0);

    // Redo
    const redoResult = redo(wb);
    expect(redoResult.success).toBe(true);
    expect(wb.sheets.length).toBe(1);
    expect(wb.sheets[0].name).toBe('TestSheet');
  });

  it('preserves sheet data through undo/redo cycle', () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
      actionLog: [],
    };

    // Add sheet with data
    const newSheet = addSheet(wb, 'DataSheet');
    newSheet.cells = {
      A1: { raw: 'test data' },
      B1: { formula: '=1+1' },
    };

    // Undo
    undo(wb);
    expect(wb.sheets.length).toBe(0);

    // Redo
    redo(wb);
    expect(wb.sheets.length).toBe(1);
    expect(wb.sheets[0].cells?.A1?.raw).toBe('test data');
    expect(wb.sheets[0].cells?.B1?.formula).toBe('=1+1');
  });

  it('handles multiple sheet additions with undo/redo', () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
      actionLog: [],
    };

    // Add multiple sheets
    addSheet(wb, 'Sheet1');
    addSheet(wb, 'Sheet2');
    addSheet(wb, 'Sheet3');
    expect(wb.sheets.length).toBe(3);

    // Undo twice
    undo(wb);
    expect(wb.sheets.length).toBe(2);
    expect(wb.sheets.map(s => s.name)).toEqual(['Sheet1', 'Sheet2']);

    undo(wb);
    expect(wb.sheets.length).toBe(1);
    expect(wb.sheets[0].name).toBe('Sheet1');

    // Redo once
    redo(wb);
    expect(wb.sheets.length).toBe(2);
    expect(wb.sheets.map(s => s.name)).toEqual(['Sheet1', 'Sheet2']);
  });

  it('updates activeTab correctly through undo/redo', () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 'Test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
      actionLog: [],
      workbookProperties: {
        workbookView: { activeTab: 0 },
      },
    };

    // Add sheet (should set activeTab to 0)
    addSheet(wb, 'NewSheet');
    expect(wb.workbookProperties?.workbookView?.activeTab).toBe(0);

    // Undo
    undo(wb);
    expect(wb.sheets.length).toBe(0);
    // activeTab should be restored (though this depends on undo implementation)

    // Redo
    redo(wb);
    expect(wb.sheets.length).toBe(1);
    expect(wb.workbookProperties?.workbookView?.activeTab).toBe(0);
  });
});