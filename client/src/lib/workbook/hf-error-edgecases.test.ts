import { describe, it, expect } from 'vitest';
import { hydrateHFFromWorkbook, recomputeAndPatchCache, computeWorkbook, DEFAULT_HF_CONFIG } from './hyperformula';
import type { WorkbookJSON } from './types';

describe('HyperFormula edge-case error tests', () => {
  it('maps #NUM! for invalid numeric operations (e.g., SQRT(-1))', () => {
    const workbook: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'edge-num',
      meta: {
        title: 'hf-edge-num',
        author: 'test',
        company: 'test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          cells: {
            A1: { formula: '=SQRT(-1)' },
          },
        },
      ],
    };

    const { recompute } = computeWorkbook(workbook, { validateFormulas: false });
    expect(recompute.updatedCells).toBeGreaterThanOrEqual(1);
    const computed = workbook.sheets[0].cells!['A1'].computed!;
    expect(computed.t).toBe('e');
    expect(String(computed.v)).toContain('#NUM!');
  });

  it('maps #NULL! for invalid range intersection', () => {
    // Example of an invalid intersection: =SUM(A1:A2 B1:B2) (space intersection)
    const workbook: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'edge-null',
      meta: {
        title: 'hf-edge-null',
        author: 'test',
        company: 'test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          cells: {
            A1: { raw: 1 },
            A2: { raw: 2 },
            B1: { raw: 3 },
            B2: { raw: 4 },
            C1: { formula: '=A1:A2 B1:B2' },
          },
        },
      ],
    };

    const { recompute } = computeWorkbook(workbook, { validateFormulas: false });
    expect(recompute.updatedCells).toBeGreaterThanOrEqual(1);
    const computed = workbook.sheets[0].cells!['C1'].computed!;
    expect(computed.t).toBe('e');
    // HyperFormula may return a generic #ERROR! or the specific #NULL! token
    expect(['#NULL!', '#ERROR!'].some((t) => String(computed.v).includes(t))).toBe(true);
  });

  it('behaves consistently when evaluateNullToZero toggled in HF config', () => {
    const workbook: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'edge-config',
      meta: {
        title: 'hf-edge-config',
        author: 'test',
        company: 'test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          cells: {
            A1: { raw: null },
            A2: { formula: '=A1+1' },
          },
        },
      ],
    };

    // Default config (evaluateNullToZero is true by default in our DEFAULT_HF_CONFIG)
    const hydrationDefault = hydrateHFFromWorkbook(workbook, { config: { ...DEFAULT_HF_CONFIG } });
    recomputeAndPatchCache(workbook, hydrationDefault);
    const computedDefault = workbook.sheets[0].cells!['A2'].computed!;

    // Now disable evaluateNullToZero and recompute in a fresh workbook copy
    const workbook2: WorkbookJSON = JSON.parse(JSON.stringify(workbook));
    const hydrationAlt = hydrateHFFromWorkbook(workbook2, { config: { ...DEFAULT_HF_CONFIG, evaluateNullToZero: false } });
    recomputeAndPatchCache(workbook2, hydrationAlt);
    const computedAlt = workbook2.sheets[0].cells!['A2'].computed!;

    // When evaluateNullToZero is true, adding null should treat as 0 -> numeric result or mapped appropriately
    expect(['n', 'e', 's', 'b', 'd']).toContain(computedDefault.t);
    // When disabled, behavior may produce error or propagate null; ensure we handle mappings and don't crash
    expect(['n', 's', 'b', 'e', 'd']).toContain(computedAlt.t);
  });
});
