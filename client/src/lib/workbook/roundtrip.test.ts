/**
 * Round-Trip Test: SheetJS Export/Import
 * 
 * THE critical test - verifies that formulas, values, merges, and structure
 * survive export -> import cycle without data loss.
 * 
 * This test MUST pass before shipping any export functionality.
 */

import {
  createWorkbook,
  setCell,
  getCell,
  SheetJSAdapter,
  type WorkbookJSON,
  type Cell,
} from "./index";

// ============================================================================
// Test Data Setup
// ============================================================================

function createTestWorkbook(): WorkbookJSON {
  const wb = createWorkbook("RoundTrip Test");
  const sheet = wb.sheets[0];
  sheet.name = "TestSheet";

  // === Test Case 0: Workbook properties ===
  wb.workbookProperties = {
    defaultRowHeight: 25,
    defaultColWidth: 120,
    workbookView: {
      firstSheet: 0,
      activeTab: 0,
    },
  };

  // === Test Case 0b: Sheet properties ===
  sheet.properties = {
    freeze: {
      row: 1,  // Freeze first row
      col: 2,  // Freeze first two columns
    },
    zoom: 85,
    tabColor: "FF0000",
    gridLines: true,
  };

  // === Test Case 1: Simple formulas with computed values ===
  setCell(wb, sheet.id, "A1", {
    raw: "Value 1",
    dataType: "string",
  });

  setCell(wb, sheet.id, "A2", {
    raw: 10,
    dataType: "number",
  });

  setCell(wb, sheet.id, "A3", {
    raw: 20,
    dataType: "number",
  });

  setCell(wb, sheet.id, "A4", {
    formula: "=A2+A3",
    dataType: "formula",
    computed: {
      v: 30,
      t: "n",
      ts: new Date().toISOString(),
    },
  });

  // === Test Case 2: Complex formulas ===
  setCell(wb, sheet.id, "B1", {
    raw: "Value 2",
    dataType: "string",
  });

  setCell(wb, sheet.id, "B2", {
    raw: 5,
    dataType: "number",
  });

  setCell(wb, sheet.id, "B3", {
    raw: 15,
    dataType: "number",
  });

  setCell(wb, sheet.id, "B4", {
    formula: "=SUM(B2:B3)",
    dataType: "formula",
    computed: {
      v: 20,
      t: "n",
      ts: new Date().toISOString(),
    },
  });

  // === Test Case 3: Formula referencing other formulas ===
  setCell(wb, sheet.id, "C4", {
    formula: "=A4*B4",
    dataType: "formula",
    computed: {
      v: 600, // 30 * 20
      t: "n",
      ts: new Date().toISOString(),
    },
  });

  // === Test Case 4: String formulas ===
  setCell(wb, sheet.id, "D1", {
    raw: "First",
    dataType: "string",
  });

  setCell(wb, sheet.id, "D2", {
    raw: "Name",
    dataType: "string",
  });

  setCell(wb, sheet.id, "D3", {
    formula: '=D1&" "&D2',
    dataType: "formula",
    computed: {
      v: "First Name",
      t: "s",
      ts: new Date().toISOString(),
    },
  });

  // === Test Case 5: Boolean and conditional formulas ===
  setCell(wb, sheet.id, "E2", {
    raw: 100,
    dataType: "number",
  });

  setCell(wb, sheet.id, "E3", {
    formula: "=E2>50",
    dataType: "formula",
    computed: {
      v: true,
      t: "b",
      ts: new Date().toISOString(),
    },
  });

  setCell(wb, sheet.id, "E4", {
    formula: "=IF(E3,\"Pass\",\"Fail\")",
    dataType: "formula",
    computed: {
      v: "Pass",
      t: "s",
      ts: new Date().toISOString(),
    },
  });

  // === Test Case 6: Number formats ===
  setCell(wb, sheet.id, "F1", {
    raw: "Formatted",
    dataType: "string",
  });

  setCell(wb, sheet.id, "F2", {
    raw: 1234.5678,
    dataType: "number",
    numFmt: "#,##0.00",
  });

  setCell(wb, sheet.id, "F3", {
    raw: 0.15,
    dataType: "number",
    numFmt: "0.00%",
  });

  // === Test Case 7: Merged ranges ===
  sheet.mergedRanges = ["A1:B1", "D1:D2"];

  // === Test Case 8: Column widths ===
  sheet.cols = {
    1: { width: 150 }, // Column A
    2: { width: 100 }, // Column B
    3: { width: 120 }, // Column C
    4: { width: 80, hidden: false }, // Column D
  };

  // === Test Case 9: Row heights ===
  sheet.rows = {
    1: { height: 30 }, // Header row
    2: { height: 21 }, // Default
    3: { height: 25 },
    4: { height: 21 },
  };

  return wb;
}

// ============================================================================
// Verification Functions
// ============================================================================

interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}

function verifyCell(
  original: Cell | undefined,
  imported: Cell | undefined,
  address: string
): TestResult {
  if (!original && !imported) {
    return { passed: true, message: `${address}: Both empty (OK)` };
  }

  if (!original) {
    return { passed: false, message: `${address}: Original missing`, details: imported };
  }

  if (!imported) {
    return { passed: false, message: `${address}: Imported missing`, details: original };
  }

  // Check formula preservation (most critical)
  if (original.formula !== imported.formula) {
    return {
      passed: false,
      message: `${address}: Formula mismatch`,
      details: {
        original: original.formula,
        imported: imported.formula,
      },
    };
  }

  // Check computed value preservation (f + v pattern)
  if (original.formula && original.computed) {
    if (!imported.computed) {
      return {
        passed: false,
        message: `${address}: Computed value missing`,
        details: { original: original.computed },
      };
    }

    if (original.computed.v !== imported.computed.v) {
      return {
        passed: false,
        message: `${address}: Computed value mismatch`,
        details: {
          original: original.computed.v,
          imported: imported.computed.v,
        },
      };
    }

    if (original.computed.t !== imported.computed.t) {
      return {
        passed: false,
        message: `${address}: Computed type mismatch`,
        details: {
          original: original.computed.t,
          imported: imported.computed.t,
        },
      };
    }
  }

  // Check raw value preservation (for non-formula cells)
  if (!original.formula && original.raw !== imported.raw) {
    return {
      passed: false,
      message: `${address}: Raw value mismatch`,
      details: {
        original: original.raw,
        imported: imported.raw,
      },
    };
  }

  // Check number format preservation
  if (original.numFmt !== imported.numFmt) {
    return {
      passed: false,
      message: `${address}: Number format mismatch`,
      details: {
        original: original.numFmt,
        imported: imported.numFmt,
      },
    };
  }

  return { passed: true, message: `${address}: ✓` };
}

function verifyMerges(
  original: string[],
  imported: string[]
): TestResult {
  if (original.length !== imported.length) {
    return {
      passed: false,
      message: "Merged ranges count mismatch",
      details: {
        original: original.length,
        imported: imported.length,
      },
    };
  }

  // Sort to ensure order doesn't matter
  const sortedOriginal = [...original].sort();
  const sortedImported = [...imported].sort();

  for (let i = 0; i < sortedOriginal.length; i++) {
    if (sortedOriginal[i] !== sortedImported[i]) {
      return {
        passed: false,
        message: "Merged range mismatch",
        details: {
          original: sortedOriginal[i],
          imported: sortedImported[i],
        },
      };
    }
  }

  return { passed: true, message: "Merges: ✓" };
}

function verifyColWidths(
  original: Record<number, { width?: number; hidden?: boolean }>,
  imported: Record<number, { width?: number; hidden?: boolean }>
): TestResult {
  const originalCols = Object.keys(original).map(Number).sort((a, b) => a - b);

  // Check if key columns exist (allow some tolerance for default widths)
  for (const colNum of originalCols) {
    const origWidth = original[colNum]?.width;
    const impWidth = imported[colNum]?.width;

    // Only check if original has explicit width
    if (origWidth && impWidth) {
      // Allow 10% tolerance due to unit conversion (pixels <-> character width)
      const diff = Math.abs(origWidth - impWidth);
      const tolerance = origWidth * 0.15;

      if (diff > tolerance) {
        return {
          passed: false,
          message: `Column ${colNum} width mismatch`,
          details: {
            original: origWidth,
            imported: impWidth,
            diff,
            tolerance,
          },
        };
      }
    }
  }

  return { passed: true, message: "Column widths: ✓" };
}

function verifyRowHeights(
  original: Record<number, { height?: number; hidden?: boolean }>,
  imported: Record<number, { height?: number; hidden?: boolean }>
): TestResult {
  const originalRows = Object.keys(original).map(Number).sort((a, b) => a - b);

  for (const rowNum of originalRows) {
    const origHeight = original[rowNum]?.height;
    const impHeight = imported[rowNum]?.height;

    if (origHeight && impHeight) {
      // Allow small tolerance for height
      const diff = Math.abs(origHeight - impHeight);
      if (diff > 2) {
        return {
          passed: false,
          message: `Row ${rowNum} height mismatch`,
          details: {
            original: origHeight,
            imported: impHeight,
          },
        };
      }
    }
  }

  return { passed: true, message: "Row heights: ✓" };
}

function verifyWorkbookProperties(
  original: WorkbookJSON,
  imported: WorkbookJSON
): TestResult {
  const origProps = original.workbookProperties;
  const impProps = imported.workbookProperties;

  if (!origProps && !impProps) {
    return { passed: true, message: "Workbook properties: ✓ (both undefined)" };
  }

  if (!origProps || !impProps) {
    return {
      passed: false,
      message: "Workbook properties: missing",
      details: {
        original: origProps,
        imported: impProps,
      },
    };
  }

  // Check defaultRowHeight
  if (origProps.defaultRowHeight !== impProps.defaultRowHeight) {
    return {
      passed: false,
      message: "Workbook properties: defaultRowHeight mismatch",
      details: {
        original: origProps.defaultRowHeight,
        imported: impProps.defaultRowHeight,
      },
    };
  }

  // Check defaultColWidth (allow 15% tolerance for unit conversion)
  if (origProps.defaultColWidth && impProps.defaultColWidth) {
    const diff = Math.abs(origProps.defaultColWidth - impProps.defaultColWidth);
    const tolerance = origProps.defaultColWidth * 0.15;
    if (diff > tolerance) {
      return {
        passed: false,
        message: "Workbook properties: defaultColWidth mismatch",
        details: {
          original: origProps.defaultColWidth,
          imported: impProps.defaultColWidth,
          diff,
          tolerance,
        },
      };
    }
  }

  // Check workbookView.activeTab
  const origActiveTab = origProps.workbookView?.activeTab;
  const impActiveTab = impProps.workbookView?.activeTab;
  if (origActiveTab !== impActiveTab) {
    return {
      passed: false,
      message: "Workbook properties: activeTab mismatch",
      details: {
        original: origActiveTab,
        imported: impActiveTab,
      },
    };
  }

  return { passed: true, message: "Workbook properties: ✓" };
}

function verifySheetProperties(
  original: WorkbookJSON["sheets"][0],
  imported: WorkbookJSON["sheets"][0]
): TestResult {
  const origProps = original.properties;
  const impProps = imported.properties;

  if (!origProps && !impProps) {
    return { passed: true, message: "Sheet properties: ✓ (both undefined)" };
  }

  if (!origProps || !impProps) {
    return {
      passed: false,
      message: "Sheet properties: missing",
      details: {
        original: origProps,
        imported: impProps,
      },
    };
  }

  // Check freeze panes
  if (origProps.freeze && impProps.freeze) {
    if (origProps.freeze.row !== impProps.freeze.row ||
        origProps.freeze.col !== impProps.freeze.col) {
      return {
        passed: false,
        message: "Sheet properties: freeze panes mismatch",
        details: {
          original: origProps.freeze,
          imported: impProps.freeze,
        },
      };
    }
  } else if (origProps.freeze || impProps.freeze) {
    return {
      passed: false,
      message: "Sheet properties: freeze panes missing",
      details: {
        original: origProps.freeze,
        imported: impProps.freeze,
      },
    };
  }

  // Check zoom
  if (origProps.zoom !== impProps.zoom) {
    return {
      passed: false,
      message: "Sheet properties: zoom mismatch",
      details: {
        original: origProps.zoom,
        imported: impProps.zoom,
      },
    };
  }

  // Check tabColor
  if (origProps.tabColor !== impProps.tabColor) {
    return {
      passed: false,
      message: "Sheet properties: tabColor mismatch",
      details: {
        original: origProps.tabColor,
        imported: impProps.tabColor,
      },
    };
  }

  // Check gridLines
  if (origProps.gridLines !== impProps.gridLines) {
    return {
      passed: false,
      message: "Sheet properties: gridLines mismatch",
      details: {
        original: origProps.gridLines,
        imported: impProps.gridLines,
      },
    };
  }

  return { passed: true, message: "Sheet properties: ✓" };
}

// ============================================================================
// Main Test Runner
// ============================================================================

export async function runRoundTripTest(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("ROUND-TRIP TEST: SheetJS Export/Import");
  console.log("=".repeat(70));

  const results: TestResult[] = [];

  try {
    // Step 1: Create test workbook
    console.log("\n[1/5] Creating test workbook...");
    const original = createTestWorkbook();
    const originalSheet = original.sheets[0];
    console.log(`  ✓ Created workbook: ${original.meta.title}`);
    console.log(`  ✓ Cells: ${Object.keys(originalSheet.cells || {}).length}`);
    console.log(`  ✓ Merges: ${originalSheet.mergedRanges?.length || 0}`);
    console.log(`  ✓ Columns: ${Object.keys(originalSheet.cols || {}).length}`);
    console.log(`  ✓ Rows: ${Object.keys(originalSheet.rows || {}).length}`);

    // Step 2: Export to XLSX
    console.log("\n[2/5] Exporting to XLSX...");
    const adapter = new SheetJSAdapter();
    const buffer = await adapter.export(original);
    console.log(`  ✓ Exported: ${buffer.byteLength} bytes`);

    // Step 3: Import back
    console.log("\n[3/5] Importing from XLSX...");
    const imported = await adapter.import(buffer);
    const importedSheet = imported.sheets[0];
    console.log(`  ✓ Imported workbook: ${imported.meta.title}`);
    console.log(`  ✓ Cells: ${Object.keys(importedSheet.cells || {}).length}`);
    console.log(`  ✓ Merges: ${importedSheet.mergedRanges?.length || 0}`);

    // Step 4: Verify cells
    console.log("\n[4/5] Verifying cells...");
    const testCells = [
      "A1", "A2", "A3", "A4",
      "B1", "B2", "B3", "B4",
      "C4",
      "D1", "D2", "D3",
      "E2", "E3", "E4",
      "F1", "F2", "F3",
    ];

    for (const address of testCells) {
      const origCell = getCell(original, originalSheet.id, address);
      const impCell = getCell(imported, importedSheet.id, address);
      const result = verifyCell(origCell, impCell, address);
      results.push(result);

      if (!result.passed) {
        console.error(`  ✗ ${result.message}`);
        if (result.details) {
          console.error("    Details:", JSON.stringify(result.details, null, 2));
        }
      } else {
        console.log(`  ${result.message}`);
      }
    }

    // Step 5: Verify structure
    console.log("\n[5/5] Verifying structure...");

    // Verify workbook properties
    const wbPropsResult = verifyWorkbookProperties(original, imported);
    results.push(wbPropsResult);
    if (!wbPropsResult.passed) {
      console.error(`  ✗ ${wbPropsResult.message}`);
      if (wbPropsResult.details) {
        console.error("    Details:", JSON.stringify(wbPropsResult.details, null, 2));
      }
    } else {
      console.log(`  ${wbPropsResult.message}`);
    }

    // Verify sheet properties
    const sheetPropsResult = verifySheetProperties(originalSheet, importedSheet);
    results.push(sheetPropsResult);
    if (!sheetPropsResult.passed) {
      console.error(`  ✗ ${sheetPropsResult.message}`);
      if (sheetPropsResult.details) {
        console.error("    Details:", JSON.stringify(sheetPropsResult.details, null, 2));
      }
    } else {
      console.log(`  ${sheetPropsResult.message}`);
    }

    // Verify merges
    const mergeResult = verifyMerges(
      originalSheet.mergedRanges || [],
      importedSheet.mergedRanges || []
    );
    results.push(mergeResult);
    if (!mergeResult.passed) {
      console.error(`  ✗ ${mergeResult.message}`);
      if (mergeResult.details) {
        console.error("    Details:", JSON.stringify(mergeResult.details, null, 2));
      }
    } else {
      console.log(`  ${mergeResult.message}`);
    }

    // Verify column widths
    const colResult = verifyColWidths(
      originalSheet.cols || {},
      importedSheet.cols || {}
    );
    results.push(colResult);
    if (!colResult.passed) {
      console.error(`  ✗ ${colResult.message}`);
      if (colResult.details) {
        console.error("    Details:", JSON.stringify(colResult.details, null, 2));
      }
    } else {
      console.log(`  ${colResult.message}`);
    }

    // Verify row heights
    const rowResult = verifyRowHeights(
      originalSheet.rows || {},
      importedSheet.rows || {}
    );
    results.push(rowResult);
    if (!rowResult.passed) {
      console.error(`  ✗ ${rowResult.message}`);
      if (rowResult.details) {
        console.error("    Details:", JSON.stringify(rowResult.details, null, 2));
      }
    } else {
      console.log(`  ${rowResult.message}`);
    }

  } catch (error) {
    console.error("\n✗ TEST FAILED WITH ERROR:");
    console.error(error);
    return false;
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`RESULTS: ${passed}/${total} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("✓ ALL TESTS PASSED - Ready to ship!");
  } else {
    console.log("✗ TESTS FAILED - DO NOT SHIP until fixed");
  }

  console.log("=".repeat(70));

  return failed === 0;
}

// ============================================================================
// ExcelJS Round-Trip Test
// ============================================================================

export async function runExcelJSRoundTripTest(): Promise<boolean> {
  console.log("=".repeat(70));
  console.log("ROUND-TRIP TEST: ExcelJS Export/Import");
  console.log("=".repeat(70));

  const results: TestResult[] = [];

  try {
    // Import ExcelJS adapter dynamically
    const { ExcelJSAdapter } = await import("./index");

    // Step 1: Create test workbook
    console.log("\n[1/5] Creating test workbook...");
    const original = createTestWorkbook();
    const originalSheet = original.sheets[0];
    console.log(`  ✓ Created workbook: ${original.meta.title}`);
    console.log(`  ✓ Cells: ${Object.keys(originalSheet.cells || {}).length}`);
    console.log(`  ✓ Merges: ${originalSheet.mergedRanges?.length || 0}`);
    console.log(`  ✓ Columns: ${Object.keys(originalSheet.cols || {}).length}`);
    console.log(`  ✓ Rows: ${Object.keys(originalSheet.rows || {}).length}`);

    // Step 2: Export to XLSX
    console.log("\n[2/5] Exporting to XLSX with ExcelJS...");
    const adapter = new ExcelJSAdapter();
    const buffer = await adapter.export(original);
    console.log(`  ✓ Exported: ${buffer.byteLength} bytes`);

    // Step 3: Import back
    console.log("\n[3/5] Importing from XLSX...");
    const imported = await adapter.import(buffer);
    const importedSheet = imported.sheets[0];
    console.log(`  ✓ Imported workbook: ${imported.meta.title}`);
    console.log(`  ✓ Cells: ${Object.keys(importedSheet.cells || {}).length}`);
    console.log(`  ✓ Merges: ${importedSheet.mergedRanges?.length || 0}`);

    // Step 4: Verify cells
    console.log("\n[4/5] Verifying cells...");
    const testCells = [
      "A1", "A2", "A3", "A4",
      "B1", "B2", "B3", "B4",
      "C4",
      "D1", "D2", "D3",
      "E2", "E3", "E4",
      "F1", "F2", "F3",
    ];

    for (const address of testCells) {
      const origCell = getCell(original, originalSheet.id, address);
      const impCell = getCell(imported, importedSheet.id, address);
      const result = verifyCell(origCell, impCell, address);
      results.push(result);

      if (!result.passed) {
        console.error(`  ✗ ${result.message}`);
        if (result.details) {
          console.error("    Details:", JSON.stringify(result.details, null, 2));
        }
      } else {
        console.log(`  ${result.message}`);
      }
    }

    // Step 5: Verify structure
    console.log("\n[5/5] Verifying structure...");

    // Verify workbook properties
    const wbPropsResult = verifyWorkbookProperties(original, imported);
    results.push(wbPropsResult);
    if (!wbPropsResult.passed) {
      console.error(`  ✗ ${wbPropsResult.message}`);
      if (wbPropsResult.details) {
        console.error("    Details:", JSON.stringify(wbPropsResult.details, null, 2));
      }
    } else {
      console.log(`  ${wbPropsResult.message}`);
    }

    // Verify sheet properties
    const sheetPropsResult = verifySheetProperties(originalSheet, importedSheet);
    results.push(sheetPropsResult);
    if (!sheetPropsResult.passed) {
      console.error(`  ✗ ${sheetPropsResult.message}`);
      if (sheetPropsResult.details) {
        console.error("    Details:", JSON.stringify(sheetPropsResult.details, null, 2));
      }
    } else {
      console.log(`  ${sheetPropsResult.message}`);
    }

    // Verify merges
    const mergeResult = verifyMerges(
      originalSheet.mergedRanges || [],
      importedSheet.mergedRanges || []
    );
    results.push(mergeResult);
    if (!mergeResult.passed) {
      console.error(`  ✗ ${mergeResult.message}`);
      if (mergeResult.details) {
        console.error("    Details:", JSON.stringify(mergeResult.details, null, 2));
      }
    } else {
      console.log(`  ${mergeResult.message}`);
    }

    // Verify column widths
    const colResult = verifyColWidths(
      originalSheet.cols || {},
      importedSheet.cols || {}
    );
    results.push(colResult);
    if (!colResult.passed) {
      console.error(`  ✗ ${colResult.message}`);
      if (colResult.details) {
        console.error("    Details:", JSON.stringify(colResult.details, null, 2));
      }
    } else {
      console.log(`  ${colResult.message}`);
    }

    // Verify row heights
    const rowResult = verifyRowHeights(
      originalSheet.rows || {},
      importedSheet.rows || {}
    );
    results.push(rowResult);
    if (!rowResult.passed) {
      console.error(`  ✗ ${rowResult.message}`);
      if (rowResult.details) {
        console.error("    Details:", JSON.stringify(rowResult.details, null, 2));
      }
    } else {
      console.log(`  ${rowResult.message}`);
    }

  } catch (error) {
    console.error("\n✗ TEST FAILED WITH ERROR:");
    console.error(error);
    return false;
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`RESULTS: ${passed}/${total} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("✓ ALL TESTS PASSED - ExcelJS adapter ready!");
  } else {
    console.log("✗ TESTS FAILED - Fix ExcelJS adapter issues");
  }

  console.log("=".repeat(70));

  return failed === 0;
}

// Export for use in test runners or manual execution
export default runRoundTripTest;

