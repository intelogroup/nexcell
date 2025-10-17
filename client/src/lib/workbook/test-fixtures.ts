import type { WorkbookJSON } from './types';

// Test helpers for constructing valid and intentionally invalid workbook fixtures

export function makeValidWorkbook(): WorkbookJSON {
  return {
    schemaVersion: '1.0',
    workbookId: 'fixture-1',
    meta: {
      title: 'Fixture Workbook',
      author: 'test',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        visible: true,
        grid: { rowCount: 100, colCount: 50 },
        cells: {
          A1: { raw: 'Hello', dataType: 'string' },
          A2: { raw: 123, dataType: 'number' },
        },
      },
    ],
  };
}

// Missing required top-level fields (workbookId, meta, sheets)
export function makeInvalidWorkbookMissingFields(): unknown {
  return {
    schemaVersion: '1.0',
    // deliberately missing workbookId, meta, sheets
  };
}

// Wrong type for schemaVersion (should be string)
export function makeInvalidWorkbookWrongType(): unknown {
  const base = makeValidWorkbook();
  return {
    ...base,
    schemaVersion: 1.0, // wrong type
  } as unknown;
}
