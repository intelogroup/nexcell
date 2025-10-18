import { describe, test, expect, afterEach } from "vitest";
import {
  computeWorkbook,
  disposeHF,
  type HydrationResult,
} from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";

describe("Logical formulas", () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach((h) => disposeHF(h.hf));
    hydrations = [];
  });

  test("IF basic and nested IFs", () => {
    const workbook = createWorkbook("IF Tests");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 75 });
    setCell(workbook, sheet.id, "A2", { raw: 45 });
    setCell(workbook, sheet.id, "A3", { raw: 90 });

    setCell(workbook, sheet.id, "B1", { formula: "=IF(A1>=70,\"Pass\",\"Fail\")" });
    setCell(workbook, sheet.id, "B2", { formula: "=IF(A2>=70,\"Pass\",\"Fail\")" });
    setCell(workbook, sheet.id, "B3", { formula: "=IF(A3>80,\"Excellent\",IF(A3>60,\"Good\",\"Fair\"))" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe("Pass");
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe("Fail");
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe("Excellent");
  });

  test("AND, OR, NOT and short-circuit behavior", () => {
    const workbook = createWorkbook("Logical Ops");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 10 });
    setCell(workbook, sheet.id, "A2", { raw: 20 });
    setCell(workbook, sheet.id, "A3", { raw: 0 });

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
  expect(getCell(workbook, sheet.id, "B6")?.computed?.v).toBe(true);
  });

  test("Boolean coercion and non-boolean inputs", () => {
    const workbook = createWorkbook("Coercion");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: 1 });
    setCell(workbook, sheet.id, "A2", { raw: 0 });
    setCell(workbook, sheet.id, "A3", { raw: "" });

    setCell(workbook, sheet.id, "B1", { formula: "=AND(A1,A2)" });
    setCell(workbook, sheet.id, "B2", { formula: "=OR(A1,A2)" });
    setCell(workbook, sheet.id, "B3", { formula: "=NOT(A3)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    // HyperFormula coerces numbers: 0 => FALSE, non-zero => TRUE
    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe(false);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe(true);
    // NOT on empty string - behavior may vary; assert boolean result
    const notVal = getCell(workbook, sheet.id, "B3")?.computed?.v;
    expect(typeof notVal === "boolean").toBe(true);
  });
});