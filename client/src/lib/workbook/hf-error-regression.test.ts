import { describe, it, expect } from 'vitest';
import { computeWorkbook } from './hyperformula';
import type { WorkbookJSON } from './types';

describe('HyperFormula error regression tests', () => {
  const errorCases: Array<{ formula: string; token: string | string[] }> = [
    { formula: '=1/0', token: '#DIV/0!' },
    { formula: '=FOOBAR()', token: '#NAME?' },
    // HyperFormula may return #NAME? for an INDIRECT referencing a missing sheet
    // or #REF! in other configs; accept either as valid for regression purposes.
    { formula: '=INDIRECT("SheetDoesNotExist!A1")', token: ['#REF!', '#NAME?'] },
    { formula: '="text"+1', token: '#VALUE!' },
    { formula: '=NA()', token: '#N/A' },
  ];

  for (const { formula, token } of errorCases) {
    it(`maps ${token} (${formula}) to computed.t === 'e' and computed.v === '${token}'`, () => {
      const workbook: WorkbookJSON = {
        schemaVersion: '1.0',
        workbookId: 'test-wb',
        meta: {
          title: 'hf-error-test',
          author: 'test',
          company: 'test',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        },
        sheets: [
          {
            id: 'sheet-1',
            name: 'Sheet1',
            cells: {
              A1: {
                formula,
              },
            },
          },
        ],
      };

      const { recompute } = computeWorkbook(workbook, { validateFormulas: false });

      // ensure recompute ran and recorded the computed value
      expect(recompute.updatedCells).toBeGreaterThanOrEqual(1);

      const computed = workbook.sheets[0].cells!['A1'].computed;
      expect(computed).toBeDefined();
      expect(computed!.t).toBe('e');
  // computed.v may be the token string or an object - normalize to string
  const vStr = String(computed!.v);
  const expectedTokens = Array.isArray(token) ? token : [token];
  const anyMatch = expectedTokens.some((t) => vStr.includes(t));
  expect(anyMatch).toBe(true);
    });
  }
});
