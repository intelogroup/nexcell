/**
 * Unit tests for WorkbookOperation types
 * 
 * These tests validate:
 * - Type inference works correctly
 * - Type guards work as expected
 * - Helper functions (createOperation, validateOperation) work correctly
 * - Required parameters are enforced
 * - Optional parameters work as expected
 * 
 * Note: These are RUNTIME tests that validate the type definitions work correctly
 * at both compile-time and runtime. TypeScript compilation is verified separately.
 */

import { describe, it, expect } from 'vitest';
import type {
  WorkbookOperation,
  CreateWorkbookOperation,
  AddSheetOperation,
  RemoveSheetOperation,
  RenameSheetOperation,
  SetCellsOperation,
  SetFormulaOperation,
  ApplyFormatOperation,
  MergeCellsOperation,
  DefineNamedRangeOperation,
  ComputeOperation,
  ImportXLSXOperation,
  ExportXLSXOperation,
  AIOperationResponse,
  OperationExecutionResult,
  ValidationResult,
  OperationType,
  OperationParams,
} from '../types';
import {
  isCreateWorkbookOperation,
  isAddSheetOperation,
  isRemoveSheetOperation,
  isRenameSheetOperation,
  isSetCellsOperation,
  isSetFormulaOperation,
  isApplyFormatOperation,
  isMergeCellsOperation,
  isDefineNamedRangeOperation,
  isComputeOperation,
  isImportXLSXOperation,
  isExportXLSXOperation,
  createOperation,
  validateOperation,
} from '../types';

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isCreateWorkbookOperation', () => {
    it('should return true for valid createWorkbook operation', () => {
      const op: WorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Test Workbook',
        },
      };

      expect(isCreateWorkbookOperation(op)).toBe(true);
    });

    it('should return false for other operation types', () => {
      const op: WorkbookOperation = {
        type: 'addSheet',
        params: {
          name: 'Sheet1',
        },
      };

      expect(isCreateWorkbookOperation(op)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const op: WorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Test Workbook',
          initialSheets: ['Sales', 'Marketing'],
        },
      };

      if (isCreateWorkbookOperation(op)) {
        // TypeScript should infer op.params has name and initialSheets
        expect(op.params.name).toBe('Test Workbook');
        expect(op.params.initialSheets).toEqual(['Sales', 'Marketing']);
      } else {
        throw new Error('Type guard should have returned true');
      }
    });
  });

  describe('isAddSheetOperation', () => {
    it('should return true for valid addSheet operation', () => {
      const op: WorkbookOperation = {
        type: 'addSheet',
        params: {
          name: 'Sheet1',
          id: 'sheet1',
        },
      };

      expect(isAddSheetOperation(op)).toBe(true);
    });

    it('should return false for other operation types', () => {
      const op: WorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Workbook',
        },
      };

      expect(isAddSheetOperation(op)).toBe(false);
    });
  });

  describe('isSetCellsOperation', () => {
    it('should return true for valid setCells operation', () => {
      const op: WorkbookOperation = {
        type: 'setCells',
        params: {
          sheet: 'sheet1',
          cells: {
            A1: {
              value: 'Hello',
              dataType: 'string',
            },
          },
        },
      };

      expect(isSetCellsOperation(op)).toBe(true);
    });

    it('should narrow type correctly with complex cells', () => {
      const op: WorkbookOperation = {
        type: 'setCells',
        params: {
          sheet: 'sheet1',
          cells: {
            A1: {
              value: 'Month',
              dataType: 'string',
              style: { bold: true },
            },
            B1: {
              value: 50000,
              dataType: 'number',
              numFmt: '$#,##0',
            },
            C1: {
              formula: 'SUM(B2:B10)',
              dataType: 'formula',
            },
          },
        },
      };

      if (isSetCellsOperation(op)) {
        expect(op.params.cells.A1.style?.bold).toBe(true);
        expect(op.params.cells.B1.numFmt).toBe('$#,##0');
        expect(op.params.cells.C1.formula).toBe('SUM(B2:B10)');
      } else {
        throw new Error('Type guard should have returned true');
      }
    });
  });

  describe('isSetFormulaOperation', () => {
    it('should return true for valid setFormula operation', () => {
      const op: WorkbookOperation = {
        type: 'setFormula',
        params: {
          sheet: 'sheet1',
          cell: 'D2',
          formula: '=C2-B2',
        },
      };

      expect(isSetFormulaOperation(op)).toBe(true);
    });

    it('should return false for other operation types', () => {
      const op: WorkbookOperation = {
        type: 'setCells',
        params: {
          sheet: 'sheet1',
          cells: {},
        },
      };

      expect(isSetFormulaOperation(op)).toBe(false);
    });
  });

  describe('isComputeOperation', () => {
    it('should return true for valid compute operation', () => {
      const op: WorkbookOperation = {
        type: 'compute',
        params: {},
      };

      expect(isComputeOperation(op)).toBe(true);
    });

    it('should return true with force parameter', () => {
      const op: WorkbookOperation = {
        type: 'compute',
        params: {
          force: true,
        },
      };

      expect(isComputeOperation(op)).toBe(true);
      if (isComputeOperation(op)) {
        expect(op.params.force).toBe(true);
      }
    });
  });

  describe('isApplyFormatOperation', () => {
    it('should return true for valid applyFormat operation', () => {
      const op: WorkbookOperation = {
        type: 'applyFormat',
        params: {
          sheet: 'sheet1',
          range: 'A1:D1',
          format: {
            style: { bold: true },
          },
        },
      };

      expect(isApplyFormatOperation(op)).toBe(true);
    });
  });

  describe('isMergeCellsOperation', () => {
    it('should return true for valid mergeCells operation', () => {
      const op: WorkbookOperation = {
        type: 'mergeCells',
        params: {
          sheet: 'sheet1',
          range: 'A1:D1',
        },
      };

      expect(isMergeCellsOperation(op)).toBe(true);
    });
  });

  describe('isDefineNamedRangeOperation', () => {
    it('should return true for valid defineNamedRange operation', () => {
      const op: WorkbookOperation = {
        type: 'defineNamedRange',
        params: {
          name: 'SalesData',
          sheet: 'sales',
          range: 'A2:D100',
        },
      };

      expect(isDefineNamedRangeOperation(op)).toBe(true);
    });

    it('should narrow type correctly with scope', () => {
      const op: WorkbookOperation = {
        type: 'defineNamedRange',
        params: {
          name: 'SalesData',
          sheet: 'sales',
          range: 'A2:D100',
          scope: 'workbook',
        },
      };

      if (isDefineNamedRangeOperation(op)) {
        expect(op.params.scope).toBe('workbook');
      } else {
        throw new Error('Type guard should have returned true');
      }
    });
  });

  describe('isImportXLSXOperation', () => {
    it('should return true for valid importXLSX operation', () => {
      const op: WorkbookOperation = {
        type: 'importXLSX',
        params: {
          fileData: 'base64data',
          fileName: 'budget.xlsx',
        },
      };

      expect(isImportXLSXOperation(op)).toBe(true);
    });
  });

  describe('isExportXLSXOperation', () => {
    it('should return true for valid exportXLSX operation', () => {
      const op: WorkbookOperation = {
        type: 'exportXLSX',
        params: {
          fileName: 'Q1_Budget.xlsx',
        },
      };

      expect(isExportXLSXOperation(op)).toBe(true);
    });

    it('should return true with empty params', () => {
      const op: WorkbookOperation = {
        type: 'exportXLSX',
        params: {},
      };

      expect(isExportXLSXOperation(op)).toBe(true);
    });
  });
});

// ============================================================================
// createOperation Helper Tests
// ============================================================================

describe('createOperation helper', () => {
  it('should create createWorkbook operation', () => {
    const op = createOperation('createWorkbook', {
      name: 'Test Workbook',
    });

    expect(op.type).toBe('createWorkbook');
    expect(op.params.name).toBe('Test Workbook');
  });

  it('should create addSheet operation with optional params', () => {
    const op = createOperation('addSheet', {
      name: 'Sales',
      id: 'sales',
      position: 0,
    });

    expect(op.type).toBe('addSheet');
    expect(op.params.name).toBe('Sales');
    expect(op.params.id).toBe('sales');
    expect(op.params.position).toBe(0);
  });

  it('should create setCells operation with complex cells', () => {
    const op = createOperation('setCells', {
      sheet: 'sheet1',
      cells: {
        A1: {
          value: 'Month',
          dataType: 'string',
          style: { bold: true, bgColor: '#f0f0f0' },
        },
        B1: {
          value: 50000,
          dataType: 'number',
          numFmt: '$#,##0',
        },
      },
    });

    expect(op.type).toBe('setCells');
    expect(op.params.cells.A1.value).toBe('Month');
    expect(op.params.cells.A1.style?.bold).toBe(true);
    expect(op.params.cells.B1.numFmt).toBe('$#,##0');
  });

  it('should create setFormula operation', () => {
    const op = createOperation('setFormula', {
      sheet: 'sales',
      cell: 'D2',
      formula: '=C2-B2',
    });

    expect(op.type).toBe('setFormula');
    expect(op.params.formula).toBe('=C2-B2');
  });

  it('should create compute operation with force', () => {
    const op = createOperation('compute', {
      force: true,
    });

    expect(op.type).toBe('compute');
    expect(op.params.force).toBe(true);
  });

  it('should create compute operation without params', () => {
    const op = createOperation('compute', {});

    expect(op.type).toBe('compute');
    expect(op.params.force).toBeUndefined();
  });
});

// ============================================================================
// validateOperation Tests
// ============================================================================

describe('validateOperation', () => {
  describe('createWorkbook validation', () => {
    it('should pass for valid createWorkbook operation', () => {
      const op: WorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: 'Test Workbook',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing workbook name', () => {
      const op: WorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: '',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_WORKBOOK_NAME');
    });

    it('should fail for whitespace-only workbook name', () => {
      const op: WorkbookOperation = {
        type: 'createWorkbook',
        params: {
          name: '   ',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_WORKBOOK_NAME');
    });
  });

  describe('addSheet validation', () => {
    it('should pass for valid addSheet operation', () => {
      const op: WorkbookOperation = {
        type: 'addSheet',
        params: {
          name: 'Sales',
          id: 'sales',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing sheet name', () => {
      const op: WorkbookOperation = {
        type: 'addSheet',
        params: {
          name: '',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_SHEET_NAME');
    });
  });

  describe('setCells validation', () => {
    it('should pass for valid setCells operation', () => {
      const op: WorkbookOperation = {
        type: 'setCells',
        params: {
          sheet: 'sheet1',
          cells: {
            A1: {
              value: 'Hello',
              dataType: 'string',
            },
          },
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing sheet reference', () => {
      const op: WorkbookOperation = {
        type: 'setCells',
        params: {
          sheet: '',
          cells: {
            A1: {
              value: 'Hello',
              dataType: 'string',
            },
          },
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_SHEET_REFERENCE');
    });

    it('should fail for empty cells object', () => {
      const op: WorkbookOperation = {
        type: 'setCells',
        params: {
          sheet: 'sheet1',
          cells: {},
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_CELLS_OBJECT');
    });
  });

  describe('setFormula validation', () => {
    it('should pass for valid setFormula operation', () => {
      const op: WorkbookOperation = {
        type: 'setFormula',
        params: {
          sheet: 'sales',
          cell: 'D2',
          formula: '=C2-B2',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing sheet reference', () => {
      const op: WorkbookOperation = {
        type: 'setFormula',
        params: {
          sheet: '',
          cell: 'D2',
          formula: '=C2-B2',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_SHEET_REFERENCE')).toBe(true);
    });

    it('should fail for missing cell reference', () => {
      const op: WorkbookOperation = {
        type: 'setFormula',
        params: {
          sheet: 'sales',
          cell: '',
          formula: '=C2-B2',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_CELL_REFERENCE')).toBe(true);
    });

    it('should fail for missing formula', () => {
      const op: WorkbookOperation = {
        type: 'setFormula',
        params: {
          sheet: 'sales',
          cell: 'D2',
          formula: '',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_FORMULA')).toBe(true);
    });

    it('should collect multiple errors', () => {
      const op: WorkbookOperation = {
        type: 'setFormula',
        params: {
          sheet: '',
          cell: '',
          formula: '',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('other operations validation', () => {
    it('should pass for removeSheet operation', () => {
      const op: WorkbookOperation = {
        type: 'removeSheet',
        params: {
          sheetId: 'sheet1',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for renameSheet operation', () => {
      const op: WorkbookOperation = {
        type: 'renameSheet',
        params: {
          sheetId: 'sheet1',
          newName: 'Revenue',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for applyFormat operation', () => {
      const op: WorkbookOperation = {
        type: 'applyFormat',
        params: {
          sheet: 'sheet1',
          range: 'A1:D1',
          format: {
            style: { bold: true },
          },
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for mergeCells operation', () => {
      const op: WorkbookOperation = {
        type: 'mergeCells',
        params: {
          sheet: 'sheet1',
          range: 'A1:D1',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for defineNamedRange operation', () => {
      const op: WorkbookOperation = {
        type: 'defineNamedRange',
        params: {
          name: 'SalesData',
          sheet: 'sales',
          range: 'A2:D100',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for compute operation', () => {
      const op: WorkbookOperation = {
        type: 'compute',
        params: {},
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for importXLSX operation', () => {
      const op: WorkbookOperation = {
        type: 'importXLSX',
        params: {
          fileData: 'base64data',
        },
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });

    it('should pass for exportXLSX operation', () => {
      const op: WorkbookOperation = {
        type: 'exportXLSX',
        params: {},
      };

      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// AIOperationResponse Tests
// ============================================================================

describe('AIOperationResponse type', () => {
  it('should accept valid AI response', () => {
    const response: AIOperationResponse = {
      intent: 'q1_budget_tracker',
      operations: [
        {
          type: 'createWorkbook',
          params: {
            name: 'Q1 Budget',
          },
        },
        {
          type: 'addSheet',
          params: {
            name: 'Sales',
            id: 'sales',
          },
        },
        {
          type: 'setCells',
          params: {
            sheet: 'sales',
            cells: {
              A1: {
                value: 'Month',
                dataType: 'string',
                style: { bold: true },
              },
            },
          },
        },
        {
          type: 'compute',
          params: {},
        },
      ],
      explanation: 'Created a Q1 budget tracker with Sales sheet and header row',
      confidence: 0.95,
    };

    expect(response.intent).toBe('q1_budget_tracker');
    expect(response.operations).toHaveLength(4);
    expect(response.confidence).toBe(0.95);
  });
});

// ============================================================================
// OperationExecutionResult Tests
// ============================================================================

describe('OperationExecutionResult type', () => {
  it('should accept successful execution result', () => {
    const result: OperationExecutionResult = {
      success: true,
      workbook: {
        name: 'Test Workbook',
        sheets: [],
      },
      errors: [],
      operationsExecuted: 5,
      operationsTotal: 5,
    };

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.operationsExecuted).toBe(5);
  });

  it('should accept failed execution result with errors', () => {
    const result: OperationExecutionResult = {
      success: false,
      errors: [
        {
          operationIndex: 2,
          operation: {
            type: 'setFormula',
            params: {
              sheet: 'sales',
              cell: 'D2',
              formula: '=INVALID(',
            },
          },
          message: 'Invalid formula syntax',
          code: 'INVALID_FORMULA',
        },
      ],
      warnings: ['Some cells have uncomputed formulas'],
      operationsExecuted: 2,
      operationsTotal: 5,
    };

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('INVALID_FORMULA');
    expect(result.warnings).toHaveLength(1);
  });
});

// ============================================================================
// ValidationResult Tests
// ============================================================================

describe('ValidationResult type', () => {
  it('should accept valid validation result', () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept validation result with issues', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [
        {
          severity: 'error',
          code: 'DIV_BY_ZERO',
          message: 'Formula results in #DIV/0! error',
          location: 'Sheet1!D2',
          sheet: 'sheet1',
          cell: 'D2',
          suggestion: 'Use IF(B2=0, 0, A2/B2) to prevent division by zero',
        },
      ],
      warnings: [
        {
          severity: 'warning',
          code: 'UNCOMPUTED_FORMULA',
          message: 'Cell has formula but no computed value',
          location: 'Sheet1!E5',
        },
      ],
      suggestions: [
        {
          severity: 'suggestion',
          code: 'USE_ABSOLUTE_REF',
          message: 'Consider using absolute reference for tax rate',
          location: 'Sheet1!C10',
          suggestion: 'Change B1 to $B$1',
        },
      ],
    };

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.suggestions).toHaveLength(1);
    expect(result.errors[0].suggestion).toBe('Use IF(B2=0, 0, A2/B2) to prevent division by zero');
  });
});

// ============================================================================
// Utility Types Tests
// ============================================================================

describe('Utility types', () => {
  it('OperationType should extract operation type strings', () => {
    const type1: OperationType = 'createWorkbook';
    const type2: OperationType = 'setCells';
    const type3: OperationType = 'compute';

    expect(type1).toBe('createWorkbook');
    expect(type2).toBe('setCells');
    expect(type3).toBe('compute');
  });

  it('OperationParams should extract params type for specific operation', () => {
    // This is a compile-time test - if it compiles, the type inference works
    const createParams: OperationParams<'createWorkbook'> = {
      name: 'Test',
    };

    const setCellsParams: OperationParams<'setCells'> = {
      sheet: 'sheet1',
      cells: {
        A1: {
          value: 'Hello',
          dataType: 'string',
        },
      },
    };

    const computeParams: OperationParams<'compute'> = {
      force: true,
    };

    expect(createParams.name).toBe('Test');
    expect(setCellsParams.sheet).toBe('sheet1');
    expect(computeParams.force).toBe(true);
  });
});

// ============================================================================
// Complex Scenario Tests
// ============================================================================

describe('Complex operation scenarios', () => {
  it('should handle multi-operation workflow types correctly', () => {
    const operations: WorkbookOperation[] = [
      {
        type: 'createWorkbook',
        params: {
          name: 'Q1 Budget',
          initialSheets: ['Sales', 'Marketing', 'Operations'],
        },
      },
      {
        type: 'setCells',
        params: {
          sheet: 'Sales',
          cells: {
            A1: { value: 'Month', dataType: 'string', style: { bold: true } },
            B1: { value: 'Budget', dataType: 'string', style: { bold: true } },
            C1: { value: 'Actual', dataType: 'string', style: { bold: true } },
            D1: { value: 'Variance', dataType: 'string', style: { bold: true } },
            A2: { value: 'January', dataType: 'string' },
            B2: { value: 50000, dataType: 'number', numFmt: '$#,##0' },
            C2: { value: 48500, dataType: 'number', numFmt: '$#,##0' },
          },
        },
      },
      {
        type: 'setFormula',
        params: {
          sheet: 'Sales',
          cell: 'D2',
          formula: '=C2-B2',
        },
      },
      {
        type: 'applyFormat',
        params: {
          sheet: 'Sales',
          range: 'A1:D1',
          format: {
            style: { bold: true, bgColor: '#f0f0f0' },
            borders: { bottom: true },
          },
        },
      },
      {
        type: 'compute',
        params: {},
      },
    ];

    expect(operations).toHaveLength(5);
    expect(operations[0].type).toBe('createWorkbook');
    expect(operations[4].type).toBe('compute');

    // Validate each operation
    operations.forEach((op) => {
      const result = validateOperation(op);
      expect(result.valid).toBe(true);
    });
  });

  it('should handle cross-sheet formula operations', () => {
    const operations: WorkbookOperation[] = [
      {
        type: 'createWorkbook',
        params: {
          name: 'Department Rollup',
          initialSheets: ['Sales', 'Marketing', 'Summary'],
        },
      },
      {
        type: 'setCells',
        params: {
          sheet: 'Sales',
          cells: {
            A1: { value: 'Total Revenue', dataType: 'string' },
            B1: { value: 150000, dataType: 'number', numFmt: '$#,##0' },
          },
        },
      },
      {
        type: 'setCells',
        params: {
          sheet: 'Marketing',
          cells: {
            A1: { value: 'Total Revenue', dataType: 'string' },
            B1: { value: 80000, dataType: 'number', numFmt: '$#,##0' },
          },
        },
      },
      {
        type: 'setCells',
        params: {
          sheet: 'Summary',
          cells: {
            A1: { value: 'Department', dataType: 'string' },
            B1: { value: 'Revenue', dataType: 'string' },
            A2: { value: 'Sales', dataType: 'string' },
            A3: { value: 'Marketing', dataType: 'string' },
            A4: { value: 'Total', dataType: 'string', style: { bold: true } },
          },
        },
      },
      {
        type: 'setFormula',
        params: {
          sheet: 'Summary',
          cell: 'B2',
          formula: "=Sales!B1",
        },
      },
      {
        type: 'setFormula',
        params: {
          sheet: 'Summary',
          cell: 'B3',
          formula: "=Marketing!B1",
        },
      },
      {
        type: 'setFormula',
        params: {
          sheet: 'Summary',
          cell: 'B4',
          formula: '=SUM(B2:B3)',
        },
      },
      {
        type: 'compute',
        params: {},
      },
    ];

    expect(operations).toHaveLength(8);

    // Find all setFormula operations
    const formulaOps = operations.filter(isSetFormulaOperation);
    expect(formulaOps).toHaveLength(3);

    // Check cross-sheet references
    expect(formulaOps[0].params.formula).toContain('Sales!');
    expect(formulaOps[1].params.formula).toContain('Marketing!');
  });
});
