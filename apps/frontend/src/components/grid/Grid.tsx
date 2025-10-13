import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Cell } from './Cell'
import { FormulaBar } from './FormulaBar'
import { useWorkbookStore } from '../../stores/workbook.store'

const COLUMN_WIDTH = 100
const ROW_HEIGHT = 32
const HEADER_HEIGHT = 32
const ROW_HEADER_WIDTH = 60

/**
 * Convert column index to letter (0 = A, 25 = Z, 26 = AA, etc.)
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

export function Grid() {
  const parentRef = useRef<HTMLDivElement>(null)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  
  const { workbookData, updateCell } = useWorkbookStore()
  
  // Get active sheet
  const activeSheet = workbookData?.sheets?.[0]
  const rows = 100
  const cols = 26

  // Convert column index to A1 notation
  const toA1Notation = (row: number, col: number): string => {
    return `${columnToLetter(col)}${row + 1}`
  }

  // Get cell value from store
  const getCellValue = (row: number, col: number): string | number | boolean | null => {
    if (!activeSheet) return null
    const cellRef = toA1Notation(row, col)
    const cell = activeSheet.cells[cellRef]
    return cell?.value ?? null
  }

  // Virtual scrollers
  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: cols,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COLUMN_WIDTH,
    overscan: 5,
  })

  // Handle cell selection
  const handleSelectCell = (row: number, col: number) => {
    setSelectedCell({ row, col })
    setEditingCell(null)
  }

  // Handle edit mode
  const handleStartEdit = (row: number, col: number) => {
    setSelectedCell({ row, col })
    setEditingCell({ row, col })
  }

  // Handle cell value change
  const handleCellChange = (row: number, col: number, value: string) => {
    if (!activeSheet) return
    const cellRef = toA1Notation(row, col)
    updateCell(activeSheet.name, cellRef, { value })
    setEditingCell(null)
  }

  // Handle formula submission from formula bar
  const handleFormulaSubmit = (formula: string) => {
    if (!selectedCell || !activeSheet) return
    const cellRef = toA1Notation(selectedCell.row, selectedCell.col)
    updateCell(activeSheet.name, cellRef, { value: formula })
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (editingCell) return // Don't navigate while editing

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (row > 0) setSelectedCell({ row: row - 1, col })
        break
      case 'ArrowDown':
        e.preventDefault()
        if (row < rows - 1) setSelectedCell({ row: row + 1, col })
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (col > 0) setSelectedCell({ row, col: col - 1 })
        break
      case 'ArrowRight':
        e.preventDefault()
        if (col < cols - 1) setSelectedCell({ row, col: col + 1 })
        break
      case 'Enter':
        e.preventDefault()
        setEditingCell({ row, col })
        break
      case 'F2':
        e.preventDefault()
        setEditingCell({ row, col })
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        handleCellChange(row, col, '')
        break
      default:
        // Start editing on any printable character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setEditingCell({ row, col })
        }
        break
    }
  }

  // Get rows and columns from virtualizers
  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualCols = colVirtualizer.getVirtualItems()

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Formula Bar */}
      <FormulaBar
        selectedCell={selectedCell}
        onFormulaSubmit={handleFormulaSubmit}
      />

      {/* Column Headers */}
      <div className="flex border-b border-excel-header-border bg-excel-header sticky top-0 z-20 shadow-sm">
        {/* Top-left corner */}
        <div
          className="flex-shrink-0 border-r border-excel-header-border bg-excel-header-dark flex items-center justify-center font-semibold text-xs text-gray-700"
          style={{ width: '60px', height: `${HEADER_HEIGHT}px` }}
        >
          #
        </div>

        {/* Column headers */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          <div
            className="relative"
            style={{
              width: `${colVirtualizer.getTotalSize()}px`,
              height: '100%',
            }}
          >
            {virtualCols.map((virtualCol) => (
              <div
                key={virtualCol.key}
                className="absolute top-0 left-0 border-r border-excel-header-border bg-excel-header hover:bg-excel-header-dark transition-colors flex items-center justify-center font-semibold text-xs text-gray-700"
                style={{
                  width: `${virtualCol.size}px`,
                  height: '100%',
                  transform: `translateX(${virtualCol.start}px)`,
                }}
              >
                {columnToLetter(virtualCol.index)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto relative"
      >
        <div
          style={{
            width: `${60 + colVirtualizer.getTotalSize()}px`,
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {/* Row headers */}
          <div className="absolute left-0 top-0">
            {virtualRows.map((virtualRow) => (
              <div
                key={`row-header-${virtualRow.key}`}
                className="absolute left-0 w-[60px] border-b border-r border-excel-header-border bg-excel-header hover:bg-excel-header-dark transition-colors flex items-center justify-center font-semibold text-xs text-gray-700"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {virtualRow.index + 1}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div
            className="absolute left-[60px] top-0"
            style={{
              width: `${colVirtualizer.getTotalSize()}px`,
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {virtualRows.map((virtualRow) => (
              <div
                key={`row-${virtualRow.key}`}
                className="absolute left-0"
                style={{
                  top: `${virtualRow.start}px`,
                  height: `${virtualRow.size}px`,
                  width: '100%',
                }}
              >
                {virtualCols.map((virtualCol) => {
                  const row = virtualRow.index
                  const col = virtualCol.index
                  const value = getCellValue(row, col)
                  const isSelected = selectedCell?.row === row && selectedCell?.col === col
                  const isEditing = editingCell?.row === row && editingCell?.col === col

                  return (
                    <div
                      key={`cell-${virtualRow.key}-${virtualCol.key}`}
                      className="absolute top-0"
                      style={{
                        left: `${virtualCol.start}px`,
                        width: `${virtualCol.size}px`,
                        height: '100%',
                      }}
                    >
                      <Cell
                        value={value}
                        isSelected={isSelected}
                        isEditing={isEditing}
                        row={row}
                        col={col}
                        onSelect={handleSelectCell}
                        onStartEdit={handleStartEdit}
                        onCellChange={handleCellChange}
                        onKeyDown={handleKeyDown}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
