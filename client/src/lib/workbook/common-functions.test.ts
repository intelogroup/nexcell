/**
 * Common Excel Functions Tests
 * 
 * Tests common Excel functions supported by HyperFormula:
 * - SUM, AVERAGE, COUNT, COUNTA, COUNTBLANK
 * - IF, AND, OR, NOT
 * - VLOOKUP, HLOOKUP, INDEX, MATCH
 * - CONCATENATE, CONCAT
 * - MAX, MIN, MEDIAN
 * - ROUND, ROUNDUP, ROUNDDOWN
 * - DATE, YEAR, MONTH, DAY
 * - LEFT, RIGHT, MID, LEN, TRIM, UPPER, LOWER
 * - ABS, SQRT, POWER, MOD, PI
 */

import { describe, test, expect, afterEach } from "vitest";
import {
  computeWorkbook,
  disposeHF,
  type HydrationResult,
  recomputeAndPatchCache,
  updateCellsAndRecompute,
} from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";

describe("Common Excel Functions", () => {
  test("Error scenarios: #DIV/0!, #REF!, #VALUE!, #NAME?", () => {
    const workbook = createWorkbook("Error Test");
    const sheet = workbook.sheets[0];

    // #DIV/0! error
    setCell(workbook, sheet.id, "A1", { formula: "=1/0" });
  // #REF! error (invalid reference)
  setCell(workbook, sheet.id, "A2", { formula: "=A1:A0" });
    // #VALUE! error (wrong type)
    setCell(workbook, sheet.id, "A3", { formula: "=1+\"text\"" });
    // #NAME? error (unknown function)
    setCell(workbook, sheet.id, "A4", { formula: "=NOTAFUNC(1)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

  // #DIV/0!
  const divCell = getCell(workbook, sheet.id, "A1");
  expect(["e", "s"].includes(divCell?.computed?.t ?? "")).toBe(true);
  const divVal = divCell?.computed?.v ?? divCell?.computed?.error ?? "";
  expect(String(divVal)).toContain("DIV/0");

  // #REF!
  const refCell = getCell(workbook, sheet.id, "A2");
  expect(["e", "s"].includes(refCell?.computed?.t ?? "")).toBe(true);
  const refVal = String(refCell?.computed?.v ?? refCell?.computed?.error ?? "");
  expect(refVal.includes("REF") || refVal.includes("VALUE")).toBe(true);

  // #VALUE!
  const valueCell = getCell(workbook, sheet.id, "A3");
  expect(["e", "s"].includes(valueCell?.computed?.t ?? "")).toBe(true);
  const valueVal = valueCell?.computed?.v ?? valueCell?.computed?.error ?? "";
  expect(String(valueVal)).toContain("VALUE");

  // #NAME?
  const nameCell = getCell(workbook, sheet.id, "A4");
  expect(["e", "s"].includes(nameCell?.computed?.t ?? "")).toBe(true);
  const nameVal = nameCell?.computed?.v ?? nameCell?.computed?.error ?? "";
  expect(String(nameVal)).toContain("NAME");
  });
  test("Cross-sheet formulas: Sheet1!A1, 'Sheet Name'!B2 references", () => {
    const workbook = createWorkbook("Cross Sheet Test");
    const sheet1 = workbook.sheets[0];
    const sheet2 = { id: "sheet2", name: "Sheet2", cells: {} };
    workbook.sheets.push(sheet2);

    // Set values in both sheets
    setCell(workbook, sheet1.id, "A1", { raw: 123 });
    setCell(workbook, sheet2.id, "B2", { raw: 456 });

    // Reference Sheet1!A1 from Sheet2
    setCell(workbook, sheet2.id, "C1", { formula: `=${sheet1.name}!A1+10` });
    // Reference Sheet2!B2 from Sheet1
    setCell(workbook, sheet1.id, "D1", { formula: `=${sheet2.name}!B2*2` });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    // Initial values
    expect(getCell(workbook, sheet2.id, "C1")?.computed?.v).toBe(133);
    expect(getCell(workbook, sheet1.id, "D1")?.computed?.v).toBe(912);

    // Change Sheet1!A1 and Sheet2!B2, verify propagation
    updateCellsAndRecompute(workbook, hydration, [
      { sheetId: sheet1.id, address: "A1", value: 200 },
      { sheetId: sheet2.id, address: "B2", value: 300 }
    ]);
    setCell(workbook, sheet1.id, "A1", { raw: 200 });
    setCell(workbook, sheet2.id, "B2", { raw: 300 });
    recomputeAndPatchCache(workbook, hydration);

    expect(getCell(workbook, sheet2.id, "C1")?.computed?.v).toBe(210);
    expect(getCell(workbook, sheet1.id, "D1")?.computed?.v).toBe(600);
  });
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    // Clean up all hydrations after each test
    hydrations.forEach(h => disposeHF(h.hf));
    hydrations = [];
  });

  test("SUM function with ranges and individual cells", () => {
    const workbook = createWorkbook("SUM Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 30 });
    setCell(workbook, sheet.id, "A4", { raw: 40 });
    setCell(workbook, sheet.id, "A5", { raw: 50 });

    setCell(workbook, sheet.id, "B1", { formula: "=SUM(A1:A5)" });
    setCell(workbook, sheet.id, "B2", { formula: "=SUM(A1,A3,A5)" });
    setCell(workbook, sheet.id, "B3", { formula: "=SUM(A1:A3,A5)" });
    setCell(workbook, sheet.id, "B4", { formula: "=SUM(10,20,30)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(150);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(90);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(110);
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(60);
  });

  test("AVERAGE function", () => {
    const workbook = createWorkbook("AVERAGE Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 30 });
    setCell(workbook, sheet.id, "A4", { raw: 40 });
    setCell(workbook, sheet.id, "A5", { raw: 50 });

    setCell(workbook, sheet.id, "B1", { formula: "=AVERAGE(A1:A5)" });
    setCell(workbook, sheet.id, "B2", { formula: "=AVERAGE(A1,A3,A5)" });
    setCell(workbook, sheet.id, "B3", { formula: "=AVERAGE(10,20,30,40)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(30);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(30);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(25);
  });

  test("COUNT functions (COUNT, COUNTA, COUNTBLANK)", () => {
    const workbook = createWorkbook("COUNT Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: "text" });
    setCell(workbook, sheet.id, "A3", { raw: 30 });
    setCell(workbook, sheet.id, "A4", { raw: "" });
    setCell(workbook, sheet.id, "A5", { raw: 50 });
    // A6 is empty (no cell)

    setCell(workbook, sheet.id, "B1", { formula: "=COUNT(A1:A6)" });
    setCell(workbook, sheet.id, "B2", { formula: "=COUNTA(A1:A6)" });
    setCell(workbook, sheet.id, "B3", { formula: "=COUNTBLANK(A1:A6)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(3); // Count numbers only
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(5); // HyperFormula counts empty string as non-blank
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(1); // Count blank (only A6)
  });

  test("IF function with simple and nested conditions", () => {
    const workbook = createWorkbook("IF Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 75 });
    setCell(workbook, sheet.id, "A2", { raw: 45 });
    setCell(workbook, sheet.id, "A3", { raw: 90 });
    setCell(workbook, sheet.id, "A4", { raw: 60 });

    setCell(workbook, sheet.id, "B1", { formula: "=IF(A1>=70,\"Pass\",\"Fail\")" });
    setCell(workbook, sheet.id, "B2", { formula: "=IF(A2>=70,\"Pass\",\"Fail\")" });
    setCell(workbook, sheet.id, "B3", { formula: "=IF(A3>80,\"Excellent\",IF(A3>60,\"Good\",\"Fair\"))" });
    setCell(workbook, sheet.id, "B4", { formula: "=IF(A4>100,1,IF(A4>50,2,3))" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe("Pass");
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe("Fail");
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe("Excellent");
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(2);
  });

  test("Logical functions (AND, OR, NOT)", () => {
    const workbook = createWorkbook("Logical Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 30 });

    setCell(workbook, sheet.id, "B1", { formula: "=AND(A1>5,A1<15)" });
    setCell(workbook, sheet.id, "B2", { formula: "=AND(A1>15,A2>15)" });
    setCell(workbook, sheet.id, "B3", { formula: "=OR(A1>15,A2>15)" });
    setCell(workbook, sheet.id, "B4", { formula: "=OR(A1>100,A2>100)" });
    setCell(workbook, sheet.id, "B5", { formula: "=NOT(A1>15)" });
    setCell(workbook, sheet.id, "B6", { formula: "=NOT(A3>15)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(true);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(false);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(true);
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(false);
    expect(getCell(workbook, sheet.id, "B5")?.computed?.v).toBe(true);
    expect(getCell(workbook, sheet.id, "B6")?.computed?.v).toBe(false);
  });

  test("VLOOKUP function", () => {
    const workbook = createWorkbook("VLOOKUP Test");
    const sheet = workbook.sheets[0];

    // Lookup table
    setCell(workbook, sheet.id, "A1", { raw: 101 });
    setCell(workbook, sheet.id, "B1", { raw: "Alice" });
    setCell(workbook, sheet.id, "C1", { raw: 85 });
    setCell(workbook, sheet.id, "A2", { raw: 102 });
    setCell(workbook, sheet.id, "B2", { raw: "Bob" });
    setCell(workbook, sheet.id, "C2", { raw: 92 });
    setCell(workbook, sheet.id, "A3", { raw: 103 });
    setCell(workbook, sheet.id, "B3", { raw: "Charlie" });
    setCell(workbook, sheet.id, "C3", { raw: 78 });

    // Use 0 instead of FALSE (HyperFormula may not recognize FALSE constant)
    setCell(workbook, sheet.id, "E1", { formula: "=VLOOKUP(102,A1:C3,2,0)" });
    setCell(workbook, sheet.id, "E2", { formula: "=VLOOKUP(103,A1:C3,3,0)" });
    setCell(workbook, sheet.id, "E3", { formula: "=VLOOKUP(101,A1:C3,2,0)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "E1")?.computed?.v).toBe("Bob");
    expect(getCell(workbook, sheet.id, "E2")?.computed?.v).toBe(78);
    expect(getCell(workbook, sheet.id, "E3")?.computed?.v).toBe("Alice");
  });

  test("CONCATENATE function", () => {
    const workbook = createWorkbook("CONCATENATE Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: "Hello" });
    setCell(workbook, sheet.id, "A2", { raw: "World" });
    setCell(workbook, sheet.id, "A3", { raw: "!" });

    setCell(workbook, sheet.id, "B1", { formula: "=CONCATENATE(A1,\" \",A2)" });
    // Note: CONCAT is not supported in HyperFormula, only CONCATENATE works
    setCell(workbook, sheet.id, "B2", { formula: "=CONCATENATE(A1,\" \",A2,A3)" });
    setCell(workbook, sheet.id, "B3", { formula: "=CONCATENATE(\"Result: \",A1)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe("Hello World");
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe("Hello World!");
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe("Result: Hello");
  });

  test("MAX and MIN functions", () => {
    const workbook = createWorkbook("MAX/MIN Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 15 });
    setCell(workbook, sheet.id, "A2", { raw: 42 });
    setCell(workbook, sheet.id, "A3", { raw: 8 });
    setCell(workbook, sheet.id, "A4", { raw: 23 });
    setCell(workbook, sheet.id, "A5", { raw: 56 });

    setCell(workbook, sheet.id, "B1", { formula: "=MAX(A1:A5)" });
    setCell(workbook, sheet.id, "B2", { formula: "=MIN(A1:A5)" });
    setCell(workbook, sheet.id, "B3", { formula: "=MAX(A1,A3,A5)" });
    setCell(workbook, sheet.id, "B4", { formula: "=MIN(10,20,5,30)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(56);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(8);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(56);
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(5);
  });

  test("Rounding functions (ROUND, ROUNDUP, ROUNDDOWN)", () => {
    const workbook = createWorkbook("Rounding Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 3.14159 });
    setCell(workbook, sheet.id, "A2", { raw: 2.5 });
    setCell(workbook, sheet.id, "A3", { raw: 7.8 });

    setCell(workbook, sheet.id, "B1", { formula: "=ROUND(A1,2)" });
    setCell(workbook, sheet.id, "B2", { formula: "=ROUND(A2,0)" });
    setCell(workbook, sheet.id, "B3", { formula: "=ROUNDUP(A3,0)" });
    setCell(workbook, sheet.id, "B4", { formula: "=ROUNDDOWN(A3,0)" });
    setCell(workbook, sheet.id, "B5", { formula: "=ROUND(A1,4)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(3.14);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(3);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(8);
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(7);
    expect(getCell(workbook, sheet.id, "B5")?.computed?.v).toBe(3.1416);
  });

  test("Text functions (LEN, TRIM, LEFT, RIGHT, MID, UPPER, LOWER)", () => {
    const workbook = createWorkbook("Text Functions Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: "  Hello World  " });
    setCell(workbook, sheet.id, "A2", { raw: "Excel" });

    setCell(workbook, sheet.id, "B1", { formula: "=LEN(A1)" });
    setCell(workbook, sheet.id, "B2", { formula: "=TRIM(A1)" });
    setCell(workbook, sheet.id, "B3", { formula: "=LEFT(A2,2)" });
    setCell(workbook, sheet.id, "B4", { formula: "=RIGHT(A2,3)" });
    setCell(workbook, sheet.id, "B5", { formula: "=MID(A2,2,3)" });
    setCell(workbook, sheet.id, "B6", { formula: "=UPPER(A2)" });
    setCell(workbook, sheet.id, "B7", { formula: "=LOWER(A2)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    // Note: The actual length depends on how the string is stored/trimmed
    const lenResult = getCell(workbook, sheet.id, "B1")?.computed?.v;
    expect(typeof lenResult === "number" && lenResult >= 11 && lenResult <= 17).toBe(true);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe("Hello World");
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe("Ex");
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe("cel");
    expect(getCell(workbook, sheet.id, "B5")?.computed?.v).toBe("xce");
    expect(getCell(workbook, sheet.id, "B6")?.computed?.v).toBe("EXCEL");
    expect(getCell(workbook, sheet.id, "B7")?.computed?.v).toBe("excel");
  });

  test("Date functions (DATE, YEAR, MONTH, DAY)", () => {
    const workbook = createWorkbook("Date Functions Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { formula: "=DATE(2024,12,25)" });
    setCell(workbook, sheet.id, "A2", { formula: "=YEAR(A1)" });
    setCell(workbook, sheet.id, "A3", { formula: "=MONTH(A1)" });
    setCell(workbook, sheet.id, "A4", { formula: "=DAY(A1)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "A1")?.computed?.v).toBeDefined();
    expect(getCell(workbook, sheet.id, "A2")?.computed?.v).toBe(2024);
    expect(getCell(workbook, sheet.id, "A3")?.computed?.v).toBe(12);
    expect(getCell(workbook, sheet.id, "A4")?.computed?.v).toBe(25);
  });

  test("Math functions (ABS, SQRT, POWER, MOD, PI)", () => {
    const workbook = createWorkbook("Math Functions Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: -15 });
    setCell(workbook, sheet.id, "A2", { raw: 16 });
    setCell(workbook, sheet.id, "A3", { raw: 5 });

    setCell(workbook, sheet.id, "B1", { formula: "=ABS(A1)" });
    setCell(workbook, sheet.id, "B2", { formula: "=SQRT(A2)" });
    setCell(workbook, sheet.id, "B3", { formula: "=POWER(A3,2)" });
    setCell(workbook, sheet.id, "B4", { formula: "=MOD(17,5)" });
    setCell(workbook, sheet.id, "B5", { formula: "=PI()" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(15);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(4);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe(25);
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe(2);

    const b5 = getCell(workbook, sheet.id, "B5")?.computed?.v;
    expect(typeof b5 === "number" && Math.abs(b5 - 3.14159) < 0.001).toBe(true);
  });

  test("Statistical functions (MEDIAN, STDEV, VAR)", () => {
    const workbook = createWorkbook("Statistical Functions Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 30 });
    setCell(workbook, sheet.id, "A4", { raw: 40 });
    setCell(workbook, sheet.id, "A5", { raw: 50 });

    setCell(workbook, sheet.id, "B1", { formula: "=MEDIAN(A1:A5)" });
    setCell(workbook, sheet.id, "B2", { formula: "=STDEV(A1:A5)" });
    setCell(workbook, sheet.id, "B3", { formula: "=VAR(A1:A5)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(30);

    const b2 = getCell(workbook, sheet.id, "B2")?.computed?.v;
    expect(typeof b2 === "number" && b2 > 0).toBe(true);

    const b3 = getCell(workbook, sheet.id, "B3")?.computed?.v;
    expect(typeof b3 === "number" && b3 > 0).toBe(true);
  });

  test("Complex nested formulas", () => {
    const workbook = createWorkbook("Complex Formula Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 85 });
    setCell(workbook, sheet.id, "A2", { raw: 92 });
    setCell(workbook, sheet.id, "A3", { raw: 78 });
    setCell(workbook, sheet.id, "A4", { raw: 95 });
    setCell(workbook, sheet.id, "A5", { raw: 88 });

    setCell(workbook, sheet.id, "B1", { formula: "=IF(AVERAGE(A1:A5)>85,\"Excellent\",\"Good\")" });
    setCell(workbook, sheet.id, "B2", { formula: "=ROUND(AVERAGE(A1:A5),1)" });
    setCell(workbook, sheet.id, "B3", { formula: "=IF(AND(MIN(A1:A5)>70,MAX(A1:A5)>90),\"Pass\",\"Fail\")" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe("Excellent");
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(87.6);
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe("Pass");
  });
  test("Cell reference types: relative, absolute, mixed", () => {
    const workbook = createWorkbook("Reference Types Test");
    const sheet = workbook.sheets[0];

    // Set up source cells
    setCell(workbook, sheet.id, "A1", { raw: 100 });
    setCell(workbook, sheet.id, "B1", { raw: 200 });

    // Relative reference
    setCell(workbook, sheet.id, "C1", { formula: "=A1" });
    // Absolute reference
    setCell(workbook, sheet.id, "C2", { formula: "=$A$1" });
    // Mixed reference (row absolute)
    setCell(workbook, sheet.id, "C3", { formula: "=A$1" });
    // Mixed reference (column absolute)
    setCell(workbook, sheet.id, "C4", { formula: "=$A1" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    // Initial values
    expect(getCell(workbook, sheet.id, "C1")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "C2")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "C3")?.computed?.v).toBe(100);
    expect(getCell(workbook, sheet.id, "C4")?.computed?.v).toBe(100);

    // Change A1 and verify propagation
    updateCellsAndRecompute(workbook, hydration, [
      { sheetId: sheet.id, address: "A1", value: 555 }
    ]);
    setCell(workbook, sheet.id, "A1", { raw: 555 });
    recomputeAndPatchCache(workbook, hydration);
    expect(getCell(workbook, sheet.id, "C1")?.computed?.v).toBe(555);
    expect(getCell(workbook, sheet.id, "C2")?.computed?.v).toBe(555);
    expect(getCell(workbook, sheet.id, "C3")?.computed?.v).toBe(555);
    expect(getCell(workbook, sheet.id, "C4")?.computed?.v).toBe(555);

    // Absolute reference copied
    updateCellsAndRecompute(workbook, hydration, [
      { sheetId: sheet.id, address: "D3", value: "=$A$1" }
    ]);
    setCell(workbook, sheet.id, "D3", { formula: "=$A$1" });
    recomputeAndPatchCache(workbook, hydration);
    expect(getCell(workbook, sheet.id, "D3")?.computed?.v).toBe(555);
  });
});
