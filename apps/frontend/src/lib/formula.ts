import { HyperFormula, type CellValue, type SimpleCellAddress } from 'hyperformula'

/**
 * HyperFormula Engine Singleton
 * Manages formula calculations and cell dependencies with multi-sheet support
 */
class FormulaEngine {
  private hf: HyperFormula | null = null
  private sheetIds: Map<string, number> = new Map()

  /**
   * Initialize the HyperFormula engine
   */
  initialize() {
    if (this.hf) return

    this.hf = HyperFormula.buildEmpty({
      licenseKey: 'gpl-v3', // Use GPL license for open source
    })
    
    // Add initial sheet
    this.addSheet('Sheet1')
  }

  /**
   * Get the HyperFormula instance
   */
  getInstance(): HyperFormula {
    if (!this.hf) {
      this.initialize()
    }
    return this.hf!
  }

  /**
   * Add a new sheet to the workbook
   * @param name - Name of the sheet
   * @returns The sheet ID
   */
  addSheet(name: string): number {
    const hf = this.getInstance()
    
    // Check if sheet already exists
    if (this.sheetIds.has(name)) {
      return this.sheetIds.get(name)!
    }
    
    const sheetId = hf.addSheet(name)
    const id = typeof sheetId === 'number' ? sheetId : 0
    this.sheetIds.set(name, id)
    return id
  }

  /**
   * Remove a sheet from the workbook
   * @param name - Name of the sheet to remove
   */
  removeSheet(name: string): void {
    const hf = this.getInstance()
    const sheetId = this.sheetIds.get(name)
    
    if (sheetId !== undefined) {
      hf.removeSheet(sheetId)
      this.sheetIds.delete(name)
    }
  }

  /**
   * Rename a sheet
   * @param oldName - Current name of the sheet
   * @param newName - New name for the sheet
   */
  renameSheet(oldName: string, newName: string): void {
    const hf = this.getInstance()
    const sheetId = this.sheetIds.get(oldName)
    
    if (sheetId !== undefined) {
      hf.renameSheet(sheetId, newName)
      this.sheetIds.delete(oldName)
      this.sheetIds.set(newName, sheetId)
    }
  }

  /**
   * Get sheet ID by name
   * @param name - Name of the sheet
   * @returns The sheet ID or undefined if not found
   */
  getSheetId(name: string): number | undefined {
    return this.sheetIds.get(name)
  }

  /**
   * Get all sheet names
   * @returns Array of sheet names
   */
  getSheetNames(): string[] {
    return Array.from(this.sheetIds.keys())
  }

  /**
   * Check if a sheet exists
   * @param name - Name of the sheet
   * @returns True if the sheet exists
   */
  hasSheet(name: string): boolean {
    return this.sheetIds.has(name)
  }

  /**
   * Set cell value or formula
   * @param sheetName - Name of the sheet
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   * @param value - Cell value or formula (formulas start with '=')
   */
  setCellValue(sheetName: string, row: number, col: number, value: string | number | boolean | null) {
    const hf = this.getInstance()
    const sheetId = this.getSheetId(sheetName)
    
    if (sheetId === undefined) {
      console.warn(`Sheet "${sheetName}" not found`)
      return
    }
    
    const cellAddress: SimpleCellAddress = {
      sheet: sheetId,
      col,
      row,
    }

    if (value === null || value === '') {
      hf.setCellContents(cellAddress, null)
    } else if (typeof value === 'string' && value.startsWith('=')) {
      // It's a formula
      hf.setCellContents(cellAddress, value)
    } else {
      // It's a value
      hf.setCellContents(cellAddress, value)
    }
  }

  /**
   * Get cell value (calculated value for formulas)
   * @param sheetName - Name of the sheet
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   * @returns The calculated cell value
   */
  getCellValue(sheetName: string, row: number, col: number): CellValue {
    const hf = this.getInstance()
    const sheetId = this.getSheetId(sheetName)
    
    if (sheetId === undefined) {
      console.warn(`Sheet "${sheetName}" not found`)
      return null
    }
    
    const cellAddress: SimpleCellAddress = {
      sheet: sheetId,
      col,
      row,
    }

    return hf.getCellValue(cellAddress)
  }

  /**
   * Get the raw formula from a cell (if it has one)
   * @param sheetName - Name of the sheet
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   * @returns The formula string or null
   */
  getCellFormula(sheetName: string, row: number, col: number): string | null {
    const hf = this.getInstance()
    const sheetId = this.getSheetId(sheetName)
    
    if (sheetId === undefined) {
      console.warn(`Sheet "${sheetName}" not found`)
      return null
    }
    
    const cellAddress: SimpleCellAddress = {
      sheet: sheetId,
      col,
      row,
    }

    const formula = hf.getCellFormula(cellAddress)
    return formula ? `=${formula}` : null
  }

  /**
   * Get serialized data for a specific sheet
   * @param sheetName - Name of the sheet
   * @returns An object with cell references as keys
   */
  getSheetData(sheetName: string): Record<string, any> {
    const hf = this.getInstance()
    const sheetId = this.getSheetId(sheetName)
    
    if (sheetId === undefined) {
      console.warn(`Sheet "${sheetName}" not found`)
      return {}
    }
    
    const serialized = hf.getSheetSerialized(sheetId)
    
    const data: Record<string, any> = {}
    
    // Convert the serialized data to our format
    for (const [address, value] of Object.entries(serialized)) {
      if (value !== null && typeof value === 'object' && 'value' in value) {
        data[address] = {
          value: value.value,
          formula: 'formula' in value ? value.formula : undefined,
        }
      } else {
        data[address] = {
          value: value,
          formula: undefined,
        }
      }
    }
    
    return data
  }

  /**
   * Load data for a single sheet
   * @param sheetName - Name of the sheet
   * @param data - Object with cell references as keys
   */
  loadSheetData(sheetName: string, data: Record<string, any>) {
    const hf = this.getInstance()
    
    // Ensure sheet exists
    if (!this.hasSheet(sheetName)) {
      this.addSheet(sheetName)
    }
    
    const sheetId = this.getSheetId(sheetName)
    if (sheetId === undefined) return
    
    // Clear existing data
    hf.clearSheet(sheetId)
    
    // Load new data
    for (const [cellRef, cellData] of Object.entries(data)) {
      // Parse cell reference (e.g., "A1" -> {row: 0, col: 0})
      const address = this.parseA1Notation(cellRef)
      if (address) {
        const value = cellData.formula || cellData.value
        this.setCellValue(sheetName, address.row, address.col, value)
      }
    }
  }

  /**
   * Load data for all sheets in the workbook
   * @param workbookData - WorkbookData object with sheets array
   */
  loadWorkbookData(workbookData: { sheets: Array<{ name: string; cells: Record<string, any> }> }) {
    // Ensure HyperFormula is initialized
    this.getInstance()
    
    // Clear existing sheets (except keep the Map for tracking)
    const existingSheets = Array.from(this.sheetIds.keys())
    for (const sheetName of existingSheets) {
      this.removeSheet(sheetName)
    }
    
    // Load all sheets
    for (const sheet of workbookData.sheets) {
      this.addSheet(sheet.name)
      this.loadSheetData(sheet.name, sheet.cells)
    }
  }

  /**
   * Parse A1 notation to row/col indices
   * @param ref - Cell reference like "A1", "B2", etc.
   * @returns Object with row and col indices
   */
  parseA1Notation(ref: string): { row: number; col: number } | null {
    const match = ref.match(/^([A-Z]+)(\d+)$/)
    if (!match) return null

    const colLetters = match[1]
    const rowNumber = parseInt(match[2], 10)

    // Convert column letters to index (A=0, B=1, ..., Z=25, AA=26, etc.)
    let col = 0
    for (let i = 0; i < colLetters.length; i++) {
      col = col * 26 + (colLetters.charCodeAt(i) - 64)
    }
    col -= 1 // Convert to 0-based

    const row = rowNumber - 1 // Convert to 0-based

    return { row, col }
  }

  /**
   * Convert row/col indices to A1 notation
   * @param row - Row index (0-based)
   * @param col - Column index (0-based)
   * @returns A1 notation string
   */
  toA1Notation(row: number, col: number): string {
    let colLetter = ''
    let colIndex = col + 1

    while (colIndex > 0) {
      const remainder = (colIndex - 1) % 26
      colLetter = String.fromCharCode(65 + remainder) + colLetter
      colIndex = Math.floor((colIndex - 1) / 26)
    }

    return `${colLetter}${row + 1}`
  }

  /**
   * Destroy the engine instance
   */
  destroy() {
    if (this.hf) {
      this.hf.destroy()
      this.hf = null
    }
  }
}

// Export singleton instance
export const formulaEngine = new FormulaEngine()
