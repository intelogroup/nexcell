/**
 * Test Helpers and Utilities
 * Shared functions for creating test workbooks, assertions, and validations
 */

import type { WorkbookJSON, SheetJSON, Cell } from '../../types';
import { 
  createWorkbook as createEmptyWorkbook, 
  addSheet, 
  setCell as setCellUtil, 
  getCell,
  parseAddress,
  toAddress,
} from '../../utils';
import { computeWorkbook, type HydrationResult } from '../../hyperformula';
import { applyOperations } from '../../operations';
import { expect } from 'vitest';

// ============================================================================
// Workbook Creation Helpers
// ============================================================================

export interface TestSheetConfig {
  name?: string;
  cells?: Record<string, Partial<Cell>>;
  mergedRanges?: string[];
  namedRanges?: Record<string, string>;
}

export interface TestWorkbookConfig {
  title?: string;
  sheets?: TestSheetConfig[];
}

/**
 * Create a test workbook with pre-populated data
 */
export function createTestWorkbook(config: TestWorkbookConfig = {}): WorkbookJSON {
  const wb = createEmptyWorkbook(config.title || 'Test Workbook');
  
  if (config.sheets && config.sheets.length > 0) {
    // Remove default sheet if custom sheets provided
    wb.sheets = [];
    
    config.sheets.forEach(sheetConfig => {
      const sheet = addSheet(wb, sheetConfig.name);
      
      // Add cells
      if (sheetConfig.cells) {
        Object.entries(sheetConfig.cells).forEach(([address, cell]) => {
          setCellUtil(wb, sheet.id, address, cell as Cell);
        });
      }
      
      // Add merged ranges
      if (sheetConfig.mergedRanges) {
        sheet.mergedRanges = sheetConfig.mergedRanges;
      }
      
      // Add named ranges
      if (sheetConfig.namedRanges) {
        sheet.namedRanges = sheetConfig.namedRanges;
      }
    });
  }
  
  return wb;
}

/**
 * Create a simple workbook with data in a grid pattern
 */
export function createGridWorkbook(rows: number, cols: number, fillValue: string | number = ''): WorkbookJSON {
  const wb = createEmptyWorkbook('Grid Test');
  const sheet = wb.sheets[0];
  
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const address = toAddress(r, c);
      const value = typeof fillValue === 'function' ? fillValue(r, c) : fillValue;
      setCellUtil(wb, sheet.id, address, { raw: value } as Cell);
    }
  }
  
  return wb;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a formula produces the expected result
 */
export function assertFormulaResult(
  workbook: WorkbookJSON,
  formula: string,
  expectedValue: any,
  sheetId?: string
): { result: any; errors: string[]; warnings: string[] } {
  const targetSheetId = sheetId || workbook.sheets[0]?.id;
  if (!targetSheetId) throw new Error('No sheet found in workbook');
  
  // Set formula in a test cell
  const testAddress = 'Z999'; // Use far-off cell to avoid conflicts
  setCellUtil(workbook, targetSheetId, testAddress, {
    formula: formula.startsWith('=') ? formula.substring(1) : formula,
  } as Cell);
  
  // Compute workbook
  const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });
  
  // Get computed value
  const cell = getCell(workbook, targetSheetId, testAddress);
  const actualValue = cell?.computed?.v;
  
  // Assert
  expect(actualValue).toEqual(expectedValue);
  
  return {
    result: actualValue,
    errors: recompute.errors,
    warnings: recompute.warnings,
  };
}

/**
 * Assert that a cell has the expected value
 */
export function assertCellValue(
  workbook: WorkbookJSON,
  address: string,
  expectedValue: any,
  sheetId?: string
): void {
  const targetSheetId = sheetId || workbook.sheets[0]?.id;
  if (!targetSheetId) throw new Error('No sheet found in workbook');
  
  const cell = getCell(workbook, targetSheetId, address);
  const actualValue = cell?.computed?.v ?? cell?.raw;
  
  expect(actualValue).toEqual(expectedValue);
}

/**
 * Assert that a cell contains an error
 */
export function assertCellError(
  workbook: WorkbookJSON,
  address: string,
  errorType?: string,
  sheetId?: string
): void {
  const targetSheetId = sheetId || workbook.sheets[0]?.id;
  if (!targetSheetId) throw new Error('No sheet found in workbook');
  
  const cell = getCell(workbook, targetSheetId, address);
  const value = cell?.computed?.v;
  
  // Check if value is an error (string starting with #)
  expect(typeof value === 'string' && value.startsWith('#')).toBe(true);
  
  if (errorType) {
    expect(value).toBe(errorType);
  }
}

/**
 * Assert that computation completes without errors
 */
export function assertNoErrors(workbook: WorkbookJSON): HydrationResult {
  const { hydration, recompute } = computeWorkbook(workbook, { validateFormulas: true });
  
  expect(recompute.errors).toHaveLength(0);
  
  return hydration;
}

/**
 * Assert that an operation succeeds
 */
export function assertOperationSuccess(
  workbook: WorkbookJSON,
  operations: any[]
): void {
  const result = applyOperations(workbook, operations);
  
  expect(result.success).toBe(true);
  expect(result.errors).toHaveLength(0);
}

// ============================================================================
// Performance Helpers
// ============================================================================

/**
 * Measure execution time of a function
 */
export function measurePerformance<T>(
  fn: () => T,
  label?: string
): { result: T; elapsed: number } {
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  
  if (label) {
    console.log(`[Perf] ${label}: ${elapsed.toFixed(2)}ms`);
  }
  
  return { result, elapsed };
}

/**
 * Assert that operation completes within time limit
 */
export function assertPerformance<T>(
  fn: () => T,
  maxMs: number,
  label?: string
): T {
  const { result, elapsed } = measurePerformance(fn, label);
  
  expect(elapsed).toBeLessThan(maxMs);
  
  return result;
}

/**
 * Run performance benchmark and return statistics
 */
export function benchmark(
  fn: () => void,
  iterations: number = 10
): { mean: number; min: number; max: number; stdDev: number } {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, min, max, stdDev };
}

// ============================================================================
// Utility Helpers
// ============================================================================

// Note: parseAddress and toAddress are now imported from utils.ts
// This eliminates code duplication and ensures consistency across the codebase

/**
 * Generate a range of addresses
 */
export function generateRange(start: string, end: string): string[] {
  const s = parseAddress(start);
  const e = parseAddress(end);
  
  const addresses: string[] = [];
  for (let r = s.row; r <= e.row; r++) {
    for (let c = s.col; c <= e.col; c++) {
      addresses.push(toAddress(r, c));
    }
  }
  
  return addresses;
}

/**
 * Clone workbook deeply
 */
export function cloneWorkbook(wb: WorkbookJSON): WorkbookJSON {
  return JSON.parse(JSON.stringify(wb));
}

/**
 * Compare two workbooks for equality
 */
export function workbooksEqual(wb1: WorkbookJSON, wb2: WorkbookJSON): boolean {
  // Remove volatile properties
  const clean = (wb: WorkbookJSON) => {
    const copy = cloneWorkbook(wb);
    copy.meta.modifiedAt = '';
    copy.actionLog = [];
    return copy;
  };
  
  return JSON.stringify(clean(wb1)) === JSON.stringify(clean(wb2));
}

/**
 * Wait for async operation (for testing async workflows)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a spy function for testing callbacks
 */
export function createSpy<T extends (...args: any[]) => any>(): T & { calls: any[][]; callCount: number } {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
  }) as any;
  
  fn.calls = calls;
  Object.defineProperty(fn, 'callCount', {
    get: () => calls.length,
  });
  
  return fn;
}

// ============================================================================
// Data Validation Helpers
// ============================================================================

/**
 * Assert that workbook structure is valid
 */
export function assertValidWorkbook(wb: WorkbookJSON): void {
  expect(wb.schemaVersion).toBeDefined();
  expect(wb.workbookId).toBeDefined();
  expect(wb.sheets).toBeDefined();
  expect(wb.sheets.length).toBeGreaterThan(0);
  
  wb.sheets.forEach(sheet => {
    expect(sheet.id).toBeDefined();
    expect(sheet.name).toBeDefined();
    expect(sheet.cells).toBeDefined();
  });
}

/**
 * Assert that all formulas in workbook are valid
 */
export function assertAllFormulasValid(wb: WorkbookJSON): void {
  const { recompute } = computeWorkbook(wb, { validateFormulas: true });
  
  recompute.errors.forEach(error => {
    console.warn('Formula error:', error);
  });
  
  expect(recompute.errors).toHaveLength(0);
}

/**
 * Get all cells with formulas
 */
export function getFormulaCells(wb: WorkbookJSON, sheetId: string): Array<{ address: string; formula: string }> {
  const sheet = wb.sheets.find(s => s.id === sheetId);
  if (!sheet) return [];
  
  return Object.entries(sheet.cells || {})
    .filter(([_, cell]) => cell.formula)
    .map(([address, cell]) => ({ address, formula: cell.formula! }));
}

/**
 * Get all cells with errors
 */
export function getErrorCells(wb: WorkbookJSON, sheetId: string): Array<{ address: string; error: string }> {
  const sheet = wb.sheets.find(s => s.id === sheetId);
  if (!sheet) return [];
  
  return Object.entries(sheet.cells || {})
    .filter(([_, cell]) => {
      const value = cell.computed?.v ?? cell.raw;
      return typeof value === 'string' && value.startsWith('#');
    })
    .map(([address, cell]) => ({
      address,
      error: (cell.computed?.v ?? cell.raw) as string,
    }));
}

/**
 * Assert that a cell has the expected formula
 */
export function assertCellFormula(
  workbook: WorkbookJSON,
  address: string,
  expectedFormula: string,
  sheetId?: string
): void {
  const targetSheetId = sheetId || workbook.sheets[0]?.id;
  if (!targetSheetId) throw new Error('No sheet found in workbook');
  
  const cell = getCell(workbook, targetSheetId, address);
  
  // Normalize formulas for comparison (remove leading = if present)
  const normalizedExpected = expectedFormula.startsWith('=') ? expectedFormula.slice(1) : expectedFormula;
  const normalizedActual = cell?.formula ? 
    (cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula) : 
    undefined;
  
  expect(normalizedActual).toBe(normalizedExpected);
}

/**
 * Compute workbook and assert cell value
 */
export function computeAndAssert(
  workbook: WorkbookJSON,
  address: string,
  expectedValue: any,
  sheetId?: string
): void {
  const targetSheetId = sheetId || workbook.sheets[0]?.id;
  if (!targetSheetId) throw new Error('No sheet found in workbook');
  
  // Compute workbook
  computeWorkbook(workbook);
  
  // Assert cell value
  assertCellValue(workbook, address, expectedValue, targetSheetId);
}

// Re-export imported utilities for convenience
export { parseAddress, toAddress };

export default {
  createTestWorkbook,
  createGridWorkbook,
  assertFormulaResult,
  assertCellValue,
  assertCellError,
  assertNoErrors,
  assertOperationSuccess,
  assertPerformance,
  measurePerformance,
  benchmark,
  toAddress,
  parseAddress,
  generateRange,
  cloneWorkbook,
  workbooksEqual,
  assertValidWorkbook,
  assertAllFormulasValid,
  getFormulaCells,
  getErrorCells,
  assertCellFormula,
  computeAndAssert,
};
