import { describe, test, expect, afterEach } from "vitest";
import { computeWorkbook, disposeHF, type HydrationResult } from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";
import { freezeTime, restoreTime } from "./test-utils";

describe("Text formulas", () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach((h) => disposeHF(h.hf));
    hydrations = [];
    restoreTime();
  });

  test("CONCATENATE and basic concatenation", () => {
    const workbook = createWorkbook("Concat Test");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: "Hello" });
    setCell(workbook, sheet.id, "A2", { raw: "World" });
    setCell(workbook, sheet.id, "A3", { raw: "!" });

    setCell(workbook, sheet.id, "B1", { formula: "=CONCATENATE(A1,\" \",A2)" });
    setCell(workbook, sheet.id, "B2", { formula: "=CONCATENATE(A1,\" \",A2,A3)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "B1")?.computed?.v).toBe("Hello World");
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe("Hello World!");
  });

  test("LEN, TRIM, LEFT, RIGHT, MID", () => {
    const workbook = createWorkbook("Text Ops");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: "  Hello World  " });
    setCell(workbook, sheet.id, "A2", { raw: "Excel" });

    setCell(workbook, sheet.id, "B1", { formula: "=LEN(A1)" });
    setCell(workbook, sheet.id, "B2", { formula: "=TRIM(A1)" });
    setCell(workbook, sheet.id, "B3", { formula: "=LEFT(A2,2)" });
    setCell(workbook, sheet.id, "B4", { formula: "=RIGHT(A2,3)" });
    setCell(workbook, sheet.id, "B5", { formula: "=MID(A2,2,3)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    const lenResult = getCell(workbook, sheet.id, "B1")?.computed?.v;
    expect(typeof lenResult === "number" && lenResult >= 11).toBe(true);
    expect(getCell(workbook, sheet.id, "B2")?.computed?.v).toBe("Hello World");
    expect(getCell(workbook, sheet.id, "B3")?.computed?.v).toBe("Ex");
    expect(getCell(workbook, sheet.id, "B4")?.computed?.v).toBe("cel");
    expect(getCell(workbook, sheet.id, "B5")?.computed?.v).toBe("xce");
  });

  test("UPPER/LOWER and unicode handling", () => {
    const workbook = createWorkbook("Case/Unicode");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { raw: "München" });
    setCell(workbook, sheet.id, "A2", { raw: "ß" });

    setCell(workbook, sheet.id, "B1", { formula: "=UPPER(A1)" });
    setCell(workbook, sheet.id, "B2", { formula: "=LOWER(A1)" });
    setCell(workbook, sheet.id, "B3", { formula: "=UPPER(A2)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(typeof getCell(workbook, sheet.id, "B1")?.computed?.v === "string").toBe(true);
    expect(typeof getCell(workbook, sheet.id, "B2")?.computed?.v === "string").toBe(true);
    expect(typeof getCell(workbook, sheet.id, "B3")?.computed?.v === "string").toBe(true);
  });
});
