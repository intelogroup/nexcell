import { describe, it, expect } from 'vitest';
import { createWorkbook, getCell } from '../utils';
import { applyOperations, createSetRangeOp } from '../operations';
import type { Cell } from '../types';

describe('Header row style operations', () => {
  it('sets background color of header row A1:F1 to #E6F3FF', () => {
    const workbook = createWorkbook('Header Style Test');
    const sheetId = workbook.sheets[0].id;

    // Prepare cells A1..F1 with header text and bgColor
    const cells: Record<string, Partial<Cell>> = {};
    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const c of cols) {
      const addr = `${c}1`;
      cells[addr] = {
        raw: `Header ${c}`,
        style: { bgColor: '#E6F3FF' },
      };
    }

    const op = createSetRangeOp(sheetId, 'A1:F1', cells);
    const result = applyOperations(workbook, [op]);

    expect(result.success).toBe(true);

    // Verify each header cell has the expected bgColor
    for (const c of cols) {
      const addr = `${c}1`;
      const cell = getCell(workbook, sheetId, addr);
      expect(cell).toBeDefined();
      expect(cell?.raw).toBe(`Header ${c}`);
      expect(cell?.style?.bgColor).toBe('#E6F3FF');
    }
  });
});
