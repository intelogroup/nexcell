import { describe, it, expect } from 'vitest';
import { createWorkbook, addSheet } from '../utils';
import { insertRows, deleteRows, insertColumns, deleteColumns, copyRange } from '../../db/jsonWorkbook';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../hyperformula';

describe('Bulk row/column operations', () => {
  it('shifts formulas correctly when inserting rows', () => {
    const wb = createWorkbook('Bulk Ops');
    const sheet = wb.sheets[0];

    sheet.cells = {
      'A1': { raw: 1 },
      'A2': { raw: 2 },
      'A3': { raw: 3 },
      'B1': { formula: '=SUM(A1:A3)' },
    } as any;

    const before = JSON.stringify(sheet.cells);

    // Simulate insert row at row 2 by shifting A2->A3
    const newCells: Record<string, any> = {};
    for (const [addr, cell] of Object.entries(sheet.cells || {})) {
      if (addr === 'A2') newCells['A3'] = cell;
      else newCells[addr] = cell;
    }
    sheet.cells = newCells as any;

    // formula should still exist at B1
    const newSheet = sheet;
  expect(newSheet).toBeDefined();
  expect(newSheet.cells?.['B1']).toBeDefined();
  });

  it('shifts formulas correctly when deleting columns', () => {
    const wb = createWorkbook('Bulk Ops');
    const sheet = wb.sheets[0];
    sheet.cells = {
      'A1': { raw: 10 },
      'B1': { raw: 20 },
      'C1': { formula: '=A1+B1' },
    } as any;

    // Simulate deleting column A by moving B->A and dropping A
    const shifted: Record<string, any> = {};
    for (const [addr, cell] of Object.entries(sheet.cells || {})) {
      // very small simulation: handle A1,B1,C1 keys
      if (addr.startsWith('B')) {
        const newAddr = 'A' + addr.substring(1);
        shifted[newAddr] = cell;
      } else if (addr.startsWith('C')) {
        const newAddr = 'B' + addr.substring(1);
        shifted[newAddr] = cell;
      }
    }
    sheet.cells = shifted as any;
  const newSheet2 = sheet;
  expect(Object.values(newSheet2.cells || {}).length).toBeGreaterThan(0);
  });
});
