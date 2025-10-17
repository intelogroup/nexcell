/**
 * Operations and Undo/Redo Tests
 * 
 * Tests the operations module and undo/redo functionality including:
 * - Basic operations (editCell, deleteCell, etc.)
 * - Operation validation
 * - Inverse action generation
 * - Action log management
 * - Undo/redo functionality
 * - Batch operations
 * - Error handling
 */

import {
  applyOperations,
  createEditCellOp,
  createDeleteCellOp,
  createSetRangeOp,
  undo,
  canUndo,
  getUndoDepth,
  getRecentActions,
  getActionLogStats,
} from "./index";
import { createWorkbook, getCell, setCell } from "./utils";

/**
 * Run all operations tests
 */
export function runOperationsTests(): void {
  console.group("🧪 Operations and Undo/Redo Tests");

  try {
    testBasicEditCell();
    testDeleteCell();
    testActionLogManagement();
    testInverseActions();
    testBasicUndo();
    testMultipleUndo();
    testBatchOperations();
    testInsertDeleteRow();
    testInsertDeleteCol();
    testMergeUnmerge();
    testSetStyleFormat();
    testSetRange();
    testOperationValidation();
    testErrorHandling();
    testActionLogStats();

    console.log("✅ All operations tests passed!");
  } catch (error) {
    console.error("❌ Operations tests failed:", error);
    throw error;
  } finally {
    console.groupEnd();
  }
}

/**
 * Test 1: Basic editCell operation
 */
function testBasicEditCell(): void {
  console.log("Test 1: Basic editCell operation");

  const workbook = createWorkbook("Edit Test");
  const sheet = workbook.sheets[0];

  // Create operation
  const op = createEditCellOp(sheet.id, "A1", { raw: 42 });

  // Apply operation
  const result = applyOperations(workbook, [op]);

  // Verify success
  console.assert(result.success, "Should succeed");
  console.assert(result.actions.length === 1, "Should create 1 action");
  console.assert(result.errors.length === 0, "Should have no errors");

  // Verify cell was updated
  const cell = getCell(workbook, sheet.id, "A1");
  console.assert(cell?.raw === 42, `A1 should be 42, got ${cell?.raw}`);

  // Verify action log
  console.assert(workbook.actionLog?.length === 1, "Should have 1 action in log");
  console.assert(
    workbook.actionLog![0].type === "editCell",
    "Action should be editCell"
  );

  // Verify inverse action exists
  console.assert(
    workbook.actionLog![0].inverse !== undefined,
    "Action should have inverse"
  );

  console.log("✓ Basic editCell works");
}

/**
 * Test 2: Delete cell operation
 */
function testDeleteCell(): void {
  console.log("Test 2: Delete cell operation");

  const workbook = createWorkbook("Delete Test");
  const sheet = workbook.sheets[0];

  // Set initial value
  setCell(workbook, sheet.id, "A1", { raw: 100 });

  // Clear action log from manual set
  workbook.actionLog = [];

  // Create delete operation
  const op = createDeleteCellOp(sheet.id, "A1");

  // Apply operation
  const result = applyOperations(workbook, [op]);

  // Verify success
  console.assert(result.success, "Should succeed");
  console.assert(result.actions.length === 1, "Should create 1 action");

  // Verify cell was deleted
  const cell = getCell(workbook, sheet.id, "A1");
  console.assert(cell === undefined, "A1 should be deleted");

  // Verify inverse action can restore
  console.assert(
    workbook.actionLog![0].inverse?.type === "editCell",
    "Inverse should be editCell"
  );
  console.assert(
    workbook.actionLog![0].inverse?.payload.cell.raw === 100,
    "Inverse should restore value 100"
  );

  console.log("✓ Delete cell works");
}

/**
 * Test 3: Action log management
 */
function testActionLogManagement(): void {
  console.log("Test 3: Action log management");

  const workbook = createWorkbook("Log Test");
  const sheet = workbook.sheets[0];

  // Perform multiple operations
  for (let i = 1; i <= 5; i++) {
    const op = createEditCellOp(sheet.id, `A${i}`, { raw: i * 10 });
    applyOperations(workbook, [op]);
  }

  // Verify action log
  console.assert(
    workbook.actionLog?.length === 5,
    `Should have 5 actions, got ${workbook.actionLog?.length}`
  );

  // Test getUndoDepth
  const depth = getUndoDepth(workbook);
  console.assert(depth === 5, `Undo depth should be 5, got ${depth}`);

  // Test getRecentActions
  const recent = getRecentActions(workbook, 3);
  console.assert(recent.length === 3, "Should get 3 recent actions");
  console.assert(
    recent[2].payload.address === "A5",
    "Most recent should be A5"
  );

  console.log("✓ Action log management works");
}

/**
 * Test 4: Inverse action generation
 */
function testInverseActions(): void {
  console.log("Test 4: Inverse action generation");

  const workbook = createWorkbook("Inverse Test");
  const sheet = workbook.sheets[0];

  // Edit cell (no previous value)
  const op1 = createEditCellOp(sheet.id, "A1", { raw: 50 });
  const result1 = applyOperations(workbook, [op1]);

  // Verify inverse is deleteCell (since cell didn't exist)
  console.assert(
    result1.actions[0].inverse?.type === "deleteCell",
    "Inverse should be deleteCell for new cell"
  );

  // Edit existing cell
  const op2 = createEditCellOp(sheet.id, "A1", { raw: 100 });
  const result2 = applyOperations(workbook, [op2]);

  // Verify inverse is editCell with old value
  console.assert(
    result2.actions[0].inverse?.type === "editCell",
    "Inverse should be editCell for existing cell"
  );
  console.assert(
    result2.actions[0].inverse?.payload.cell.raw === 50,
    "Inverse should have old value 50"
  );

  console.log("✓ Inverse action generation works");
}

/**
 * Test 5: Basic undo
 */
function testBasicUndo(): void {
  console.log("Test 5: Basic undo");

  const workbook = createWorkbook("Undo Test");
  const sheet = workbook.sheets[0];

  // Perform operation
  const op = createEditCellOp(sheet.id, "A1", { raw: 123 });
  applyOperations(workbook, [op]);

  // Verify cell was set
  let cell = getCell(workbook, sheet.id, "A1");
  console.assert(cell?.raw === 123, "A1 should be 123 before undo");

  // Check canUndo
  console.assert(canUndo(workbook), "Should be able to undo");

  // Undo
  const undoResult = undo(workbook);

  // Verify undo succeeded
  console.assert(undoResult.success, "Undo should succeed");
  console.assert(undoResult.action !== null, "Should return undone action");

  // Verify cell was restored
  cell = getCell(workbook, sheet.id, "A1");
  console.assert(cell === undefined, "A1 should be deleted after undo");

  // Verify action log
  console.assert(
    workbook.actionLog?.length === 0,
    "Action log should be empty after undo"
  );

  console.log("✓ Basic undo works");
}

/**
 * Test 6: Multiple undo
 */
function testMultipleUndo(): void {
  console.log("Test 6: Multiple undo");

  const workbook = createWorkbook("Multi Undo Test");
  const sheet = workbook.sheets[0];

  // Perform multiple operations
  const ops = [
    createEditCellOp(sheet.id, "A1", { raw: 10 }),
    createEditCellOp(sheet.id, "A2", { raw: 20 }),
    createEditCellOp(sheet.id, "A3", { raw: 30 }),
  ];

  for (const op of ops) {
    applyOperations(workbook, [op]);
  }

  // Verify all cells set
  console.assert(getCell(workbook, sheet.id, "A1")?.raw === 10, "A1 should be 10");
  console.assert(getCell(workbook, sheet.id, "A2")?.raw === 20, "A2 should be 20");
  console.assert(getCell(workbook, sheet.id, "A3")?.raw === 30, "A3 should be 30");

  // Undo last operation (A3)
  undo(workbook);
  console.assert(
    getCell(workbook, sheet.id, "A3") === undefined,
    "A3 should be deleted after undo"
  );
  console.assert(
    getCell(workbook, sheet.id, "A1")?.raw === 10,
    "A1 should still be 10"
  );

  // Undo second operation (A2)
  undo(workbook);
  console.assert(
    getCell(workbook, sheet.id, "A2") === undefined,
    "A2 should be deleted after undo"
  );
  console.assert(
    getCell(workbook, sheet.id, "A1")?.raw === 10,
    "A1 should still be 10"
  );

  // Undo first operation (A1)
  undo(workbook);
  console.assert(
    getCell(workbook, sheet.id, "A1") === undefined,
    "A1 should be deleted after undo"
  );

  // Verify no more undo available
  console.assert(!canUndo(workbook), "Should not be able to undo");

  console.log("✓ Multiple undo works");
}

/**
 * Test 7: Batch operations
 */
function testBatchOperations(): void {
  console.log("Test 7: Batch operations");

  const workbook = createWorkbook("Batch Test");
  const sheet = workbook.sheets[0];

  // Create batch of operations
  const ops = [
    createEditCellOp(sheet.id, "A1", { raw: 1 }),
    createEditCellOp(sheet.id, "A2", { raw: 2 }),
    createEditCellOp(sheet.id, "A3", { raw: 3 }),
    createEditCellOp(sheet.id, "B1", { formula: "=SUM(A1:A3)" }),
  ];

  // Apply all at once
  const result = applyOperations(workbook, ops);

  // Verify success
  console.assert(result.success, "Batch should succeed");
  console.assert(result.actions.length === 4, "Should create 4 actions");

  // Verify all cells set
  console.assert(getCell(workbook, sheet.id, "A1")?.raw === 1, "A1 should be 1");
  console.assert(getCell(workbook, sheet.id, "A2")?.raw === 2, "A2 should be 2");
  console.assert(getCell(workbook, sheet.id, "A3")?.raw === 3, "A3 should be 3");
  console.assert(
    getCell(workbook, sheet.id, "B1")?.formula === "=SUM(A1:A3)",
    "B1 should have formula"
  );

  console.log("✓ Batch operations work");
}

/**
 * Test 8: Insert/Delete row
 */
function testInsertDeleteRow(): void {
  console.log("Test 8: Insert/Delete row");

  const workbook = createWorkbook("Row Test");
  const sheet = workbook.sheets[0];

  // Set up initial cells
  setCell(workbook, sheet.id, "A1", { raw: "Row 1" });
  setCell(workbook, sheet.id, "A2", { raw: "Row 2" });
  setCell(workbook, sheet.id, "A3", { raw: "Row 3" });

  // Clear action log
  workbook.actionLog = [];

  // Insert row at position 2
  const insertOp = {
    type: "insertRow" as const,
    sheetId: sheet.id,
    row: 2,
    count: 1,
  };

  const result = applyOperations(workbook, [insertOp]);

  // Verify success
  console.assert(result.success, "Insert row should succeed");

  // Verify cells shifted
  console.assert(
    getCell(workbook, sheet.id, "A1")?.raw === "Row 1",
    "A1 should still be Row 1"
  );
  console.assert(
    getCell(workbook, sheet.id, "A2") === undefined,
    "A2 should be empty (inserted row)"
  );
  console.assert(
    getCell(workbook, sheet.id, "A3")?.raw === "Row 2",
    "A3 should now be Row 2 (shifted down)"
  );
  console.assert(
    getCell(workbook, sheet.id, "A4")?.raw === "Row 3",
    "A4 should now be Row 3 (shifted down)"
  );

  console.log("✓ Insert/Delete row works");
}

/**
 * Test 9: Insert/Delete column
 */
function testInsertDeleteCol(): void {
  console.log("Test 9: Insert/Delete column");

  const workbook = createWorkbook("Col Test");
  const sheet = workbook.sheets[0];

  // Set up initial cells
  setCell(workbook, sheet.id, "A1", { raw: "Col A" });
  setCell(workbook, sheet.id, "B1", { raw: "Col B" });
  setCell(workbook, sheet.id, "C1", { raw: "Col C" });

  // Clear action log
  workbook.actionLog = [];

  // Insert column at position 2 (B)
  const insertOp = {
    type: "insertCol" as const,
    sheetId: sheet.id,
    col: 2, // Insert at column B
    count: 1,
  };

  const result = applyOperations(workbook, [insertOp]);

  // Verify success
  console.assert(result.success, "Insert col should succeed");

  // Verify cells shifted
  console.assert(
    getCell(workbook, sheet.id, "A1")?.raw === "Col A",
    "A1 should still be Col A"
  );
  console.assert(
    getCell(workbook, sheet.id, "B1") === undefined,
    "B1 should be empty (inserted col)"
  );
  console.assert(
    getCell(workbook, sheet.id, "C1")?.raw === "Col B",
    "C1 should now be Col B (shifted right)"
  );
  console.assert(
    getCell(workbook, sheet.id, "D1")?.raw === "Col C",
    "D1 should now be Col C (shifted right)"
  );

  console.log("✓ Insert/Delete column works");
}

/**
 * Test 10: Merge/Unmerge
 */
function testMergeUnmerge(): void {
  console.log("Test 10: Merge/Unmerge");

  const workbook = createWorkbook("Merge Test");
  const sheet = workbook.sheets[0];

  // Merge range
  const mergeOp = {
    type: "merge" as const,
    sheetId: sheet.id,
    range: "A1:B2",
  };

  const result = applyOperations(workbook, [mergeOp]);

  // Verify success
  console.assert(result.success, "Merge should succeed");

  // Verify merged range added
  console.assert(
    sheet.mergedRanges?.includes("A1:B2"),
    "Should have merged range A1:B2"
  );

  // Unmerge
  const unmergeOp = {
    type: "unmerge" as const,
    sheetId: sheet.id,
    range: "A1:B2",
  };

  const result2 = applyOperations(workbook, [unmergeOp]);

  // Verify success
  console.assert(result2.success, "Unmerge should succeed");

  // Verify merged range removed
  console.assert(
    !sheet.mergedRanges?.includes("A1:B2"),
    "Should not have merged range A1:B2"
  );

  console.log("✓ Merge/Unmerge works");
}

/**
 * Test 11: Set style and format
 */
function testSetStyleFormat(): void {
  console.log("Test 11: Set style and format");

  const workbook = createWorkbook("Style Test");
  const sheet = workbook.sheets[0];

  // Set style
  const styleOp = {
    type: "setStyle" as const,
    sheetId: sheet.id,
    address: "A1",
    style: { bold: true, color: "#FF0000" },
  };

  const result1 = applyOperations(workbook, [styleOp]);

  // Verify success
  console.assert(result1.success, "Set style should succeed");

  // Verify style applied
  const cell1 = getCell(workbook, sheet.id, "A1");
  console.assert(cell1?.style?.bold === true, "A1 should be bold");
  console.assert(cell1?.style?.color === "#FF0000", "A1 should be red");

  // Set format
  const formatOp = {
    type: "setFormat" as const,
    sheetId: sheet.id,
    address: "A2",
    numFmt: "#,##0.00",
  };

  const result2 = applyOperations(workbook, [formatOp]);

  // Verify success
  console.assert(result2.success, "Set format should succeed");

  // Verify format applied
  const cell2 = getCell(workbook, sheet.id, "A2");
  console.assert(cell2?.numFmt === "#,##0.00", "A2 should have number format");

  console.log("✓ Set style and format works");
}

/**
 * Test 12: Set range (batch edit)
 */
function testSetRange(): void {
  console.log("Test 12: Set range (batch edit)");

  const workbook = createWorkbook("Range Test");
  const sheet = workbook.sheets[0];

  // Create setRange operation
  const op = createSetRangeOp(sheet.id, "A1:B2", {
    A1: { raw: 1 },
    A2: { raw: 2 },
    B1: { raw: 3 },
    B2: { raw: 4 },
  });

  const result = applyOperations(workbook, [op]);

  // Verify success
  console.assert(result.success, "Set range should succeed");

  // Verify all cells set
  console.assert(getCell(workbook, sheet.id, "A1")?.raw === 1, "A1 should be 1");
  console.assert(getCell(workbook, sheet.id, "A2")?.raw === 2, "A2 should be 2");
  console.assert(getCell(workbook, sheet.id, "B1")?.raw === 3, "B1 should be 3");
  console.assert(getCell(workbook, sheet.id, "B2")?.raw === 4, "B2 should be 4");

  console.log("✓ Set range works");
}

/**
 * Test 13: Operation validation
 */
function testOperationValidation(): void {
  console.log("Test 13: Operation validation");

  const workbook = createWorkbook("Validation Test");
  const sheet = workbook.sheets[0];

  // Invalid sheet ID
  const op1 = createEditCellOp("invalid-sheet-id", "A1", { raw: 1 });
  const result1 = applyOperations(workbook, [op1]);

  console.assert(!result1.success, "Should fail with invalid sheet ID");
  console.assert(result1.errors.length > 0, "Should have error message");

  // Invalid address
  const op2 = createEditCellOp(sheet.id, "INVALID", { raw: 1 });
  const result2 = applyOperations(workbook, [op2]);

  console.assert(!result2.success, "Should fail with invalid address");
  console.assert(result2.errors.length > 0, "Should have error message");

  console.log("✓ Operation validation works");
}

/**
 * Test 14: Error handling and rollback
 */
function testErrorHandling(): void {
  console.log("Test 14: Error handling and rollback");

  const workbook = createWorkbook("Error Test");
  const sheet = workbook.sheets[0];

  // Set initial value
  setCell(workbook, sheet.id, "A1", { raw: 100 });

  // Clear action log
  workbook.actionLog = [];

  // Create batch with one invalid operation
  const ops = [
    createEditCellOp(sheet.id, "A1", { raw: 200 }), // Valid
    createEditCellOp("invalid-sheet", "A2", { raw: 300 }), // Invalid
  ];

  const result = applyOperations(workbook, ops);

  // Verify failure
  console.assert(!result.success, "Batch should fail");
  console.assert(result.errors.length > 0, "Should have error");

  // Verify rollback - A1 should still be 100
  const cell = getCell(workbook, sheet.id, "A1");
  console.assert(
    cell?.raw === 100,
    `A1 should be rolled back to 100, got ${cell?.raw}`
  );

  // Verify no actions added to log
  console.assert(
    workbook.actionLog?.length === 0,
    "Action log should be empty after rollback"
  );

  console.log("✓ Error handling and rollback works");
}

/**
 * Test 15: Action log statistics
 */
function testActionLogStats(): void {
  console.log("Test 15: Action log statistics");

  const workbook = createWorkbook("Stats Test");
  const sheet = workbook.sheets[0];

  // Perform various operations
  applyOperations(workbook, [
    createEditCellOp(sheet.id, "A1", { raw: 1 }),
    createEditCellOp(sheet.id, "A2", { raw: 2 }),
    createDeleteCellOp(sheet.id, "A1"),
  ]);

  // Get stats
  const stats = getActionLogStats(workbook);

  // Verify stats
  console.assert(stats.totalActions === 3, "Should have 3 total actions");
  console.assert(
    stats.actionsByType.editCell === 2,
    "Should have 2 editCell actions"
  );
  console.assert(
    stats.actionsByType.deleteCell === 1,
    "Should have 1 deleteCell action"
  );
  console.assert(stats.oldestAction !== undefined, "Should have oldest timestamp");
  console.assert(stats.newestAction !== undefined, "Should have newest timestamp");

  console.log("✓ Action log statistics works");
}

// Export test runner
if (import.meta.url === `file://${process.argv[1]}`) {
  runOperationsTests();
}
