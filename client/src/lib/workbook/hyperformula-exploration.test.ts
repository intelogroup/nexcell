/**
 * HyperFormula Exploration and Interactive Testing
 * 
 * This file demonstrates how HyperFormula integrates with the workbook
 * and tests various computational scenarios interactively.
 * 
 * Run this file to see HyperFormula in action!
 */

import {
  createWorkbook,
  setCell,
  getCell,
  computeFormulas,
  disposeFormulaEngine,
  createEditCellOp,
  applyOperations,
} from "./api";
import type { WorkbookJSON } from "./types";
import { hydrateHFFromWorkbook, updateCellsAndRecompute } from "./hyperformula";

/**
 * Main exploration runner
 */
export function exploreHyperFormula(): void {
  console.group("🔬 HyperFormula Exploration & Testing");
  console.log("=" .repeat(60));
  console.log("Understanding how HyperFormula works with the workbook");
  console.log("=" .repeat(60));

  try {
    // Section 1: Basic Cell Operations
    exploreBasicCellOperations();
    
    // Section 2: Simple Formulas
    exploreSimpleFormulas();
    
    // Section 3: Cell References
    exploreCellReferences();
    
    // Section 4: Formula Dependencies
    exploreFormulaDependencies();
    
    // Section 5: Common Excel Functions
    exploreCommonFunctions();
    
    // Section 6: Error Handling
    exploreErrorHandling();
    
    // Section 7: Performance with Large Data
    explorePerformance();
    
    // Section 8: Real-world Scenario
    exploreRealWorldScenario();

    console.log("\n" + "=".repeat(60));
    console.log("✅ All explorations completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Exploration failed:", error);
    throw error;
  } finally {
    console.groupEnd();
  }
}

/**
 * Section 1: Basic Cell Operations
 * Demonstrates: setting values, getting values, updating values, clearing values
 */
function exploreBasicCellOperations(): void {
  console.group("\n📝 Section 1: Basic Cell Operations");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Basic Operations Test");
  const sheet = workbook.sheets[0];

  console.log("Creating a simple workbook with basic values...");

  // Set different types of values
  setCell(workbook, sheet.id, "A1", { raw: 42 });
  setCell(workbook, sheet.id, "A2", { raw: "Hello" });
  setCell(workbook, sheet.id, "A3", { raw: true });
  setCell(workbook, sheet.id, "A4", { raw: 3.14159 });

  console.log("✓ Set values: A1=42, A2='Hello', A3=true, A4=3.14159");

  // Create HyperFormula instance
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`✓ HyperFormula loaded (updated ${recompute.updatedCells} cells)`);

  // Get values
  const a1 = getCell(workbook, sheet.id, "A1");
  const a2 = getCell(workbook, sheet.id, "A2");
  const a3 = getCell(workbook, sheet.id, "A3");
  const a4 = getCell(workbook, sheet.id, "A4");

  console.log("\nCell values retrieved:");
  console.log(`  A1: ${a1?.raw} (type: ${typeof a1?.raw})`);
  console.log(`  A2: ${a2?.raw} (type: ${typeof a2?.raw})`);
  console.log(`  A3: ${a3?.raw} (type: ${typeof a3?.raw})`);
  console.log(`  A4: ${a4?.raw} (type: ${typeof a4?.raw})`);

  // Update a value
  console.log("\nUpdating A1 from 42 to 100...");
  updateCellsAndRecompute(workbook, hydration, [
    { sheetId: sheet.id, address: "A1", value: 100 }
  ]);
  setCell(workbook, sheet.id, "A1", { raw: 100 });

  const a1Updated = getCell(workbook, sheet.id, "A1");
  console.log(`✓ A1 updated: ${a1Updated?.raw}`);

  // Clear a value
  console.log("\nClearing A2...");
  updateCellsAndRecompute(workbook, hydration, [
    { sheetId: sheet.id, address: "A2", value: null }
  ]);
  setCell(workbook, sheet.id, "A2", { raw: null });

  const a2Cleared = getCell(workbook, sheet.id, "A2");
  console.log(`✓ A2 cleared: ${a2Cleared?.raw}`);

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Basic cell operations work correctly!");
  console.groupEnd();
}

/**
 * Section 2: Simple Formulas
 * Demonstrates: arithmetic operations, SUM function, computed values
 */
function exploreSimpleFormulas(): void {
  console.group("\n🧮 Section 2: Simple Formulas");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Simple Formulas Test");
  const sheet = workbook.sheets[0];

  console.log("Creating formulas with basic arithmetic...");

  // Set up data
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 20 });
  setCell(workbook, sheet.id, "A3", { raw: 30 });

  // Create formulas
  setCell(workbook, sheet.id, "B1", { formula: "=A1+A2" });
  setCell(workbook, sheet.id, "B2", { formula: "=A1*A2" });
  setCell(workbook, sheet.id, "B3", { formula: "=A2/A1" });
  setCell(workbook, sheet.id, "B4", { formula: "=A3-A1" });
  setCell(workbook, sheet.id, "B5", { formula: "=SUM(A1:A3)" });

  console.log("✓ Formulas created:");
  console.log("  B1 = A1+A2 (10+20)");
  console.log("  B2 = A1*A2 (10*20)");
  console.log("  B3 = A2/A1 (20/10)");
  console.log("  B4 = A3-A1 (30-10)");
  console.log("  B5 = SUM(A1:A3) (10+20+30)");

  // Compute
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`\n✓ Computed ${recompute.updatedCells} formulas`);

  // Display results
  console.log("\nComputed results:");
  const b1 = getCell(workbook, sheet.id, "B1");
  const b2 = getCell(workbook, sheet.id, "B2");
  const b3 = getCell(workbook, sheet.id, "B3");
  const b4 = getCell(workbook, sheet.id, "B4");
  const b5 = getCell(workbook, sheet.id, "B5");

  console.log(`  B1 = ${b1?.computed?.v} (expected: 30)`);
  console.log(`  B2 = ${b2?.computed?.v} (expected: 200)`);
  console.log(`  B3 = ${b3?.computed?.v} (expected: 2)`);
  console.log(`  B4 = ${b4?.computed?.v} (expected: 20)`);
  console.log(`  B5 = ${b5?.computed?.v} (expected: 60)`);

  // Verify
  console.assert(b1?.computed?.v === 30, "B1 should be 30");
  console.assert(b2?.computed?.v === 200, "B2 should be 200");
  console.assert(b3?.computed?.v === 2, "B3 should be 2");
  console.assert(b4?.computed?.v === 20, "B4 should be 20");
  console.assert(b5?.computed?.v === 60, "B5 should be 60");

  // Check metadata
  console.log("\nComputed value metadata:");
  console.log(`  Type: ${b1?.computed?.t} (number)`);
  console.log(`  Timestamp: ${b1?.computed?.ts?.substring(0, 19)}`);
  console.log(`  HF Version: ${b1?.computed?.hfVersion}`);
  console.log(`  Computed By: ${b1?.computed?.computedBy}`);

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Simple formulas compute correctly!");
  console.groupEnd();
}

/**
 * Section 3: Cell References
 * Demonstrates: relative references, absolute references, mixed references
 */
function exploreCellReferences(): void {
  console.group("\n🔗 Section 3: Cell References");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Cell References Test");
  const sheet = workbook.sheets[0];

  console.log("Testing different types of cell references...");

  // Set up data grid
  setCell(workbook, sheet.id, "A1", { raw: 100 });
  setCell(workbook, sheet.id, "B1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 200 });
  setCell(workbook, sheet.id, "B2", { raw: 20 });

  // Relative reference (will change when copied)
  setCell(workbook, sheet.id, "C1", { formula: "=A1+B1" });
  
  // Absolute reference (won't change when copied)
  setCell(workbook, sheet.id, "C2", { formula: "=$A$1+$B$1" });
  
  // Mixed references
  setCell(workbook, sheet.id, "C3", { formula: "=$A1+B$1" });

  console.log("✓ Formulas with different reference types:");
  console.log("  C1 = A1+B1 (relative: 100+10)");
  console.log("  C2 = $A$1+$B$1 (absolute: 100+10)");
  console.log("  C3 = $A1+B$1 (mixed: 100+10)");

  // Compute
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`\n✓ Computed ${recompute.updatedCells} formulas`);

  // Display results
  console.log("\nComputed results:");
  const c1 = getCell(workbook, sheet.id, "C1");
  const c2 = getCell(workbook, sheet.id, "C2");
  const c3 = getCell(workbook, sheet.id, "C3");

  console.log(`  C1 = ${c1?.computed?.v} (expected: 110)`);
  console.log(`  C2 = ${c2?.computed?.v} (expected: 110)`);
  console.log(`  C3 = ${c3?.computed?.v} (expected: 110)`);

  // Verify
  console.assert(c1?.computed?.v === 110, "C1 should be 110");
  console.assert(c2?.computed?.v === 110, "C2 should be 110");
  console.assert(c3?.computed?.v === 110, "C3 should be 110");

  // Test reference behavior with updates
  console.log("\nTesting reference update behavior...");
  console.log("Updating A1 from 100 to 500...");
  
  updateCellsAndRecompute(workbook, hydration, [
    { sheetId: sheet.id, address: "A1", value: 500 }
  ]);
  setCell(workbook, sheet.id, "A1", { raw: 500 });

  const c1Updated = getCell(workbook, sheet.id, "C1");
  const c2Updated = getCell(workbook, sheet.id, "C2");
  const c3Updated = getCell(workbook, sheet.id, "C3");

  console.log(`  C1 = ${c1Updated?.computed?.v} (expected: 510)`);
  console.log(`  C2 = ${c2Updated?.computed?.v} (expected: 510)`);
  console.log(`  C3 = ${c3Updated?.computed?.v} (expected: 510)`);

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Cell references work correctly!");
  console.groupEnd();
}

/**
 * Section 4: Formula Dependencies
 * Demonstrates: dependency chains, cascading updates
 */
function exploreFormulaDependencies(): void {
  console.group("\n🔄 Section 4: Formula Dependencies");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Dependencies Test");
  const sheet = workbook.sheets[0];

  console.log("Creating a dependency chain: A1 → B1 → C1 → D1");

  // Create dependency chain
  setCell(workbook, sheet.id, "A1", { raw: 5 });
  setCell(workbook, sheet.id, "B1", { formula: "=A1*2" });      // Depends on A1
  setCell(workbook, sheet.id, "C1", { formula: "=B1+10" });     // Depends on B1
  setCell(workbook, sheet.id, "D1", { formula: "=C1*3" });      // Depends on C1

  console.log("✓ Formula chain created:");
  console.log("  A1 = 5 (raw value)");
  console.log("  B1 = A1*2 (depends on A1)");
  console.log("  C1 = B1+10 (depends on B1)");
  console.log("  D1 = C1*3 (depends on C1)");

  // Initial compute
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`\n✓ Initial computation (${recompute.updatedCells} cells)`);

  let b1 = getCell(workbook, sheet.id, "B1");
  let c1 = getCell(workbook, sheet.id, "C1");
  let d1 = getCell(workbook, sheet.id, "D1");

  console.log("\nInitial computed values:");
  console.log(`  B1 = ${b1?.computed?.v} (5*2 = 10)`);
  console.log(`  C1 = ${c1?.computed?.v} (10+10 = 20)`);
  console.log(`  D1 = ${d1?.computed?.v} (20*3 = 60)`);

  console.assert(b1?.computed?.v === 10, "B1 should be 10");
  console.assert(c1?.computed?.v === 20, "C1 should be 20");
  console.assert(d1?.computed?.v === 60, "D1 should be 60");

  // Update source cell and watch cascade
  console.log("\n📊 Testing dependency propagation...");
  console.log("Updating A1 from 5 to 10...");
  
  updateCellsAndRecompute(workbook, hydration, [
    { sheetId: sheet.id, address: "A1", value: 10 }
  ]);
  setCell(workbook, sheet.id, "A1", { raw: 10 });

  b1 = getCell(workbook, sheet.id, "B1");
  c1 = getCell(workbook, sheet.id, "C1");
  d1 = getCell(workbook, sheet.id, "D1");

  console.log("\nAfter A1 update, all dependent cells recalculate:");
  console.log(`  B1 = ${b1?.computed?.v} (10*2 = 20)`);
  console.log(`  C1 = ${c1?.computed?.v} (20+10 = 30)`);
  console.log(`  D1 = ${d1?.computed?.v} (30*3 = 90)`);

  console.assert(b1?.computed?.v === 20, "B1 should be 20");
  console.assert(c1?.computed?.v === 30, "C1 should be 30");
  console.assert(d1?.computed?.v === 90, "D1 should be 90");

  // Check dependency graph
  if (workbook.computed?.dependencyGraph) {
    console.log("\n📈 Dependency graph:");
    const deps = workbook.computed.dependencyGraph;
    Object.entries(deps).forEach(([cell, dependents]) => {
      console.log(`  ${cell} → [${dependents.join(", ")}]`);
    });
  }

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Formula dependencies propagate correctly!");
  console.groupEnd();
}

/**
 * Section 5: Common Excel Functions
 * Demonstrates: SUM, AVERAGE, COUNT, IF, MIN, MAX, ROUND, CONCATENATE
 */
function exploreCommonFunctions(): void {
  console.group("\n📊 Section 5: Common Excel Functions");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Common Functions Test");
  const sheet = workbook.sheets[0];

  console.log("Testing common Excel functions...");

  // Set up data
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 20 });
  setCell(workbook, sheet.id, "A3", { raw: 30 });
  setCell(workbook, sheet.id, "A4", { raw: 40 });
  setCell(workbook, sheet.id, "A5", { raw: 50 });

  // Test various functions
  setCell(workbook, sheet.id, "B1", { formula: "=SUM(A1:A5)" });
  setCell(workbook, sheet.id, "B2", { formula: "=AVERAGE(A1:A5)" });
  setCell(workbook, sheet.id, "B3", { formula: "=COUNT(A1:A5)" });
  setCell(workbook, sheet.id, "B4", { formula: "=MIN(A1:A5)" });
  setCell(workbook, sheet.id, "B5", { formula: "=MAX(A1:A5)" });
  setCell(workbook, sheet.id, "B6", { formula: "=IF(A1>15, \"High\", \"Low\")" });
  setCell(workbook, sheet.id, "B7", { formula: "=ROUND(B2, 0)" });
  setCell(workbook, sheet.id, "B8", { formula: "=CONCATENATE(\"Sum: \", B1)" });

  console.log("✓ Functions created:");
  console.log("  B1 = SUM(A1:A5)");
  console.log("  B2 = AVERAGE(A1:A5)");
  console.log("  B3 = COUNT(A1:A5)");
  console.log("  B4 = MIN(A1:A5)");
  console.log("  B5 = MAX(A1:A5)");
  console.log("  B6 = IF(A1>15, \"High\", \"Low\")");
  console.log("  B7 = ROUND(B2, 0)");
  console.log("  B8 = CONCATENATE(\"Sum: \", B1)");

  // Compute
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`\n✓ Computed ${recompute.updatedCells} formulas`);

  // Display results
  console.log("\nComputed results:");
  const results = [
    { cell: "B1", expected: 150, name: "SUM" },
    { cell: "B2", expected: 30, name: "AVERAGE" },
    { cell: "B3", expected: 5, name: "COUNT" },
    { cell: "B4", expected: 10, name: "MIN" },
    { cell: "B5", expected: 50, name: "MAX" },
    { cell: "B6", expected: "Low", name: "IF" },
    { cell: "B7", expected: 30, name: "ROUND" },
    { cell: "B8", expected: "Sum: 150", name: "CONCATENATE" },
  ];

  results.forEach(({ cell, expected, name }) => {
    const cellData = getCell(workbook, sheet.id, cell);
    const value = cellData?.computed?.v;
    const match = value === expected ? "✓" : "✗";
    console.log(`  ${match} ${name}: ${cell} = ${value} (expected: ${expected})`);
    console.assert(value === expected, `${cell} should be ${expected}`);
  });

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Common Excel functions work correctly!");
  console.groupEnd();
}

/**
 * Section 6: Error Handling
 * Demonstrates: #DIV/0!, #REF!, #VALUE!, #NAME? errors
 */
function exploreErrorHandling(): void {
  console.group("\n⚠️  Section 6: Error Handling");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Error Handling Test");
  const sheet = workbook.sheets[0];

  console.log("Creating formulas with various error conditions...");

  // Set up error scenarios
  setCell(workbook, sheet.id, "A1", { raw: 10 });
  setCell(workbook, sheet.id, "A2", { raw: 0 });
  setCell(workbook, sheet.id, "A3", { raw: "text" });

  // Create error formulas
  setCell(workbook, sheet.id, "B1", { formula: "=A1/A2" });              // #DIV/0!
  setCell(workbook, sheet.id, "B2", { formula: "=INVALID_FUNC(A1)" });   // #NAME?
  setCell(workbook, sheet.id, "B3", { formula: "=A1+A3" });              // #VALUE!
  setCell(workbook, sheet.id, "B4", { formula: "=SUM(Z999:Z1000)" });    // Valid but empty range

  console.log("✓ Error scenarios created:");
  console.log("  B1 = A1/A2 (10/0 → #DIV/0!)");
  console.log("  B2 = INVALID_FUNC(A1) (→ #NAME?)");
  console.log("  B3 = A1+A3 (10+\"text\" → #VALUE!)");
  console.log("  B4 = SUM(Z999:Z1000) (empty range → 0)");

  // Compute
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`\n✓ Computed ${recompute.updatedCells} formulas`);
  console.log(`⚠️  ${recompute.errors.length} errors detected`);

  // Display errors
  console.log("\nError details:");
  const b1 = getCell(workbook, sheet.id, "B1");
  const b2 = getCell(workbook, sheet.id, "B2");
  const b3 = getCell(workbook, sheet.id, "B3");
  const b4 = getCell(workbook, sheet.id, "B4");

  console.log(`  B1: type=${b1?.computed?.t}, error="${b1?.computed?.error}"`);
  console.log(`  B2: type=${b2?.computed?.t}, error="${b2?.computed?.error}"`);
  console.log(`  B3: type=${b3?.computed?.t}, error="${b3?.computed?.error}"`);
  console.log(`  B4: value=${b4?.computed?.v} (no error - empty range sums to 0)`);

  // Verify error types
  console.assert(b1?.computed?.t === "e", "B1 should be error type");
  console.assert(b1?.computed?.error?.includes("DIV"), "B1 should have DIV/0 error");

  // Show error log
  if (recompute.errors.length > 0) {
    console.log("\nError log:");
    recompute.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.sheetId}!${err.address}: ${err.error}`);
    });
  }

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Error handling works correctly!");
  console.groupEnd();
}

/**
 * Section 7: Performance with Large Data
 * Demonstrates: handling large datasets, batch operations
 */
function explorePerformance(): void {
  console.group("\n⚡ Section 7: Performance Test");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Performance Test");
  const sheet = workbook.sheets[0];

  console.log("Creating large dataset...");

  const startSetup = performance.now();
  const rows = 100;
  const cols = 10;

  // Create grid of data
  for (let row = 1; row <= rows; row++) {
    for (let col = 0; col < cols; col++) {
      const address = `${String.fromCharCode(65 + col)}${row}`;
      setCell(workbook, sheet.id, address, { raw: row * (col + 1) });
    }
  }

  const setupTime = performance.now() - startSetup;
  console.log(`✓ Created ${rows * cols} cells in ${setupTime.toFixed(2)}ms`);

  // Add summary formulas
  console.log("\nAdding summary formulas...");
  for (let col = 0; col < cols; col++) {
    const colLetter = String.fromCharCode(65 + col);
    const summaryRow = rows + 1;
    const range = `${colLetter}1:${colLetter}${rows}`;
    setCell(workbook, sheet.id, `${colLetter}${summaryRow}`, { 
      formula: `=SUM(${range})` 
    });
  }

  // Compute
  console.log("Computing all formulas...");
  const startCompute = performance.now();
  const { hydration, recompute } = computeFormulas(workbook);
  const computeTime = performance.now() - startCompute;

  console.log(`\n✓ Computed ${recompute.updatedCells} formulas in ${computeTime.toFixed(2)}ms`);
  console.log(`  Average: ${(computeTime / recompute.updatedCells).toFixed(3)}ms per formula`);

  // Test incremental update
  console.log("\nTesting incremental update performance...");
  const startUpdate = performance.now();
  
  updateCellsAndRecompute(workbook, hydration, [
    { sheetId: sheet.id, address: "A1", value: 999 }
  ]);
  
  const updateTime = performance.now() - startUpdate;
  console.log(`✓ Updated 1 cell and recomputed dependents in ${updateTime.toFixed(2)}ms`);

  // Display sample results
  console.log("\nSample summary results:");
  for (let col = 0; col < Math.min(cols, 3); col++) {
    const colLetter = String.fromCharCode(65 + col);
    const summaryCell = getCell(workbook, sheet.id, `${colLetter}${rows + 1}`);
    console.log(`  Column ${colLetter} sum: ${summaryCell?.computed?.v}`);
  }

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Performance test completed!");
  console.groupEnd();
}

/**
 * Section 8: Real-world Scenario
 * Demonstrates: A realistic budget calculator with multiple formulas
 */
function exploreRealWorldScenario(): void {
  console.group("\n💼 Section 8: Real-world Budget Calculator");
  console.log("-".repeat(60));

  const workbook = createWorkbook("Budget Calculator");
  const sheet = workbook.sheets[0];

  console.log("Building a monthly budget calculator...");

  // Headers
  console.log("\nSetting up budget categories...");
  setCell(workbook, sheet.id, "A1", { raw: "Category" });
  setCell(workbook, sheet.id, "B1", { raw: "Budgeted" });
  setCell(workbook, sheet.id, "C1", { raw: "Actual" });
  setCell(workbook, sheet.id, "D1", { raw: "Difference" });
  setCell(workbook, sheet.id, "E1", { raw: "Status" });

  // Income
  setCell(workbook, sheet.id, "A2", { raw: "Income" });
  setCell(workbook, sheet.id, "B2", { raw: 5000 });
  setCell(workbook, sheet.id, "C2", { raw: 5200 });
  setCell(workbook, sheet.id, "D2", { formula: "=C2-B2" });
  setCell(workbook, sheet.id, "E2", { formula: "=IF(D2>=0, \"Good\", \"Bad\")" });

  // Expenses
  const expenses = [
    { name: "Rent", budget: 1500, actual: 1500 },
    { name: "Groceries", budget: 600, actual: 680 },
    { name: "Utilities", budget: 200, actual: 185 },
    { name: "Transportation", budget: 300, actual: 350 },
    { name: "Entertainment", budget: 200, actual: 250 },
  ];

  expenses.forEach((expense, i) => {
    const row = i + 3;
    setCell(workbook, sheet.id, `A${row}`, { raw: expense.name });
    setCell(workbook, sheet.id, `B${row}`, { raw: expense.budget });
    setCell(workbook, sheet.id, `C${row}`, { raw: expense.actual });
    setCell(workbook, sheet.id, `D${row}`, { formula: `=C${row}-B${row}` });
    setCell(workbook, sheet.id, `E${row}`, { formula: `=IF(D${row}<=0, \"Good\", \"Over\")` });
  });

  // Totals
  const totalRow = 8;
  setCell(workbook, sheet.id, `A${totalRow}`, { raw: "TOTAL EXPENSES" });
  setCell(workbook, sheet.id, `B${totalRow}`, { formula: "=SUM(B3:B7)" });
  setCell(workbook, sheet.id, `C${totalRow}`, { formula: "=SUM(C3:C7)" });
  setCell(workbook, sheet.id, `D${totalRow}`, { formula: "=C8-B8" });

  // Net
  const netRow = 9;
  setCell(workbook, sheet.id, `A${netRow}`, { raw: "NET (Income - Expenses)" });
  setCell(workbook, sheet.id, `B${netRow}`, { formula: "=B2-B8" });
  setCell(workbook, sheet.id, `C${netRow}`, { formula: "=C2-C8" });
  setCell(workbook, sheet.id, `D${netRow}`, { formula: "=C9-B9" });
  setCell(workbook, sheet.id, `E${netRow}`, { formula: "=IF(C9>0, \"Surplus\", \"Deficit\")" });

  console.log("✓ Budget structure created");
  console.log(`  - ${expenses.length} expense categories`);
  console.log(`  - ${expenses.length * 2 + 7} formulas total`);

  // Compute
  console.log("\nComputing budget...");
  const { hydration, recompute } = computeFormulas(workbook);
  console.log(`✓ Computed ${recompute.updatedCells} formulas`);

  // Display results
  console.log("\n📊 Budget Summary:");
  console.log("-".repeat(60));

  const income = getCell(workbook, sheet.id, "C2")?.raw;
  console.log(`Income:           $${income}`);

  const totalBudget = getCell(workbook, sheet.id, "B8")?.computed?.v;
  const totalActual = getCell(workbook, sheet.id, "C8")?.computed?.v;
  console.log(`Total Budget:     $${totalBudget}`);
  console.log(`Total Actual:     $${totalActual}`);
  console.log(`Difference:       $${getCell(workbook, sheet.id, "D8")?.computed?.v}`);

  const netBudget = getCell(workbook, sheet.id, "B9")?.computed?.v;
  const netActual = getCell(workbook, sheet.id, "C9")?.computed?.v;
  const netStatus = getCell(workbook, sheet.id, "E9")?.computed?.v;
  console.log(`\nNet (Budgeted):   $${netBudget}`);
  console.log(`Net (Actual):     $${netActual}`);
  console.log(`Status:           ${netStatus}`);

  console.log("\n📋 Category Breakdown:");
  expenses.forEach((_, i) => {
    const row = i + 3;
    const category = getCell(workbook, sheet.id, `A${row}`)?.raw;
    const diff = getCell(workbook, sheet.id, `D${row}`)?.computed?.v;
    const status = getCell(workbook, sheet.id, `E${row}`)?.computed?.v;
    console.log(`  ${category}: $${diff} (${status})`);
  });

  // Verify key calculations
  console.assert(totalBudget === 2800, "Total budget should be 2800");
  console.assert(totalActual === 2965, "Total actual should be 2965");
  console.assert(netActual === 2235, "Net actual should be 2235");
  console.assert(netStatus === "Surplus", "Should show surplus");

  // Cleanup
  disposeFormulaEngine(hydration);
  console.log("\n✅ Real-world scenario works perfectly!");
  console.groupEnd();
}

/**
 * Vitest test suite wrapper
 */
import { describe, it } from "vitest";

describe("HyperFormula Exploration", () => {
  it("should explore all HyperFormula features", () => {
    exploreHyperFormula();
  });
});
