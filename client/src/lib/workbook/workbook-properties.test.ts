/**
 * Workbook Properties Test
 * Verify that workbookProperties are properly initialized and used
 */

import { createWorkbook, addSheet, cloneWorkbook } from "./utils";
import type { WorkbookJSON } from "./types";

/**
 * Test 1: Verify workbookProperties initialization
 */
function testWorkbookPropertiesInit(): void {
  console.log("\n=== Test 1: WorkbookProperties Initialization ===");
  
  const wb = createWorkbook("Test Workbook");
  
  // Verify workbookProperties exists
  if (!wb.workbookProperties) {
    throw new Error("workbookProperties not initialized");
  }
  
  // Verify default values
  console.assert(
    wb.workbookProperties.defaultRowHeight === 21,
    `Expected defaultRowHeight=21, got ${wb.workbookProperties.defaultRowHeight}`
  );
  
  console.assert(
    wb.workbookProperties.defaultColWidth === 100,
    `Expected defaultColWidth=100, got ${wb.workbookProperties.defaultColWidth}`
  );
  
  // Verify workbookView
  if (!wb.workbookProperties.workbookView) {
    throw new Error("workbookView not initialized");
  }
  
  console.assert(
    wb.workbookProperties.workbookView.firstSheet === 0,
    `Expected firstSheet=0, got ${wb.workbookProperties.workbookView.firstSheet}`
  );
  
  console.assert(
    wb.workbookProperties.workbookView.activeTab === 0,
    `Expected activeTab=0, got ${wb.workbookProperties.workbookView.activeTab}`
  );
  
  console.log("✓ workbookProperties initialized correctly");
  console.log("  - defaultRowHeight:", wb.workbookProperties.defaultRowHeight);
  console.log("  - defaultColWidth:", wb.workbookProperties.defaultColWidth);
  console.log("  - firstSheet:", wb.workbookProperties.workbookView.firstSheet);
  console.log("  - activeTab:", wb.workbookProperties.workbookView.activeTab);
}

/**
 * Test 2: Verify workbookProperties persist through clone
 */
function testWorkbookPropertiesClone(): void {
  console.log("\n=== Test 2: WorkbookProperties Clone ===");
  
  const wb = createWorkbook("Original");
  const cloned = cloneWorkbook(wb);
  
  // Verify properties persist
  if (!cloned.workbookProperties) {
    throw new Error("workbookProperties not cloned");
  }
  
  console.assert(
    cloned.workbookProperties.defaultRowHeight === 21,
    "defaultRowHeight not preserved in clone"
  );
  
  console.assert(
    cloned.workbookProperties.defaultColWidth === 100,
    "defaultColWidth not preserved in clone"
  );
  
  console.assert(
    cloned.workbookProperties.workbookView?.firstSheet === 0,
    "workbookView not preserved in clone"
  );
  
  console.log("✓ workbookProperties preserved through clone");
}

/**
 * Test 3: Verify workbookProperties can be modified
 */
function testWorkbookPropertiesModification(): void {
  console.log("\n=== Test 3: WorkbookProperties Modification ===");
  
  const wb = createWorkbook("Test");
  
  // Modify properties
  wb.workbookProperties!.defaultRowHeight = 25;
  wb.workbookProperties!.defaultColWidth = 120;
  wb.workbookProperties!.workbookView!.activeTab = 1;
  
  // Verify changes
  console.assert(
    wb.workbookProperties!.defaultRowHeight === 25,
    "defaultRowHeight not updated"
  );
  
  console.assert(
    wb.workbookProperties!.defaultColWidth === 120,
    "defaultColWidth not updated"
  );
  
  console.assert(
    wb.workbookProperties!.workbookView!.activeTab === 1,
    "activeTab not updated"
  );
  
  console.log("✓ workbookProperties can be modified");
  console.log("  - New defaultRowHeight:", wb.workbookProperties!.defaultRowHeight);
  console.log("  - New defaultColWidth:", wb.workbookProperties!.defaultColWidth);
  console.log("  - New activeTab:", wb.workbookProperties!.workbookView!.activeTab);
}

/**
 * Test 4: Verify activeTab updates when adding sheets
 */
function testWorkbookPropertiesWithMultipleSheets(): void {
  console.log("\n=== Test 4: WorkbookProperties with Multiple Sheets ===");
  
  const wb = createWorkbook("Multi-sheet Test");
  
  // Add more sheets
  addSheet(wb, "Sheet2");
  addSheet(wb, "Sheet3");
  
  console.assert(
    wb.sheets.length === 3,
    `Expected 3 sheets, got ${wb.sheets.length}`
  );
  
  // Update activeTab to point to second sheet
  wb.workbookProperties!.workbookView!.activeTab = 1;
  
  console.assert(
    wb.workbookProperties!.workbookView!.activeTab === 1,
    "activeTab not set to second sheet"
  );
  
  // Verify firstSheet remains 0
  console.assert(
    wb.workbookProperties!.workbookView!.firstSheet === 0,
    "firstSheet should remain 0"
  );
  
  console.log("✓ workbookProperties work correctly with multiple sheets");
  console.log("  - Total sheets:", wb.sheets.length);
  console.log("  - Active tab:", wb.workbookProperties!.workbookView!.activeTab);
}

/**
 * Test 5: Verify JSON serialization/deserialization
 */
function testWorkbookPropertiesSerialization(): void {
  console.log("\n=== Test 5: WorkbookProperties Serialization ===");
  
  const wb = createWorkbook("Serialization Test");
  
  // Serialize to JSON
  const json = JSON.stringify(wb);
  
  // Deserialize
  const parsed: WorkbookJSON = JSON.parse(json);
  
  // Verify workbookProperties survived
  if (!parsed.workbookProperties) {
    throw new Error("workbookProperties lost in serialization");
  }
  
  console.assert(
    parsed.workbookProperties.defaultRowHeight === 21,
    "defaultRowHeight lost in serialization"
  );
  
  console.assert(
    parsed.workbookProperties.defaultColWidth === 100,
    "defaultColWidth lost in serialization"
  );
  
  console.assert(
    parsed.workbookProperties.workbookView?.firstSheet === 0,
    "workbookView lost in serialization"
  );
  
  console.log("✓ workbookProperties survive JSON serialization");
  console.log("  - Serialized size:", json.length, "bytes");
}

/**
 * Run all tests
 */
export function runWorkbookPropertiesTests(): void {
  console.log("\n🧪 Running Workbook Properties Tests...\n");
  
  try {
    testWorkbookPropertiesInit();
    testWorkbookPropertiesClone();
    testWorkbookPropertiesModification();
    testWorkbookPropertiesWithMultipleSheets();
    testWorkbookPropertiesSerialization();
    
    console.log("\n✅ All workbook properties tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  }
}

// Auto-run if imported in browser console
if (typeof window !== "undefined") {
  runWorkbookPropertiesTests();
}
