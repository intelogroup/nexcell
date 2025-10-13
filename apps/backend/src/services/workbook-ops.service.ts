import {
  Operation,
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
  WorkbookSnapshot,
  CellData,
  OpValidationError,
} from '../types/operations'
import { workbookValidation, WORKBOOK_LIMITS } from './workbook-validation.service'
import { WorkbookData, Sheet } from './workbook-validation.service'

/**
 * Result of applying operations to a workbook
 */
export interface ApplyOpsResult {
  next: WorkbookData // New workbook state
  diff: OperationDiff[] // List of actual changes made
  errors: OpValidationError[] // Errors encountered during application
}

/**
 * Describes a change made to the workbook
 */
export interface OperationDiff {
  opIndex: number
  kind: string
  sheet?: string
  changes: string // Human-readable description of changes
}

/**
 * Workbook Operations Service
 * Pure transformation service that applies operations to workbook data
 */
export class WorkbookOpsService {
  /**
   * Apply a list of operations to workbook data
   * Returns new workbook state, diff, and any errors
   */
  applyOperations(
    data: WorkbookData,
    operations: Operation[]
  ): ApplyOpsResult {
    // Clone the data to avoid mutations
    let current: WorkbookData = JSON.parse(JSON.stringify(data))
    const diff: OperationDiff[] = []
    const errors: OpValidationError[] = []

    // Apply each operation sequentially
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!
      try {
        const result = this.applyOperation(current, op, i)
        current = result.data
        if (result.diff) {
          diff.push(result.diff)
        }
      } catch (error) {
        errors.push({
          opIndex: i,
          operation: op,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      next: current,
      diff,
      errors,
    }
  }

  /**
   * Apply a single operation to workbook data
   */
  private applyOperation(
    data: WorkbookData,
    op: Operation,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    switch (op.kind) {
      case 'set_cell':
        return this.applySetCell(data, op, opIndex)
      case 'fill_range':
        return this.applyFillRange(data, op, opIndex)
      case 'insert_rows':
        return this.applyInsertRows(data, op, opIndex)
      case 'insert_cols':
        return this.applyInsertCols(data, op, opIndex)
      case 'delete_rows':
        return this.applyDeleteRows(data, op, opIndex)
      case 'delete_cols':
        return this.applyDeleteCols(data, op, opIndex)
      case 'add_sheet':
        return this.applyAddSheet(data, op, opIndex)
      case 'rename_sheet':
        return this.applyRenameSheet(data, op, opIndex)
      case 'delete_sheet':
        return this.applyDeleteSheet(data, op, opIndex)
      case 'format_range':
        return this.applyFormatRange(data, op, opIndex)
      default:
        throw new Error(`Unknown operation kind: ${(op as any).kind}`)
    }
  }

  /**
   * Apply set_cell operation
   */
  private applySetCell(
    data: WorkbookData,
    op: SetCellOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    const { row, col } = workbookValidation.parseA1Notation(op.cell)
    this.validateBounds(row, col)

    // Ensure cells object exists
    if (!sheet.cells) {
      sheet.cells = {}
    }

    // Set cell value
    const cellData: CellData = {}
    if (op.value !== undefined) {
      cellData.value = op.value
    }
    if (op.formula) {
      if (!op.formula.startsWith('=')) {
        throw new Error('Formula must start with "="')
      }
      cellData.formula = op.formula
      delete cellData.value // Formula takes precedence
    }
    if (op.format) {
      cellData.format = op.format
    }

    sheet.cells[op.cell] = cellData

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Set ${op.cell} to ${op.formula || JSON.stringify(op.value)}`,
      },
    }
  }

  /**
   * Apply fill_range operation
   */
  private applyFillRange(
    data: WorkbookData,
    op: FillRangeOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    // Parse range
    const [startRef, endRef] = op.range.split(':')
    if (!startRef || !endRef) {
      throw new Error(`Invalid range: ${op.range}`)
    }

    const start = workbookValidation.parseA1Notation(startRef)
    const end = workbookValidation.parseA1Notation(endRef)

    // Validate bounds
    this.validateBounds(start.row, start.col)
    this.validateBounds(end.row, end.col)

    if (start.row > end.row || start.col > end.col) {
      throw new Error('Invalid range: start must be before end')
    }

    // Ensure cells object exists
    if (!sheet.cells) {
      sheet.cells = {}
    }

    let cellsFilled = 0

    // Fill each cell in range
    for (let row = start.row; row <= end.row; row++) {
      for (let col = start.col; col <= end.col; col++) {
        const cellRef = workbookValidation.toA1Notation(row, col)
        const cellData: CellData = {}

        if (op.value !== undefined) {
          cellData.value = op.value
        }
        if (op.formula) {
          if (!op.formula.startsWith('=')) {
            throw new Error('Formula must start with "="')
          }
          cellData.formula = op.formula
          delete cellData.value
        }
        if (op.format) {
          cellData.format = op.format
        }

        sheet.cells[cellRef] = cellData
        cellsFilled++
      }
    }

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Filled ${cellsFilled} cells in range ${op.range}`,
      },
    }
  }

  /**
   * Apply insert_rows operation
   */
  private applyInsertRows(
    data: WorkbookData,
    op: InsertRowsOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    if (op.startRow < 1 || op.startRow > WORKBOOK_LIMITS.MAX_ROWS) {
      throw new Error(`Invalid row number: ${op.startRow}`)
    }

    if (!sheet.cells) {
      sheet.cells = {}
    }

    // Shift cells down
    const newCells: Record<string, CellData> = {}
    for (const [cellRef, cellData] of Object.entries(sheet.cells)) {
      const { row, col } = workbookValidation.parseA1Notation(cellRef)
      
      if (row >= op.startRow - 1) {
        // Shift this cell down
        const newRow = row + op.count
        if (newRow < WORKBOOK_LIMITS.MAX_ROWS) {
          const newRef = workbookValidation.toA1Notation(newRow, col)
          newCells[newRef] = cellData
        }
      } else {
        // Keep cell as is
        newCells[cellRef] = cellData
      }
    }

    sheet.cells = newCells

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Inserted ${op.count} row(s) at row ${op.startRow}`,
      },
    }
  }

  /**
   * Apply insert_cols operation
   */
  private applyInsertCols(
    data: WorkbookData,
    op: InsertColsOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    if (op.startCol < 1 || op.startCol > WORKBOOK_LIMITS.MAX_COLS) {
      throw new Error(`Invalid column number: ${op.startCol}`)
    }

    if (!sheet.cells) {
      sheet.cells = {}
    }

    // Shift cells right
    const newCells: Record<string, CellData> = {}
    for (const [cellRef, cellData] of Object.entries(sheet.cells)) {
      const { row, col } = workbookValidation.parseA1Notation(cellRef)
      
      if (col >= op.startCol - 1) {
        // Shift this cell right
        const newCol = col + op.count
        if (newCol < WORKBOOK_LIMITS.MAX_COLS) {
          const newRef = workbookValidation.toA1Notation(row, newCol)
          newCells[newRef] = cellData
        }
      } else {
        // Keep cell as is
        newCells[cellRef] = cellData
      }
    }

    sheet.cells = newCells

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Inserted ${op.count} column(s) at column ${op.startCol}`,
      },
    }
  }

  /**
   * Apply delete_rows operation
   */
  private applyDeleteRows(
    data: WorkbookData,
    op: DeleteRowsOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    if (op.startRow < 1 || op.startRow > WORKBOOK_LIMITS.MAX_ROWS) {
      throw new Error(`Invalid row number: ${op.startRow}`)
    }

    if (!sheet.cells) {
      sheet.cells = {}
    }

    const endRow = op.startRow + op.count - 1

    // Delete cells in range and shift cells up
    const newCells: Record<string, CellData> = {}
    for (const [cellRef, cellData] of Object.entries(sheet.cells)) {
      const { row, col } = workbookValidation.parseA1Notation(cellRef)
      
      if (row >= op.startRow - 1 && row < op.startRow - 1 + op.count) {
        // Delete this cell
        continue
      } else if (row >= op.startRow - 1 + op.count) {
        // Shift this cell up
        const newRow = row - op.count
        const newRef = workbookValidation.toA1Notation(newRow, col)
        newCells[newRef] = cellData
      } else {
        // Keep cell as is
        newCells[cellRef] = cellData
      }
    }

    sheet.cells = newCells

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Deleted ${op.count} row(s) starting at row ${op.startRow}`,
      },
    }
  }

  /**
   * Apply delete_cols operation
   */
  private applyDeleteCols(
    data: WorkbookData,
    op: DeleteColsOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    if (op.startCol < 1 || op.startCol > WORKBOOK_LIMITS.MAX_COLS) {
      throw new Error(`Invalid column number: ${op.startCol}`)
    }

    if (!sheet.cells) {
      sheet.cells = {}
    }

    // Delete cells in range and shift cells left
    const newCells: Record<string, CellData> = {}
    for (const [cellRef, cellData] of Object.entries(sheet.cells)) {
      const { row, col } = workbookValidation.parseA1Notation(cellRef)
      
      if (col >= op.startCol - 1 && col < op.startCol - 1 + op.count) {
        // Delete this cell
        continue
      } else if (col >= op.startCol - 1 + op.count) {
        // Shift this cell left
        const newCol = col - op.count
        const newRef = workbookValidation.toA1Notation(row, newCol)
        newCells[newRef] = cellData
      } else {
        // Keep cell as is
        newCells[cellRef] = cellData
      }
    }

    sheet.cells = newCells

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Deleted ${op.count} column(s) starting at column ${op.startCol}`,
      },
    }
  }

  /**
   * Apply add_sheet operation
   */
  private applyAddSheet(
    data: WorkbookData,
    op: AddSheetOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    // Check if sheet already exists
    if (data.sheets.some(s => s.name === op.name)) {
      throw new Error(`Sheet already exists: ${op.name}`)
    }

    // Check sheet limit
    if (data.sheets.length >= 10) {
      throw new Error('Maximum number of sheets (10) reached')
    }

    // Add new sheet
    data.sheets.push({
      name: op.name,
      cells: {},
    })

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        changes: `Added sheet: ${op.name}`,
      },
    }
  }

  /**
   * Apply rename_sheet operation
   */
  private applyRenameSheet(
    data: WorkbookData,
    op: RenameSheetOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.oldName)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.oldName}`)
    }

    // Check if new name already exists
    if (data.sheets.some(s => s.name === op.newName && s.name !== op.oldName)) {
      throw new Error(`Sheet already exists: ${op.newName}`)
    }

    sheet.name = op.newName

    // Update active sheet if needed
    if (data.metadata?.activeSheet === op.oldName) {
      data.metadata.activeSheet = op.newName
    }

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        changes: `Renamed sheet from ${op.oldName} to ${op.newName}`,
      },
    }
  }

  /**
   * Apply delete_sheet operation
   */
  private applyDeleteSheet(
    data: WorkbookData,
    op: DeleteSheetOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheetIndex = data.sheets.findIndex(s => s.name === op.name)
    if (sheetIndex === -1) {
      throw new Error(`Sheet not found: ${op.name}`)
    }

    // Can't delete last sheet
    if (data.sheets.length === 1) {
      throw new Error('Cannot delete the last sheet')
    }

    data.sheets.splice(sheetIndex, 1)

    // Update active sheet if needed
    if (data.metadata?.activeSheet === op.name) {
      data.metadata.activeSheet = data.sheets[0]!.name
    }

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        changes: `Deleted sheet: ${op.name}`,
      },
    }
  }

  /**
   * Apply format_range operation
   */
  private applyFormatRange(
    data: WorkbookData,
    op: FormatRangeOp,
    opIndex: number
  ): { data: WorkbookData; diff?: OperationDiff } {
    const sheet = this.findSheet(data, op.sheet)
    if (!sheet) {
      throw new Error(`Sheet not found: ${op.sheet}`)
    }

    // Parse range
    const [startRef, endRef] = op.range.split(':')
    if (!startRef || !endRef) {
      throw new Error(`Invalid range: ${op.range}`)
    }

    const start = workbookValidation.parseA1Notation(startRef)
    const end = workbookValidation.parseA1Notation(endRef)

    // Validate bounds
    this.validateBounds(start.row, start.col)
    this.validateBounds(end.row, end.col)

    if (start.row > end.row || start.col > end.col) {
      throw new Error('Invalid range: start must be before end')
    }

    // Ensure cells object exists
    if (!sheet.cells) {
      sheet.cells = {}
    }

    let cellsFormatted = 0

    // Format each cell in range
    for (let row = start.row; row <= end.row; row++) {
      for (let col = start.col; col <= end.col; col++) {
        const cellRef = workbookValidation.toA1Notation(row, col)
        
        // Get or create cell
        if (!sheet.cells[cellRef]) {
          sheet.cells[cellRef] = {}
        }

        // Merge format
        sheet.cells[cellRef]!.format = {
          ...sheet.cells[cellRef]!.format,
          ...op.format,
        }

        cellsFormatted++
      }
    }

    return {
      data,
      diff: {
        opIndex,
        kind: op.kind,
        sheet: op.sheet,
        changes: `Formatted ${cellsFormatted} cells in range ${op.range}`,
      },
    }
  }

  /**
   * Find a sheet by name
   */
  private findSheet(data: WorkbookData, name: string): Sheet | undefined {
    return data.sheets.find(s => s.name === name)
  }

  /**
   * Validate cell bounds
   */
  private validateBounds(row: number, col: number): void {
    if (row < 0 || row >= WORKBOOK_LIMITS.MAX_ROWS) {
      throw new Error(`Row ${row + 1} exceeds bounds (max ${WORKBOOK_LIMITS.MAX_ROWS})`)
    }
    if (col < 0 || col >= WORKBOOK_LIMITS.MAX_COLS) {
      throw new Error(`Column ${col + 1} exceeds bounds (max ${WORKBOOK_LIMITS.MAX_COLS})`)
    }
  }
}

// Export singleton instance
export const workbookOps = new WorkbookOpsService()
