import { describe, test, expect, afterEach } from "vitest";
import { computeWorkbook, disposeHF, type HydrationResult } from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";
import { freezeTime, restoreTime } from "./test-utils";

describe("Date/time formulas", () => {
  let hydrations: HydrationResult[] = [];

  afterEach(() => {
    hydrations.forEach((h) => disposeHF(h.hf));
    hydrations = [];
    restoreTime();
  });

  test("DATE, YEAR, MONTH, DAY", () => {
    const workbook = createWorkbook("Date Tests");
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

  test("NOW and TODAY deterministic with freezeTime", () => {
    // Freeze to a known epoch (2025-10-17T12:00:00Z)
    const fixed = Date.UTC(2025, 9, 17, 12, 0, 0); // month is 0-based
    freezeTime(fixed);

    const workbook = createWorkbook("NowToday");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { formula: "=NOW()" });
    setCell(workbook, sheet.id, "A2", { formula: "=TODAY()" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

  const nowValRaw = getCell(workbook, sheet.id, "A1")?.computed?.v;
  const todayValRaw = getCell(workbook, sheet.id, "A2")?.computed?.v;

  const nowNum = typeof nowValRaw === "number" ? nowValRaw : Number(nowValRaw);
  const todayNum = typeof todayValRaw === "number" ? todayValRaw : Number(todayValRaw);

  expect(typeof nowNum).toBe("number");
  expect(typeof todayNum).toBe("number");
  // TODAY should correspond to the date part of NOW (UTC-based here)
  const msPerDay = 24 * 60 * 60 * 1000;
  const truncatedNow = Math.floor(nowNum / msPerDay) * msPerDay;
  expect(Math.abs(truncatedNow - todayNum) < msPerDay).toBe(true);
  });

  test("Leap year handling (Feb 29)", () => {
    const workbook = createWorkbook("LeapYear");
    const sheet = workbook.sheets[0];

    setCell(workbook, sheet.id, "A1", { formula: "=DATE(2020,2,29)" });
    setCell(workbook, sheet.id, "A2", { formula: "=YEAR(A1)" });
    setCell(workbook, sheet.id, "A3", { formula: "=MONTH(A1)" });
    setCell(workbook, sheet.id, "A4", { formula: "=DAY(A1)" });

    const { hydration } = computeWorkbook(workbook);
    hydrations.push(hydration);

    expect(getCell(workbook, sheet.id, "A2")?.computed?.v).toBe(2020);
    expect(getCell(workbook, sheet.id, "A3")?.computed?.v).toBe(2);
    expect(getCell(workbook, sheet.id, "A4")?.computed?.v).toBe(29);
  });
});
