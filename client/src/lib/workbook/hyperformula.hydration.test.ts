/**
 * HyperFormula Hydration Tests
 * 
 * Tests for the hydrateHFFromWorkbook function to ensure proper
 * sheet creation, mapping, and error handling.
 */

import { describe, test, expect } from 'vitest';
import { createWorkbook, addSheet } from "./utils";
import { hydrateHFFromWorkbook, disposeHF } from "./hyperformula";
import type { WorkbookJSON } from "./types";

describe('HyperFormula Hydration', () => {
  test('Single Sheet Hydration', () => {
    const workbook = createWorkbook("Single Sheet Test");
    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);

    expect(hf).toBeTruthy();

    const sheetNames = hf.getSheetNames();
    expect(sheetNames.length).toBe(1);
    expect(sheetNames[0]).toBe(workbook.sheets[0].name);

    const hfSheetId = sheetMap.get(workbook.sheets[0].id);
    expect(hfSheetId).not.toBeUndefined();

    disposeHF(hf);
  });

/**
 * Test 2: Hydrate with multiple sheets
 */
  test('Multiple Sheet Hydration', () => {
    const workbook = createWorkbook("Multi Sheet Test");
    addSheet(workbook, "Second Sheet");
    addSheet(workbook, "Third Sheet");

    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);

    expect(hf).toBeTruthy();
    const sheetNames = hf.getSheetNames();
    expect(sheetNames.length).toBe(3);

    for (let i = 0; i < workbook.sheets.length; i++) {
      expect(sheetNames[i]).toBe(workbook.sheets[i].name);
      const hfSheetId = sheetMap.get(workbook.sheets[i].id);
      expect(hfSheetId).not.toBeUndefined();
    }

    disposeHF(hf);
  });

/**
 * Test 3: Hydrate with empty workbook (should throw)
 */
  test('Empty Workbook Hydration should throw', () => {
    const emptyWorkbook: WorkbookJSON = {
      version: "1.0.0",
      meta: {
        title: "Empty Workbook",
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        author: "Test",
      },
      sheets: [], // Empty sheets array
      namedRanges: {},
      globalSettings: {
        defaultRowHeight: 21,
        defaultColWidth: 100,
        firstSheet: 0,
        activeTab: 0,
      },
    };

    expect(() => hydrateHFFromWorkbook(emptyWorkbook)).toThrow();
  });

/**
 * Test 4: Hydrate with cells and formulas
 */
  test('Hydration with Cells and Formulas', () => {
    const workbook = createWorkbook("Cells Test");
    const sheet = workbook.sheets[0];

    sheet.cells = {
      A1: { raw: 10 },
      A2: { raw: 20 },
      A3: { formula: "=A1+A2" },
      B1: { raw: "Hello" },
      B2: { raw: "World" },
      B3: { formula: '=CONCATENATE(B1," ",B2)' },
    };

    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);
    expect(hf).toBeTruthy();

    const hfSheetId = sheetMap.get(sheet.id);
    expect(hfSheetId).not.toBeUndefined();

    const a1Value = hf.getCellValue({ sheet: hfSheetId, row: 0, col: 0 });
    const a2Value = hf.getCellValue({ sheet: hfSheetId, row: 1, col: 0 });
    const a3Value = hf.getCellValue({ sheet: hfSheetId, row: 2, col: 0 });

    expect(a1Value).toBe(10);
    expect(a2Value).toBe(20);
    expect(a3Value).toBe(30);

    disposeHF(hf);
  });

/**
 * Test 5: Hydrate with special characters in sheet names
 */
  test('Special Characters in Sheet Names', () => {
    const workbook = createWorkbook("Test");
    workbook.sheets[0].name = "Sheet-1";
    addSheet(workbook, "Sheet_2");
    addSheet(workbook, "Sheet 3");
    addSheet(workbook, "Sheet's Data");

    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);
    expect(hf).toBeTruthy();

    const sheetNames = hf.getSheetNames();
    expect(sheetNames.length).toBe(4);

    disposeHF(hf);
  });
});
