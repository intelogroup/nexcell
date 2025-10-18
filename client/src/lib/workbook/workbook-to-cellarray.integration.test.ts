import { describe, it, expect } from 'vitest';
import { createWorkbook } from './utils';
import { workbookToCellArray } from './converters';
import { applyOperations } from './operations';

// This test ensures that applying an operation updates the workbook and
// that the converter `workbookToCellArray` reflects the change.

describe('workbookToCellArray integration', () => {
  it('reflects setCell operation in the output 2D array', () => {
    const wb = createWorkbook('Test');
    const sheetId = wb.sheets[0].id;

    // Initially empty
    let cells = workbookToCellArray(wb, sheetId, 10, 5);
    expect(cells[0][0].value).toBeNull();

    // Apply an edit operation: set A1 to number 123
    const operations = [
      {
        type: 'editCell',
        sheetId,
        address: 'A1',
        cell: { raw: 123, dataType: 'number' },
      },
    ];

    const result = applyOperations(wb, operations as any, { user: 'test' });
    // applyOperations mutates and returns a result object; workbook should be updated

    cells = workbookToCellArray(wb, sheetId, 10, 5);
    expect(cells[0][0].value).toBe(123);
  });
});
