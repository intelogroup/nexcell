/**
 * Node.js test runner for round-trip tests
 * Run with: node run-roundtrip-test.js
 */

async function runTests() {
  try {
    // Import the test module
    const { runRoundTripTest, runExcelJSRoundTripTest } = await import('./roundtrip.test.ts');
    
    console.log("Starting workbook round-trip tests...\n");
    
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
      process.exit(0);
    } else {
      console.log("\n❌ SOME TESTS FAILED - Review errors above");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error running tests:");
    console.error(error);
    process.exit(1);
  }
}

runTests();
