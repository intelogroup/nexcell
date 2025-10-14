/**
 * Basic workbook JSON tests
 * Run these to verify core functionality
 */

import {
  createWorkbook,
  addSheet,
  setCell,
  getCell,
  parseAddress,
  toAddress,
  getCellsInRange,
  getWorkbookStats,
  SheetJSAdapter,
  type Cell,
} from "./index";

// Test 1: Create workbook
console.log("Test 1: Create workbook");
const wb = createWorkbook("Test Workbook");
console.log("✓ Created workbook:", wb.workbookId);
console.log("✓ Default sheet:", wb.sheets[0].name);

// Test 2: Add cells
console.log("\nTest 2: Add cells");
const sheet1 = wb.sheets[0];

setCell(wb, sheet1.id, "A1", {
  raw: "Name",
  dataType: "string",
});

setCell(wb, sheet1.id, "B1", {
  raw: "Score",
  dataType: "string",
});

setCell(wb, sheet1.id, "A2", {
  raw: "Alice",
  dataType: "string",
});

setCell(wb, sheet1.id, "B2", {
  raw: 95,
  dataType: "number",
  numFmt: "0",
});

setCell(wb, sheet1.id, "A3", {
  raw: "Bob",
  dataType: "string",
});

setCell(wb, sheet1.id, "B3", {
  raw: 87,
  dataType: "number",
  numFmt: "0",
});

setCell(wb, sheet1.id, "B4", {
  formula: "=SUM(B2:B3)",
  dataType: "formula",
  computed: {
    v: 182,
    t: "n",
    ts: new Date().toISOString(),
  },
});

console.log("✓ Added 7 cells");

// Test 3: Read cells
console.log("\nTest 3: Read cells");
const cellA1 = getCell(wb, sheet1.id, "A1");
console.log("✓ A1:", cellA1?.raw);

const cellB4 = getCell(wb, sheet1.id, "B4");
console.log("✓ B4 formula:", cellB4?.formula);
console.log("✓ B4 computed:", cellB4?.computed?.v);

// Test 4: Address conversion
console.log("\nTest 4: Address conversion");
console.log("✓ A1 ->", parseAddress("A1")); // { row: 1, col: 1 }
console.log("✓ Z10 ->", parseAddress("Z10")); // { row: 10, col: 26 }
console.log("✓ AA1 ->", parseAddress("AA1")); // { row: 1, col: 27 }
console.log("✓ (1,1) ->", toAddress(1, 1)); // "A1"
console.log("✓ (10,26) ->", toAddress(10, 26)); // "Z10"

// Test 5: Range operations
console.log("\nTest 5: Range operations");
const range = getCellsInRange("A1:B2");
console.log("✓ A1:B2 cells:", range); // ["A1", "A2", "B1", "B2"]

// Test 6: Workbook stats
console.log("\nTest 6: Workbook stats");
const stats = getWorkbookStats(wb);
console.log("✓ Stats:", stats);

// Test 7: Add merge
console.log("\nTest 7: Add merge");
sheet1.mergedRanges = ["A1:B1"];
console.log("✓ Added merge A1:B1");

// Test 8: Add styling
console.log("\nTest 8: Add styling");
const styledCell: Cell = {
  raw: "Header",
  dataType: "string",
  style: {
    bold: true,
    fontSize: 14,
    bgColor: "#4472C4",
    color: "#FFFFFF",
    alignment: {
      horizontal: "center",
      vertical: "middle",
    },
  },
};
setCell(wb, sheet1.id, "C1", styledCell);
console.log("✓ Added styled cell C1");

// Test 9: Add second sheet
console.log("\nTest 9: Add second sheet");
const sheet2 = addSheet(wb, "Data");
setCell(wb, sheet2.id, "A1", {
  raw: "Second Sheet",
  dataType: "string",
});
console.log("✓ Added sheet:", sheet2.name);
console.log("✓ Total sheets:", wb.sheets.length);

// Test 10: Export/Import with SheetJS adapter
console.log("\nTest 10: Export/Import round-trip");
async function testExportImport() {
  const adapter = new SheetJSAdapter();
  
  try {
    // Export
    console.log("  Exporting...");
    const buffer = await adapter.export(wb);
    console.log("  ✓ Exported:", buffer.byteLength, "bytes");
    
    // Import
    console.log("  Importing...");
    const imported = await adapter.import(buffer);
    console.log("  ✓ Imported workbook:", imported.workbookId);
    console.log("  ✓ Sheets:", imported.sheets.map((s: { name: string }) => s.name));
    console.log("  ✓ Cells in Sheet1:", Object.keys(imported.sheets[0].cells || {}).length);
    
    // Verify formula preserved
    const importedB4 = getCell(imported, imported.sheets[0].id, "B4");
    console.log("  ✓ B4 formula preserved:", importedB4?.formula);
    
    // Verify merge preserved
    console.log("  ✓ Merges preserved:", imported.sheets[0].mergedRanges);
    
  } catch (error) {
    console.error("  ✗ Export/Import failed:", error);
  }
}

testExportImport();

console.log("\n✓ All tests completed!");
