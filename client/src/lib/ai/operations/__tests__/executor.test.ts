/**
 * Unit tests for WorkbookOperationExecutor
 * 
 * Tests individual operation handlers and execution flow.
 */

import { describe, it, expect } from 'vitest';
import { WorkbookOperationExecutor } from '../executor';
import type { 
  CreateWorkbookOperation, 
  AddSheetOperation, 
  RemoveSheetOperation, 
  RenameSheetOperation,
  SetFormulaOperation,
  SetCellsOperation,
  ComputeOperation,
  ApplyFormatOperation,
  MergeCellsOperation,
} from '../types';
import { getSheet } from '../../../workbook/utils';

describe('WorkbookOperationExecutor', () => {
  describe('execute()', () => {
    it('should execute empty operation array', async () => {
      const executor = new WorkbookOperationExecutor();
      const result = await executor.execute([]);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(0);
      expect(result.operationsTotal).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle execution errors gracefully', async () => {
      const executor = new WorkbookOperationExecutor({ stopOnError: false });
      const operations = [
        { type: 'invalidOperation', params: {} } as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Unknown operation type');
    });

    it('should stop on first error when stopOnError=true', async () => {
      const executor = new WorkbookOperationExecutor({ stopOnError: true });
      const operations = [
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A1', formula: '=SUM(1,2)' } } as any,
        { type: 'setCells', params: { sheet: 'Sheet1', cells: {} } } as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.operationsExecuted).toBe(0);
      expect(result.operationsTotal).toBe(2);
    });
  });

  describe('createWorkbook operation', () => {
    it('should create a workbook with default name', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Test Workbook',
        },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(true);
      expect(result.workbook).toBeDefined();
      expect(result.workbook?.meta.title).toBe('Test Workbook');
      expect(result.workbook?.sheets).toHaveLength(1);
      expect(result.workbook?.sheets[0].name).toBe('Sheet1');
    });

    it('should create a workbook with initial sheets', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Multi-Sheet Workbook',
          initialSheets: ['Sales', 'Marketing', 'Operations'],
        },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(true);
      expect(result.workbook).toBeDefined();
      expect(result.workbook?.meta.title).toBe('Multi-Sheet Workbook');
      expect(result.workbook?.sheets).toHaveLength(3);
      expect(result.workbook?.sheets[0].name).toBe('Sales');
      expect(result.workbook?.sheets[1].name).toBe('Marketing');
      expect(result.workbook?.sheets[2].name).toBe('Operations');
    });

    it('should fail if workbook name is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: '   ', // empty/whitespace
        },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('name is required');
    });

    it('should fail if initialSheets contains duplicates', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Test',
          initialSheets: ['Sheet1', 'Sheet2', 'Sheet1'], // duplicate
        },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('duplicate names');
    });

    it('should warn and use default Sheet1 if initialSheets are all empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Test',
          initialSheets: ['  ', '', '   '], // all empty
        },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(true);
      expect(result.workbook?.sheets).toHaveLength(1);
      expect(result.workbook?.sheets[0].name).toBe('Sheet1');
      expect(result.warnings).toContain('initialSheets contained only empty names, keeping default Sheet1');
    });

    it('should fail if creating workbook twice in same execution', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations: CreateWorkbookOperation[] = [
        { type: 'createWorkbook', params: { name: 'First' } },
        { type: 'createWorkbook', params: { name: 'Second' } },
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Workbook already exists');
      expect(result.operationsExecuted).toBe(1);
    });

    it('should create workbook with metadata timestamps', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: { name: 'Test' },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(true);
      expect(result.workbook?.meta.createdAt).toBeDefined();
      expect(result.workbook?.meta.modifiedAt).toBeDefined();
      expect(result.workbook?.workbookId).toBeDefined();
    });

    it('should clone workbook by default', async () => {
      const executor = new WorkbookOperationExecutor({ cloneWorkbook: true });
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: { name: 'Test' },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(true);
      // Workbook should be created fresh, cloning doesn't apply here
      expect(result.workbook).toBeDefined();
    });
  });

  describe('debug mode', () => {
    it('should log when debug=true', async () => {
      const logs: any[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args);

      const executor = new WorkbookOperationExecutor({ debug: true });
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: { name: 'Test' },
      };

      await executor.execute([operation]);

      console.log = originalLog;

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.includes('[WorkbookOperationExecutor]'))).toBe(true);
    });

    it('should not log when debug=false', async () => {
      const logs: any[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args);

      const executor = new WorkbookOperationExecutor({ debug: false });
      const operation: CreateWorkbookOperation = {
        type: 'createWorkbook',
        params: { name: 'Test' },
      };

      await executor.execute([operation]);

      console.log = originalLog;

      expect(logs.some(log => log.includes('[WorkbookOperationExecutor]'))).toBe(false);
    });
  });

  describe('addSheet operation', () => {
    it('should add a sheet to existing workbook', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'NewSheet' } } as AddSheetOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.sheets).toHaveLength(2);
      expect(result.workbook?.sheets[0].name).toBe('Sheet1');
      expect(result.workbook?.sheets[1].name).toBe('NewSheet');
    });

    it('should handle duplicate sheet names by appending suffix', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['A', 'B'] } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'A' } } as AddSheetOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.sheets).toHaveLength(3);
      expect(result.workbook?.sheets[0].name).toBe('A');
      expect(result.workbook?.sheets[1].name).toBe('B');
      expect(result.workbook?.sheets[2].name).toBe('A1'); // addSheet() adds suffix for duplicates
    });

    it('should add sheet at specific position', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['A', 'B', 'C'] } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'Middle', position: 1 } } as AddSheetOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.sheets).toHaveLength(4);
      expect(result.workbook?.sheets[0].name).toBe('A');
      expect(result.workbook?.sheets[1].name).toBe('Middle');
      expect(result.workbook?.sheets[2].name).toBe('B');
      expect(result.workbook?.sheets[3].name).toBe('C');
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: AddSheetOperation = {
        type: 'addSheet',
        params: { name: 'NewSheet' },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheet name is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: '  ' } } as AddSheetOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('name is required');
    });

    it('should fail if position is invalid', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'NewSheet', position: 99 } } as AddSheetOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid position');
    });

    it('should set custom sheet ID if provided', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'Custom', id: 'custom-id-123' } } as AddSheetOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.sheets[1].id).toBe('custom-id-123');
    });
  });

  describe('removeSheet operation', () => {
    it('should remove a sheet by ID', async () => {
      const executor = new WorkbookOperationExecutor();
      
      // First create workbook and get sheet IDs
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['A', 'B', 'C'] } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetBId = createResult.workbook?.sheets[1].id;

      // Then remove sheet B
      const removeOp: RemoveSheetOperation = {
        type: 'removeSheet',
        params: { sheetId: sheetBId! },
      };
      const removeResult = await executor.execute([removeOp], createResult.workbook!);

      expect(removeResult.success).toBe(true);
      expect(removeResult.workbook?.sheets).toHaveLength(2);
      expect(removeResult.workbook?.sheets[0].name).toBe('A');
      expect(removeResult.workbook?.sheets[1].name).toBe('C');
    });

    it('should fail if trying to remove last sheet', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const removeOp: RemoveSheetOperation = {
        type: 'removeSheet',
        params: { sheetId: sheetId! },
      };
      const removeResult = await executor.execute([removeOp], createResult.workbook!);

      expect(removeResult.success).toBe(false);
      expect(removeResult.errors).toHaveLength(1);
      expect(removeResult.errors[0].message).toContain('At least one sheet must remain');
    });

    it('should fail if sheet ID does not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);

      const removeOp: RemoveSheetOperation = {
        type: 'removeSheet',
        params: { sheetId: 'nonexistent-id' },
      };
      const removeResult = await executor.execute([removeOp], createResult.workbook!);

      expect(removeResult.success).toBe(false);
      expect(removeResult.errors).toHaveLength(1);
      expect(removeResult.errors[0].message).toContain('not found');
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: RemoveSheetOperation = {
        type: 'removeSheet',
        params: { sheetId: 'some-id' },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheetId is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);

      const removeOp: RemoveSheetOperation = {
        type: 'removeSheet',
        params: { sheetId: '  ' },
      };
      const removeResult = await executor.execute([removeOp], createResult.workbook!);

      expect(removeResult.success).toBe(false);
      expect(removeResult.errors).toHaveLength(1);
      expect(removeResult.errors[0].message).toContain('sheetId is required');
    });
  });

  describe('renameSheet operation', () => {
    it('should rename a sheet', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['OldName'] } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const renameOp: RenameSheetOperation = {
        type: 'renameSheet',
        params: { sheetId: sheetId!, newName: 'NewName' },
      };
      const renameResult = await executor.execute([renameOp], createResult.workbook!);

      expect(renameResult.success).toBe(true);
      expect(renameResult.workbook?.sheets[0].name).toBe('NewName');
    });

    it('should fail if new name conflicts with another sheet', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Sheet1', 'Sheet2'] } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheet1Id = createResult.workbook?.sheets[0].id;

      const renameOp: RenameSheetOperation = {
        type: 'renameSheet',
        params: { sheetId: sheet1Id!, newName: 'Sheet2' },
      };
      const renameResult = await executor.execute([renameOp], createResult.workbook!);

      expect(renameResult.success).toBe(false);
      expect(renameResult.errors).toHaveLength(1);
      expect(renameResult.errors[0].message).toContain('already used');
    });

    it('should succeed if renaming sheet to same name', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Sheet1'] } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const renameOp: RenameSheetOperation = {
        type: 'renameSheet',
        params: { sheetId: sheetId!, newName: 'Sheet1' },
      };
      const renameResult = await executor.execute([renameOp], createResult.workbook!);

      expect(renameResult.success).toBe(true);
      expect(renameResult.workbook?.sheets[0].name).toBe('Sheet1');
    });

    it('should fail if sheet ID does not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);

      const renameOp: RenameSheetOperation = {
        type: 'renameSheet',
        params: { sheetId: 'nonexistent-id', newName: 'NewName' },
      };
      const renameResult = await executor.execute([renameOp], createResult.workbook!);

      expect(renameResult.success).toBe(false);
      expect(renameResult.errors).toHaveLength(1);
      expect(renameResult.errors[0].message).toContain('not found');
    });

    it('should fail if new name is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const renameOp: RenameSheetOperation = {
        type: 'renameSheet',
        params: { sheetId: sheetId!, newName: '  ' },
      };
      const renameResult = await executor.execute([renameOp], createResult.workbook!);

      expect(renameResult.success).toBe(false);
      expect(renameResult.errors).toHaveLength(1);
      expect(renameResult.errors[0].message).toContain('newName is required');
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: RenameSheetOperation = {
        type: 'renameSheet',
        params: { sheetId: 'some-id', newName: 'NewName' },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });
  });

  describe('setCells operation', () => {
    it('should set a single cell with value', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Hello', dataType: 'string' }
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1).toBeDefined();
      expect(sheet?.cells?.A1.raw).toBe('Hello');
      expect(sheet?.cells?.A1.dataType).toBe('string');
    });

    it('should set multiple cells at once', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Name', dataType: 'string' },
            B1: { value: 'Age', dataType: 'string' },
            C1: { value: 'Score', dataType: 'string' },
            A2: { value: 'Alice', dataType: 'string' },
            B2: { value: 25, dataType: 'number' },
            C2: { value: 95.5, dataType: 'number' },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.raw).toBe('Name');
      expect(sheet?.cells?.B1.raw).toBe('Age');
      expect(sheet?.cells?.C1.raw).toBe('Score');
      expect(sheet?.cells?.A2.raw).toBe('Alice');
      expect(sheet?.cells?.B2.raw).toBe(25);
      expect(sheet?.cells?.C2.raw).toBe(95.5);
    });

    it('should set cells with different data types', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Text', dataType: 'string' },
            A2: { value: 123, dataType: 'number' },
            A3: { value: true, dataType: 'boolean' },
            A4: { value: null, dataType: 'string' }, // null value
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.dataType).toBe('string');
      expect(sheet?.cells?.A2.dataType).toBe('number');
      expect(sheet?.cells?.A3.dataType).toBe('boolean');
      expect(sheet?.cells?.A4.raw).toBeNull();
    });

    it('should set cells with formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 10, dataType: 'number' },
            A2: { value: 20, dataType: 'number' },
            A3: { formula: '=A1+A2', dataType: 'formula' },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A3.formula).toBe('=A1+A2');
      expect(sheet?.cells?.A3.dataType).toBe('formula');
    });

    it('should normalize formulas by adding leading = if missing', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { formula: 'SUM(B1:B10)', dataType: 'formula' },
            A2: { formula: 'AVERAGE(C1:C5)', dataType: 'formula' },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.formula).toBe('=SUM(B1:B10)');
      expect(sheet?.cells?.A2.formula).toBe('=AVERAGE(C1:C5)');
    });

    it('should set cells with number formatting', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 1234.56, dataType: 'number', numFmt: '#,##0.00' },
            A2: { value: 0.85, dataType: 'number', numFmt: '0.00%' },
            A3: { value: 99.99, dataType: 'number', numFmt: '$#,##0.00' },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.numFmt).toBe('#,##0.00');
      expect(sheet?.cells?.A2.numFmt).toBe('0.00%');
      expect(sheet?.cells?.A3.numFmt).toBe('$#,##0.00');
    });

    it('should set cells with styling', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { 
              value: 'Header', 
              dataType: 'string',
              style: { bold: true, bgColor: '#f0f0f0', fontSize: 14 } as any
            },
            A2: { 
              value: 'Important', 
              dataType: 'string',
              style: { italic: true, color: '#ff0000' } as any
            },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A1.style?.bgColor).toBe('#f0f0f0');
      expect(sheet?.cells?.A1.style?.fontSize).toBe(14);
      expect(sheet?.cells?.A2.style?.italic).toBe(true);
      expect(sheet?.cells?.A2.style?.color).toBe('#ff0000');
    });

    it('should set cells with combined attributes', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { 
              value: 1500.75, 
              dataType: 'number',
              numFmt: '$#,##0.00',
              style: { bold: true, alignment: { horizontal: 'right' } } as any
            },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.raw).toBe(1500.75);
      expect(sheet?.cells?.A1.numFmt).toBe('$#,##0.00');
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A1.style?.alignment?.horizontal).toBe('right');
    });

    it('should work with sheet name instead of ID', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data'] } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Data', // Using name
          cells: {
            A1: { value: 'Test', dataType: 'string' }
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets.find((s: any) => s.name === 'Data');
      expect(sheet?.cells?.A1.raw).toBe('Test');
    });

    it('should overwrite existing cell values', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Original', dataType: 'string' }
          }
        }} as SetCellsOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Updated', dataType: 'string' }
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.raw).toBe('Updated');
    });

    it('should handle sparse cell placement', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Top Left', dataType: 'string' },
            Z100: { value: 'Bottom Right', dataType: 'string' },
            M50: { value: 'Middle', dataType: 'string' },
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.raw).toBe('Top Left');
      expect(sheet?.cells?.Z100.raw).toBe('Bottom Right');
      expect(sheet?.cells?.M50.raw).toBe('Middle');
    });

    it('should update workbook modifiedAt timestamp', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const originalModifiedAt = createResult.workbook?.meta.modifiedAt;
      
      // Small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const setCellsOp: SetCellsOperation = {
        type: 'setCells',
        params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Test', dataType: 'string' }
          }
        }
      };
      const result = await executor.execute([setCellsOp], createResult.workbook!);

      expect(result.success).toBe(true);
      expect(result.workbook?.meta.modifiedAt).not.toBe(originalModifiedAt);
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: SetCellsOperation = {
        type: 'setCells',
        params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Test', dataType: 'string' }
          }
        }
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheet does not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'NonExistent',
          cells: {
            A1: { value: 'Test', dataType: 'string' }
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sheet not found');
    });

    it('should fail if cells object is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {} // Empty cells object
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No cells provided');
    });

    it('should fail if cell address is invalid', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            'INVALID': { value: 'Test', dataType: 'string' }
          }
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid cell address');
    });

    it('should handle budget tracker scenario', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Budget Tracker' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            // Headers
            A1: { value: 'Category', dataType: 'string', style: { bold: true } as any },
            B1: { value: 'Budget', dataType: 'string', style: { bold: true } as any },
            C1: { value: 'Actual', dataType: 'string', style: { bold: true } as any },
            D1: { value: 'Variance', dataType: 'string', style: { bold: true } as any },
            // Data rows
            A2: { value: 'Rent', dataType: 'string' },
            B2: { value: 2000, dataType: 'number', numFmt: '$#,##0.00' },
            C2: { value: 2000, dataType: 'number', numFmt: '$#,##0.00' },
            A3: { value: 'Food', dataType: 'string' },
            B3: { value: 800, dataType: 'number', numFmt: '$#,##0.00' },
            C3: { value: 850, dataType: 'number', numFmt: '$#,##0.00' },
            A4: { value: 'Transport', dataType: 'string' },
            B4: { value: 200, dataType: 'number', numFmt: '$#,##0.00' },
            C4: { value: 175, dataType: 'number', numFmt: '$#,##0.00' },
            // Formulas
            D2: { formula: '=C2-B2', dataType: 'formula' },
            D3: { formula: '=C3-B3', dataType: 'formula' },
            D4: { formula: '=C4-B4', dataType: 'formula' },
            // Totals
            A5: { value: 'Total', dataType: 'string', style: { bold: true } as any },
            B5: { formula: '=SUM(B2:B4)', dataType: 'formula', numFmt: '$#,##0.00' },
            C5: { formula: '=SUM(C2:C4)', dataType: 'formula', numFmt: '$#,##0.00' },
            D5: { formula: '=SUM(D2:D4)', dataType: 'formula', numFmt: '$#,##0.00' },
          }
        }} as SetCellsOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // Check headers
      expect(sheet?.cells?.A1.raw).toBe('Category');
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      
      // Check data
      expect(sheet?.cells?.B2.raw).toBe(2000);
      expect(sheet?.cells?.B2.numFmt).toBe('$#,##0.00');
      
      // Check formulas
      expect(sheet?.cells?.D2.formula).toBe('=C2-B2');
      
      // Check computed values
      expect(sheet?.cells?.D2.computed?.v).toBe(0); // 2000-2000
      expect(sheet?.cells?.D3.computed?.v).toBe(50); // 850-800
      expect(sheet?.cells?.D4.computed?.v).toBe(-25); // 175-200
      expect(sheet?.cells?.B5.computed?.v).toBe(3000); // Total budget
      expect(sheet?.cells?.C5.computed?.v).toBe(3025); // Total actual
      expect(sheet?.cells?.D5.computed?.v).toBe(25); // Total variance
    });
  });

  describe('setFormula operation', () => {
    it('should set a formula in a cell', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'A1', formula: '=SUM(B1:B10)' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(true);
      const sheet = getSheet(result.workbook!, sheetId!);
      expect(sheet?.cells?.A1).toBeDefined();
      expect(sheet?.cells?.A1.formula).toBe('=SUM(B1:B10)');
      expect(sheet?.cells?.A1.dataType).toBe('formula');
    });

    it('should normalize formula by adding leading = if missing', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'B2', formula: 'A1*2' }, // no leading =
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(true);
      const sheet = getSheet(result.workbook!, sheetId!);
      expect(sheet?.cells?.B2.formula).toBe('=A1*2'); // normalized with =
    });

    it('should accept sheet name instead of sheet ID', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data'] } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: 'Data', cell: 'C1', formula: '=A1+B1' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets.find((s: any) => s.name === 'Data');
      expect(sheet?.cells?.C1).toBeDefined();
      expect(sheet?.cells?.C1.formula).toBe('=A1+B1');
    });

    it('should handle complex formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const complexFormulas = [
        { cell: 'A1', formula: '=IF(B1>100,"High","Low")' },
        { cell: 'A2', formula: '=SUMIF(B:B,"Sales",A:A)' },
        { cell: 'A3', formula: '=VLOOKUP(A1,A1:B10,2,FALSE)' },
        { cell: 'A4', formula: '=COUNTIFS(A:A,">100",A:A,"<500")' },
      ];

      let finalWorkbook = createResult.workbook!;
      for (const { cell, formula } of complexFormulas) {
        const op: SetFormulaOperation = {
          type: 'setFormula',
          params: { sheet: sheetId!, cell, formula },
        };
        const result = await executor.execute([op], finalWorkbook);
        expect(result.success).toBe(true);
        finalWorkbook = result.workbook!;
      }

      const sheet = getSheet(finalWorkbook, sheetId!);
      expect(sheet?.cells?.A1?.formula).toBe('=IF(B1>100,"High","Low")');
      expect(sheet?.cells?.A2?.formula).toBe('=SUMIF(B:B,"Sales",A:A)');
      expect(sheet?.cells?.A3?.formula).toBe('=VLOOKUP(A1,A1:B10,2,FALSE)');
      expect(sheet?.cells?.A4?.formula).toBe('=COUNTIFS(A:A,">100",A:A,"<500")');
    });

    it('should handle cross-sheet formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data', 'Summary'] } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: 'Summary', cell: 'A1', formula: '=Data!A1' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(true);
      const summarySheet = result.workbook?.sheets.find((s: any) => s.name === 'Summary');
      expect(summarySheet?.cells.A1.formula).toBe('=Data!A1');
    });

    it('should handle range formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'D10', formula: '=SUM(A1:C100)' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(true);
      const sheet = getSheet(result.workbook!, sheetId!);
      expect(sheet?.cells?.D10?.formula).toBe('=SUM(A1:C100)');
    });

    it('should overwrite existing formula in cell', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      // First formula
      const setFormula1: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'A1', formula: '=SUM(B1:B10)' },
      };
      await executor.execute([setFormula1], createResult.workbook!);

      // Overwrite with new formula
      const setFormula2: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'A1', formula: '=AVERAGE(B1:B10)' },
      };
      const result = await executor.execute([setFormula2], createResult.workbook!);

      expect(result.success).toBe(true);
      const sheet = getSheet(result.workbook!, sheetId!);
      expect(sheet?.cells?.A1?.formula).toBe('=AVERAGE(B1:B10)');
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: 'Sheet1', cell: 'A1', formula: '=SUM(1,2)' },
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheet does not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: 'NonExistent', cell: 'A1', formula: '=1+1' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sheet not found');
    });

    it('should fail if cell address is invalid', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      // Truly invalid addresses (empty, whitespace, no letter, no number, etc.)
      const invalidAddresses = ['', '  ', 'A', '1', 'A1B2C'];
      
      for (const address of invalidAddresses) {
        const op: SetFormulaOperation = {
          type: 'setFormula',
          params: { sheet: sheetId!, cell: address, formula: '=1+1' },
        };
        const result = await executor.execute([op], createResult.workbook!);
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should fail if formula is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'A1', formula: '   ' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Formula is required');
    });

    it('should handle formulas with various cell references', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const referenceTypes = [
        { cell: 'B1', formula: '=A1' },              // Relative
        { cell: 'B2', formula: '=$A$1' },            // Absolute
        { cell: 'B3', formula: '=$A1' },             // Mixed (col absolute)
        { cell: 'B4', formula: '=A$1' },             // Mixed (row absolute)
        { cell: 'B5', formula: '=A1:A10' },          // Range
        { cell: 'B6', formula: '=$A$1:$C$10' },      // Absolute range
      ];

      let finalWorkbook = createResult.workbook!;
      for (const { cell, formula } of referenceTypes) {
        const op: SetFormulaOperation = {
          type: 'setFormula',
          params: { sheet: sheetId!, cell, formula },
        };
        const result = await executor.execute([op], finalWorkbook);
        expect(result.success).toBe(true);
        finalWorkbook = result.workbook!;
      }

      const sheet = getSheet(finalWorkbook, sheetId!);
      expect(sheet?.cells?.B1?.formula).toBe('=A1');
      expect(sheet?.cells?.B2?.formula).toBe('=$A$1');
      expect(sheet?.cells?.B3?.formula).toBe('=$A1');
      expect(sheet?.cells?.B4?.formula).toBe('=A$1');
      expect(sheet?.cells?.B5?.formula).toBe('=A1:A10');
      expect(sheet?.cells?.B6?.formula).toBe('=$A$1:$C$10');
    });

    it('should set multiple formulas in sequence', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;

      const operations: SetFormulaOperation[] = [
        { type: 'setFormula', params: { sheet: sheetId!, cell: 'A1', formula: '=10' } },
        { type: 'setFormula', params: { sheet: sheetId!, cell: 'A2', formula: '=20' } },
        { type: 'setFormula', params: { sheet: sheetId!, cell: 'A3', formula: '=A1+A2' } },
        { type: 'setFormula', params: { sheet: sheetId!, cell: 'A4', formula: '=SUM(A1:A3)' } },
      ];

      const result = await executor.execute(operations, createResult.workbook!);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(4);
      const sheet = getSheet(result.workbook!, sheetId!);
      expect(sheet?.cells?.A1?.formula).toBe('=10');
      expect(sheet?.cells?.A2?.formula).toBe('=20');
      expect(sheet?.cells?.A3?.formula).toBe('=A1+A2');
      expect(sheet?.cells?.A4?.formula).toBe('=SUM(A1:A3)');
    });

    it('should update workbook modifiedAt timestamp', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const originalModifiedAt = createResult.workbook?.meta.modifiedAt;
      
      // Small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const sheetId = createResult.workbook?.sheets[0].id;
      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'A1', formula: '=1+1' },
      };
      const result = await executor.execute([setFormulaOp], createResult.workbook!);

      expect(result.success).toBe(true);
      expect(result.workbook?.meta.modifiedAt).not.toBe(originalModifiedAt);
    });
  });

  describe('compute operation', () => {
    it('should compute simple formula', async () => {
      const executor = new WorkbookOperationExecutor();
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      const sheetId = createResult.workbook?.sheets[0].id;
      const sheetName = createResult.workbook?.sheets[0].name;

      // Set a simple formula
      const setFormulaOp: SetFormulaOperation = {
        type: 'setFormula',
        params: { sheet: sheetId!, cell: 'A1', formula: '=10+20' },
      };
      const setFormulaResult = await executor.execute([setFormulaOp], createResult.workbook!);

      // Compute
      const computeOp: ComputeOperation = {
        type: 'compute',
        params: {},
      };
      const result = await executor.execute([computeOp], setFormulaResult.workbook!);

      expect(result.success).toBe(true);
      expect(result.workbook?.computed?.hfCache).toBeDefined();
      
      // Check computed value (cache key uses sheet name, not ID)
      const computedKey = `${sheetName}!A1`;
      const computedValue = result.workbook?.computed?.hfCache?.[computedKey];
      expect(computedValue).toBeDefined();
      expect(computedValue?.v).toBe(30);
    });

    it('should compute multiple dependent formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 100, dataType: 'number' },
            A2: { value: 200, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A3', formula: '=A1+A2' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A4', formula: '=A3*2' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      
      // Get sheet name (cache key uses sheet name, not ID)
      const sheetName = result.workbook?.sheets[0].name;
      
      // Check computed values
      const a3Key = `${sheetName}!A3`;
      const a4Key = `${sheetName}!A4`;
      expect(result.workbook?.computed?.hfCache?.[a3Key]?.v).toBe(300); // 100+200
      expect(result.workbook?.computed?.hfCache?.[a4Key]?.v).toBe(600); // 300*2
    });

    it('should compute formulas across multiple sheets', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data', 'Summary'] } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Data', 
          cells: {
            A1: { value: 50, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'A1', formula: '=Data!A1*2' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      
      // Check cross-sheet formula computed correctly (cache key uses sheet name)
      const a1Key = `Summary!A1`;
      expect(result.workbook?.computed?.hfCache?.[a1Key]?.v).toBe(100); // 50*2
    });

    it('should handle SUM function', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 10, dataType: 'number' },
            A2: { value: 20, dataType: 'number' },
            A3: { value: 30, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A4', formula: '=SUM(A1:A3)' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheetName = result.workbook?.sheets[0].name;
      const a4Key = `${sheetName}!A4`;
      expect(result.workbook?.computed?.hfCache?.[a4Key]?.v).toBe(60); // 10+20+30
    });

    it('should handle AVERAGE function', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            B1: { value: 100, dataType: 'number' },
            B2: { value: 200, dataType: 'number' },
            B3: { value: 300, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'B4', formula: '=AVERAGE(B1:B3)' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheetName = result.workbook?.sheets[0].name;
      const b4Key = `${sheetName}!B4`;
      expect(result.workbook?.computed?.hfCache?.[b4Key]?.v).toBe(200); // (100+200+300)/3
    });

    it('should handle IF function', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            C1: { value: 150, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'C2', formula: '=IF(C1>100,"High","Low")' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheetName = result.workbook?.sheets[0].name;
      const c2Key = `${sheetName}!C2`;
      expect(result.workbook?.computed?.hfCache?.[c2Key]?.v).toBe('High'); // C1=150>100
    });

    it('should handle nested formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            D1: { value: 10, dataType: 'number' },
            D2: { value: 20, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'D3', formula: '=IF(SUM(D1:D2)>25,SUM(D1:D2)*2,SUM(D1:D2)/2)' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheetName = result.workbook?.sheets[0].name;
      const d3Key = `${sheetName}!D3`;
      expect(result.workbook?.computed?.hfCache?.[d3Key]?.v).toBe(60); // SUM=30>25, so 30*2=60
    });

    it('should handle formula errors gracefully (#DIV/0!)', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            E1: { value: 100, dataType: 'number' },
            E2: { value: 0, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'E3', formula: '=E1/E2' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      // Compute should succeed even with formula errors
      expect(result.success).toBe(true);
      
      // Check that error is captured in warnings
      expect(result.warnings).toBeDefined();
      // Note: Formula errors may be stored as warnings
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operation: ComputeOperation = {
        type: 'compute',
        params: {},
      };

      const result = await executor.execute([operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if workbook has no sheets', async () => {
      const executor = new WorkbookOperationExecutor();
      
      // Create workbook then manually remove all sheets (edge case)
      const createOps = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];
      const createResult = await executor.execute(createOps);
      
      // Manually remove all sheets (for testing purposes)
      createResult.workbook!.sheets = [];

      const computeOp: ComputeOperation = {
        type: 'compute',
        params: {},
      };
      const result = await executor.execute([computeOp], createResult.workbook!);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('no sheets');
    });

    it('should recompute after multiple operations', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            F1: { value: 5, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'F2', formula: '=F1*10' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheetName = result.workbook?.sheets[0].name;
      const f2Key = `${sheetName}!F2`;
      expect(result.workbook?.computed?.hfCache?.[f2Key]?.v).toBe(50); // 5*10
    });

    it('should destroy previous HF instance when computing multiple times', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A1', formula: '=10' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A2', formula: '=20' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      // Should succeed and not leak memory
      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(5);
    });

    it('should handle compute with debug logging', async () => {
      const logs: any[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args);

      const executor = new WorkbookOperationExecutor({ debug: true });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A1', formula: '=100' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      await executor.execute(operations);

      console.log = originalLog;

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.some((arg: any) => 
        typeof arg === 'string' && (arg.includes('compute') || arg.includes('Compute'))
      ))).toBe(true);
    });

    it('should handle complex budget scenario', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Budget', initialSheets: ['Income', 'Expenses', 'Summary'] } } as CreateWorkbookOperation,
        
        // Income sheet
        { type: 'setCells', params: { 
          sheet: 'Income', 
          cells: {
            A1: { value: 'Salary', dataType: 'string' },
            B1: { value: 5000, dataType: 'number' },
            A2: { value: 'Freelance', dataType: 'string' },
            B2: { value: 1500, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Income', cell: 'B3', formula: '=SUM(B1:B2)' } } as SetFormulaOperation,
        
        // Expenses sheet
        { type: 'setCells', params: { 
          sheet: 'Expenses', 
          cells: {
            A1: { value: 'Rent', dataType: 'string' },
            B1: { value: 2000, dataType: 'number' },
            A2: { value: 'Food', dataType: 'string' },
            B2: { value: 800, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Expenses', cell: 'B3', formula: '=SUM(B1:B2)' } } as SetFormulaOperation,
        
        // Summary sheet
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'B1', formula: '=Income!B3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'B2', formula: '=Expenses!B3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'B3', formula: '=B1-B2' } } as SetFormulaOperation,
        
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      
      // Check Summary calculations (cache key uses sheet name)
      expect(result.workbook?.computed?.hfCache?.['Summary!B1']?.v).toBe(6500); // Total income
      expect(result.workbook?.computed?.hfCache?.['Summary!B2']?.v).toBe(2800); // Total expenses
      expect(result.workbook?.computed?.hfCache?.['Summary!B3']?.v).toBe(3700); // Net (6500-2800)
    });
  });

  describe('applyFormat operation', () => {
    it('should apply style formatting to a single cell', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 'Header', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            style: { bold: true, bgColor: '#f0f0f0' }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A1.style?.bgColor).toBe('#f0f0f0');
      expect(sheet?.cells?.A1.raw).toBe('Header'); // Data preserved
    });

    it('should apply number format to cells', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 1234.56, dataType: 'number' } } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            numFmt: '#,##0.00'
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.numFmt).toBe('#,##0.00');
      expect(sheet?.cells?.A1.raw).toBe(1234.56); // Data preserved
    });

    it('should apply formatting to a range of cells', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 'Q1', dataType: 'string' },
            B1: { value: 'Q2', dataType: 'string' },
            C1: { value: 'Q3', dataType: 'string' },
          } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1:C1',
          format: {
            style: { bold: true, alignment: { horizontal: 'center' } }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // All cells in range should have formatting
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A1.style?.alignment?.horizontal).toBe('center');
      expect(sheet?.cells?.B1.style?.bold).toBe(true);
      expect(sheet?.cells?.B1.style?.alignment?.horizontal).toBe('center');
      expect(sheet?.cells?.C1.style?.bold).toBe(true);
      expect(sheet?.cells?.C1.style?.alignment?.horizontal).toBe('center');
    });

    it('should apply borders to cells', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 'Total', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            borders: { bottom: true }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.style?.border?.bottom).toEqual({ style: 'thin' });
    });

    it('should apply all borders to cells', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1:B2',
          format: {
            borders: { all: true }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // Check all cells in range have all borders
      expect(sheet?.cells?.A1.style?.border?.top).toEqual({ style: 'thin' });
      expect(sheet?.cells?.A1.style?.border?.bottom).toEqual({ style: 'thin' });
      expect(sheet?.cells?.A1.style?.border?.left).toEqual({ style: 'thin' });
      expect(sheet?.cells?.A1.style?.border?.right).toEqual({ style: 'thin' });
      
      expect(sheet?.cells?.B2.style?.border?.top).toEqual({ style: 'thin' });
      expect(sheet?.cells?.B2.style?.border?.bottom).toEqual({ style: 'thin' });
      expect(sheet?.cells?.B2.style?.border?.left).toEqual({ style: 'thin' });
      expect(sheet?.cells?.B2.style?.border?.right).toEqual({ style: 'thin' });
    });

    it('should create cells with formatting if they do not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'D5',
          format: {
            style: { bgColor: '#ffff00' },
            numFmt: '0.00%'
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // Cell should be created with formatting
      expect(sheet?.cells?.D5).toBeDefined();
      expect(sheet?.cells?.D5.style?.bgColor).toBe('#ffff00');
      expect(sheet?.cells?.D5.numFmt).toBe('0.00%');
    });

    it('should merge formatting with existing style properties', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 'Text', dataType: 'string', style: { bold: true } as any } } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            style: { italic: true, color: '#0000ff' }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // Both old and new styles should be preserved
      expect(sheet?.cells?.A1.style?.bold).toBe(true); // existing
      expect(sheet?.cells?.A1.style?.italic).toBe(true); // new
      expect(sheet?.cells?.A1.style?.color).toBe('#0000ff'); // new
    });

    it('should apply combined formatting (style + numFmt + borders)', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 0.85, dataType: 'number' } } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            style: { bold: true, bgColor: '#e0ffe0' },
            numFmt: '0.0%',
            borders: { all: true }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A1.style?.bgColor).toBe('#e0ffe0');
      expect(sheet?.cells?.A1.numFmt).toBe('0.0%');
      expect(sheet?.cells?.A1.style?.border?.top).toEqual({ style: 'thin' });
      expect(sheet?.cells?.A1.raw).toBe(0.85); // Data preserved
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: { style: { bold: true } }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheet does not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'applyFormat', params: {
          sheet: 'NonExistent',
          range: 'A1',
          format: { style: { bold: true } }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sheet not found');
    });

    it('should fail if range is invalid', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'INVALID',
          format: { style: { bold: true } }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid cell range');
    });

    it('should fail if format is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {}
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Format specification is required');
    });

    it('should work with sheet name instead of ID', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data'] } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Data', 
          cells: { A1: { value: 'Title', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Data',
          range: 'A1',
          format: {
            style: { fontSize: 16, bold: true }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets.find((s: any) => s.name === 'Data');
      expect(sheet?.cells?.A1.style?.fontSize).toBe(16);
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
    });

    it('should handle multi-cell range expansion', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1:C2',
          format: {
            style: { bgColor: '#cccccc' }
          }
        }} as ApplyFormatOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // All 6 cells in range should have formatting
      expect(sheet?.cells?.A1.style?.bgColor).toBe('#cccccc');
      expect(sheet?.cells?.A2.style?.bgColor).toBe('#cccccc');
      expect(sheet?.cells?.B1.style?.bgColor).toBe('#cccccc');
      expect(sheet?.cells?.B2.style?.bgColor).toBe('#cccccc');
      expect(sheet?.cells?.C1.style?.bgColor).toBe('#cccccc');
      expect(sheet?.cells?.C2.style?.bgColor).toBe('#cccccc');
    });
  });

  describe('mergeCells operation', () => {
    it('should merge a simple cell range', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 'Merged Header', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'A1:D1'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.mergedRanges).toContain('A1:D1');
      expect(sheet?.mergedRanges?.length).toBe(1);
      expect(sheet?.cells?.A1.raw).toBe('Merged Header'); // Data preserved
    });

    it('should merge multiple non-overlapping ranges', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 'Header 1', dataType: 'string' },
            A2: { value: 'Header 2', dataType: 'string' },
            A3: { value: 'Header 3', dataType: 'string' },
          } 
        }} as SetCellsOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A1:B1' }} as MergeCellsOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A2:C2' }} as MergeCellsOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A3:D3' }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.mergedRanges).toContain('A1:B1');
      expect(sheet?.mergedRanges).toContain('A2:C2');
      expect(sheet?.mergedRanges).toContain('A3:D3');
      expect(sheet?.mergedRanges?.length).toBe(3);
    });

    it('should merge vertical range', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 'Vertical Merge', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'A1:A5'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.mergedRanges).toContain('A1:A5');
    });

    it('should merge a 2D rectangular range', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'B2:D4'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.mergedRanges).toContain('B2:D4');
    });

    it('should warn if range is already merged', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A1:D1' }} as MergeCellsOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A1:D1' }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.mergedRanges?.length).toBe(1); // Only one merge
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('Range A1:D1 is already merged');
    });

    it('should fail if ranges overlap', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A1:C1' }} as MergeCellsOperation,
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'B1:D1' }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('overlaps with existing merged range');
    });

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'A1:B1'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheet does not exist', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: {
          sheet: 'NonExistent',
          range: 'A1:B1'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sheet not found');
    });

    it('should fail if range is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: ''
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('required and cannot be empty');
    });

    it('should fail if range is a single cell', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'A1'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must contain at least 2 cells');
    });

    it('should fail if range is invalid', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'INVALID:RANGE'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid merge range');
    });

    it('should work with sheet name instead of ID', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data'] } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Data', 
          cells: { A1: { value: 'Title', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'mergeCells', params: {
          sheet: 'Data',
          range: 'A1:E1'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets.find((s: any) => s.name === 'Data');
      expect(sheet?.mergedRanges).toContain('A1:E1');
    });

    it('should preserve cell data when merging', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 'Top Left', dataType: 'string', style: { bold: true } as any },
            B1: { value: 'Will be merged', dataType: 'string' },
          } 
        }} as SetCellsOperation,
        { type: 'mergeCells', params: {
          sheet: 'Sheet1',
          range: 'A1:B1'
        }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      
      // Top-left cell data should be preserved
      expect(sheet?.cells?.A1.raw).toBe('Top Left');
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      
      // Other cells should still exist (merge is just metadata)
      expect(sheet?.cells?.B1.raw).toBe('Will be merged');
      
      // Merge metadata should be added
      expect(sheet?.mergedRanges).toContain('A1:B1');
    });

    it('should handle complex nested merge structure', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 'Sales Report 2024', dataType: 'string' },
            A2: { value: 'Q1', dataType: 'string' },
            E2: { value: 'Q2', dataType: 'string' },
          } 
        }} as SetCellsOperation,
        // Top header spanning all columns
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A1:H1' }} as MergeCellsOperation,
        // Q1 section
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A2:D2' }} as MergeCellsOperation,
        // Q2 section
        { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'E2:H2' }} as MergeCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.mergedRanges).toContain('A1:H1');
      expect(sheet?.mergedRanges).toContain('A2:D2');
      expect(sheet?.mergedRanges).toContain('E2:H2');
      expect(sheet?.mergedRanges?.length).toBe(3);
    });
  });

  // ============================================================================
  // defineNamedRange Operation Tests
  // ============================================================================

  describe('plan mode enforcement', () => {
    it('should block all operations when mode=plan', async () => {
      const executor = new WorkbookOperationExecutor({ mode: 'plan' });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: { A1: { value: 'Hello', dataType: 'string' } } 
        }} as SetCellsOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PLAN_MODE_BLOCKED');
      expect(result.errors[0].message).toContain('PLAN mode');
      expect(result.operationsExecuted).toBe(0);
      expect(result.operationsTotal).toBe(2);
    });

    it('should allow operations when mode=act', async () => {
      const executor = new WorkbookOperationExecutor({ mode: 'act' });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(1);
    });

    it('should default to act mode when mode not specified', async () => {
      const executor = new WorkbookOperationExecutor(); // No mode specified
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(1);
    });

    it('should include helpful warnings in plan mode', async () => {
      const executor = new WorkbookOperationExecutor({ mode: 'plan' });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      expect(result.warnings!.some(w => w.includes('ACT mode'))).toBe(true);
    });

    it('should preserve existing workbook when blocked in plan mode', async () => {
      const executor1 = new WorkbookOperationExecutor();
      const createResult = await executor1.execute([
        { type: 'createWorkbook', params: { name: 'Existing' } } as CreateWorkbookOperation,
      ]);

      const executor2 = new WorkbookOperationExecutor({ mode: 'plan' });
      const result = await executor2.execute(
        [
          { type: 'setCells', params: { 
            sheet: 'Sheet1', 
            cells: { A1: { value: 'Should not execute', dataType: 'string' } } 
          }} as SetCellsOperation,
        ],
        createResult.workbook!
      );

      expect(result.success).toBe(false);
      expect(result.workbook).toBeDefined();
      expect(result.workbook?.meta.title).toBe('Existing');
      // Cell should not have been set
      expect(result.workbook?.sheets[0].cells?.A1).toBeUndefined();
    });

    it('should log plan mode blocking when debug=true', async () => {
      const logs: any[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args);

      const executor = new WorkbookOperationExecutor({ mode: 'plan', debug: true });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
      ];

      await executor.execute(operations);

      console.log = originalLog;

      expect(logs.some(log => 
        log.some((arg: any) => typeof arg === 'string' && arg.includes('PLAN mode'))
      )).toBe(true);
    });

    it('should work with convenience function executeOperations', async () => {
      const { executeOperations } = await import('../executor');
      
      const result = await executeOperations(
        [{ type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation],
        null,
        { mode: 'plan' }
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('PLAN_MODE_BLOCKED');
    });

    it('should handle complex operation sequences in plan mode', async () => {
      const executor = new WorkbookOperationExecutor({ mode: 'plan' });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Budget' } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'Q1' } } as AddSheetOperation,
        { type: 'addSheet', params: { name: 'Q2' } } as AddSheetOperation,
        { type: 'setCells', params: { 
          sheet: 'Q1', 
          cells: { A1: { value: 'Revenue', dataType: 'string' } } 
        }} as SetCellsOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('PLAN_MODE_BLOCKED');
      expect(result.operationsExecuted).toBe(0);
      expect(result.operationsTotal).toBe(5);
      expect(result.workbook).toBeUndefined();
    });

    it('should provide clear error message for UI display', async () => {
      const executor = new WorkbookOperationExecutor({ mode: 'plan' });
      const operations = [
        { type: 'setFormula', params: { 
          sheet: 'Sheet1', 
          cell: 'A1', 
          formula: '=SUM(B1:B10)' 
        }} as SetFormulaOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Cannot execute operations in PLAN mode');
      expect(result.errors[0].message).toContain('Switch to ACT mode');
    });
  });

  describe('executeDefineNamedRange', () => {
    it('should create workbook-scoped named range', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'SalesData',
          sheet: 'Sheet1',
          range: 'A1:D100',
          scope: 'workbook'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.namedRanges).toBeDefined();
      expect(result.workbook?.namedRanges?.['SalesData']).toBeDefined();
      
      const nr = result.workbook?.namedRanges?.['SalesData'] as any;
      expect(nr.name).toBe('SalesData');
      expect(nr.ref).toBe('Sheet1!$A$1:$D$100'); // Converted to absolute
      expect(nr.scope).toBe('workbook');
    });

    it('should create sheet-scoped named range', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Data'] } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'LocalRange',
          sheet: 'Data',
          range: 'B2:E50',
          scope: 'sheet'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const sheet = result.workbook?.sheets.find((s: any) => s.name === 'Data');
      expect(sheet?.namedRanges).toBeDefined();
      expect(sheet?.namedRanges?.['LocalRange']).toBeDefined();
      
      const nr = sheet?.namedRanges?.['LocalRange'] as any;
      expect(nr.name).toBe('LocalRange');
      expect(nr.ref).toBe('Data!$B$2:$E$50');
      expect(nr.scope).toBe(sheet?.id);
    });

    it('should default to workbook scope when not specified', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'DefaultScope',
          sheet: 'Sheet1',
          range: 'A1:A10'
          // scope not specified
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.namedRanges?.['DefaultScope']).toBeDefined();
    });

    it('should convert relative references to absolute ($A$1)', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'TestRange',
          sheet: 'Sheet1',
          range: 'C5:F20' // Relative reference
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const nr = result.workbook?.namedRanges?.['TestRange'] as any;
      expect(nr.ref).toBe('Sheet1!$C$5:$F$20'); // Converted to absolute
    });

    it('should handle single cell named range', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'TaxRate',
          sheet: 'Sheet1',
          range: 'A1'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const nr = result.workbook?.namedRanges?.['TaxRate'] as any;
      expect(nr.ref).toBe('Sheet1!$A$1');
    });

    it('should handle already absolute references', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'AbsRange',
          sheet: 'Sheet1',
          range: '$B$2:$D$10' // Already absolute
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const nr = result.workbook?.namedRanges?.['AbsRange'] as any;
      expect(nr.ref).toBe('Sheet1!$B$2:$D$10');
    });

    it('should allow underscores and dots in names', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Sales_Q1.2024',
          sheet: 'Sheet1',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.namedRanges?.['Sales_Q1.2024']).toBeDefined();
    });

    it('should create multiple named ranges', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Revenue',
          sheet: 'Sheet1',
          range: 'A1:A100'
        }} as any,
        { type: 'defineNamedRange', params: {
          name: 'Expenses',
          sheet: 'Sheet1',
          range: 'B1:B100'
        }} as any,
        { type: 'defineNamedRange', params: {
          name: 'Profit',
          sheet: 'Sheet1',
          range: 'C1:C100'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.namedRanges?.['Revenue']).toBeDefined();
      expect(result.workbook?.namedRanges?.['Expenses']).toBeDefined();
      expect(result.workbook?.namedRanges?.['Profit']).toBeDefined();
      expect(Object.keys(result.workbook?.namedRanges || {}).length).toBe(3);
    });

    it('should work with sheet name instead of ID', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test', initialSheets: ['Sales'] } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'SalesData',
          sheet: 'Sales', // Using name
          range: 'A1:D100'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      const nr = result.workbook?.namedRanges?.['SalesData'] as any;
      expect(nr.ref).toBe('Sales!$A$1:$D$100');
    });

    // Validation tests

    it('should fail if no workbook exists', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'defineNamedRange', params: {
          name: 'Test',
          sheet: 'Sheet1',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No workbook exists');
    });

    it('should fail if sheet not found', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Test',
          sheet: 'NonExistent',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sheet not found: NonExistent');
    });

    it('should fail if name is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: '',
          sheet: 'Sheet1',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('name is required');
    });

    it('should fail if range is empty', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Test',
          sheet: 'Sheet1',
          range: ''
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('reference is required');
    });

    it('should fail if name contains spaces', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Invalid Name',
          sheet: 'Sheet1',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid named range name');
    });

    it('should fail if name starts with number', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: '123Range',
          sheet: 'Sheet1',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid named range name');
    });

    it('should fail if name is a cell reference', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'A1',
          sheet: 'Sheet1',
          range: 'B1:B10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('cannot be a cell reference');
    });

    it('should fail if name is Excel reserved word', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'TRUE',
          sheet: 'Sheet1',
          range: 'A1:A10'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('cannot be an Excel reserved word');
    });

    it('should fail if range is invalid', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Test',
          sheet: 'Sheet1',
          range: 'INVALID:RANGE'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid range reference');
    });

    it('should fail if duplicate name at workbook scope', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'DuplicateName',
          sheet: 'Sheet1',
          range: 'A1:A10',
          scope: 'workbook'
        }} as any,
        { type: 'defineNamedRange', params: {
          name: 'DuplicateName',
          sheet: 'Sheet1',
          range: 'B1:B10',
          scope: 'workbook'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('already exists at workbook scope');
    });

    it('should fail if duplicate name at sheet scope', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'LocalDuplicate',
          sheet: 'Sheet1',
          range: 'A1:A10',
          scope: 'sheet'
        }} as any,
        { type: 'defineNamedRange', params: {
          name: 'LocalDuplicate',
          sheet: 'Sheet1',
          range: 'B1:B10',
          scope: 'sheet'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('already exists in sheet');
    });

    it('should fail if invalid scope', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'defineNamedRange', params: {
          name: 'Test',
          sheet: 'Sheet1',
          range: 'A1:A10',
          scope: 'invalid'
        }} as any,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid scope');
    });

    // Integration test with formulas

    it('should allow named ranges to be used in formulas', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Test' } } as CreateWorkbookOperation,
        { type: 'setCells', params: { 
          sheet: 'Sheet1', 
          cells: {
            A1: { value: 10, dataType: 'number' },
            A2: { value: 20, dataType: 'number' },
            A3: { value: 30, dataType: 'number' },
          } 
        }} as SetCellsOperation,
        { type: 'defineNamedRange', params: {
          name: 'SalesData',
          sheet: 'Sheet1',
          range: 'A1:A3'
        }} as any,
        { type: 'setFormula', params: {
          sheet: 'Sheet1',
          cell: 'B1',
          formula: '=SUM(SalesData)'
        }} as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.namedRanges?.['SalesData']).toBeDefined();
      
      // Formula should use named range
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.B1.formula).toBe('=SUM(SalesData)');
      
      // Computed value should be sum of A1:A3 (10+20+30=60)
      expect(sheet?.cells?.B1.computed?.v).toBe(60);
    });
  });

  // ============================================================================
  // Integration Tests - Multi-Step Operation Sequences
  // ============================================================================

  describe('integration: operation sequences', () => {
    it('should execute create → setCells → compute sequence', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Simple Budget' } } as CreateWorkbookOperation,
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Income', dataType: 'string', style: { bold: true } as any },
            A2: { value: 5000, dataType: 'number', numFmt: '$#,##0.00' },
            B1: { value: 'Expenses', dataType: 'string', style: { bold: true } as any },
            B2: { value: 3500, dataType: 'number', numFmt: '$#,##0.00' },
            C1: { value: 'Balance', dataType: 'string', style: { bold: true } as any },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'C2', formula: '=A2-B2' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(4);
      
      const sheet = result.workbook?.sheets[0];
      
      // Verify data structure
      expect(sheet?.cells?.A1.raw).toBe('Income');
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A2.raw).toBe(5000);
      expect(sheet?.cells?.A2.numFmt).toBe('$#,##0.00');
      expect(sheet?.cells?.B2.raw).toBe(3500);
      expect(sheet?.cells?.C2.formula).toBe('=A2-B2');
      
      // Verify computation
      expect(sheet?.cells?.C2.computed?.v).toBe(1500); // 5000-3500
    });

    it('should execute create → addSheet → setCells → setFormula → compute sequence', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Multi-Sheet Budget', initialSheets: ['Income'] } } as CreateWorkbookOperation,
        { type: 'addSheet', params: { name: 'Expenses' } } as AddSheetOperation,
        { type: 'addSheet', params: { name: 'Summary' } } as AddSheetOperation,
        
        // Income sheet
        { type: 'setCells', params: {
          sheet: 'Income',
          cells: {
            A1: { value: 'Salary', dataType: 'string' },
            B1: { value: 6000, dataType: 'number' },
            A2: { value: 'Freelance', dataType: 'string' },
            B2: { value: 2000, dataType: 'number' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Income', cell: 'B3', formula: '=SUM(B1:B2)' } } as SetFormulaOperation,
        
        // Expenses sheet
        { type: 'setCells', params: {
          sheet: 'Expenses',
          cells: {
            A1: { value: 'Rent', dataType: 'string' },
            B1: { value: 2500, dataType: 'number' },
            A2: { value: 'Utilities', dataType: 'string' },
            B2: { value: 500, dataType: 'number' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Expenses', cell: 'B3', formula: '=SUM(B1:B2)' } } as SetFormulaOperation,
        
        // Summary sheet with cross-sheet references
        { type: 'setCells', params: {
          sheet: 'Summary',
          cells: {
            A1: { value: 'Total Income', dataType: 'string', style: { bold: true } as any },
            A2: { value: 'Total Expenses', dataType: 'string', style: { bold: true } as any },
            A3: { value: 'Net Savings', dataType: 'string', style: { bold: true, bgColor: '#e0ffe0' } as any },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'B1', formula: '=Income!B3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'B2', formula: '=Expenses!B3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Summary', cell: 'B3', formula: '=B1-B2' } } as SetFormulaOperation,
        
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(12);
      expect(result.workbook?.sheets).toHaveLength(3);
      
      // Verify Income sheet computations
      const incomeSheet = result.workbook?.sheets.find((s: any) => s.name === 'Income');
      expect(incomeSheet?.cells?.B3.computed?.v).toBe(8000); // 6000+2000
      
      // Verify Expenses sheet computations
      const expensesSheet = result.workbook?.sheets.find((s: any) => s.name === 'Expenses');
      expect(expensesSheet?.cells?.B3.computed?.v).toBe(3000); // 2500+500
      
      // Verify Summary sheet computations (cross-sheet formulas)
      const summarySheet = result.workbook?.sheets.find((s: any) => s.name === 'Summary');
      expect(summarySheet?.cells?.B1.computed?.v).toBe(8000); // =Income!B3
      expect(summarySheet?.cells?.B2.computed?.v).toBe(3000); // =Expenses!B3
      expect(summarySheet?.cells?.B3.computed?.v).toBe(5000); // 8000-3000
      expect(summarySheet?.cells?.A3.style?.bgColor).toBe('#e0ffe0');
    });

    it('should execute budget tracker with formatting and named ranges', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Budget Tracker 2024' } } as CreateWorkbookOperation,
        
        // Headers
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Category', dataType: 'string' },
            B1: { value: 'Budgeted', dataType: 'string' },
            C1: { value: 'Actual', dataType: 'string' },
            D1: { value: 'Variance', dataType: 'string' },
            E1: { value: 'Status', dataType: 'string' },
          }
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1:E1',
          format: {
            style: { bold: true, bgColor: '#4472c4', color: '#ffffff', alignment: { horizontal: 'center' } },
            borders: { all: true }
          }
        }} as ApplyFormatOperation,
        
        // Data rows
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A2: { value: 'Housing', dataType: 'string' },
            B2: { value: 2000, dataType: 'number', numFmt: '$#,##0.00' },
            C2: { value: 2100, dataType: 'number', numFmt: '$#,##0.00' },
            A3: { value: 'Transportation', dataType: 'string' },
            B3: { value: 500, dataType: 'number', numFmt: '$#,##0.00' },
            C3: { value: 450, dataType: 'number', numFmt: '$#,##0.00' },
            A4: { value: 'Food', dataType: 'string' },
            B4: { value: 800, dataType: 'number', numFmt: '$#,##0.00' },
            C4: { value: 850, dataType: 'number', numFmt: '$#,##0.00' },
            A5: { value: 'Entertainment', dataType: 'string' },
            B5: { value: 300, dataType: 'number', numFmt: '$#,##0.00' },
            C5: { value: 250, dataType: 'number', numFmt: '$#,##0.00' },
          }
        }} as SetCellsOperation,
        
        // Variance formulas
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'D2', formula: '=C2-B2' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'D3', formula: '=C3-B3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'D4', formula: '=C4-B4' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'D5', formula: '=C5-B5' } } as SetFormulaOperation,
        
        // Status formulas (IF statements)
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'E2', formula: '=IF(D2>0,"Over","Under")' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'E3', formula: '=IF(D3>0,"Over","Under")' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'E4', formula: '=IF(D4>0,"Over","Under")' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'E5', formula: '=IF(D5>0,"Over","Under")' } } as SetFormulaOperation,
        
        // Format variance columns with currency
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'D2:D5',
          format: {
            numFmt: '$#,##0.00',
            borders: { all: true }
          }
        }} as ApplyFormatOperation,
        
        // Total row
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A6: { value: 'TOTAL', dataType: 'string' },
          }
        }} as SetCellsOperation,
        { type: 'defineNamedRange', params: {
          name: 'BudgetedAmounts',
          sheet: 'Sheet1',
          range: 'B2:B5',
          scope: 'workbook'
        }} as any,
        { type: 'defineNamedRange', params: {
          name: 'ActualAmounts',
          sheet: 'Sheet1',
          range: 'C2:C5',
          scope: 'workbook'
        }} as any,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'B6', formula: '=SUM(BudgetedAmounts)' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'C6', formula: '=SUM(ActualAmounts)' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'D6', formula: '=C6-B6' } } as SetFormulaOperation,
        
        // Format total row
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A6:E6',
          format: {
            style: { bold: true, bgColor: '#d9e1f2' },
            borders: { all: true }
          }
        }} as ApplyFormatOperation,
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'B6:D6',
          format: {
            numFmt: '$#,##0.00'
          }
        }} as ApplyFormatOperation,
        
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.operationsExecuted).toBe(22);
      
      const sheet = result.workbook?.sheets[0];
      
      // Verify headers are formatted
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.A1.style?.bgColor).toBe('#4472c4');
      
      // Verify variance calculations
      expect(sheet?.cells?.D2.computed?.v).toBe(100); // 2100-2000 (over budget)
      expect(sheet?.cells?.D3.computed?.v).toBe(-50); // 450-500 (under budget)
      expect(sheet?.cells?.D4.computed?.v).toBe(50); // 850-800 (over budget)
      expect(sheet?.cells?.D5.computed?.v).toBe(-50); // 250-300 (under budget)
      
      // Verify status formulas
      expect(sheet?.cells?.E2.computed?.v).toBe('Over');
      expect(sheet?.cells?.E3.computed?.v).toBe('Under');
      expect(sheet?.cells?.E4.computed?.v).toBe('Over');
      expect(sheet?.cells?.E5.computed?.v).toBe('Under');
      
      // Verify named ranges exist
      expect(result.workbook?.namedRanges?.['BudgetedAmounts']).toBeDefined();
      expect(result.workbook?.namedRanges?.['ActualAmounts']).toBeDefined();
      
      // Verify total calculations using named ranges
      expect(sheet?.cells?.B6.computed?.v).toBe(3600); // Total budgeted
      expect(sheet?.cells?.C6.computed?.v).toBe(3650); // Total actual
      expect(sheet?.cells?.D6.computed?.v).toBe(50); // Total variance
      
      // Verify total row formatting
      expect(sheet?.cells?.A6.style?.bold).toBe(true);
      expect(sheet?.cells?.A6.style?.bgColor).toBe('#d9e1f2');
      expect(sheet?.cells?.B6.numFmt).toBe('$#,##0.00');
    });

    it('should execute sales report with multiple sheets and formatting', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Q1 Sales Report', initialSheets: ['January', 'February', 'March', 'Q1 Summary'] } } as CreateWorkbookOperation,
        
        // January data
        { type: 'setCells', params: {
          sheet: 'January',
          cells: {
            A1: { value: 'Product', dataType: 'string', style: { bold: true } as any },
            B1: { value: 'Units Sold', dataType: 'string', style: { bold: true } as any },
            C1: { value: 'Unit Price', dataType: 'string', style: { bold: true } as any },
            D1: { value: 'Revenue', dataType: 'string', style: { bold: true } as any },
            A2: { value: 'Widget A', dataType: 'string' },
            B2: { value: 100, dataType: 'number' },
            C2: { value: 25, dataType: 'number', numFmt: '$#,##0.00' },
            A3: { value: 'Widget B', dataType: 'string' },
            B3: { value: 75, dataType: 'number' },
            C3: { value: 40, dataType: 'number', numFmt: '$#,##0.00' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'January', cell: 'D2', formula: '=B2*C2' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'January', cell: 'D3', formula: '=B3*C3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'January', cell: 'D4', formula: '=SUM(D2:D3)' } } as SetFormulaOperation,
        { type: 'setCells', params: {
          sheet: 'January',
          cells: { A4: { value: 'Total', dataType: 'string', style: { bold: true } as any } }
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'January',
          range: 'D2:D4',
          format: { numFmt: '$#,##0.00' }
        }} as ApplyFormatOperation,
        
        // February data
        { type: 'setCells', params: {
          sheet: 'February',
          cells: {
            A1: { value: 'Product', dataType: 'string', style: { bold: true } as any },
            B1: { value: 'Units Sold', dataType: 'string', style: { bold: true } as any },
            C1: { value: 'Unit Price', dataType: 'string', style: { bold: true } as any },
            D1: { value: 'Revenue', dataType: 'string', style: { bold: true } as any },
            A2: { value: 'Widget A', dataType: 'string' },
            B2: { value: 120, dataType: 'number' },
            C2: { value: 25, dataType: 'number', numFmt: '$#,##0.00' },
            A3: { value: 'Widget B', dataType: 'string' },
            B3: { value: 90, dataType: 'number' },
            C3: { value: 40, dataType: 'number', numFmt: '$#,##0.00' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'February', cell: 'D2', formula: '=B2*C2' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'February', cell: 'D3', formula: '=B3*C3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'February', cell: 'D4', formula: '=SUM(D2:D3)' } } as SetFormulaOperation,
        { type: 'setCells', params: {
          sheet: 'February',
          cells: { A4: { value: 'Total', dataType: 'string', style: { bold: true } as any } }
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'February',
          range: 'D2:D4',
          format: { numFmt: '$#,##0.00' }
        }} as ApplyFormatOperation,
        
        // March data
        { type: 'setCells', params: {
          sheet: 'March',
          cells: {
            A1: { value: 'Product', dataType: 'string', style: { bold: true } as any },
            B1: { value: 'Units Sold', dataType: 'string', style: { bold: true } as any },
            C1: { value: 'Unit Price', dataType: 'string', style: { bold: true } as any },
            D1: { value: 'Revenue', dataType: 'string', style: { bold: true } as any },
            A2: { value: 'Widget A', dataType: 'string' },
            B2: { value: 110, dataType: 'number' },
            C2: { value: 25, dataType: 'number', numFmt: '$#,##0.00' },
            A3: { value: 'Widget B', dataType: 'string' },
            B3: { value: 85, dataType: 'number' },
            C3: { value: 40, dataType: 'number', numFmt: '$#,##0.00' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'March', cell: 'D2', formula: '=B2*C2' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'March', cell: 'D3', formula: '=B3*C3' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'March', cell: 'D4', formula: '=SUM(D2:D3)' } } as SetFormulaOperation,
        { type: 'setCells', params: {
          sheet: 'March',
          cells: { A4: { value: 'Total', dataType: 'string', style: { bold: true } as any } }
        }} as SetCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'March',
          range: 'D2:D4',
          format: { numFmt: '$#,##0.00' }
        }} as ApplyFormatOperation,
        
        // Q1 Summary with cross-sheet formulas
        { type: 'setCells', params: {
          sheet: 'Q1 Summary',
          cells: {
            A1: { value: 'Q1 2024 Summary', dataType: 'string' },
            A2: { value: 'Month', dataType: 'string', style: { bold: true } as any },
            B2: { value: 'Total Revenue', dataType: 'string', style: { bold: true } as any },
            A3: { value: 'January', dataType: 'string' },
            A4: { value: 'February', dataType: 'string' },
            A5: { value: 'March', dataType: 'string' },
            A6: { value: 'Q1 TOTAL', dataType: 'string', style: { bold: true } as any },
          }
        }} as SetCellsOperation,
        { type: 'mergeCells', params: { sheet: 'Q1 Summary', range: 'A1:B1' } } as MergeCellsOperation,
        { type: 'applyFormat', params: {
          sheet: 'Q1 Summary',
          range: 'A1:B1',
          format: {
            style: { bold: true, fontSize: 16, alignment: { horizontal: 'center' }, bgColor: '#4472c4', color: '#ffffff' }
          }
        }} as ApplyFormatOperation,
        { type: 'setFormula', params: { sheet: 'Q1 Summary', cell: 'B3', formula: '=January!D4' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Q1 Summary', cell: 'B4', formula: '=February!D4' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Q1 Summary', cell: 'B5', formula: '=March!D4' } } as SetFormulaOperation,
        { type: 'setFormula', params: { sheet: 'Q1 Summary', cell: 'B6', formula: '=SUM(B3:B5)' } } as SetFormulaOperation,
        { type: 'applyFormat', params: {
          sheet: 'Q1 Summary',
          range: 'B3:B6',
          format: { numFmt: '$#,##0.00' }
        }} as ApplyFormatOperation,
        { type: 'applyFormat', params: {
          sheet: 'Q1 Summary',
          range: 'A6:B6',
          format: {
            style: { bold: true, bgColor: '#d9e1f2' },
            borders: { top: true, bottom: true }
          }
        }} as ApplyFormatOperation,
        
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      expect(result.workbook?.sheets).toHaveLength(4);
      
      // Verify January calculations
      const janSheet = result.workbook?.sheets.find((s: any) => s.name === 'January');
      expect(janSheet?.cells?.D2.computed?.v).toBe(2500); // 100*25
      expect(janSheet?.cells?.D3.computed?.v).toBe(3000); // 75*40
      expect(janSheet?.cells?.D4.computed?.v).toBe(5500); // Total
      
      // Verify February calculations
      const febSheet = result.workbook?.sheets.find((s: any) => s.name === 'February');
      expect(febSheet?.cells?.D2.computed?.v).toBe(3000); // 120*25
      expect(febSheet?.cells?.D3.computed?.v).toBe(3600); // 90*40
      expect(febSheet?.cells?.D4.computed?.v).toBe(6600); // Total
      
      // Verify March calculations
      const marSheet = result.workbook?.sheets.find((s: any) => s.name === 'March');
      expect(marSheet?.cells?.D2.computed?.v).toBe(2750); // 110*25
      expect(marSheet?.cells?.D3.computed?.v).toBe(3400); // 85*40
      expect(marSheet?.cells?.D4.computed?.v).toBe(6150); // Total
      
      // Verify Q1 Summary cross-sheet references
      const summarySheet = result.workbook?.sheets.find((s: any) => s.name === 'Q1 Summary');
      expect(summarySheet?.cells?.B3.computed?.v).toBe(5500); // January total
      expect(summarySheet?.cells?.B4.computed?.v).toBe(6600); // February total
      expect(summarySheet?.cells?.B5.computed?.v).toBe(6150); // March total
      expect(summarySheet?.cells?.B6.computed?.v).toBe(18250); // Q1 total
      
      // Verify formatting
      expect(summarySheet?.cells?.A1.style?.fontSize).toBe(16);
      expect(summarySheet?.mergedRanges).toContain('A1:B1');
      expect(summarySheet?.cells?.A6.style?.bold).toBe(true);
    });

    it('should handle complex operation ordering', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        // Create workbook
        { type: 'createWorkbook', params: { name: 'Order Test' } } as CreateWorkbookOperation,
        
        // Set formula BEFORE setting the values it references (should still compute correctly)
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'C1', formula: '=A1+B1' } } as SetFormulaOperation,
        
        // Now set the values
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 100, dataType: 'number' },
            B1: { value: 200, dataType: 'number' },
          }
        }} as SetCellsOperation,
        
        // Add formatting after values are set
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1:C1',
          format: { style: { bold: true } }
        }} as ApplyFormatOperation,
        
        // Compute should resolve everything correctly
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.raw).toBe(100);
      expect(sheet?.cells?.B1.raw).toBe(200);
      expect(sheet?.cells?.C1.formula).toBe('=A1+B1');
      expect(sheet?.cells?.C1.computed?.v).toBe(300); // Formula computed correctly
      expect(sheet?.cells?.A1.style?.bold).toBe(true);
      expect(sheet?.cells?.C1.style?.bold).toBe(true);
    });

    it('should handle multiple compute operations in sequence', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Multi-Compute' } } as CreateWorkbookOperation,
        
        // Initial data and formula
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 10, dataType: 'number' },
            A2: { value: 20, dataType: 'number' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A3', formula: '=SUM(A1:A2)' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation, // First compute
        
        // Add more data
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A4: { value: 30, dataType: 'number' },
          }
        }} as SetCellsOperation,
        { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'A5', formula: '=A3+A4' } } as SetFormulaOperation,
        { type: 'compute', params: {} } as ComputeOperation, // Second compute
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A3.computed?.v).toBe(30); // 10+20
      expect(sheet?.cells?.A5.computed?.v).toBe(60); // 30+30
    });

    it('should maintain data integrity through complex operation chain', async () => {
      const executor = new WorkbookOperationExecutor();
      const operations = [
        { type: 'createWorkbook', params: { name: 'Integrity Test' } } as CreateWorkbookOperation,
        
        // Create initial data with formatting
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: {
            A1: { value: 'Test', dataType: 'string', style: { bold: true } as any, numFmt: '@' },
          }
        }} as SetCellsOperation,
        
        // Apply additional formatting (should merge with existing)
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            style: { italic: true, color: '#ff0000' }
          }
        }} as ApplyFormatOperation,
        
        // Verify first formatting merge worked
        { type: 'applyFormat', params: {
          sheet: 'Sheet1',
          range: 'A1',
          format: {
            style: { fontSize: 14 }
          }
        }} as ApplyFormatOperation,
        
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(true);
      
      const sheet = result.workbook?.sheets[0];
      const cell = sheet?.cells?.A1;
      
      // Verify value is preserved
      expect(cell?.raw).toBe('Test');
      
      // Verify all formatting is preserved and merged through multiple applyFormat operations
      expect(cell?.style?.bold).toBe(true); // From setCells
      expect(cell?.style?.italic).toBe(true); // From first applyFormat
      expect(cell?.style?.color).toBe('#ff0000'); // From first applyFormat
      expect(cell?.style?.fontSize).toBe(14); // From second applyFormat
      
      // Note: setCells replaces cell content including styles. To update values while
      // preserving formatting, use applyFormat after setCells, or include styles in setCells.
    });

    it('should handle error recovery in operation sequences', async () => {
      const executor = new WorkbookOperationExecutor({ stopOnError: false });
      const operations = [
        { type: 'createWorkbook', params: { name: 'Error Test' } } as CreateWorkbookOperation,
        
        // Valid operation
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: { A1: { value: 'Valid', dataType: 'string' } }
        }} as SetCellsOperation,
        
        // Invalid operation (sheet doesn't exist)
        { type: 'setCells', params: {
          sheet: 'NonExistent',
          cells: { A1: { value: 'Invalid', dataType: 'string' } }
        }} as SetCellsOperation,
        
        // Valid operation after error
        { type: 'setCells', params: {
          sheet: 'Sheet1',
          cells: { A2: { value: 'After Error', dataType: 'string' } }
        }} as SetCellsOperation,
        
        { type: 'compute', params: {} } as ComputeOperation,
      ];

      const result = await executor.execute(operations);

      expect(result.success).toBe(false); // Overall failed due to one error
      expect(result.errors).toHaveLength(1);
      expect(result.operationsExecuted).toBe(4); // 3 valid + 1 compute, skipped 1 invalid
      
      // Verify valid operations still executed
      const sheet = result.workbook?.sheets[0];
      expect(sheet?.cells?.A1.raw).toBe('Valid');
      expect(sheet?.cells?.A2.raw).toBe('After Error');
    });
  });
});
