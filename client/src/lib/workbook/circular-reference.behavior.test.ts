import { describe, test, expect, afterEach, beforeEach } from 'vitest';
import {
  detectCircularReferences,
  createCircularReferenceError,
  applyCircularReferenceRecovery,
} from './circular-reference-guard';
import type { WorkbookJSON } from './types';

describe('Circular Reference Behavior', () => {
  let workbook: WorkbookJSON;

  beforeEach(() => {
    workbook = {
      schemaVersion: '1.0',
      workbookId: 'behavior-test',
      meta: { title: 'Behavior', author: 'test', createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() },
      sheets: [ { id: 'Sheet1', name: 'Sheet1', visible: true, grid: { rowCount: 100, colCount: 50 }, cells: {}, mergedRanges: [], properties: {} } ],
      namedRanges: {}
    };
  });

  afterEach(() => {
    // noop
  });

  test('self-reference (A1 -> A1) is detected', () => {
    workbook.sheets[0].cells = { 'A1': { formula: '=A1', dataType: 'formula' } };
    const res = detectCircularReferences(workbook);
    expect(res.hasCircularReferences).toBe(true);
    expect(res.circularChains.length).toBeGreaterThanOrEqual(1);
    // chain should include A1 repeated
    const chain = res.circularChains[0].cells;
    expect(chain[0]).toBe('A1');
    expect(chain[chain.length - 1]).toBe('A1');
  });

  test('multi-cell cycle detection and severity', () => {
    workbook.sheets[0].cells = {
      'A1': { formula: '=B1', dataType: 'formula' },
      'B1': { formula: '=C1', dataType: 'formula' },
      'C1': { formula: '=A1', dataType: 'formula' }
    };

    const res = detectCircularReferences(workbook);
    expect(res.hasCircularReferences).toBe(true);
    expect(res.circularChains[0].severity).toBe('medium');
  });

  test('apply recovery: break_chain removes formula from last cell', () => {
    workbook.sheets[0].cells = {
      'A1': { formula: '=B1', dataType: 'formula' },
      'B1': { formula: '=A1', dataType: 'formula' }
    };

    const res = detectCircularReferences(workbook);
    expect(res.hasCircularReferences).toBe(true);
    const chain = res.circularChains[0];

    const out = applyCircularReferenceRecovery(workbook, { ...chain, sheetId: workbook.sheets[0].id }, 'break_chain');
    expect(out.success).toBe(true);
    // Last cell formula should be removed
    const last = chain.cells[chain.cells.length - 1];
    expect((workbook.sheets[0].cells as any)[last].formula).toBeUndefined();
  });

  test('apply recovery: convert_to_value converts formulas with computed.v', () => {
    // Set up cells with computed values to simulate prior computation
    workbook.sheets[0].cells = {
      'A1': { formula: '=B1', dataType: 'formula', computed: { v: 1 } },
      'B1': { formula: '=A1', dataType: 'formula', computed: { v: 2 } }
    } as any;

    const res = detectCircularReferences(workbook);
    expect(res.hasCircularReferences).toBe(true);
    const chain = res.circularChains[0];

    const out = applyCircularReferenceRecovery(workbook, { ...chain, sheetId: workbook.sheets[0].id }, 'convert_to_value');
    expect(out.success).toBe(true);
    // After conversion, formulas removed and raw set
    for (const addr of out.modifiedCells) {
      expect((workbook.sheets[0].cells as any)[addr].formula).toBeUndefined();
      expect((workbook.sheets[0].cells as any)[addr].raw).toBeDefined();
    }
  });

  test('property-based random cycle generator finds cycles reliably', () => {
    // Generate random dependency chains and ensure detectCircularReferences
    // finds cycles when we intentionally insert them.
    function genChain(len: number) {
      const cells: any = {};
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < len; i++) {
        const cur = `${letters[i]}1`;
        const next = i === len - 1 ? `${letters[0]}1` : `${letters[i+1]}1`;
        cells[cur] = { formula: `=${next}`, dataType: 'formula' };
      }
      return cells;
    }

    for (const l of [2,3,5,10]) {
      workbook.sheets[0].cells = genChain(l);
      const r = detectCircularReferences(workbook);
      expect(r.hasCircularReferences).toBe(true);
      expect(r.circularChains[0].cells.length).toBe(l + 1);
    }
  });
});
