import { describe, it, expect, beforeEach } from 'vitest'
import { workbookOps } from './workbook-ops.service'
import { WorkbookData } from './workbook-validation.service'
import {
  SetCellOp,
  FillRangeOp,
  InsertRowsOp,
  InsertColsOp,
  DeleteRowsOp,
  DeleteColsOp,
  AddSheetOp,
  RenameSheetOp,
  DeleteSheetOp,
  FormatRangeOp,
} from '../types/operations'

describe('WorkbookOpsService', () => {
  let testData: WorkbookData

  beforeEach(() => {
    // Create a fresh test workbook before each test
    testData = {
      sheets: [
        {
          name: 'Sheet1',
          cells: {
            A1: { value: 'Name' },
            B1: { value: 'Age' },
            A2: { value: 'Alice' },
            B2: { value: 30 },
            A3: { value: 'Bob' },
            B3: { value: 25 },
          },
        },
      ],
      metadata: {
        activeSheet: 'Sheet1',
      },
    }
  })

  describe('set_cell operation', () => {
    it('should set cell value', () => {
      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'C1',
        value: 'Email',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.C1).toEqual({ value: 'Email' })
      expect(result.diff).toHaveLength(1)
      expect(result.diff[0]!.changes).toContain('Set C1')
    })

    it('should set cell formula', () => {
      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'C2',
        formula: '=SUM(B2:B3)',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.C2).toEqual({ formula: '=SUM(B2:B3)' })
    })

    it('should set cell with format', () => {
      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'A1',
        value: 'Title',
        format: {
          bold: true,
          fontSize: 16,
        },
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.A1).toEqual({
        value: 'Title',
        format: { bold: true, fontSize: 16 },
      })
    })

    it('should error on invalid sheet', () => {
      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'NonExistent',
        cell: 'A1',
        value: 'test',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('Sheet not found')
    })

    it('should error on formula without =', () => {
      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'A1',
        formula: 'SUM(A1:A10)',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('must start with "="')
    })
  })

  describe('fill_range operation', () => {
    it('should fill range with value', () => {
      const op: FillRangeOp = {
        kind: 'fill_range',
        sheet: 'Sheet1',
        range: 'C1:C3',
        value: 100,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.C1).toEqual({ value: 100 })
      expect(result.next.sheets[0]!.cells.C2).toEqual({ value: 100 })
      expect(result.next.sheets[0]!.cells.C3).toEqual({ value: 100 })
      expect(result.diff[0]!.changes).toContain('3 cells')
    })

    it('should fill range with formula', () => {
      const op: FillRangeOp = {
        kind: 'fill_range',
        sheet: 'Sheet1',
        range: 'D1:D3',
        formula: '=B1*2',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.D1).toEqual({ formula: '=B1*2' })
      expect(result.next.sheets[0]!.cells.D2).toEqual({ formula: '=B1*2' })
      expect(result.next.sheets[0]!.cells.D3).toEqual({ formula: '=B1*2' })
    })

    it('should fill 2D range', () => {
      const op: FillRangeOp = {
        kind: 'fill_range',
        sheet: 'Sheet1',
        range: 'C1:D2',
        value: 0,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.C1).toEqual({ value: 0 })
      expect(result.next.sheets[0]!.cells.C2).toEqual({ value: 0 })
      expect(result.next.sheets[0]!.cells.D1).toEqual({ value: 0 })
      expect(result.next.sheets[0]!.cells.D2).toEqual({ value: 0 })
      expect(result.diff[0]!.changes).toContain('4 cells')
    })

    it('should error on invalid range', () => {
      const op: FillRangeOp = {
        kind: 'fill_range',
        sheet: 'Sheet1',
        range: 'C3:C1', // End before start
        value: 0,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('start must be before end')
    })
  })

  describe('insert_rows operation', () => {
    it('should insert rows', () => {
      const op: InsertRowsOp = {
        kind: 'insert_rows',
        sheet: 'Sheet1',
        startRow: 2,
        count: 2,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      // A1 should stay at A1
      expect(result.next.sheets[0]!.cells.A1).toEqual({ value: 'Name' })
      // A2 should move to A4 (inserted 2 rows at row 2)
      expect(result.next.sheets[0]!.cells.A4).toEqual({ value: 'Alice' })
      // A3 should move to A5
      expect(result.next.sheets[0]!.cells.A5).toEqual({ value: 'Bob' })
      // Old A2 should be gone
      expect(result.next.sheets[0]!.cells.A2).toBeUndefined()
    })

    it('should error on invalid row number', () => {
      const op: InsertRowsOp = {
        kind: 'insert_rows',
        sheet: 'Sheet1',
        startRow: 0,
        count: 1,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('Invalid row number')
    })
  })

  describe('insert_cols operation', () => {
    it('should insert columns', () => {
      const op: InsertColsOp = {
        kind: 'insert_cols',
        sheet: 'Sheet1',
        startCol: 2,
        count: 1,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      // A1 should stay at A1
      expect(result.next.sheets[0]!.cells.A1).toEqual({ value: 'Name' })
      // B1 should move to C1 (inserted 1 col at col 2)
      expect(result.next.sheets[0]!.cells.C1).toEqual({ value: 'Age' })
      // B2 should move to C2
      expect(result.next.sheets[0]!.cells.C2).toEqual({ value: 30 })
      // Old B1 should be gone
      expect(result.next.sheets[0]!.cells.B1).toBeUndefined()
    })
  })

  describe('delete_rows operation', () => {
    it('should delete rows', () => {
      const op: DeleteRowsOp = {
        kind: 'delete_rows',
        sheet: 'Sheet1',
        startRow: 2,
        count: 1,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      // A1 should stay at A1
      expect(result.next.sheets[0]!.cells.A1).toEqual({ value: 'Name' })
      // A2 should be deleted
      expect(result.next.sheets[0]!.cells.A2).toEqual({ value: 'Bob' }) // A3 moved to A2
      // A3 should not exist anymore
      expect(result.next.sheets[0]!.cells.A3).toBeUndefined()
    })

    it('should delete multiple rows', () => {
      const op: DeleteRowsOp = {
        kind: 'delete_rows',
        sheet: 'Sheet1',
        startRow: 2,
        count: 2,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      // Only header row should remain
      expect(result.next.sheets[0]!.cells.A1).toEqual({ value: 'Name' })
      expect(result.next.sheets[0]!.cells.A2).toBeUndefined()
      expect(result.next.sheets[0]!.cells.A3).toBeUndefined()
    })
  })

  describe('delete_cols operation', () => {
    it('should delete columns', () => {
      const op: DeleteColsOp = {
        kind: 'delete_cols',
        sheet: 'Sheet1',
        startCol: 1,
        count: 1,
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      // A1 should be deleted, B1 moved to A1
      expect(result.next.sheets[0]!.cells.A1).toEqual({ value: 'Age' })
      expect(result.next.sheets[0]!.cells.A2).toEqual({ value: 30 })
      // B1 should not exist anymore
      expect(result.next.sheets[0]!.cells.B1).toBeUndefined()
    })
  })

  describe('add_sheet operation', () => {
    it('should add sheet', () => {
      const op: AddSheetOp = {
        kind: 'add_sheet',
        name: 'Sheet2',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets).toHaveLength(2)
      expect(result.next.sheets[1]!.name).toBe('Sheet2')
      expect(result.next.sheets[1]!.cells).toEqual({})
    })

    it('should error on duplicate sheet name', () => {
      const op: AddSheetOp = {
        kind: 'add_sheet',
        name: 'Sheet1',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('already exists')
    })

    it('should error when max sheets reached', () => {
      // Add 9 more sheets (already have 1)
      for (let i = 2; i <= 10; i++) {
        testData.sheets.push({ name: `Sheet${i}`, cells: {} })
      }

      const op: AddSheetOp = {
        kind: 'add_sheet',
        name: 'Sheet11',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('Maximum number of sheets')
    })
  })

  describe('rename_sheet operation', () => {
    it('should rename sheet', () => {
      const op: RenameSheetOp = {
        kind: 'rename_sheet',
        oldName: 'Sheet1',
        newName: 'Data',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.name).toBe('Data')
      expect(result.next.metadata?.activeSheet).toBe('Data')
    })

    it('should error on non-existent sheet', () => {
      const op: RenameSheetOp = {
        kind: 'rename_sheet',
        oldName: 'NonExistent',
        newName: 'Data',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('Sheet not found')
    })

    it('should error on duplicate new name', () => {
      testData.sheets.push({ name: 'Sheet2', cells: {} })

      const op: RenameSheetOp = {
        kind: 'rename_sheet',
        oldName: 'Sheet1',
        newName: 'Sheet2',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('already exists')
    })
  })

  describe('delete_sheet operation', () => {
    beforeEach(() => {
      // Add a second sheet
      testData.sheets.push({
        name: 'Sheet2',
        cells: {
          A1: { value: 'Data' },
        },
      })
    })

    it('should delete sheet', () => {
      const op: DeleteSheetOp = {
        kind: 'delete_sheet',
        name: 'Sheet2',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets).toHaveLength(1)
      expect(result.next.sheets[0]!.name).toBe('Sheet1')
    })

    it('should update active sheet if deleted', () => {
      testData.metadata!.activeSheet = 'Sheet2'

      const op: DeleteSheetOp = {
        kind: 'delete_sheet',
        name: 'Sheet2',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.metadata?.activeSheet).toBe('Sheet1')
    })

    it('should error when deleting last sheet', () => {
      const op: DeleteSheetOp = {
        kind: 'delete_sheet',
        name: 'Sheet1',
      }

      // Only one sheet in testData by default
      const singleSheetData = {
        sheets: [testData.sheets[0]!],
        metadata: testData.metadata,
      }

      const result = workbookOps.applyOperations(singleSheetData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('Cannot delete the last sheet')
    })

    it('should error on non-existent sheet', () => {
      const op: DeleteSheetOp = {
        kind: 'delete_sheet',
        name: 'NonExistent',
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.error).toContain('Sheet not found')
    })
  })

  describe('format_range operation', () => {
    it('should format range', () => {
      const op: FormatRangeOp = {
        kind: 'format_range',
        sheet: 'Sheet1',
        range: 'A1:B1',
        format: {
          bold: true,
          backgroundColor: '#f0f0f0',
        },
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.A1!.format).toEqual({
        bold: true,
        backgroundColor: '#f0f0f0',
      })
      expect(result.next.sheets[0]!.cells.B1!.format).toEqual({
        bold: true,
        backgroundColor: '#f0f0f0',
      })
    })

    it('should merge format with existing', () => {
      testData.sheets[0]!.cells.A1!.format = { italic: true }

      const op: FormatRangeOp = {
        kind: 'format_range',
        sheet: 'Sheet1',
        range: 'A1:A1',
        format: {
          bold: true,
        },
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.A1!.format).toEqual({
        italic: true,
        bold: true,
      })
    })

    it('should create cells if they don\'t exist', () => {
      const op: FormatRangeOp = {
        kind: 'format_range',
        sheet: 'Sheet1',
        range: 'D1:D3',
        format: {
          color: '#ff0000',
        },
      }

      const result = workbookOps.applyOperations(testData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.D1).toBeDefined()
      expect(result.next.sheets[0]!.cells.D1!.format).toEqual({ color: '#ff0000' })
      expect(result.next.sheets[0]!.cells.D2).toBeDefined()
      expect(result.next.sheets[0]!.cells.D3).toBeDefined()
    })
  })

  describe('multiple operations', () => {
    it('should apply multiple operations in sequence', () => {
      const ops = [
        {
          kind: 'set_cell' as const,
          sheet: 'Sheet1',
          cell: 'C1',
          value: 'Total',
        },
        {
          kind: 'set_cell' as const,
          sheet: 'Sheet1',
          cell: 'C2',
          formula: '=B2*2',
        },
        {
          kind: 'format_range' as const,
          sheet: 'Sheet1',
          range: 'C1:C1',
          format: { bold: true },
        },
      ]

      const result = workbookOps.applyOperations(testData, ops)

      expect(result.errors).toHaveLength(0)
      expect(result.diff).toHaveLength(3)
      expect(result.next.sheets[0]!.cells.C1).toEqual({
        value: 'Total',
        format: { bold: true },
      })
      expect(result.next.sheets[0]!.cells.C2).toEqual({
        formula: '=B2*2',
      })
    })

    it('should continue on error and collect all errors', () => {
      const ops = [
        {
          kind: 'set_cell' as const,
          sheet: 'NonExistent',
          cell: 'A1',
          value: 'test',
        },
        {
          kind: 'set_cell' as const,
          sheet: 'Sheet1',
          cell: 'C1',
          value: 'Valid',
        },
        {
          kind: 'delete_sheet' as const,
          name: 'NonExistent',
        },
      ]

      const result = workbookOps.applyOperations(testData, ops)

      expect(result.errors).toHaveLength(2)
      expect(result.errors[0]!.opIndex).toBe(0)
      expect(result.errors[1]!.opIndex).toBe(2)
      expect(result.diff).toHaveLength(1)
      expect(result.next.sheets[0]!.cells.C1).toEqual({ value: 'Valid' })
    })
  })

  describe('edge cases', () => {
    it('should handle empty workbook', () => {
      const emptyData: WorkbookData = {
        sheets: [{ name: 'Sheet1', cells: {} }],
      }

      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'A1',
        value: 'First cell',
      }

      const result = workbookOps.applyOperations(emptyData, [op])

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.A1).toEqual({ value: 'First cell' })
    })

    it('should handle A1 notation edge cases', () => {
      const ops = [
        {
          kind: 'set_cell' as const,
          sheet: 'Sheet1',
          cell: 'AA1',
          value: 'Column 27',
        },
        {
          kind: 'set_cell' as const,
          sheet: 'Sheet1',
          cell: 'Z99',
          value: 'Far cell',
        },
      ]

      const result = workbookOps.applyOperations(testData, ops)

      expect(result.errors).toHaveLength(0)
      expect(result.next.sheets[0]!.cells.AA1).toEqual({ value: 'Column 27' })
      expect(result.next.sheets[0]!.cells.Z99).toEqual({ value: 'Far cell' })
    })

    it('should not mutate original data', () => {
      const originalData = JSON.stringify(testData)

      const op: SetCellOp = {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'Z99',
        value: 'New value',
      }

      workbookOps.applyOperations(testData, [op])

      expect(JSON.stringify(testData)).toBe(originalData)
    })
  })
})
