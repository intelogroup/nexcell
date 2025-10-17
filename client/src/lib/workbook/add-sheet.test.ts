import { it, expect, describe } from 'vitest';
import { addSheet } from './workbook';
import type { WorkbookJSON } from './types';

describe('addSheet helper', () => {
  it('creates unique sheet with default values and updates workbook meta', () => {
    const wb: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-test',
      meta: {
        title: 't',
        author: 'a',
        company: 'c',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [],
    };

    const s1 = addSheet(wb);
    expect(wb.sheets.length).toBe(1);
    expect(s1.id).toBeDefined();
    expect(s1.name).toMatch(/^Sheet\d+$/);
    expect(s1.cells).toEqual({});
    expect(wb.workbookProperties?.workbookView?.activeTab).toBe(0);

    const s2 = addSheet(wb);
    expect(wb.sheets.length).toBe(2);
    expect(s2.name).not.toBe(s1.name);
    expect(wb.workbookProperties?.workbookView?.activeTab).toBe(1);
  });
});
