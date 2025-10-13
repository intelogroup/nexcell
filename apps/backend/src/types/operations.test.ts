import { describe, it, expect } from 'vitest'
import {
  CellRefSchema,
  RangeRefSchema,
  SetCellOpSchema,
  FillRangeOpSchema,
  InsertRowsOpSchema,
  DeleteRowsOpSchema,
  AddSheetOpSchema,
  RenameSheetOpSchema,
  FormatRangeOpSchema,
  OperationSchema,
  OperationsSchema,
  AiPlanSchema,
  type Operation,
} from './operations'

describe('Operation Type Schemas', () => {
  describe('CellRefSchema', () => {
    it('should validate valid cell references', () => {
      expect(() => CellRefSchema.parse('A1')).not.toThrow()
      expect(() => CellRefSchema.parse('B2')).not.toThrow()
      expect(() => CellRefSchema.parse('AA100')).not.toThrow()
      expect(() => CellRefSchema.parse('ZZ999')).not.toThrow()
    })

    it('should reject invalid cell references', () => {
      expect(() => CellRefSchema.parse('1A')).toThrow()
      expect(() => CellRefSchema.parse('A')).toThrow()
      expect(() => CellRefSchema.parse('1')).toThrow()
      expect(() => CellRefSchema.parse('a1')).toThrow() // lowercase
      expect(() => CellRefSchema.parse('')).toThrow()
    })
  })

  describe('RangeRefSchema', () => {
    it('should validate valid range references', () => {
      expect(() => RangeRefSchema.parse('A1:B10')).not.toThrow()
      expect(() => RangeRefSchema.parse('C5:C5')).not.toThrow()
      expect(() => RangeRefSchema.parse('AA1:ZZ100')).not.toThrow()
    })

    it('should reject invalid range references', () => {
      expect(() => RangeRefSchema.parse('A1')).toThrow() // not a range
      expect(() => RangeRefSchema.parse('A1:B')).toThrow()
      expect(() => RangeRefSchema.parse('A:B10')).toThrow()
      expect(() => RangeRefSchema.parse('A1-B10')).toThrow() // wrong separator
    })
  })

  describe('SetCellOp', () => {
    it('should validate set_cell operation with value', () => {
      const op = {
        kind: 'set_cell' as const,
        sheet: 'Sheet1',
        cell: 'A1',
        value: 42,
      }
      expect(() => SetCellOpSchema.parse(op)).not.toThrow()
    })

    it('should validate set_cell operation with formula', () => {
      const op = {
        kind: 'set_cell' as const,
        sheet: 'Sheet1',
        cell: 'B2',
        formula: '=SUM(A1:A10)',
      }
      expect(() => SetCellOpSchema.parse(op)).not.toThrow()
    })

    it('should validate set_cell operation with format', () => {
      const op = {
        kind: 'set_cell' as const,
        sheet: 'Sheet1',
        cell: 'C3',
        value: 'Hello',
        format: {
          bold: true,
          color: '#FF0000',
          backgroundColor: '#FFFF00',
        },
      }
      expect(() => SetCellOpSchema.parse(op)).not.toThrow()
    })

    it('should reject invalid cell reference', () => {
      const op = {
        kind: 'set_cell' as const,
        sheet: 'Sheet1',
        cell: 'INVALID',
        value: 42,
      }
      expect(() => SetCellOpSchema.parse(op)).toThrow()
    })
  })

  describe('FillRangeOp', () => {
    it('should validate fill_range operation', () => {
      const op = {
        kind: 'fill_range' as const,
        sheet: 'Sheet1',
        range: 'A1:B10',
        value: 0,
      }
      expect(() => FillRangeOpSchema.parse(op)).not.toThrow()
    })

    it('should validate fill_range with formula', () => {
      const op = {
        kind: 'fill_range' as const,
        sheet: 'Sheet1',
        range: 'C1:C10',
        formula: '=A1+B1',
      }
      expect(() => FillRangeOpSchema.parse(op)).not.toThrow()
    })
  })

  describe('InsertRowsOp', () => {
    it('should validate insert_rows operation', () => {
      const op = {
        kind: 'insert_rows' as const,
        sheet: 'Sheet1',
        startRow: 5,
        count: 3,
      }
      expect(() => InsertRowsOpSchema.parse(op)).not.toThrow()
    })

    it('should reject invalid row numbers', () => {
      const op = {
        kind: 'insert_rows' as const,
        sheet: 'Sheet1',
        startRow: 0, // must be positive
        count: 1,
      }
      expect(() => InsertRowsOpSchema.parse(op)).toThrow()
    })

    it('should use default count of 1', () => {
      const op = {
        kind: 'insert_rows' as const,
        sheet: 'Sheet1',
        startRow: 5,
      }
      const parsed = InsertRowsOpSchema.parse(op)
      expect(parsed.count).toBe(1)
    })
  })

  describe('DeleteRowsOp', () => {
    it('should validate delete_rows operation', () => {
      const op = {
        kind: 'delete_rows' as const,
        sheet: 'Sheet1',
        startRow: 5,
        count: 2,
      }
      expect(() => DeleteRowsOpSchema.parse(op)).not.toThrow()
    })
  })

  describe('AddSheetOp', () => {
    it('should validate add_sheet operation', () => {
      const op = {
        kind: 'add_sheet' as const,
        name: 'NewSheet',
      }
      expect(() => AddSheetOpSchema.parse(op)).not.toThrow()
    })

    it('should reject empty sheet names', () => {
      const op = {
        kind: 'add_sheet' as const,
        name: '',
      }
      expect(() => AddSheetOpSchema.parse(op)).toThrow()
    })

    it('should reject too long sheet names', () => {
      const op = {
        kind: 'add_sheet' as const,
        name: 'A'.repeat(101), // max 100 chars
      }
      expect(() => AddSheetOpSchema.parse(op)).toThrow()
    })
  })

  describe('RenameSheetOp', () => {
    it('should validate rename_sheet operation', () => {
      const op = {
        kind: 'rename_sheet' as const,
        oldName: 'Sheet1',
        newName: 'Data',
      }
      expect(() => RenameSheetOpSchema.parse(op)).not.toThrow()
    })
  })

  describe('FormatRangeOp', () => {
    it('should validate format_range operation', () => {
      const op = {
        kind: 'format_range' as const,
        sheet: 'Sheet1',
        range: 'A1:D10',
        format: {
          bold: true,
          italic: false,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          align: 'center' as const,
        },
      }
      expect(() => FormatRangeOpSchema.parse(op)).not.toThrow()
    })

    it('should reject invalid alignment', () => {
      const op = {
        kind: 'format_range' as const,
        sheet: 'Sheet1',
        range: 'A1:D10',
        format: {
          align: 'invalid' as any,
        },
      }
      expect(() => FormatRangeOpSchema.parse(op)).toThrow()
    })
  })

  describe('OperationSchema (discriminated union)', () => {
    it('should validate any valid operation type', () => {
      const ops: Operation[] = [
        { kind: 'set_cell', sheet: 'Sheet1', cell: 'A1', value: 42 },
        { kind: 'fill_range', sheet: 'Sheet1', range: 'B1:B10', value: 0 },
        { kind: 'insert_rows', sheet: 'Sheet1', startRow: 5, count: 2 },
        { kind: 'delete_cols', sheet: 'Sheet1', startCol: 3, count: 1 },
        { kind: 'add_sheet', name: 'NewSheet' },
        { kind: 'rename_sheet', oldName: 'Old', newName: 'New' },
      ]

      ops.forEach((op) => {
        expect(() => OperationSchema.parse(op)).not.toThrow()
      })
    })

    it('should reject unknown operation kinds', () => {
      const op = {
        kind: 'unknown_operation',
        sheet: 'Sheet1',
      }
      expect(() => OperationSchema.parse(op)).toThrow()
    })
  })

  describe('OperationsSchema (array)', () => {
    it('should validate array of operations', () => {
      const ops = [
        { kind: 'set_cell', sheet: 'Sheet1', cell: 'A1', value: 100 },
        { kind: 'set_cell', sheet: 'Sheet1', cell: 'A2', value: 200 },
        { kind: 'set_cell', sheet: 'Sheet1', cell: 'A3', formula: '=A1+A2' },
      ]
      expect(() => OperationsSchema.parse(ops)).not.toThrow()
    })

    it('should reject array with invalid operations', () => {
      const ops = [
        { kind: 'set_cell', sheet: 'Sheet1', cell: 'A1', value: 100 },
        { kind: 'set_cell', sheet: 'Sheet1', cell: 'INVALID', value: 200 }, // invalid cell ref
      ]
      expect(() => OperationsSchema.parse(ops)).toThrow()
    })
  })

  describe('AiPlanSchema', () => {
    it('should validate complete AI plan', () => {
      const plan = {
        id: 'plan-123',
        instructions: 'Calculate sum of column A',
        reasoning: 'I will create a SUM formula in cell A10',
        operations: [
          {
            kind: 'set_cell' as const,
            sheet: 'Sheet1',
            cell: 'A10',
            formula: '=SUM(A1:A9)',
          },
        ],
        confidence: 0.95,
        warnings: [],
        estimatedCost: 0.5,
      }
      expect(() => AiPlanSchema.parse(plan)).not.toThrow()
    })

    it('should validate minimal AI plan', () => {
      const plan = {
        instructions: 'Do something',
        operations: [],
      }
      expect(() => AiPlanSchema.parse(plan)).not.toThrow()
    })

    it('should reject plan with invalid confidence', () => {
      const plan = {
        instructions: 'Do something',
        operations: [],
        confidence: 1.5, // must be <= 1
      }
      expect(() => AiPlanSchema.parse(plan)).toThrow()
    })
  })
})
