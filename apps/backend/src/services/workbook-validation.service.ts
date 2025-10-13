import { z } from 'zod'

/**
 * System limits from PRD
 */
export const WORKBOOK_LIMITS = {
  MAX_ROWS: 5000,
  MAX_COLS: 100,
  MAX_CELLS: 500000, // 5000 * 100
  MAX_WORKBOOKS: 10,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FORMULA_LENGTH: 1000,
  MAX_WORKBOOK_NAME_LENGTH: 255,
  MAX_SHEET_NAME_LENGTH: 31, // Excel standard
} as const

/**
 * Cell value schema
 */
const cellValueSchema = z.object({
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ]).optional(),
  formula: z.string().max(WORKBOOK_LIMITS.MAX_FORMULA_LENGTH).optional(),
  format: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional()
})

/**
 * Sheet schema
 */
const sheetSchema = z.object({
  name: z.string().min(1).max(WORKBOOK_LIMITS.MAX_SHEET_NAME_LENGTH),
  cells: z.record(z.string(), cellValueSchema),
  formats: z.record(z.string(), z.any()).optional(),
})

/**
 * Complete workbook data schema
 */
export const workbookDataSchema = z.object({
  sheets: z.array(sheetSchema).min(1).max(10), // Max 10 sheets per workbook
  metadata: z.object({
    activeSheet: z.string(),
    theme: z.string().optional(),
    created: z.string().optional(),
    modified: z.string().optional(),
  }).optional()
})

export type WorkbookData = z.infer<typeof workbookDataSchema>
export type Sheet = z.infer<typeof sheetSchema>
export type CellValue = z.infer<typeof cellValueSchema>

/**
 * Workbook Validation Service
 * Validates workbook structure and enforces size limits
 */
export class WorkbookValidationService {
  
  /**
   * Validate workbook data structure and size limits
   */
  validate(data: unknown): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate schema
    try {
      workbookDataSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          warnings: []
        }
      }
    }

    const workbookData = data as WorkbookData

    // Validate size limits
    const { totalCells, maxRow, maxCol } = this.calculateSize(workbookData)

    if (totalCells > WORKBOOK_LIMITS.MAX_CELLS) {
      errors.push(`Workbook exceeds maximum cell count (${totalCells} > ${WORKBOOK_LIMITS.MAX_CELLS})`)
    }

    if (maxRow > WORKBOOK_LIMITS.MAX_ROWS) {
      errors.push(`Workbook exceeds maximum rows (${maxRow} > ${WORKBOOK_LIMITS.MAX_ROWS})`)
    }

    if (maxCol > WORKBOOK_LIMITS.MAX_COLS) {
      errors.push(`Workbook exceeds maximum columns (${maxCol} > ${WORKBOOK_LIMITS.MAX_COLS})`)
    }

    // Warnings for large workbooks
    if (totalCells > WORKBOOK_LIMITS.MAX_CELLS * 0.8) {
      warnings.push(`Workbook is approaching maximum cell limit (${totalCells}/${WORKBOOK_LIMITS.MAX_CELLS})`)
    }

    // Validate formulas
    const formulaErrors = this.validateFormulas(workbookData)
    errors.push(...formulaErrors)

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Calculate total cells and dimensions
   */
  private calculateSize(data: WorkbookData): {
    totalCells: number
    maxRow: number
    maxCol: number
  } {
    let totalCells = 0
    let maxRow = 0
    let maxCol = 0

    for (const sheet of data.sheets) {
      const cellCount = Object.keys(sheet.cells || {}).length
      totalCells += cellCount

      // Calculate max row/col from cell references
      for (const cellRef of Object.keys(sheet.cells || {})) {
        const { row, col } = this.parseA1Notation(cellRef)
        maxRow = Math.max(maxRow, row)
        maxCol = Math.max(maxCol, col)
      }
    }

    return { totalCells, maxRow, maxCol }
  }

  /**
   * Validate formulas in workbook
   */
  private validateFormulas(data: WorkbookData): string[] {
    const errors: string[] = []

    for (const sheet of data.sheets) {
      for (const [cellRef, cell] of Object.entries(sheet.cells || {})) {
        if (cell.formula) {
          // Check formula length
          if (cell.formula.length > WORKBOOK_LIMITS.MAX_FORMULA_LENGTH) {
            errors.push(`Formula in ${sheet.name}!${cellRef} exceeds maximum length`)
          }

          // Check formula syntax (basic validation)
          if (!cell.formula.startsWith('=')) {
            errors.push(`Formula in ${sheet.name}!${cellRef} must start with '='`)
          }
        }
      }
    }

    return errors
  }

  /**
   * Parse A1 notation to row/column indices
   * Examples:
   *   "A1" -> { row: 0, col: 0 }
   *   "Z99" -> { row: 98, col: 25 }
   *   "AA1" -> { row: 0, col: 26 }
   */
  parseA1Notation(ref: string): { row: number; col: number } {
    const match = ref.match(/^([A-Z]+)(\d+)$/)
    
    if (!match) {
      return { row: 0, col: 0 }
    }

    const colStr = match[1]!
    const rowStr = match[2]!

    // Convert column letters to index (A=0, B=1, ..., Z=25, AA=26, AB=27, etc.)
    // Algorithm: treat as base-26 with A=1, B=2, ..., Z=26
    let col = 0
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64) // A=1, B=2, etc.
    }
    col -= 1 // Convert to 0-based index

    // Convert row number to 0-based index
    const row = parseInt(rowStr, 10) - 1

    return { row, col }
  }

  /**
   * Convert row/col indices to A1 notation
   * Examples:
   *   (0, 0) -> "A1"
   *   (0, 25) -> "Z1"
   *   (0, 26) -> "AA1"
   */
  toA1Notation(row: number, col: number): string {
    let colStr = ''
    let colNum = col

    while (colNum >= 0) {
      colStr = String.fromCharCode(65 + (colNum % 26)) + colStr
      colNum = Math.floor(colNum / 26) - 1
    }

    return `${colStr}${row + 1}`
  }

  /**
   * Get size statistics for a workbook
   */
  getStatistics(data: WorkbookData): {
    totalSheets: number
    totalCells: number
    totalFormulas: number
    maxRow: number
    maxCol: number
    estimatedSizeBytes: number
  } {
    const { totalCells, maxRow, maxCol } = this.calculateSize(data)
    
    let totalFormulas = 0
    for (const sheet of data.sheets) {
      for (const cell of Object.values(sheet.cells || {})) {
        if (cell.formula) {
          totalFormulas++
        }
      }
    }

    // Rough estimate of JSON size
    const estimatedSizeBytes = JSON.stringify(data).length

    return {
      totalSheets: data.sheets.length,
      totalCells,
      totalFormulas,
      maxRow,
      maxCol,
      estimatedSizeBytes
    }
  }
}

// Export singleton instance
export const workbookValidation = new WorkbookValidationService()
