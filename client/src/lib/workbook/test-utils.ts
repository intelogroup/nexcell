import { vi } from 'vitest';
import type { WorkbookJSON } from './types';

export function freezeTime(nowMs: number) {
  vi.useFakeTimers();
  vi.setSystemTime(nowMs);
}

export function restoreTime() {
  vi.useRealTimers();
}

// Build a normalized WorkbookJSON from a lightweight fixture shape.
// The fixture is already expected to be close to WorkbookJSON in this repo,
// but ensure default fields exist so tests can rely on them.
export function buildWorkbookFromFixture(json: any): WorkbookJSON {
  const wb: WorkbookJSON = json as WorkbookJSON;
  wb.meta = wb.meta || {} as any;
  wb.sheets = wb.sheets || [];
  for (const s of wb.sheets) {
    s.id = s.id || s.name || `sheet-${Math.random().toString(36).slice(2,8)}`;
    s.cells = s.cells || {};
    s.visible = s.visible !== undefined ? s.visible : true;
  }
  wb.namedRanges = wb.namedRanges || {};
  return wb;
}

// Detailed compare that returns diagnostics for failures. Checks is an array of
// { sheetId, addr } identifying cells to compare. Returns { passed, failures }.
export type CompareOptions = {
  compareFormula?: boolean;
  compareRaw?: boolean;
  compareMetadata?: string[]; // e.g., ['arrayRange', 'spilledFrom']
}

export function compareCellsDetailed(
  getCellA: (sheetId: string, addr: string) => any,
  getCellB: (sheetId: string, addr: string) => any,
  checks: Array<{sheetId:string, addr:string}>,
  options?: CompareOptions
) {
  const failures: Array<{ sheetId: string; addr: string; field: string; a: any; b: any}> = [];
  const opts = Object.assign({ compareFormula: false, compareRaw: false, compareMetadata: [] as string[] }, options || {});

  for (const c of checks) {
    const aCell = getCellA(c.sheetId, c.addr);
    const bCell = getCellB(c.sheetId, c.addr);

    // 1) Compare computed values (default)
    const aComputed = aCell?.computed?.v ?? aCell?.raw;
    const bComputed = bCell?.computed?.v ?? bCell?.raw;
    const computedEqual = (Array.isArray(aComputed) || Array.isArray(bComputed))
      ? JSON.stringify(aComputed) === JSON.stringify(bComputed)
      : Object.is(aComputed, bComputed);
    if (!computedEqual) failures.push({ sheetId: c.sheetId, addr: c.addr, field: 'computed', a: aComputed, b: bComputed });

    // 2) Optionally compare raw values
    if (opts.compareRaw) {
      const aRaw = aCell?.raw;
      const bRaw = bCell?.raw;
      const rawEqual = (Array.isArray(aRaw) || Array.isArray(bRaw)) ? JSON.stringify(aRaw) === JSON.stringify(bRaw) : Object.is(aRaw, bRaw);
      if (!rawEqual) failures.push({ sheetId: c.sheetId, addr: c.addr, field: 'raw', a: aRaw, b: bRaw });
    }

    // 3) Optionally compare formula strings
    if (opts.compareFormula) {
      const aF = aCell?.formula ?? aCell?.formulaString ?? aCell?.raw;
      const bF = bCell?.formula ?? bCell?.formulaString ?? bCell?.raw;
      const fEqual = Object.is(aF, bF);
      if (!fEqual) failures.push({ sheetId: c.sheetId, addr: c.addr, field: 'formula', a: aF, b: bF });
    }

    // 4) Optionally compare metadata fields like arrayRange, spilledFrom
    for (const metaField of opts.compareMetadata || []) {
      const aM = aCell?.[metaField];
      const bM = bCell?.[metaField];
      const mEqual = (Array.isArray(aM) || Array.isArray(bM)) ? JSON.stringify(aM) === JSON.stringify(bM) : Object.is(aM, bM);
      if (!mEqual) failures.push({ sheetId: c.sheetId, addr: c.addr, field: `meta:${metaField}`, a: aM, b: bM });
    }
  }

  return { passed: failures.length === 0, failures };
}

// Back-compat lightweight comparator used by older tests. Delegates to detailed
// comparator and returns boolean.
export function compareCells(getCellA: (sheetId: string, addr: string) => any, getCellB: (sheetId: string, addr: string) => any, checks: Array<{sheetId:string, addr:string}>) {
  return compareCellsDetailed(getCellA, getCellB, checks).passed;
}
