import { useState, useEffect, useRef } from 'react'
import { useWorkbookStore } from '../../stores/workbook.store'

interface FormulaBarProps {
  selectedCell: { row: number; col: number } | null
  onFormulaSubmit: (formula: string) => void
}

/**
 * Convert column index to letter (0 = A, 1 = B, etc.)
 */
function columnToLetter(col: number): string {
  let result = ''
  let num = col
  
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result
    num = Math.floor(num / 26) - 1
  }
  
  return result
}

/**
 * FormulaBar Component
 * Displays and edits formulas for the selected cell
 */
export function FormulaBar({ selectedCell, onFormulaSubmit }: FormulaBarProps) {
  const [formulaValue, setFormulaValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { workbookData } = useWorkbookStore()

  // Update formula value when selected cell changes
  useEffect(() => {
    if (!selectedCell || !workbookData) {
      setFormulaValue('')
      return
    }

    const activeSheet = workbookData.sheets[0]
    if (!activeSheet) {
      setFormulaValue('')
      return
    }

    const cellRef = `${columnToLetter(selectedCell.col)}${selectedCell.row + 1}`
    const cell = activeSheet.cells[cellRef]
    
    // Show formula if it exists, otherwise show value
    const displayValue = cell?.formula || cell?.value?.toString() || ''
    setFormulaValue(displayValue)
  }, [selectedCell, workbookData])

  const handleFocus = () => {
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormulaValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onFormulaSubmit(formulaValue)
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      // Reset to original value
      if (selectedCell && workbookData) {
        const activeSheet = workbookData.sheets[0]
        const cellRef = `${columnToLetter(selectedCell.col)}${selectedCell.row + 1}`
        const cell = activeSheet?.cells[cellRef]
        setFormulaValue(cell?.formula || cell?.value?.toString() || '')
      }
      inputRef.current?.blur()
    }
  }

  // Get cell reference display
  const cellRef = selectedCell
    ? `${columnToLetter(selectedCell.col)}${selectedCell.row + 1}`
    : ''

  return (
    <div className="flex items-center border-b border-excel-header-border bg-excel-green-50 h-10 px-2 gap-2 shadow-sm">
      {/* Cell Reference Display */}
      <div className="flex-shrink-0 px-3 py-1 font-sans text-sm font-semibold text-gray-800 min-w-[70px] bg-white border border-excel-grid-line rounded">
        {cellRef || 'A1'}
      </div>

      {/* Function Symbol */}
      <div className="flex-shrink-0 text-excel-green-500 font-semibold text-base px-1">
        f<sub className="text-xs">x</sub>
      </div>

      {/* Formula Input */}
      <input
        ref={inputRef}
        type="text"
        value={formulaValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={selectedCell ? 'Enter value or formula (=...)' : 'Select a cell'}
        disabled={!selectedCell}
        className={`
          flex-1 px-3 py-1 text-sm font-sans
          border border-excel-grid-line rounded
          focus:outline-none focus:ring-2 focus:ring-excel-selection-border focus:border-transparent
          disabled:bg-gray-100 disabled:text-gray-400
          transition-colors
          ${isEditing ? 'bg-white shadow-sm' : 'bg-white'}
        `}
      />
    </div>
  )
}
