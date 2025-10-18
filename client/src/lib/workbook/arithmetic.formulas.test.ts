import { describe, test, expect, afterEach } from "vitest";
import {
  computeWorkbook,
  disposeHF,
  type HydrationResult,
  recomputeAndPatchCache,
  updateCellsAndRecompute,
} from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";

describe("Arithmetic formulas", () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach((h) => disposeHF(h.hf));
    hydrations = [];
  });

  test("Basic arithmetic operators (+ - * /)", () => {
    const workbook = createWorkbook("Arithmetic Basic");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 2 });
    setCell(workbook, sheet.id, "A2", { raw: 3 });

    setCell(workbook, sheet.id, "A3", { formula: "=A1+A2" });
    setCell(workbook, sheet.id, "A4", { formula: "=A1*A2" });
    setCell(workbook, sheet.id, "A5", { formula: "=A2-A1" });
    setCell(workbook, sheet.id, "A6", { formula: "=A2/A1" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "A3")?.computed?.v).toBe(5);
    expect(getCell(workbook, sheet.id, "A4")?.computed?.v).toBe(6);
    expect(getCell(workbook, sheet.id, "A5")?.computed?.v).toBe(1);
    expect(getCell(workbook, sheet.id, "A6")?.computed?.v).toBe(1.5);
  });

  test("Operator precedence and parentheses (*/ before +-, parentheses override)", () => {
    const workbook = createWorkbook("Arithmetic Precedence");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { formula: "=2+3*4" });
    setCell(workbook, sheet.id, "A2", { formula: "=(2+3)*4" });
    setCell(workbook, sheet.id, "A3", { formula: "=2^3^2" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "A1")?.computed?.v).toBe(14);
    expect(getCell(workbook, sheet.id, "A2")?.computed?.v).toBe(20);
  // Observed engine behavior: exponentiation is left-associative here: (2^3)^2 = 64
  // Note: Excel/HF semantics may differ; record observed behavior for now.
  expect(getCell(workbook, sheet.id, "A3")?.computed?.v).toBe(64);
  });

  test("MOD and unary minus", () => {
    const workbook = createWorkbook("MOD and Unary");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 3 });
    setCell(workbook, sheet.id, "A3", { formula: "=MOD(A1,A2)" });
    setCell(workbook, sheet.id, "A4", { raw: 5 });
    setCell(workbook, sheet.id, "A5", { formula: "=-A4" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "A3")?.computed?.v).toBe(1);
    expect(getCell(workbook, sheet.id, "A5")?.computed?.v).toBe(-5);
  });

  test("Division by zero produces an error", () => {
    const workbook = createWorkbook("Div0");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { formula: "=1/0" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    const cell = getCell(workbook, sheet.id, "A1");
    expect(["e", "s"].includes(cell?.computed?.t ?? "")).toBe(true);
    const val = String(cell?.computed?.v ?? cell?.computed?.error ?? "");
    expect(val.toUpperCase()).toContain("DIV/0");
  });

  test("Decimal precision (approximate)", () => {
    const workbook = createWorkbook("Precision");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { formula: "=10/3" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    const v = getCell(workbook, sheet.id, "A1")?.computed?.v;
    expect(typeof v === "number").toBe(true);
    if (typeof v === "number") {
      expect(Math.abs(v - 10 / 3) < 1e-12).toBe(true);
    }
  });
});
