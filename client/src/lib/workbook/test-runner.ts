/**
 * Test runner for workbook round-trip tests
 * 
 * Usage in browser console:
 * import('./src/lib/workbook/test-runner.ts').then(m => m.runTests())
 * 
 * Or add to dev app temporarily for visual testing
 */

import { runRoundTripTest, runExcelJSRoundTripTest } from "./roundtrip.test";

export async function runTests() {
  console.log("Starting workbook round-trip tests...\n");
  
  try {
    // Test 1: SheetJS adapter
    const sheetjsSuccess = await runRoundTripTest();
    
    console.log("\n" + "=".repeat(70));
    console.log("\n");
    
    // Test 2: ExcelJS adapter
    const exceljsSuccess = await runExcelJSRoundTripTest();
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("FINAL SUMMARY");
    console.log("=".repeat(70));
    console.log(`SheetJS Adapter:  ${sheetjsSuccess ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`ExcelJS Adapter:  ${exceljsSuccess ? "✅ PASSED" : "❌ FAILED"}`);
    console.log("=".repeat(70));
    
    const allSuccess = sheetjsSuccess && exceljsSuccess;
    
    if (allSuccess) {
      console.log("\n✅ ALL TESTS PASSED - Both adapters ready!");
    } else {
      console.log("\n❌ SOME TESTS FAILED - Review errors above");
    }
    
    return allSuccess;
  } catch (error) {
    console.error("\n❌ Fatal error running tests:");
    console.error(error);
    return false;
  }
}

// Auto-run when imported
runTests();
