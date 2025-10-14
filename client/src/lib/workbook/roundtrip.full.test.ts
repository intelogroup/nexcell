/**
 * Round-Trip Test: Full Integration (Formats + Formulas + Layout + HF Recompute)
 * 
 * Priority-1 Gate: The ULTIMATE test — combines formats, formulas, layout,
 * and HyperFormula recomputation to ensure the entire pipeline is stable.
 * 
 * This test MUST PASS before enabling AI Plan→Act orchestration in production.
 * If this passes, the system is ready for users to make changes that will
 * export correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createWorkbook,
  setCell,
  getCell,
  SheetJSAdapter,
  hydrateHFFromWorkbook,
  recomputeAndPatchCache,
  updateCellsAndRecompute,
  type WorkbookJSON,
} from "./index";

describe("Round-Trip: Full Integration (Formats + Formulas + Layout + HF)", () => {
  let workbook: WorkbookJSON;
  let sheetId: string;
  let adapter: SheetJSAdapter;

  beforeEach(() => {
    workbook = createWorkbook("Full Integration Test");
    sheetId = workbook.sheets[0].id;
    adapter = new SheetJSAdapter();
  });

  it("should preserve formats + formulas + layout after export/import/recompute", async () => {
    const sheet = workbook.sheets[0];

    // === Setup: Layout ===
    sheet.cols = {
      1: { width: 100 }, // Column A
      2: { width: 120 }, // Column B
      3: { width: 150 }, // Column C
    };

    sheet.rows = {
      1: { height: 30 }, // Header row
      2: { height: 21 },
      3: { height: 21 },
      4: { height: 25 }, // Total row
    };

    // === Setup: Headers (with formats) ===
    setCell(workbook, sheetId, "A1", {
      raw: "Quantity",
      dataType: "string",
    });

    setCell(workbook, sheetId, "B1", {
      raw: "Price",
      dataType: "string",
    });

    setCell(workbook, sheetId, "C1", {
      raw: "Total",
      dataType: "string",
    });

    // === Setup: Data with formats ===
    setCell(workbook, sheetId, "A2", {
      raw: 10,
      dataType: "number",
      numFmt: "#,##0",
    });

    setCell(workbook, sheetId, "B2", {
      raw: 25.50,
      dataType: "number",
      numFmt: '"$"#,##0.00',
    });

    setCell(workbook, sheetId, "A3", {
      raw: 5,
      dataType: "number",
      numFmt: "#,##0",
    });

    setCell(workbook, sheetId, "B3", {
      raw: 100.00,
      dataType: "number",
      numFmt: '"$"#,##0.00',
    });

    // === Setup: Formulas with formats ===
    setCell(workbook, sheetId, "C2", {
      formula: "=A2*B2",
      dataType: "formula",
      numFmt: '"$"#,##0.00',
      computed: {
        v: 255.00,
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    setCell(workbook, sheetId, "C3", {
      formula: "=A3*B3",
      dataType: "formula",
      numFmt: '"$"#,##0.00',
      computed: {
        v: 500.00,
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    // === Setup: Summary formulas ===
    setCell(workbook, sheetId, "A4", {
      raw: "Total:",
      dataType: "string",
    });

    setCell(workbook, sheetId, "C4", {
      formula: "=SUM(C2:C3)",
      dataType: "formula",
      numFmt: '"$"#,##0.00',
      computed: {
        v: 755.00,
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    // === Setup: Merged range ===
    sheet.mergedRanges = ["A1:A1"]; // Not really merged, but test the mechanism

    // === Step 1: Export to XLSX ===
    const buffer1 = await adapter.export(workbook);
    expect(buffer1.byteLength).toBeGreaterThan(0);

    // === Step 2: Import from XLSX ===
    const imported = await adapter.import(buffer1);
    const importedSheetId = imported.sheets[0].id;
    const importedSheet = imported.sheets[0];

    // === Step 3: Verify Layout ===
    expect(importedSheet.cols![1]?.width).toBeCloseTo(100, -1);
    expect(importedSheet.cols![2]?.width).toBeCloseTo(120, -1);
    expect(importedSheet.cols![3]?.width).toBeCloseTo(150, -1);

    expect(importedSheet.rows![1]?.height).toBeCloseTo(30, 0);
    expect(importedSheet.rows![2]?.height).toBeCloseTo(21, 0);
    expect(importedSheet.rows![3]?.height).toBeCloseTo(21, 0);
    expect(importedSheet.rows![4]?.height).toBeCloseTo(25, 0);

    // === Step 4: Verify Formats ===
    const cellA2 = getCell(imported, importedSheetId, "A2");
    expect(cellA2?.numFmt).toBe("#,##0");

    const cellB2 = getCell(imported, importedSheetId, "B2");
    expect(cellB2?.numFmt).toBe('"$"#,##0.00');

    const cellC2 = getCell(imported, importedSheetId, "C2");
    expect(cellC2?.numFmt).toBe('"$"#,##0.00');

    const cellC4 = getCell(imported, importedSheetId, "C4");
    expect(cellC4?.numFmt).toBe('"$"#,##0.00');

    // === Step 5: Verify Formulas ===
    expect(cellC2?.formula).toBe("=A2*B2");
    expect(cellC2?.computed?.v).toBe(255.00);

    const cellC3 = getCell(imported, importedSheetId, "C3");
    expect(cellC3?.formula).toBe("=A3*B3");
    expect(cellC3?.computed?.v).toBe(500.00);

    expect(cellC4?.formula).toBe("=SUM(C2:C3)");
    expect(cellC4?.computed?.v).toBe(755.00);

    // === Step 6: Load into HyperFormula and hydrate ===
    const hydration = hydrateHFFromWorkbook(imported);

    // === Step 7: Modify a value and recompute ===
    updateCellsAndRecompute(imported, hydration, [
      { sheetId: importedSheetId, address: "A2", value: 20 },
    ]);

    // === Step 9: Verify recomputed values ===
    const cellC2After = getCell(imported, importedSheetId, "C2");
    expect(cellC2After?.computed?.v).toBe(510.00); // 20 * 25.50

    const cellC3After = getCell(imported, importedSheetId, "C3");
    expect(cellC3After?.computed?.v).toBe(500.00); // Unchanged

    const cellC4After = getCell(imported, importedSheetId, "C4");
    expect(cellC4After?.computed?.v).toBe(1010.00); // 510 + 500

    // === Step 10: Verify formats still intact ===
    expect(cellC2After?.numFmt).toBe('"$"#,##0.00');
    expect(cellC3After?.numFmt).toBe('"$"#,##0.00');
    expect(cellC4After?.numFmt).toBe('"$"#,##0.00');

    // === Step 11: Export again ===
    const buffer2 = await adapter.export(imported);
    expect(buffer2.byteLength).toBeGreaterThan(0);

    // === Step 12: Import again ===
    const imported2 = await adapter.import(buffer2);
    const imported2SheetId = imported2.sheets[0].id;

    // === Step 13: Verify everything STILL preserved ===
    const finalC2 = getCell(imported2, imported2SheetId, "C2");
    expect(finalC2?.formula).toBe("=A2*B2");
    expect(finalC2?.computed?.v).toBe(510.00);
    expect(finalC2?.numFmt).toBe('"$"#,##0.00');

    const finalC4 = getCell(imported2, imported2SheetId, "C4");
    expect(finalC4?.formula).toBe("=SUM(C2:C3)");
    expect(finalC4?.computed?.v).toBe(1010.00);
    expect(finalC4?.numFmt).toBe('"$"#,##0.00');

    // === Step 14: Verify layout STILL preserved ===
    const imported2Sheet = imported2.sheets[0];
    expect(imported2Sheet.cols![1]?.width).toBeCloseTo(100, -1);
    expect(imported2Sheet.cols![2]?.width).toBeCloseTo(120, -1);
    expect(imported2Sheet.cols![3]?.width).toBeCloseTo(150, -1);

    expect(imported2Sheet.rows![1]?.height).toBeCloseTo(30, 0);
    expect(imported2Sheet.rows![4]?.height).toBeCloseTo(25, 0);
  });

  it("should handle date formulas with date formats", async () => {
    const sheet = workbook.sheets[0];

    // Today's date (serial number)
    const today = 44927; // 2023-01-15

    setCell(workbook, sheetId, "A1", {
      raw: "Start Date",
      dataType: "string",
    });

    setCell(workbook, sheetId, "A2", {
      raw: today,
      dataType: "number",
      numFmt: "mm/dd/yyyy",
    });

    setCell(workbook, sheetId, "B1", {
      raw: "End Date",
      dataType: "string",
    });

    setCell(workbook, sheetId, "B2", {
      formula: "=A2+30", // 30 days later
      dataType: "formula",
      numFmt: "mm/dd/yyyy",
      computed: {
        v: today + 30,
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    setCell(workbook, sheetId, "C1", {
      raw: "Days",
      dataType: "string",
    });

    setCell(workbook, sheetId, "C2", {
      formula: "=B2-A2",
      dataType: "formula",
      numFmt: "#,##0",
      computed: {
        v: 30,
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    // Export → Import
    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    // Verify date formats
    const cellA2 = getCell(imported, importedSheetId, "A2");
    expect(cellA2?.numFmt).toBe("mm/dd/yyyy");
    expect(cellA2?.raw).toBe(today);

    const cellB2 = getCell(imported, importedSheetId, "B2");
    expect(cellB2?.formula).toBe("=A2+30");
    expect(cellB2?.numFmt).toBe("mm/dd/yyyy");
    expect(cellB2?.computed?.v).toBe(today + 30);

    const cellC2 = getCell(imported, importedSheetId, "C2");
    expect(cellC2?.formula).toBe("=B2-A2");
    expect(cellC2?.numFmt).toBe("#,##0");
    expect(cellC2?.computed?.v).toBe(30);

    // Recompute with HF
    const hydration = hydrateHFFromWorkbook(imported);
    recomputeAndPatchCache(imported, hydration);

    // Verify recomputed values
    const cellB2After = getCell(imported, importedSheetId, "B2");
    expect(cellB2After?.computed?.v).toBe(today + 30);
    expect(cellB2After?.numFmt).toBe("mm/dd/yyyy");

    const cellC2After = getCell(imported, importedSheetId, "C2");
    expect(cellC2After?.computed?.v).toBe(30);
    expect(cellC2After?.numFmt).toBe("#,##0");
  });

  it("should handle percentage formulas with percentage formats", async () => {
    setCell(workbook, sheetId, "A1", {
      raw: "Sales",
      dataType: "string",
    });

    setCell(workbook, sheetId, "A2", {
      raw: 1000,
      dataType: "number",
      numFmt: '"$"#,##0.00',
    });

    setCell(workbook, sheetId, "B1", {
      raw: "Target",
      dataType: "string",
    });

    setCell(workbook, sheetId, "B2", {
      raw: 800,
      dataType: "number",
      numFmt: '"$"#,##0.00',
    });

    setCell(workbook, sheetId, "C1", {
      raw: "Achievement",
      dataType: "string",
    });

    setCell(workbook, sheetId, "C2", {
      formula: "=A2/B2",
      dataType: "formula",
      numFmt: "0.00%",
      computed: {
        v: 1.25, // 125%
        t: "n",
        ts: new Date().toISOString(),
      },
    });

    // Export → Import → Recompute
    const buffer = await adapter.export(workbook);
    const imported = await adapter.import(buffer);
    const importedSheetId = imported.sheets[0].id;

    const hydration = hydrateHFFromWorkbook(imported);
    recomputeAndPatchCache(imported, hydration);

    const cellC2 = getCell(imported, importedSheetId, "C2");
    expect(cellC2?.formula).toBe("=A2/B2");
    expect(cellC2?.computed?.v).toBe(1.25);
    expect(cellC2?.numFmt).toBe("0.00%");
  });

  it("should preserve everything after multiple export/import cycles", async () => {
    const sheet = workbook.sheets[0];

    // Setup
    sheet.cols = { 1: { width: 120 }, 2: { width: 120 } };
    sheet.rows = { 1: { height: 25 }, 2: { height: 21 } };

    setCell(workbook, sheetId, "A1", { raw: "Value", dataType: "string" });
    setCell(workbook, sheetId, "A2", { raw: 100, dataType: "number", numFmt: "#,##0.00" });

    setCell(workbook, sheetId, "B1", { raw: "Double", dataType: "string" });
    setCell(workbook, sheetId, "B2", {
      formula: "=A2*2",
      dataType: "formula",
      numFmt: "#,##0.00",
      computed: { v: 200, t: "n", ts: new Date().toISOString() },
    });

    let current = workbook;

    // Cycle 3 times: export → import → export → import → export → import
    for (let i = 0; i < 3; i++) {
      const buffer = await adapter.export(current);
      current = await adapter.import(buffer);
    }

    // Verify after 3 cycles
    const finalSheetId = current.sheets[0].id;
    const finalSheet = current.sheets[0];

    expect(finalSheet.cols![1]?.width).toBeCloseTo(120, -1);
    expect(finalSheet.cols![2]?.width).toBeCloseTo(120, -1);

    const cellB2 = getCell(current, finalSheetId, "B2");
    expect(cellB2?.formula).toBe("=A2*2");
    expect(cellB2?.computed?.v).toBe(200);
    expect(cellB2?.numFmt).toBe("#,##0.00");
  });
});
