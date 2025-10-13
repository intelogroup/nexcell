import ExcelJS from 'exceljs'
import { WorkbookData } from './ai.service.js'

/**
 * Export a workbook to XLSX format using ExcelJS
 */
export async function exportToXlsx(workbookData: WorkbookData): Promise<Buffer> {
  // Create a new Excel workbook
  const workbook = new ExcelJS.Workbook()
  
  // Set workbook properties
  workbook.creator = 'Nexcell'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.lastPrinted = new Date()
  
  // Add each sheet from the workbook data
  for (const sheetData of workbookData.sheets) {
    const worksheet = workbook.addWorksheet(sheetData.name)
    
    // Convert A1 notation cells to row/col format and populate
    for (const [cellRef, cellData] of Object.entries(sheetData.cells)) {
      const { row, col } = parseA1Notation(cellRef)
      const cell = worksheet.getCell(row, col)
      
      // Set cell value or formula
      if (cellData.formula) {
        // ExcelJS expects formulas without the leading '='
        cell.value = {
          formula: cellData.formula.startsWith('=') ? cellData.formula.substring(1) : cellData.formula,
          result: cellData.value ?? 0,
        }
      } else {
        cell.value = cellData.value ?? null
      }
      
      // Apply formatting if present (check if format property exists)
      const format = (cellData as any).format
      if (format) {
        applyFormatting(cell, format)
      }
    }
    
    // Auto-fit columns (estimate width based on content)
    worksheet.columns.forEach((column) => {
      let maxLength = 10 // Minimum width
      
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellValue = cell.value?.toString() || ''
        maxLength = Math.max(maxLength, cellValue.length)
      })
      
      column.width = Math.min(maxLength + 2, 50) // Max width 50
    })
  }
  
  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Parse A1 notation (e.g., "A1", "BC123") to row/col numbers (1-indexed)
 */
function parseA1Notation(cellRef: string): { row: number; col: number } {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/)
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid cell reference: ${cellRef}`)
  }
  
  const colStr = match[1]
  const rowStr = match[2]
  
  // Convert column letters to number (A=1, B=2, ..., AA=27, etc.)
  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  
  const row = parseInt(rowStr, 10)
  
  return { row, col }
}

/**
 * Apply cell formatting
 */
function applyFormatting(cell: ExcelJS.Cell, format: {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  backgroundColor?: string
}) {
  // Apply font styles
  const font: Partial<ExcelJS.Font> = {}
  
  if (format.bold) {
    font.bold = true
  }
  
  if (format.italic) {
    font.italic = true
  }
  
  if (format.underline) {
    font.underline = true
  }
  
  if (format.color) {
    // Convert hex color to ARGB (ExcelJS format)
    const argb = convertHexToArgb(format.color)
    font.color = { argb }
  }
  
  if (Object.keys(font).length > 0) {
    cell.font = font
  }
  
  // Apply background color
  if (format.backgroundColor) {
    const argb = convertHexToArgb(format.backgroundColor)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    }
  }
}

/**
 * Convert hex color to ARGB format (with full opacity)
 */
function convertHexToArgb(hex: string): string {
  // Remove '#' if present
  const cleanHex = hex.replace('#', '')
  
  // If it's a 3-char hex, expand it to 6 chars
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex
  
  // Add alpha channel (FF = fully opaque)
  return `FF${fullHex.toUpperCase()}`
}

// Export service
export const xlsxExportService = {
  exportToXlsx,
}
