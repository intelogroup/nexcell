/**
 * API Usage Examples
 * 
 * This file demonstrates the clean public API exposed by index.ts
 * All examples follow best practices for the workbook module
 */

import {
  // Workbook Creation & Loading
  createWorkbook,
  loadWorkbook,
  cloneWorkbook,
  
  // Workbook Export & Saving
  exportWorkbook,
  
  // Cell Operations
  setCell,
  getCell,
  
  // Operations & Undo/Redo
  applyOperations,
  createEditCellOp,
  createSetRangeOp,
  undoOperation,
  canUndoOperation,
  
  // Formula Computation
  computeFormulas,
  createFormulaEngine,
  disposeFormulaEngine,
  
  // Validation & Utilities
  validateWorkbook,
  getStats,
  getActionHistory,
  
  // Helper utilities
  getSheet,
  parseAddress,
  toAddress,
} from "./index";

// ============================================================================
// Example 1: Create a new workbook and add data
// ============================================================================

export function example1_CreateWorkbook() {
  console.log("=== Example 1: Create Workbook ===");
  
  // Create a new workbook
  const workbook = createWorkbook("My Spreadsheet");
  
  // Validate it
  if (!validateWorkbook(workbook)) {
    throw new Error("Invalid workbook");
  }
  
  // Get stats
  const stats = getStats(workbook);
  console.log(`Created workbook with ${stats.sheets} sheets, ${stats.cells} cells`);
  
  return workbook;
}

// ============================================================================
// Example 2: Add data using low-level API (not recommended for production)
// ============================================================================

export function example2_LowLevelCellOps() {
  console.log("\n=== Example 2: Low-level Cell Operations ===");
  
  const workbook = createWorkbook("Test");
  const sheet = getSheet(workbook, workbook.sheets[0].id);
  
  if (!sheet) {
    throw new Error("Sheet not found");
  }
  
  // Set some cells (low-level - not recommended)
  setCell(workbook, sheet.id, "A1", { raw: 100 });
  setCell(workbook, sheet.id, "A2", { raw: 200 });
  setCell(workbook, sheet.id, "A3", { formula: "=A1+A2" });
  
  // Get a cell
  const cell = getCell(workbook, sheet.id, "A1");
  console.log(`Cell A1 value: ${cell?.raw}`);
  
  return workbook;
}

// ============================================================================
// Example 3: Add data using operations (recommended)
// ============================================================================

export function example3_UsingOperations() {
  console.log("\n=== Example 3: Using Operations (Recommended) ===");
  
  const workbook = createWorkbook("Operations Demo");
  const sheet = workbook.sheets[0];
  
  // Create operations
  const operations = [
    createEditCellOp(sheet.id, "A1", { raw: 100 }),
    createEditCellOp(sheet.id, "A2", { raw: 200 }),
    createEditCellOp(sheet.id, "A3", { formula: "=A1+A2" }),
    createEditCellOp(sheet.id, "B1", { raw: 50, style: { bold: true } }),
    createEditCellOp(sheet.id, "B2", { raw: 25, numFmt: "#,##0.00" }),
  ];
  
  // Apply operations (without formula computation for now)
  const result = applyOperations(workbook, operations, {
    user: "user-123",
    skipRecompute: true, // Skip for now, we'll compute separately
  });
  
  if (!result.success) {
    console.error("Failed to apply operations:", result.errors);
    return workbook;
  }
  
  console.log(`Applied ${result.actions.length} actions`);
  console.log(`Affected ranges:`, result.affectedRanges);
  
  // Check action history
  const history = getActionHistory(workbook);
  console.log(`Action history has ${history.length} entries`);
  
  return workbook;
}

// ============================================================================
// Example 4: Formula computation
// ============================================================================

export function example4_FormulaComputation() {
  console.log("\n=== Example 4: Formula Computation ===");
  
  // Create workbook with formulas
  const workbook = example3_UsingOperations();
  const sheet = workbook.sheets[0];
  
  // Compute all formulas
  const { hydration, recompute } = computeFormulas(workbook);
  
  console.log(`Computed ${recompute.updatedCells} cells`);
  
  // Check computed value
  const cell = getCell(workbook, sheet.id, "A3");
  console.log(`A3 formula: ${cell?.formula}`);
  console.log(`A3 computed value: ${cell?.computed?.v}`);
  
  // Don't forget to dispose!
  disposeFormulaEngine(hydration);
  
  return workbook;
}

// ============================================================================
// Example 5: Undo/Redo with formula recomputation
// ============================================================================

export function example5_UndoRedo() {
  console.log("\n=== Example 5: Undo/Redo ===");
  
  const workbook = createWorkbook("Undo Demo");
  const sheet = workbook.sheets[0];
  
  // Create HF instance for recomputation
  const hydration = createFormulaEngine(workbook);
  
  // Apply some operations
  applyOperations(
    workbook,
    [
      createEditCellOp(sheet.id, "A1", { raw: 100 }),
      createEditCellOp(sheet.id, "A2", { formula: "=A1*2" }),
    ],
    { hydration }
  );
  
  console.log(`A1: ${getCell(workbook, sheet.id, "A1")?.raw}`);
  console.log(`A2: ${getCell(workbook, sheet.id, "A2")?.computed?.v}`);
  
  // Apply another operation
  applyOperations(
    workbook,
    [createEditCellOp(sheet.id, "A1", { raw: 500 })],
    { hydration }
  );
  
  console.log(`After edit - A1: ${getCell(workbook, sheet.id, "A1")?.raw}`);
  console.log(`After edit - A2: ${getCell(workbook, sheet.id, "A2")?.computed?.v}`);
  
  // Undo
  if (canUndoOperation(workbook)) {
    const undoResult = undoOperation(workbook, { hydration });
    console.log(`Undone: ${undoResult.action?.type}`);
    console.log(`After undo - A1: ${getCell(workbook, sheet.id, "A1")?.raw}`);
    console.log(`After undo - A2: ${getCell(workbook, sheet.id, "A2")?.computed?.v}`);
  }
  
  // Cleanup
  disposeFormulaEngine(hydration);
  
  return workbook;
}

// ============================================================================
// Example 6: Batch operations with range
// ============================================================================

export function example6_BatchOperations() {
  console.log("\n=== Example 6: Batch Operations ===");
  
  const workbook = createWorkbook("Batch Demo");
  const sheet = workbook.sheets[0];
  
  // Create a range of cells
  const cells: Record<string, any> = {};
  for (let row = 1; row <= 10; row++) {
    for (let col = 1; col <= 5; col++) {
      const address = toAddress(row, col);
      cells[address] = { raw: row * col };
    }
  }
  
  // Apply in one operation
  const result = applyOperations(
    workbook,
    [createSetRangeOp(sheet.id, "A1:E10", cells)],
    { skipRecompute: true }
  );
  
  console.log(`Set ${Object.keys(cells).length} cells in one operation`);
  console.log(`Success: ${result.success}`);
  
  // Check a cell
  const cell = getCell(workbook, sheet.id, "C3");
  console.log(`C3 value: ${cell?.raw}`); // Should be 3 * 3 = 9
  
  return workbook;
}

// ============================================================================
// Example 7: Export and load workbook
// ============================================================================

export async function example7_ExportAndLoad() {
  console.log("\n=== Example 7: Export and Load ===");
  
  // Create workbook with data
  const workbook1 = createWorkbook("Export Demo");
  const sheet = workbook1.sheets[0];
  
  applyOperations(
    workbook1,
    [
      createEditCellOp(sheet.id, "A1", { raw: "Hello" }),
      createEditCellOp(sheet.id, "A2", { raw: "World" }),
      createEditCellOp(sheet.id, "B1", { raw: 42 }),
    ],
    { skipRecompute: true }
  );
  
  console.log("Original workbook stats:", getStats(workbook1));
  
  // Export to XLSX
  const buffer = await exportWorkbook(workbook1);
  console.log(`Exported ${buffer.byteLength} bytes`);
  
  // Load it back
  const workbook2 = await loadWorkbook(buffer);
  console.log("Loaded workbook stats:", getStats(workbook2));
  
  // Verify data
  const cell = getCell(workbook2, workbook2.sheets[0].id, "A1");
  console.log(`Loaded cell A1: ${cell?.raw}`);
  
  return workbook2;
}

// ============================================================================
// Example 8: Clone workbook
// ============================================================================

export function example8_CloneWorkbook() {
  console.log("\n=== Example 8: Clone Workbook ===");
  
  const original = createWorkbook("Original");
  const sheet = original.sheets[0];
  
  applyOperations(
    original,
    [createEditCellOp(sheet.id, "A1", { raw: 100 })],
    { skipRecompute: true }
  );
  
  // Clone it
  const clone = cloneWorkbook(original);
  
  // Modify clone
  applyOperations(
    clone,
    [createEditCellOp(sheet.id, "A1", { raw: 999 })],
    { skipRecompute: true }
  );
  
  // Verify original is unchanged
  const originalCell = getCell(original, sheet.id, "A1");
  const cloneCell = getCell(clone, sheet.id, "A1");
  
  console.log(`Original A1: ${originalCell?.raw}`); // Should be 100
  console.log(`Clone A1: ${cloneCell?.raw}`); // Should be 999
  
  return { original, clone };
}

// ============================================================================
// Example 9: Address utilities
// ============================================================================

export function example9_AddressUtilities() {
  console.log("\n=== Example 9: Address Utilities ===");
  
  // Parse address
  const addr1 = parseAddress("A1");
  console.log(`A1 -> row: ${addr1.row}, col: ${addr1.col}`); // row: 1, col: 1
  
  const addr2 = parseAddress("Z10");
  console.log(`Z10 -> row: ${addr2.row}, col: ${addr2.col}`); // row: 10, col: 26
  
  // Convert to address
  const address1 = toAddress(1, 1);
  console.log(`row: 1, col: 1 -> ${address1}`); // A1
  
  const address2 = toAddress(10, 26);
  console.log(`row: 10, col: 26 -> ${address2}`); // Z10
  
  const address3 = toAddress(100, 100);
  console.log(`row: 100, col: 100 -> ${address3}`); // CV100
}

// ============================================================================
// Run all examples
// ============================================================================

export function runAllExamples() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Workbook API Usage Examples                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  example1_CreateWorkbook();
  example2_LowLevelCellOps();
  example3_UsingOperations();
  example4_FormulaComputation();
  example5_UndoRedo();
  example6_BatchOperations();
  example9_AddressUtilities();
  
  // Note: Example 7 is async, so it needs to be run separately
  console.log("\n✓ All synchronous examples completed!");
  console.log("To run example 7 (export/load), call example7_ExportAndLoad() separately.");
}

// Uncomment to run examples
// runAllExamples();
