/**
 * Sample Data Generators
 * Fixtures for creating realistic test data
 */

import type { WorkbookJSON, Cell } from '../../types';
import { setCell as setCellUtil } from '../../utils';
import { toAddress } from '../utils/test-helpers';

// ============================================================================
// Sales Data Generators
// ============================================================================

export interface SalesRecord {
  product: string;
  category: string;
  basePrice: number;
  region: string;
  multiplier: number;
  quantity: number;
  date: string;
}

/**
 * Generate sample sales data
 */
export function generateSalesData(
  workbook: WorkbookJSON,
  sheetId: string,
  rowCount: number = 20
): SalesRecord[] {
  const products = ['Laptop Pro', 'Desktop Elite', 'Tablet Mini', 'Smartphone X', 'Monitor 4K'];
  const categories = ['Electronics', 'Computers', 'Tablets', 'Phones', 'Displays'];
  const regions = ['North', 'South', 'East', 'West'];
  const multipliers = [0.9, 1.0, 1.1, 1.2];
  
  const records: SalesRecord[] = [];
  
  // Headers
  setCellUtil(workbook, sheetId, 'A1', { raw: 'Product', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'B1', { raw: 'Category', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'C1', { raw: 'Base Price', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'D1', { raw: 'Region', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'E1', { raw: 'Multiplier', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'F1', { raw: 'Quantity', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'G1', { raw: 'Date', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'H1', { raw: 'Total', dataType: 'string' } as Cell);
  
  // Data rows
  for (let i = 0; i < rowCount; i++) {
    const row = i + 2;
    const productIdx = i % products.length;
    const regionIdx = i % regions.length;
    
    const record: SalesRecord = {
      product: products[productIdx],
      category: categories[productIdx],
      basePrice: 100 + (i * 50),
      region: regions[regionIdx],
      multiplier: multipliers[regionIdx],
      quantity: 1 + (i % 10),
      date: `2024-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
    };
    
    records.push(record);
    
    setCellUtil(workbook, sheetId, `A${row}`, { raw: record.product, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `B${row}`, { raw: record.category, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `C${row}`, { raw: record.basePrice, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `D${row}`, { raw: record.region, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `E${row}`, { raw: record.multiplier, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `F${row}`, { raw: record.quantity, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `G${row}`, { raw: record.date, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `H${row}`, { formula: `C${row}*E${row}*F${row}` } as Cell);
  }
  
  return records;
}

// ============================================================================
// Financial Data Generators
// ============================================================================

export interface FinancialRecord {
  date: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
}

/**
 * Generate sample financial/accounting data
 */
export function generateFinancialData(
  workbook: WorkbookJSON,
  sheetId: string,
  rowCount: number = 50
): FinancialRecord[] {
  const accounts = ['Cash', 'Accounts Receivable', 'Inventory', 'Accounts Payable', 'Revenue', 'Expenses'];
  const descriptions = ['Sale', 'Purchase', 'Payment', 'Receipt', 'Adjustment'];
  
  const records: FinancialRecord[] = [];
  
  // Headers
  setCellUtil(workbook, sheetId, 'A1', { raw: 'Date', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'B1', { raw: 'Account', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'C1', { raw: 'Debit', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'D1', { raw: 'Credit', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'E1', { raw: 'Description', dataType: 'string' } as Cell);
  
  // Data rows
  for (let i = 0; i < rowCount; i++) {
    const row = i + 2;
    const isDebit = i % 2 === 0;
    const amount = 100 + Math.floor(Math.random() * 1000);
    
    const record: FinancialRecord = {
      date: `2024-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      account: accounts[i % accounts.length],
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      description: descriptions[i % descriptions.length],
    };
    
    records.push(record);
    
    setCellUtil(workbook, sheetId, `A${row}`, { raw: record.date, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `B${row}`, { raw: record.account, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `C${row}`, { raw: record.debit, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `D${row}`, { raw: record.credit, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `E${row}`, { raw: record.description, dataType: 'string' } as Cell);
  }
  
  return records;
}

// ============================================================================
// Student/Gradebook Data Generators
// ============================================================================

export interface StudentRecord {
  name: string;
  testScore: number;
  homeworkScore: number;
  projectScore: number;
}

/**
 * Generate sample student gradebook data
 */
export function generateGradebookData(
  workbook: WorkbookJSON,
  sheetId: string,
  studentCount: number = 30
): StudentRecord[] {
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  
  const records: StudentRecord[] = [];
  
  // Headers
  setCellUtil(workbook, sheetId, 'A1', { raw: 'Student Name', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'B1', { raw: 'Test Score', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'C1', { raw: 'Homework Score', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'D1', { raw: 'Project Score', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'E1', { raw: 'Final Grade', dataType: 'string' } as Cell);
  
  // Data rows
  for (let i = 0; i < studentCount; i++) {
    const row = i + 2;
    
    const record: StudentRecord = {
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      testScore: 60 + Math.floor(Math.random() * 40), // 60-100
      homeworkScore: 70 + Math.floor(Math.random() * 30), // 70-100
      projectScore: 65 + Math.floor(Math.random() * 35), // 65-100
    };
    
    records.push(record);
    
    setCellUtil(workbook, sheetId, `A${row}`, { raw: record.name, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `B${row}`, { raw: record.testScore, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `C${row}`, { raw: record.homeworkScore, dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `D${row}`, { raw: record.projectScore, dataType: 'number' } as Cell);
    // Weighted average: Tests 40%, Homework 30%, Projects 30%
    setCellUtil(workbook, sheetId, `E${row}`, { formula: `B${row}*0.4+C${row}*0.3+D${row}*0.3` } as Cell);
  }
  
  return records;
}

// ============================================================================
// Date/Time Data Generators
// ============================================================================

export interface DateTimeRecord {
  startTime: string;
  endTime: string;
  description: string;
}

/**
 * Generate sample date/time data with edge cases
 */
export function generateDateTimeData(
  workbook: WorkbookJSON,
  sheetId: string,
  rowCount: number = 20
): DateTimeRecord[] {
  const records: DateTimeRecord[] = [];
  
  // Headers
  setCellUtil(workbook, sheetId, 'A1', { raw: 'Start Date', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'B1', { raw: 'End Date', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'C1', { raw: 'Days Between', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'D1', { raw: 'Workdays', dataType: 'string' } as Cell);
  
  // Data rows with various date scenarios
  const scenarios = [
    { start: '2024-01-01', end: '2024-01-31', desc: 'Full month' },
    { start: '2024-02-28', end: '2024-03-01', desc: 'Month boundary' },
    { start: '2024-02-28', end: '2024-02-29', desc: 'Leap year' },
    { start: '2024-12-31', end: '2025-01-01', desc: 'Year boundary' },
    { start: '2024-03-10', end: '2024-03-10', desc: 'Same day' },
  ];
  
  for (let i = 0; i < Math.min(rowCount, scenarios.length); i++) {
    const row = i + 2;
    const scenario = scenarios[i];
    
    const record: DateTimeRecord = {
      startTime: scenario.start,
      endTime: scenario.end,
      description: scenario.desc,
    };
    
    records.push(record);
    
    setCellUtil(workbook, sheetId, `A${row}`, { raw: scenario.start, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `B${row}`, { raw: scenario.end, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `C${row}`, { formula: `DAYS(B${row},A${row})` } as Cell);
    setCellUtil(workbook, sheetId, `D${row}`, { formula: `NETWORKDAYS(A${row},B${row})` } as Cell);
  }
  
  return records;
}

// ============================================================================
// Large Dataset Generators
// ============================================================================

/**
 * Generate large dataset for performance testing
 */
export function generateLargeDataset(
  workbook: WorkbookJSON,
  sheetId: string,
  rowCount: number = 10000,
  colCount: number = 10
): void {
  console.log(`Generating large dataset: ${rowCount} rows x ${colCount} cols`);
  
  const start = performance.now();
  
  // Headers
  for (let c = 1; c <= colCount; c++) {
    const address = toAddress(1, c);
    setCellUtil(workbook, sheetId, address, { raw: `Col${c}`, dataType: 'string' } as Cell);
  }
  
  // Data rows
  for (let r = 2; r <= rowCount + 1; r++) {
    for (let c = 1; c <= colCount; c++) {
      const address = toAddress(r, c);
      const value = (r - 1) * colCount + c; // Sequential numbers
      setCellUtil(workbook, sheetId, address, { raw: value, dataType: 'number' } as Cell);
    }
    
    // Progress logging
    if (r % 1000 === 0) {
      console.log(`  Generated ${r - 1} rows...`);
    }
  }
  
  const elapsed = performance.now() - start;
  console.log(`Dataset generation completed in ${(elapsed / 1000).toFixed(2)}s`);
}

/**
 * Generate dataset with formulas for recalculation testing
 */
export function generateFormulaDataset(
  workbook: WorkbookJSON,
  sheetId: string,
  dataRows: number = 1000,
  formulaRows: number = 500
): void {
  console.log(`Generating formula dataset: ${dataRows} data rows, ${formulaRows} formula rows`);
  
  // Data section (A1:C{dataRows})
  setCellUtil(workbook, sheetId, 'A1', { raw: 'Category', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'B1', { raw: 'Value', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'C1', { raw: 'Multiplier', dataType: 'string' } as Cell);
  
  const categories = ['A', 'B', 'C', 'D', 'E'];
  for (let r = 2; r <= dataRows + 1; r++) {
    setCellUtil(workbook, sheetId, `A${r}`, { raw: categories[(r - 2) % categories.length], dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `B${r}`, { raw: 100 + (r - 2), dataType: 'number' } as Cell);
    setCellUtil(workbook, sheetId, `C${r}`, { raw: 1.1, dataType: 'number' } as Cell);
  }
  
  // Formula section (E1:E{formulaRows}) - SUMIFS formulas
  setCellUtil(workbook, sheetId, 'E1', { raw: 'Sum by Category', dataType: 'string' } as Cell);
  setCellUtil(workbook, sheetId, 'F1', { raw: 'Category', dataType: 'string' } as Cell);
  
  for (let r = 2; r <= formulaRows + 1; r++) {
    const category = categories[(r - 2) % categories.length];
    setCellUtil(workbook, sheetId, `F${r}`, { raw: category, dataType: 'string' } as Cell);
    setCellUtil(workbook, sheetId, `E${r}`, {
      formula: `SUMIFS(B:B,A:A,"${category}")`,
    } as Cell);
  }
  
  console.log('Formula dataset generation completed');
}

// ============================================================================
// Random Data Utilities
// ============================================================================

/**
 * Generate random number in range
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random date in range
 */
export function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

/**
 * Pick random item from array
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export default {
  generateSalesData,
  generateFinancialData,
  generateGradebookData,
  generateDateTimeData,
  generateLargeDataset,
  generateFormulaDataset,
  randomInt,
  randomDate,
  randomChoice,
};
