/**
 * Workbook Properties Test
 * Verify that workbookProperties are properly initialized and used
 */

import { describe, test, expect } from 'vitest';
import { createWorkbook, addSheet, cloneWorkbook } from "./utils";
import type { WorkbookJSON } from "./types";

describe('Workbook Properties', () => {
  test('initialization', () => {
    const wb = createWorkbook("Test Workbook");
    expect(wb.workbookProperties).toBeTruthy();
    expect(wb.workbookProperties!.defaultRowHeight).toBe(21);
    expect(wb.workbookProperties!.defaultColWidth).toBe(100);
    expect(wb.workbookProperties!.workbookView).toBeTruthy();
    expect(wb.workbookProperties!.workbookView!.firstSheet).toBe(0);
    expect(wb.workbookProperties!.workbookView!.activeTab).toBe(0);
  });

/**
 * Test 2: Verify workbookProperties persist through clone
 */
  test('clone preserves properties', () => {
    const wb = createWorkbook("Original");
    const cloned = cloneWorkbook(wb);
    expect(cloned.workbookProperties).toBeTruthy();
    expect(cloned.workbookProperties!.defaultRowHeight).toBe(21);
    expect(cloned.workbookProperties!.defaultColWidth).toBe(100);
    expect(cloned.workbookProperties!.workbookView?.firstSheet).toBe(0);
  });

/**
 * Test 3: Verify workbookProperties can be modified
 */
  test('modification', () => {
    const wb = createWorkbook("Test");
    wb.workbookProperties!.defaultRowHeight = 25;
    wb.workbookProperties!.defaultColWidth = 120;
    wb.workbookProperties!.workbookView!.activeTab = 1;

    expect(wb.workbookProperties!.defaultRowHeight).toBe(25);
    expect(wb.workbookProperties!.defaultColWidth).toBe(120);
    expect(wb.workbookProperties!.workbookView!.activeTab).toBe(1);
  });

/**
 * Test 4: Verify activeTab updates when adding sheets
 */
  test('works with multiple sheets', () => {
    const wb = createWorkbook("Multi-sheet Test");
    addSheet(wb, "Sheet2");
    addSheet(wb, "Sheet3");

    expect(wb.sheets.length).toBe(3);
    wb.workbookProperties!.workbookView!.activeTab = 1;
    expect(wb.workbookProperties!.workbookView!.activeTab).toBe(1);
    expect(wb.workbookProperties!.workbookView!.firstSheet).toBe(0);
  });

/**
 * Test 5: Verify JSON serialization/deserialization
 */
  test('serialization', () => {
    const wb = createWorkbook("Serialization Test");
    const json = JSON.stringify(wb);
    const parsed: WorkbookJSON = JSON.parse(json);

    expect(parsed.workbookProperties).toBeTruthy();
    expect(parsed.workbookProperties.defaultRowHeight).toBe(21);
    expect(parsed.workbookProperties.defaultColWidth).toBe(100);
    expect(parsed.workbookProperties.workbookView?.firstSheet).toBe(0);
  });
});

/**
 * Run all tests
 */
// Tests are defined via Vitest above.
