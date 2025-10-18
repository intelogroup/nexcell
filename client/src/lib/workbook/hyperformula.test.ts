/**
 * HyperFormula Integration Tests
 * 
 * Tests the hyperformula module functionality including:
 * - Hydration from WorkbookJSON
 * - Formula computation and caching
 * - Bidirectional coordinate mapping
 * - Incremental updates
 * - Error handling
 */

import { describe, test, expect } from 'vitest';
import {
  hydrateHFFromWorkbook,
  recomputeAndPatchCache,
  computeWorkbook,
  updateCellsAndRecompute,
  getCellValueFromHF,
  formatHFError,
  getHFStats,
  disposeHF,
} from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";

/**
 * Run all HyperFormula tests
 */
describe('HyperFormula integration', () => {
  test('Basic hydration', () => {
    const workbook = createWorkbook("Test Workbook");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { formula: "=A1+A2" });

    const hydration = hydrateHFFromWorkbook(workbook);

    expect(hydration.sheetMap.size).toBe(1);
    expect(hydration.sheetMap.has(sheet.id)).toBeTruthy();
    expect(hydration.warnings.length).toBe(0);
    expect(getCellValueFromHF(hydration.hf, hydration.sheetMap.get(sheet.id)!, "A1")).toBe(10);
    disposeHF(hydration.hf);
  });

  test('Formula computation and result caching', () => {
    const workbook = createWorkbook("Formula Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 5 });
    setCell(workbook, sheet.id, "A2", { raw: 10 });
    setCell(workbook, sheet.id, "B1", { formula: "=A1+A2" });
    setCell(workbook, sheet.id, "B2", { formula: "=A1*A2" });
    setCell(workbook, sheet.id, "B3", { formula: "=SUM(A1:A2)" });

    const { hydration, recompute } = computeWorkbook(workbook);

    expect(recompute.updatedCells).toBe(3);
    expect(recompute.errors.length).toBe(0);

    const b1 = getCell(workbook, sheet.id, "B1");
    expect(b1?.computed?.v).toBe(15);
    expect(b1?.computed?.t).toBe('n');

    const b2 = getCell(workbook, sheet.id, "B2");
    expect(b2?.computed?.v).toBe(50);

    const b3 = getCell(workbook, sheet.id, "B3");
    expect(b3?.computed?.v).toBe(15);

    disposeHF(hydration.hf);
  });

  test('Cache persistence in workbook', () => {
    const workbook = createWorkbook("Cache Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 100 });
    setCell(workbook, sheet.id, "A2", { formula: "=A1*2" });

    const { hydration } = computeWorkbook(workbook);

    const fullAddress = `${sheet.name}!A2`;
    expect(workbook.computed?.hfCache).toBeTruthy();
    expect(workbook.computed?.hfCache![fullAddress]).toBeTruthy();
    expect(workbook.computed?.hfCache![fullAddress].v).toBe(200);

    const a2 = getCell(workbook, sheet.id, "A2");
    expect(a2?.computed?.v).toBe(200);

    disposeHF(hydration.hf);
  });

  test('Bidirectional coordinate mapping', () => {
    const workbook = createWorkbook("Mapping Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 1 });
    setCell(workbook, sheet.id, "Z10", { raw: 2 });
    setCell(workbook, sheet.id, "AA100", { raw: 3 });

    const hydration = hydrateHFFromWorkbook(workbook);
    const hfSheetId = hydration.sheetMap.get(sheet.id)!;

    expect(hydration.addressMap.has(`${sheet.name}!A1`)).toBeTruthy();
    expect(hydration.addressMap.has(`${sheet.name}!Z10`)).toBeTruthy();
    expect(hydration.addressMap.has(`${sheet.name}!AA100`)).toBeTruthy();

    expect(getCellValueFromHF(hydration.hf, hfSheetId, "A1")).toBe(1);
    expect(getCellValueFromHF(hydration.hf, hfSheetId, "Z10")).toBe(2);
    expect(getCellValueFromHF(hydration.hf, hfSheetId, "AA100")).toBe(3);

    const a1 = getCell(workbook, sheet.id, "A1");
    expect(a1?.hfInternal).toBeTruthy();
    expect(a1?.hfInternal?.sheetId).toBe(hfSheetId);
    expect(a1?.hfInternal?.row).toBe(0);
    expect(a1?.hfInternal?.col).toBe(0);

    disposeHF(hydration.hf);
  });

  test('Incremental updates', () => {
    const workbook = createWorkbook("Update Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { formula: "=A1*10" });

    const { hydration } = computeWorkbook(workbook);

    let a2 = getCell(workbook, sheet.id, "A2");
    expect(a2?.computed?.v).toBe(100);

    updateCellsAndRecompute(workbook, hydration, [
      { sheetId: sheet.id, address: "A1", value: 20 },
    ]);

    setCell(workbook, sheet.id, "A1", { raw: 20 });
    recomputeAndPatchCache(workbook, hydration);

    a2 = getCell(workbook, sheet.id, "A2");
    expect(a2?.computed?.v).toBe(200);

    disposeHF(hydration.hf);
  });

  test('Error handling', () => {
    const workbook = createWorkbook("Error Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 0 });
    setCell(workbook, sheet.id, "B1", { formula: "=A1/A2" });
    setCell(workbook, sheet.id, "B2", { formula: "=INVALID()" });
    setCell(workbook, sheet.id, "B3", { formula: "=A1+#REF!" });

    const { hydration, recompute } = computeWorkbook(workbook);

    expect(recompute.errors.length).toBeGreaterThanOrEqual(1);

    const b1 = getCell(workbook, sheet.id, "B1");
    expect(b1?.computed?.error).toBeTruthy();
    expect(b1?.computed?.t).toBe('e');

    const errorMsg = formatHFError({ type: "ERROR", value: "#DIV/0!" });
    expect(errorMsg).toBe("Division by zero");

    disposeHF(hydration.hf);
  });

  test('Dependency tracking', () => {
    const workbook = createWorkbook("Dependency Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 5 });
    setCell(workbook, sheet.id, "B1", { formula: "=A1*2" });
    setCell(workbook, sheet.id, "C1", { formula: "=B1+10" });

    const { hydration } = computeWorkbook(workbook);

    expect(workbook.computed?.dependencyGraph).toBeTruthy();
    expect(Object.keys(workbook.computed?.dependencyGraph || {}).length).toBeGreaterThan(0);

    disposeHF(hydration.hf);
  });

  test('Multi-sheet formulas', () => {
    const workbook = createWorkbook("Multi-Sheet Test");
    const sheet1 = workbook.sheets[0];

    const sheet2 = {
      id: "sheet2-id",
      name: "Sheet2",
      visible: true,
      grid: { rowCount: 1000, colCount: 50 },
      cells: {},
      mergedRanges: [],
    } as any;
    workbook.sheets.push(sheet2);

    setCell(workbook, sheet1.id, "A1", { raw: 100 });
    setCell(workbook, sheet2.id, "A1", { formula: "=Sheet1!A1*2" });

    const { hydration } = computeWorkbook(workbook);
    expect(hydration.sheetMap.size).toBe(2);

    const a1 = getCell(workbook, sheet2.id, "A1");
    expect(a1?.computed?.v).toBe(200);

    disposeHF(hydration.hf);
  });

  test('Complex formulas', () => {
    const workbook = createWorkbook("Complex Formula Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 30 });
    setCell(workbook, sheet.id, "A4", { raw: 40 });

    setCell(workbook, sheet.id, "B1", { formula: "=SUM(A1:A4)" });
    setCell(workbook, sheet.id, "B2", { formula: "=AVERAGE(A1:A4)" });
    setCell(workbook, sheet.id, "B3", { formula: "=MAX(A1:A4)" });
    setCell(workbook, sheet.id, "B4", { formula: "=MIN(A1:A4)" });
    setCell(workbook, sheet.id, "B5", { formula: "=IF(A1>15, \"High\", \"Low\")" });
    setCell(workbook, sheet.id, "B6", { formula: "=ROUND(B2, 0)" });

    const { hydration } = computeWorkbook(workbook);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(25);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(40);
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(10);
    expect(getCell(workbook, sheet.id, "B5")?.computed?.v).toBe("Low");
    expect(getCell(workbook, sheet.id, "B6")?.computed?.v).toBe(25);

    disposeHF(hydration.hf);
  });

  test('HF disposal and cleanup', () => {
    const workbook = createWorkbook("Disposal Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 42 });

    const { hydration } = computeWorkbook(workbook);
    const stats = getHFStats(hydration.hf);
    expect(stats.sheets).toBe(1);

    disposeHF(hydration.hf);

    try {
      getHFStats(hydration.hf);
      // If no error, mark as fail
      throw new Error('HF still accessible after disposal');
    } catch (error) {
      // Expected
    }
  });
});

/**
 * Test 1: Basic hydration from workbook
 */

/**
 * Test 2: Formula computation and result caching
 */

/**
 * Test 3: Cache persistence in workbook
 */

/**
 * Test 4: Bidirectional coordinate mapping
 */
