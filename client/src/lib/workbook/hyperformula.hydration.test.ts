/**
 * HyperFormula Hydration Tests
 * 
 * Tests for the hydrateHFFromWorkbook function to ensure proper
 * sheet creation, mapping, and error handling.
 */

import { createWorkbook, addSheet } from "./utils";
import { hydrateHFFromWorkbook, disposeHF } from "./hyperformula";
import type { WorkbookJSON } from "./types";

/**
 * Test 1: Hydrate with single sheet (default)
 */
export function testSingleSheetHydration(): void {
  console.log("\n=== Test 1: Single Sheet Hydration ===");
  
  const workbook = createWorkbook("Single Sheet Test");
  
  try {
    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);
    
    // Verify HF was created
    if (!hf) throw new Error("HF instance not created");
    
    // Verify sheet names
    const sheetNames = hf.getSheetNames();
    if (sheetNames.length !== 1) {
      throw new Error(`Expected 1 sheet, got ${sheetNames.length}`);
    }
    
    if (sheetNames[0] !== workbook.sheets[0].name) {
      throw new Error(`Sheet name mismatch: expected "${workbook.sheets[0].name}", got "${sheetNames[0]}"`);
    }
    
    // Verify sheet mapping
    const hfSheetId = sheetMap.get(workbook.sheets[0].id);
    if (hfSheetId === undefined) {
      throw new Error("Sheet ID not mapped to HF");
    }
    
    console.log("✓ Single sheet hydrated correctly");
    console.log(`  - Sheet name: ${sheetNames[0]}`);
    console.log(`  - HF sheet ID: ${hfSheetId}`);
    console.log(`  - Warnings: ${warnings.length}`);
    
    // Cleanup
    disposeHF(hf);
  } catch (error) {
    console.error("✗ Single sheet hydration failed:", error);
    throw error;
  }
}

/**
 * Test 2: Hydrate with multiple sheets
 */
export function testMultipleSheetHydration(): void {
  console.log("\n=== Test 2: Multiple Sheet Hydration ===");
  
  const workbook = createWorkbook("Multi Sheet Test");
  addSheet(workbook, "Second Sheet");
  addSheet(workbook, "Third Sheet");
  
  try {
    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);
    
    // Verify HF was created
    if (!hf) throw new Error("HF instance not created");
    
    // Verify sheet count
    const sheetNames = hf.getSheetNames();
    if (sheetNames.length !== 3) {
      throw new Error(`Expected 3 sheets, got ${sheetNames.length}`);
    }
    
    // Verify sheet names match in order
    for (let i = 0; i < workbook.sheets.length; i++) {
      const expectedName = workbook.sheets[i].name;
      const actualName = sheetNames[i];
      
      if (expectedName !== actualName) {
        throw new Error(`Sheet ${i} name mismatch: expected "${expectedName}", got "${actualName}"`);
      }
      
      // Verify mapping
      const hfSheetId = sheetMap.get(workbook.sheets[i].id);
      if (hfSheetId === undefined) {
        throw new Error(`Sheet ${i} (${expectedName}) not mapped to HF`);
      }
    }
    
    console.log("✓ Multiple sheets hydrated correctly");
    console.log(`  - Total sheets: ${sheetNames.length}`);
    console.log(`  - Sheet names: ${sheetNames.join(", ")}`);
    console.log(`  - Warnings: ${warnings.length}`);
    
    // Cleanup
    disposeHF(hf);
  } catch (error) {
    console.error("✗ Multiple sheet hydration failed:", error);
    throw error;
  }
}

/**
 * Test 3: Hydrate with empty workbook (should throw)
 */
export function testEmptyWorkbookHydration(): void {
  console.log("\n=== Test 3: Empty Workbook Hydration (Should Fail) ===");
  
  const emptyWorkbook: WorkbookJSON = {
    version: "1.0.0",
    meta: {
      title: "Empty Workbook",
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      author: "Test",
    },
    sheets: [], // Empty sheets array
    namedRanges: {},
    globalSettings: {
      defaultRowHeight: 21,
      defaultColWidth: 100,
      firstSheet: 0,
      activeTab: 0,
    },
  };
  
  try {
    const { hf } = hydrateHFFromWorkbook(emptyWorkbook);
    disposeHF(hf);
    
    console.error("✗ Empty workbook should have thrown an error");
    throw new Error("Expected error for empty workbook, but none was thrown");
  } catch (error: any) {
    if (error.message?.includes("workbook has no sheets")) {
      console.log("✓ Empty workbook correctly rejected");
      console.log(`  - Error: ${error.message}`);
    } else {
      console.error("✗ Wrong error thrown:", error);
      throw error;
    }
  }
}

/**
 * Test 4: Hydrate with cells and formulas
 */
export function testHydrationWithCells(): void {
  console.log("\n=== Test 4: Hydration with Cells and Formulas ===");
  
  const workbook = createWorkbook("Cells Test");
  const sheet = workbook.sheets[0];
  
  // Add some cells with values and formulas
  sheet.cells = {
    A1: { raw: 10 },
    A2: { raw: 20 },
    A3: { formula: "=A1+A2" },
    B1: { raw: "Hello" },
    B2: { raw: "World" },
    B3: { formula: '=CONCATENATE(B1," ",B2)' },
  };
  
  try {
    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);
    
    // Verify HF was created
    if (!hf) throw new Error("HF instance not created");
    
    const hfSheetId = sheetMap.get(sheet.id);
    if (hfSheetId === undefined) {
      throw new Error("Sheet not mapped to HF");
    }
    
    // Verify cell values
    const a1Value = hf.getCellValue({ sheet: hfSheetId, row: 0, col: 0 });
    const a2Value = hf.getCellValue({ sheet: hfSheetId, row: 1, col: 0 });
    const a3Value = hf.getCellValue({ sheet: hfSheetId, row: 2, col: 0 });
    
    if (a1Value !== 10) {
      throw new Error(`A1 value mismatch: expected 10, got ${a1Value}`);
    }
    if (a2Value !== 20) {
      throw new Error(`A2 value mismatch: expected 20, got ${a2Value}`);
    }
    if (a3Value !== 30) {
      throw new Error(`A3 formula result mismatch: expected 30, got ${a3Value}`);
    }
    
    console.log("✓ Cells and formulas hydrated correctly");
    console.log(`  - A1: ${a1Value}`);
    console.log(`  - A2: ${a2Value}`);
    console.log(`  - A3: ${a3Value} (formula: =A1+A2)`);
    console.log(`  - Warnings: ${warnings.length}`);
    
    // Cleanup
    disposeHF(hf);
  } catch (error) {
    console.error("✗ Cell hydration failed:", error);
    throw error;
  }
}

/**
 * Test 5: Hydrate with special characters in sheet names
 */
export function testSpecialCharactersInSheetNames(): void {
  console.log("\n=== Test 5: Special Characters in Sheet Names ===");
  
  const workbook = createWorkbook("Test");
  workbook.sheets[0].name = "Sheet-1";
  addSheet(workbook, "Sheet_2");
  addSheet(workbook, "Sheet 3");
  addSheet(workbook, "Sheet's Data");
  
  try {
    const { hf, sheetMap, warnings } = hydrateHFFromWorkbook(workbook);
    
    // Verify HF was created
    if (!hf) throw new Error("HF instance not created");
    
    const sheetNames = hf.getSheetNames();
    
    // Verify all sheets were created
    if (sheetNames.length !== 4) {
      throw new Error(`Expected 4 sheets, got ${sheetNames.length}`);
    }
    
    console.log("✓ Special characters in sheet names handled correctly");
    console.log(`  - Sheet names: ${sheetNames.join(", ")}`);
    console.log(`  - Warnings: ${warnings.length}`);
    
    // Cleanup
    disposeHF(hf);
  } catch (error) {
    console.error("✗ Special character test failed:", error);
    throw error;
  }
}

/**
 * Run all HyperFormula hydration tests
 */
export function runHyperFormulaHydrationTests(): void {
  console.log("🧪 Running HyperFormula Hydration Tests...");
  
  try {
    testSingleSheetHydration();
    testMultipleSheetHydration();
    testEmptyWorkbookHydration();
    testHydrationWithCells();
    testSpecialCharactersInSheetNames();
    
    console.log("\n✅ All HyperFormula hydration tests passed!");
  } catch (error) {
    console.error("\n❌ HyperFormula hydration tests failed!");
    throw error;
  }
}

// Auto-run tests if loaded in browser console
if (typeof window !== "undefined") {
  (window as any).runHyperFormulaHydrationTests = runHyperFormulaHydrationTests;
  (window as any).testSingleSheetHydration = testSingleSheetHydration;
  (window as any).testMultipleSheetHydration = testMultipleSheetHydration;
  (window as any).testEmptyWorkbookHydration = testEmptyWorkbookHydration;
  (window as any).testHydrationWithCells = testHydrationWithCells;
  (window as any).testSpecialCharactersInSheetNames = testSpecialCharactersInSheetNames;
}
