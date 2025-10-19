/**
 * Integration Tests for AI Operation Generator
 * 
 * Tests real-world user prompts from AI_PROMPT_EXAMPLES.md
 * Uses mocked AI responses for deterministic testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWorkbookOperations } from './operation-generator';
import { WorkbookOperationExecutor } from './executor';
import type { WorkbookJSON } from '@/lib/workbook/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Operation Generator - Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.setItem('openrouter_api_key', 'test-key');
  });

  afterEach(() => {
    localStorage.removeItem('openrouter_api_key');
  });

  /**
   * Test 1: Create a simple monthly budget workbook
   */
  it('should generate operations for creating a monthly budget', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'createWorkbook',
          params: {
            name: 'Marketing Budget',
            initialSheets: ['Inputs', 'Budget'],
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Inputs',
            cells: {
              A1: { value: 'Category', dataType: 'string', style: { bold: true } },
              B1: { value: 'Jan', dataType: 'string', style: { bold: true } },
              C1: { value: 'Feb', dataType: 'string', style: { bold: true } },
              D1: { value: 'Mar', dataType: 'string', style: { bold: true } },
            },
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Budget',
            cells: {
              A1: { value: 'Category', dataType: 'string', style: { bold: true } },
              A2: { value: 'Advertising', dataType: 'string' },
              A3: { value: 'Events', dataType: 'string' },
              A4: { value: 'SaaS', dataType: 'string' },
              A5: { value: 'Contractors', dataType: 'string' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Created a marketing budget workbook with Inputs and Budget sheets',
      confidence: 0.95,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Create a monthly budget workbook for Marketing with sheets Inputs and Budget';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(4);
    expect(result.operations[0].type).toBe('createWorkbook');
    expect(result.operations[0].params.name).toBe('Marketing Budget');
    expect(result.operations[0].params.initialSheets).toEqual(['Inputs', 'Budget']);
    expect(result.confidence).toBeGreaterThan(0.9);

    // Execute operations and verify
    const executor = new WorkbookOperationExecutor();
    const execResult = await executor.execute(result.operations);
    
    expect(execResult.success).toBe(true);
    expect(execResult.workbook).toBeDefined();
    expect(execResult.workbook!.sheets).toHaveLength(2);
    expect(execResult.workbook!.sheets[0].name).toBe('Inputs');
    expect(execResult.workbook!.sheets[1].name).toBe('Budget');
  });

  /**
   * Test 2: Add variance % column
   */
  it('should generate operations for adding variance column', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'setCells',
          params: {
            sheet: 'Budget',
            cells: {
              E1: { value: 'Actual', dataType: 'string', style: { bold: true } },
              F1: { value: 'Variance %', dataType: 'string', style: { bold: true } },
            },
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Budget',
            cells: {
              F2: { formula: '=IF(B2=0,0,(E2-B2)/B2)', dataType: 'formula', numFmt: '0.00%' },
              F3: { formula: '=IF(B3=0,0,(E3-B3)/B3)', dataType: 'formula', numFmt: '0.00%' },
              F4: { formula: '=IF(B4=0,0,(E4-B4)/B4)', dataType: 'formula', numFmt: '0.00%' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Added Actual and Variance % columns with protected formulas',
      confidence: 0.92,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Add an Actual column and Variance % column that computes (Actual - Budget)/Budget';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(result.operations[0].type).toBe('setCells');
    
    // Verify variance formulas include divide-by-zero protection
    const varianceOp = result.operations[1];
    expect(varianceOp.type).toBe('setCells');
    const f2Cell = varianceOp.params.cells.F2;
    expect(f2Cell.formula).toContain('IF');
    expect(f2Cell.numFmt).toBe('0.00%');
  });

  /**
   * Test 3: Consolidate sheets
   */
  it('should generate operations for consolidating multiple sheets', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'addSheet',
          params: {
            name: 'Consolidated',
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Consolidated',
            cells: {
              A1: { value: 'Category', dataType: 'string', style: { bold: true } },
              B1: { value: 'Total', dataType: 'string', style: { bold: true } },
            },
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Consolidated',
            cells: {
              A2: { value: 'Item1', dataType: 'string' },
              B2: { formula: '=SUMIF(Sales!A:A,A2,Sales!B:B)+SUMIF(Ops!A:A,A2,Ops!B:B)+SUMIF(HR!A:A,A2,HR!B:B)', dataType: 'formula' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Created Consolidated sheet to sum amounts across Sales, Ops, and HR',
      confidence: 0.88,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Create Consolidated sheet that sums Amount by Category across Sales, Ops, HR sheets';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations[0].type).toBe('addSheet');
    expect(result.operations[0].params.name).toBe('Consolidated');
    
    // Verify consolidation formula
    const formulaOp = result.operations[2];
    expect(formulaOp.params.cells.B2.formula).toContain('SUMIF');
    expect(formulaOp.params.cells.B2.formula).toContain('Sales!');
    expect(formulaOp.params.cells.B2.formula).toContain('Ops!');
    expect(formulaOp.params.cells.B2.formula).toContain('HR!');
  });

  /**
   * Test 4: Format currency columns
   */
  it('should generate operations for formatting currency', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'applyFormat',
          params: {
            sheet: 'Budget',
            range: 'B:D',
            format: {
              numFmt: '$#,##0.00',
            },
          },
        },
        {
          type: 'applyFormat',
          params: {
            sheet: 'Budget',
            range: 'A1:D1',
            format: {
              bold: true,
              bgColor: '#f3f4f6',
            },
          },
        },
      ],
      explanation: 'Applied currency formatting to columns B-D and styled header row',
      confidence: 0.97,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Format columns B:D as currency and make header row bold with gray background';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(2);
    expect(result.operations[0].type).toBe('applyFormat');
    expect(result.operations[0].params.format.numFmt).toBe('$#,##0.00');
    expect(result.operations[1].params.format.bold).toBe(true);
  });

  /**
   * Test 5: Create running totals
   */
  it('should generate operations for YTD running total', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'setCells',
          params: {
            sheet: 'Sales',
            cells: {
              C1: { value: 'YTD', dataType: 'string', style: { bold: true } },
              C2: { formula: '=B2', dataType: 'formula' },
              C3: { formula: '=C2+B3', dataType: 'formula' },
              C4: { formula: '=C3+B4', dataType: 'formula' },
              C5: { formula: '=C4+B5', dataType: 'formula' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Created YTD running total in column C',
      confidence: 0.94,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Calculate YTD running total in column C where C2=B2 and C3=C2+B3 etc';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations[0].type).toBe('setCells');
    
    // Verify running total pattern
    const cells = result.operations[0].params.cells;
    expect(cells.C2.formula).toBe('=B2');
    expect(cells.C3.formula).toContain('C2');
    expect(cells.C3.formula).toContain('B3');
  });

  /**
   * Test 6: Named ranges
   */
  it('should generate operations for named ranges', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'defineNamedRange',
          params: {
            name: 'Expenses',
            range: 'Expenses!A2:B100',
          },
        },
        {
          type: 'setFormula',
          params: {
            sheet: 'Summary',
            cell: 'B2',
            formula: '=SUM(Expenses)',
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Defined named range and used it in formula',
      confidence: 0.91,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Define named range Expenses as Expenses!A2:B100 and use it in a SUM formula';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations[0].type).toBe('defineNamedRange');
    expect(result.operations[0].params.name).toBe('Expenses');
    expect(result.operations[1].params.formula).toContain('Expenses');
  });

  /**
   * Test 7: Simple data entry
   */
  it('should generate operations for simple data entry', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'createWorkbook',
          params: {
            name: 'Sales Tracker',
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Sheet1',
            cells: {
              A1: { value: 'Product', dataType: 'string' },
              B1: { value: 'Price', dataType: 'string' },
              C1: { value: 'Quantity', dataType: 'string' },
              D1: { value: 'Total', dataType: 'string' },
              A2: { value: 'Widget', dataType: 'string' },
              B2: { value: 19.99, dataType: 'number', numFmt: '$#,##0.00' },
              C2: { value: 5, dataType: 'number' },
              D2: { formula: '=B2*C2', dataType: 'formula', numFmt: '$#,##0.00' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Created sales tracker with product data',
      confidence: 0.96,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Create a sales tracker with Product, Price, Quantity, and Total columns';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations[0].type).toBe('createWorkbook');
    
    // Verify data structure
    const cells = result.operations[1].params.cells;
    expect(cells.D2.formula).toContain('*');
    expect(cells.B2.numFmt).toContain('$');
  });

  /**
   * Test 8: Add sheet with formulas
   */
  it('should generate operations for adding summary sheet', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'addSheet',
          params: {
            name: 'Summary',
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Summary',
            cells: {
              A1: { value: 'Metric', dataType: 'string' },
              B1: { value: 'Value', dataType: 'string' },
              A2: { value: 'Total Sales', dataType: 'string' },
              B2: { formula: '=SUM(Data!D:D)', dataType: 'formula' },
              A3: { value: 'Average', dataType: 'string' },
              B3: { formula: '=AVERAGE(Data!D:D)', dataType: 'formula' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Added Summary sheet with aggregate formulas',
      confidence: 0.93,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Add Summary sheet with Total Sales and Average from Data sheet';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations[0].type).toBe('addSheet');
    
    // Verify aggregate formulas
    const cells = result.operations[1].params.cells;
    expect(cells.B2.formula).toContain('SUM');
    expect(cells.B3.formula).toContain('AVERAGE');
  });

  /**
   * Test 9: Complex budget with multiple sheets
   */
  it('should generate operations for complex multi-sheet budget', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'createWorkbook',
          params: {
            name: 'Q1 Budget',
            initialSheets: ['Revenue', 'Expenses', 'Summary'],
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Revenue',
            cells: {
              A1: { value: 'Source', dataType: 'string', style: { bold: true } },
              B1: { value: 'Amount', dataType: 'string', style: { bold: true } },
            },
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Expenses',
            cells: {
              A1: { value: 'Category', dataType: 'string', style: { bold: true } },
              B1: { value: 'Amount', dataType: 'string', style: { bold: true } },
            },
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'Summary',
            cells: {
              A1: { value: 'Total Revenue', dataType: 'string' },
              B1: { formula: '=SUM(Revenue!B:B)', dataType: 'formula' },
              A2: { value: 'Total Expenses', dataType: 'string' },
              B2: { formula: '=SUM(Expenses!B:B)', dataType: 'formula' },
              A3: { value: 'Net Income', dataType: 'string' },
              B3: { formula: '=B1-B2', dataType: 'formula' },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Created Q1 budget with Revenue, Expenses, and Summary sheets',
      confidence: 0.89,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Create Q1 budget with Revenue, Expenses, and Summary sheets that calculate net income';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations).toHaveLength(5);
    expect(result.operations[0].params.initialSheets).toHaveLength(3);
    
    // Verify cross-sheet formulas in Summary
    const summaryOp = result.operations.find(op => 
      op.type === 'setCells' && op.params.sheet === 'Summary'
    );
    expect(summaryOp).toBeDefined();
    expect(summaryOp!.params.cells.B1.formula).toContain('Revenue!');
    expect(summaryOp!.params.cells.B2.formula).toContain('Expenses!');
  });

  /**
   * Test 10: Merge cells
   */
  it('should generate operations for merging cells', async () => {
    const mockResponse = {
      operations: [
        {
          type: 'setCells',
          params: {
            sheet: 'Report',
            cells: {
              A1: { value: 'Q1 Sales Report', dataType: 'string', style: { bold: true, fontSize: 16 } },
            },
          },
        },
        {
          type: 'mergeCells',
          params: {
            sheet: 'Report',
            range: 'A1:D1',
          },
        },
      ],
      explanation: 'Created title and merged cells A1:D1',
      confidence: 0.95,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      }),
    });

    const prompt = 'Add title "Q1 Sales Report" and merge cells A1:D1';
    const result = await generateWorkbookOperations(prompt);

    expect(result.success).toBe(true);
    expect(result.operations[0].type).toBe('setCells');
    expect(result.operations[1].type).toBe('mergeCells');
    expect(result.operations[1].params.range).toBe('A1:D1');
  });
});
