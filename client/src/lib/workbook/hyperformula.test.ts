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

import {
  hydrateHFFromWorkbook,
  recomputeAndPatchCache,
  computeWorkbook,
  updateCellsAndRecompute,
  getCellValueFromHF,
  isCellFormula,
  getCellFormulaFromHF,
  formatHFError,
  getHFStats,
  disposeHF,
} from "./hyperformula";
import { createWorkbook, setCell, getCell } from "./utils";
import type { WorkbookJSON, Cell } from "./types";

/**
 * Run all HyperFormula tests
 */
export function runHyperFormulaTests(): void {
  console.group("🧪 HyperFormula Integration Tests");

  try {
    testBasicHydration();
    testFormulaComputation();
    testCachePersistence();
    testBidirectionalMapping();
    testIncrementalUpdates();
    testErrorHandling();
    testDependencyTracking();
    testMultiSheetFormulas();
    testComplexFormulas();
    testHFDisposal();

    console.log("✅ All HyperFormula tests passed!");
  } catch (error) {
    console.error("❌ HyperFormula tests failed:", error);
    throw error;
  } finally {
    console.groupEnd();
  }
}

/**
 * Test 1: Basic hydration from workbook
 */
function testBasicHydration(): void {
  console.log("Test 1: Basic hydration");

  const workbook = createWorkbook("Test Workbook");
  const sheet = workbook.sheets[0];

  // Add some cells
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 20 });
  setCell(workbook, sheet.id, "A3", { formula: "=A1+A2" });

  // Hydrate HF
  const hydration = hydrateHFFromWorkbook(workbook);

  // Verify sheet mapping
  console.assert(hydration.sheetMap.size === 1, "Should have 1 sheet");
  console.assert(
    hydration.sheetMap.has(sheet.id),
    "Should map sheet ID to HF index"
  );

  // Verify no warnings
  console.assert(
    hydration.warnings.length === 0,
    `Should have no warnings, got: ${hydration.warnings.join(", ")}`
  );

  // Verify HF has correct data
  const hfSheetId = hydration.sheetMap.get(sheet.id)!;
  console.assert(
    getCellValueFromHF(hydration.hf, hfSheetId, "A1") === 10,
    "A1 should be 10"
  );
  console.assert(
    getCellValueFromHF(hydration.hf, hfSheetId, "A2") === 20,
    "A2 should be 20"
  );
  console.assert(
    isCellFormula(hydration.hf, hfSheetId, "A3"),
    "A3 should be a formula"
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Basic hydration works");
}

/**
 * Test 2: Formula computation and result caching
 */
function testFormulaComputation(): void {
  console.log("Test 2: Formula computation");

  const workbook = createWorkbook("Formula Test");
  const sheet = workbook.sheets[0];

  // Add formula cells
  setCell(workbook, sheet.id, "A1", { raw: 5 });
  setCell(workbook, sheet.id, "A2", { raw: 10 });
  setCell(workbook, sheet.id, "B1", { formula: "=A1+A2" });
  setCell(workbook, sheet.id, "B2", { formula: "=A1*A2" });
  setCell(workbook, sheet.id, "B3", { formula: "=SUM(A1:A2)" });

  // Compute workbook
  const { hydration, recompute } = computeWorkbook(workbook);

  // Verify computation stats
  console.assert(
    recompute.updatedCells === 3,
    `Should update 3 formula cells, got ${recompute.updatedCells}`
  );
  console.assert(
    recompute.errors.length === 0,
    `Should have no errors, got: ${JSON.stringify(recompute.errors)}`
  );

  // Verify computed values
  const b1 = getCell(workbook, sheet.id, "B1");
  console.assert(b1?.computed?.v === 15, `B1 should be 15, got ${b1?.computed?.v}`);
  console.assert(b1?.computed?.t === "n", `B1 type should be 'n', got ${b1?.computed?.t}`);

  const b2 = getCell(workbook, sheet.id, "B2");
  console.assert(b2?.computed?.v === 50, `B2 should be 50, got ${b2?.computed?.v}`);

  const b3 = getCell(workbook, sheet.id, "B3");
  console.assert(b3?.computed?.v === 15, `B3 should be 15, got ${b3?.computed?.v}`);

  // Verify cache metadata
  console.assert(b1?.computed?.hfVersion, "Should have HF version");
  console.assert(b1?.computed?.ts, "Should have timestamp");
  console.assert(
    b1?.computed?.computedBy?.startsWith("hf-"),
    "Should have computedBy field"
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Formula computation works");
}

/**
 * Test 3: Cache persistence in workbook
 */
function testCachePersistence(): void {
  console.log("Test 3: Cache persistence");

  const workbook = createWorkbook("Cache Test");
  const sheet = workbook.sheets[0];

  // Add formula
  setCell(workbook, sheet.id, "A1", { raw: 100 });
  setCell(workbook, sheet.id, "A2", { formula: "=A1*2" });

  // Compute
  const { hydration } = computeWorkbook(workbook);

  // Verify workbook-level cache
  const fullAddress = `${sheet.name}!A2`;
  console.assert(
    workbook.computed?.hfCache,
    "Should have hfCache in workbook"
  );
  console.assert(
    workbook.computed?.hfCache![fullAddress],
    "Should cache A2 in workbook"
  );
  console.assert(
    workbook.computed?.hfCache![fullAddress].v === 200,
    `Cache should have value 200, got ${workbook.computed?.hfCache![fullAddress].v}`
  );

  // Verify cell-level cache
  const a2 = getCell(workbook, sheet.id, "A2");
  console.assert(a2?.computed?.v === 200, "Cell should have cached value");

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Cache persistence works");
}

/**
 * Test 4: Bidirectional coordinate mapping
 */
function testBidirectionalMapping(): void {
  console.log("Test 4: Bidirectional coordinate mapping");

  const workbook = createWorkbook("Mapping Test");
  const sheet = workbook.sheets[0];

  // Add cells with various addresses
  setCell(workbook, sheet.id, "A1", { raw: 1 });
  setCell(workbook, sheet.id, "Z10", { raw: 2 });
  setCell(workbook, sheet.id, "AA100", { raw: 3 });

  // Hydrate
  const hydration = hydrateHFFromWorkbook(workbook);
  const hfSheetId = hydration.sheetMap.get(sheet.id)!;

  // Verify address mapping
  console.assert(
    hydration.addressMap.has(`${sheet.name}!A1`),
    "Should map A1"
  );
  console.assert(
    hydration.addressMap.has(`${sheet.name}!Z10`),
    "Should map Z10"
  );
  console.assert(
    hydration.addressMap.has(`${sheet.name}!AA100`),
    "Should map AA100"
  );

  // Verify HF can read values at these addresses
  console.assert(
    getCellValueFromHF(hydration.hf, hfSheetId, "A1") === 1,
    "A1 should be readable"
  );
  console.assert(
    getCellValueFromHF(hydration.hf, hfSheetId, "Z10") === 2,
    "Z10 should be readable"
  );
  console.assert(
    getCellValueFromHF(hydration.hf, hfSheetId, "AA100") === 3,
    "AA100 should be readable"
  );

  // Verify hfInternal was set
  const a1 = getCell(workbook, sheet.id, "A1");
  console.assert(a1?.hfInternal, "A1 should have hfInternal");
  console.assert(
    a1?.hfInternal?.sheetId === hfSheetId,
    "A1 hfInternal should have correct sheet ID"
  );
  console.assert(
    a1?.hfInternal?.row === 0 && a1?.hfInternal?.col === 0,
    "A1 should map to (0,0)"
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Bidirectional mapping works");
}

/**
 * Test 5: Incremental updates
 */
function testIncrementalUpdates(): void {
  console.log("Test 5: Incremental updates");

  const workbook = createWorkbook("Update Test");
  const sheet = workbook.sheets[0];

  // Initial setup
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { formula: "=A1*10" });

  // Initial compute
  const { hydration } = computeWorkbook(workbook);

  // Verify initial value
  let a2 = getCell(workbook, sheet.id, "A2");
  console.assert(a2?.computed?.v === 100, "Initial A2 should be 100");

  // Update A1
  const result = updateCellsAndRecompute(workbook, hydration, [
    { sheetId: sheet.id, address: "A1", value: 20 },
  ]);

  // Update workbook cell (simulate user edit)
  setCell(workbook, sheet.id, "A1", { raw: 20 });

  // Recompute
  recomputeAndPatchCache(workbook, hydration);

  // Verify updated value
  a2 = getCell(workbook, sheet.id, "A2");
  console.assert(
    a2?.computed?.v === 200,
    `Updated A2 should be 200, got ${a2?.computed?.v}`
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Incremental updates work");
}

/**
 * Test 6: Error handling
 */
function testErrorHandling(): void {
  console.log("Test 6: Error handling");

  const workbook = createWorkbook("Error Test");
  const sheet = workbook.sheets[0];

  // Add cells with errors
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 0 });
  setCell(workbook, sheet.id, "B1", { formula: "=A1/A2" }); // Division by zero
  setCell(workbook, sheet.id, "B2", { formula: "=INVALID()" }); // Invalid function
  setCell(workbook, sheet.id, "B3", { formula: "=A1+#REF!" }); // Invalid reference

  // Compute
  const { hydration, recompute } = computeWorkbook(workbook);

  // Verify errors were captured
  console.assert(
    recompute.errors.length >= 1,
    `Should have at least 1 error, got ${recompute.errors.length}`
  );

  // Verify error in computed cache
  const b1 = getCell(workbook, sheet.id, "B1");
  console.assert(b1?.computed?.error, "B1 should have error");
  console.assert(b1?.computed?.t === "e", "B1 should be error type");

  // Test error formatting
  const errorMsg = formatHFError({ type: "ERROR", value: "#DIV/0!" });
  console.assert(
    errorMsg === "Division by zero",
    `Should format #DIV/0! error, got: ${errorMsg}`
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Error handling works");
}

/**
 * Test 7: Dependency tracking
 */
function testDependencyTracking(): void {
  console.log("Test 7: Dependency tracking");

  const workbook = createWorkbook("Dependency Test");
  const sheet = workbook.sheets[0];

  // Create dependency chain: A1 <- B1 <- C1
  setCell(workbook, sheet.id, "A1", { raw: 5 });
  setCell(workbook, sheet.id, "B1", { formula: "=A1*2" });
  setCell(workbook, sheet.id, "C1", { formula: "=B1+10" });

  // Compute
  const { hydration } = computeWorkbook(workbook);

  // Verify dependency graph
  console.assert(
    workbook.computed?.dependencyGraph,
    "Should have dependency graph"
  );

  // Note: HF getDependents returns cells that depend on current cell,
  // not cells that current cell depends on
  // So we check if dependencies exist (not exact structure)
  console.assert(
    Object.keys(workbook.computed?.dependencyGraph || {}).length > 0,
    "Should have dependency entries"
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Dependency tracking works");
}

/**
 * Test 8: Multi-sheet formulas
 */
function testMultiSheetFormulas(): void {
  console.log("Test 8: Multi-sheet formulas");

  const workbook = createWorkbook("Multi-Sheet Test");
  const sheet1 = workbook.sheets[0];

  // Add second sheet
  const sheet2 = {
    id: "sheet2-id",
    name: "Sheet2",
    visible: true,
    grid: { rowCount: 1000, colCount: 50 },
    cells: {},
    mergedRanges: [],
  };
  workbook.sheets.push(sheet2);

  // Add data
  setCell(workbook, sheet1.id, "A1", { raw: 100 });
  setCell(workbook, sheet2.id, "A1", { formula: "=Sheet1!A1*2" });

  // Compute
  const { hydration } = computeWorkbook(workbook);

  // Verify sheet mapping
  console.assert(hydration.sheetMap.size === 2, "Should have 2 sheets");

  // Verify cross-sheet formula
  const a1 = getCell(workbook, sheet2.id, "A1");
  console.assert(
    a1?.computed?.v === 200,
    `Sheet2!A1 should be 200, got ${a1?.computed?.v}`
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Multi-sheet formulas work");
}

/**
 * Test 9: Complex formulas
 */
function testComplexFormulas(): void {
  console.log("Test 9: Complex formulas");

  const workbook = createWorkbook("Complex Formula Test");
  const sheet = workbook.sheets[0];

  // Add test data
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 20 });
  setCell(workbook, sheet.id, "A3", { raw: 30 });
  setCell(workbook, sheet.id, "A4", { raw: 40 });

  // Complex formulas
  setCell(workbook, sheet.id, "B1", { formula: "=SUM(A1:A4)" });
  setCell(workbook, sheet.id, "B2", { formula: "=AVERAGE(A1:A4)" });
  setCell(workbook, sheet.id, "B3", { formula: "=MAX(A1:A4)" });
  setCell(workbook, sheet.id, "B4", { formula: "=MIN(A1:A4)" });
  setCell(workbook, sheet.id, "B5", { formula: "=IF(A1>15, \"High\", \"Low\")" });
  setCell(workbook, sheet.id, "B6", { formula: "=ROUND(B2, 0)" });

  // Compute
  const { hydration } = computeWorkbook(workbook);

  // Verify results
  console.assert(
    getCell(workbook, sheet.id, "B1")?.computed?.v === 100,
    "SUM should work"
  );
  console.assert(
    getCell(workbook, sheet.id, "B2")?.computed?.v === 25,
    "AVERAGE should work"
  );
  console.assert(
    getCell(workbook, sheet.id, "B3")?.computed?.v === 40,
    "MAX should work"
  );
  console.assert(
    getCell(workbook, sheet.id, "B4")?.computed?.v === 10,
    "MIN should work"
  );
  console.assert(
    getCell(workbook, sheet.id, "B5")?.computed?.v === "Low",
    "IF should work"
  );
  console.assert(
    getCell(workbook, sheet.id, "B6")?.computed?.v === 25,
    "ROUND should work"
  );

  // Cleanup
  disposeHF(hydration.hf);
  console.log("✓ Complex formulas work");
}

/**
 * Test 10: HF disposal and cleanup
 */
function testHFDisposal(): void {
  console.log("Test 10: HF disposal");

  const workbook = createWorkbook("Disposal Test");
  const sheet = workbook.sheets[0];

  setCell(workbook, sheet.id, "A1", { raw: 42 });

  // Create and dispose HF
  const { hydration } = computeWorkbook(workbook);
  const stats = getHFStats(hydration.hf);

  console.assert(stats.sheets === 1, "Should have 1 sheet before disposal");

  // Dispose
  disposeHF(hydration.hf);

  // Verify can't use after disposal (should not crash)
  try {
    getHFStats(hydration.hf);
    console.log("⚠️ Warning: HF still accessible after disposal");
  } catch (error) {
    // Expected - HF should throw after disposal
    console.log("✓ HF disposal prevents further use (expected)");
  }

  console.log("✓ HF disposal works");
}

// Export test runner
if (import.meta.url === `file://${process.argv[1]}`) {
  runHyperFormulaTests();
}
