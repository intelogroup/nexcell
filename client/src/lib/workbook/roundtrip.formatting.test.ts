/**
 * Round-Trip Test: Number Format Preservation
 * 
 * Priority-1 Gate: Verifies that number formats (numFmt) survive export/import
 * without data loss. This is CRITICAL for production — losing numFmt turns
 * dates into serial numbers and percentages into decimals.
 * 
 * MUST PASS before enabling AI Plan→Act orchestration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createWorkbook,
  setCell,
  getCell,
  SheetJSAdapter,
  type WorkbookJSON,
} from "./index";

describe("Round-Trip: Number Format Preservation", () => {
  let workbook: WorkbookJSON;
  let sheetId: string;
  let adapter: SheetJSAdapter;

  beforeEach(() => {
    workbook = createWorkbook("Format Test");
    sheetId = workbook.sheets[0].id;
    adapter = new SheetJSAdapter();
  });

  it("should preserve date formats (mm/dd/yyyy)", async () => {
    // Excel stores dates as serial numbers (days since 1/1/1900)
    // 44927 = 2023-01-15
    setCell(workbook, sheetId, "A1", {
      raw: 44927,
      dataType: "number",
      numFmt: "mm/dd/yyyy",
    });

    // Export → Import
    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    // Verify
    const cell = getCell(imported, importedSheetId, "A1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(44927);
    expect(cell!.numFmt).toBe("mm/dd/yyyy");
  });

  it("should preserve date-time formats (mm/dd/yyyy hh:mm)", async () => {
    // 44927.5 = 2023-01-15 12:00 PM
    setCell(workbook, sheetId, "A2", {
      raw: 44927.5,
      dataType: "number",
      numFmt: "mm/dd/yyyy hh:mm",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "A2");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(44927.5);
    expect(cell!.numFmt).toBe("mm/dd/yyyy hh:mm");
  });

  it("should preserve percentage formats (0.00%)", async () => {
    // Excel stores 50% as 0.5
    setCell(workbook, sheetId, "B1", {
      raw: 0.5,
      dataType: "number",
      numFmt: "0.00%",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "B1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(0.5);
    expect(cell!.numFmt).toBe("0.00%");
  });

  it("should preserve percentage formats (0%)", async () => {
    setCell(workbook, sheetId, "B2", {
      raw: 0.15,
      dataType: "number",
      numFmt: "0%",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "B2");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(0.15);
    expect(cell!.numFmt).toBe("0%");
  });

  it("should preserve currency formats ($#,##0.00)", async () => {
    setCell(workbook, sheetId, "C1", {
      raw: 1234.56,
      dataType: "number",
      numFmt: '"$"#,##0.00',
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "C1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(1234.56);
    expect(cell!.numFmt).toBe('"$"#,##0.00');
  });

  it("should preserve accounting formats (_($* #,##0.00_))", async () => {
    setCell(workbook, sheetId, "C2", {
      raw: -5678.90,
      dataType: "number",
      numFmt: '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)',
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "C2");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(-5678.90);
    expect(cell!.numFmt).toBe('_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)');
  });

  it("should preserve custom number formats (#,##0.00)", async () => {
    setCell(workbook, sheetId, "D1", {
      raw: 9876.543,
      dataType: "number",
      numFmt: "#,##0.00",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "D1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(9876.543);
    expect(cell!.numFmt).toBe("#,##0.00");
  });

  it("should preserve scientific notation formats (0.00E+00)", async () => {
    setCell(workbook, sheetId, "D2", {
      raw: 1234567890,
      dataType: "number",
      numFmt: "0.00E+00",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "D2");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(1234567890);
    expect(cell!.numFmt).toBe("0.00E+00");
  });

  it("should preserve fraction formats (# ?/?)", async () => {
    setCell(workbook, sheetId, "E1", {
      raw: 0.75,
      dataType: "number",
      numFmt: "# ?/?",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "E1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(0.75);
    expect(cell!.numFmt).toBe("# ?/?");
  });

  it("should preserve text format (@)", async () => {
    // Text format forces Excel to treat numbers as text
    setCell(workbook, sheetId, "F1", {
      raw: "00123",
      dataType: "string",
      numFmt: "@",
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "F1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe("00123");
    expect(cell!.numFmt).toBe("@");
  });

  it("should preserve formats with computed values (formulas)", async () => {
    // Set up formula with numFmt
    setCell(workbook, sheetId, "G1", {
      raw: 0.5,
      dataType: "number",
    });

    setCell(workbook, sheetId, "G2", {
      formula: "=G1*2",
      dataType: "formula",
      numFmt: "0.00%",
      computed: {
        v: 1.0, // 100%
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "G2");
    expect(cell).toBeDefined();
    expect(cell!.formula).toBe("=G1*2");
    expect(cell!.computed?.v).toBe(1.0);
    expect(cell!.numFmt).toBe("0.00%");
  });

  it("should handle cells without numFmt (default general format)", async () => {
    setCell(workbook, sheetId, "H1", {
      raw: 12345.67,
      dataType: "number",
      // No numFmt specified
    });

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const cell = getCell(imported, importedSheetId, "H1");
    expect(cell).toBeDefined();
    expect(cell!.raw).toBe(12345.67);
    // numFmt should be undefined or "General"
    expect(cell!.numFmt === undefined || cell!.numFmt === "General").toBe(true);
  });

  it("should preserve multiple formats in same sheet", async () => {
    // Mix of formats in one sheet
    const testCases = [
      { addr: "I1", raw: 44927, numFmt: "mm/dd/yyyy" },
      { addr: "I2", raw: 0.25, numFmt: "0.00%" },
      { addr: "I3", raw: 999.99, numFmt: '"$"#,##0.00' },
      { addr: "I4", raw: 1234.5678, numFmt: "#,##0.00" },
    ];

    for (const tc of testCases) {
      setCell(workbook, sheetId, tc.addr, {
        raw: tc.raw,
        dataType: "number",
        numFmt: tc.numFmt,
      });
    }

    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    for (const tc of testCases) {
      const cell = getCell(imported, importedSheetId, tc.addr);
      expect(cell, `Cell ${tc.addr} should exist`).toBeDefined();
      expect(cell!.raw, `Cell ${tc.addr} raw value`).toBe(tc.raw);
      expect(cell!.numFmt, `Cell ${tc.addr} numFmt`).toBe(tc.numFmt);
    }
  });
});
