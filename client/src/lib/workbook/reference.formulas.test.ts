import { describe, test, expect, afterEach } from "vitest";
import {
  computeWorkbook,
  disposeHF,
  type HydrationResult,
  updateCellsAndRecompute,
  recomputeAndPatchCache,
} from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";

describe("Reference formulas", () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach((h) => disposeHF(h.hf));
    hydrations = [];
  });

  test("Single cell and range references", () => {
    const workbook = createWorkbook("Refs");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 30 });

    setCell(workbook, sheet.id, "B1", { formula: "=A1" });
    setCell(workbook, sheet.id, "B2", { formula: "=SUM(A1:A3)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(10);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(60);
  });

  test("Absolute, relative and mixed references behavior", () => {
    const workbook = createWorkbook("Ref Types");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 100 });
    setCell(workbook, sheet.id, "B1", { raw: 200 });

    setCell(workbook, sheet.id, "C1", { formula: "=A1" });
    setCell(workbook, sheet.id, "C2", { formula: "=$A$1" });
    setCell(workbook, sheet.id, "C3", { formula: "=A$1" });
    setCell(workbook, sheet.id, "C4", { formula: "=$A1" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    // initial values
    expect(getCell(workbook, sheet.id, "C1")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "C2")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "C3")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "C4")?.computed?.v).toBe(100);

    // change A1 and ensure propagation
    updateCellsAndRecompute(workbook, hydration, [
      { sheetId: sheet.id, address: "A1", value: 555 },
    ]);
    setCell(workbook, sheet.id, "A1", { raw: 555 });
    recomputeAndPatchCache(workbook, hydration);

    expect(getCell(workbook, sheet.id, "C1")?.computed?.v).toBe(555);
    expect(getCell(workbook, sheet.id, "C2")?.computed?.v).toBe(555);
    expect(getCell(workbook, sheet.id, "C3")?.computed?.v).toBe(555);
    expect(getCell(workbook, sheet.id, "C4")?.computed?.v).toBe(555);
  });

  test("Cross-sheet references and propagation", () => {
    const workbook = createWorkbook("Cross Sheet Ref");
    const sheet1 = workbook.sheets[0];
    const sheet2 = { id: "sheet2", name: "Sheet2", cells: {} };
    workbook.sheets.push(sheet2);

    setCell(workbook, sheet1.id, "A1", { raw: 123 });
    setCell(workbook, sheet2.id, "B1", { formula: `=${sheet1.name}!A1+10` });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet2.id, "B1")?.computed?.v).toBe(133);

    // change sheet1 A1 and verify propagation
    updateCellsAndRecompute(workbook, hydration, [
      { sheetId: sheet1.id, address: "A1", value: 200 },
    ]);
    setCell(workbook, sheet1.id, "A1", { raw: 200 });
    recomputeAndPatchCache(workbook, hydration);

    expect(getCell(workbook, sheet2.id, "B1")?.computed?.v).toBe(210);
  });
});
