import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

interface CellProps {
  value: string | number | boolean | null
  isSelected: boolean
  isEditing: boolean
  row: number
  col: number
  onSelect: (row: number, col: number) => void
  onStartEdit: (row: number, col: number) => void
  onCellChange: (row: number, col: number, value: string) => void
  onKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
}

export function Cell({
  value,
  isSelected,
  isEditing,
  row,
  col,
  onSelect,
  onStartEdit,
  onCellChange,
  onKeyDown,
}: CellProps) {
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const cellRef = useRef<HTMLDivElement>(null)

  // Initialize edit value when editing starts
  useEffect(() => {
    if (isEditing) {
      setEditValue(String(value ?? ''))
      // Focus and select input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
    }
  }, [isEditing, value])

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && cellRef.current) {
      cellRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }, [isSelected])

  const handleDoubleClick = () => {
    setEditValue(String(value ?? ''))
    onStartEdit(row, col)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }

  const handleBlur = () => {
    onCellChange(row, col, editValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onCellChange(row, col, editValue)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''))
      onCellChange(row, col, String(value ?? ''))
      e.preventDefault()
    } else if (e.key === 'Tab') {
      onCellChange(row, col, editValue)
    }
  }

  // Format value for display
  const displayValue = (() => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
  })()

  return (
    <div
      ref={cellRef}
      className={cn(
        'relative border-r border-b border-excel-grid-line flex items-center px-2',
        'hover:bg-excel-grid-hover cursor-cell transition-colors',
        isSelected && !isEditing && 'ring-2 ring-excel-selection-ring ring-inset z-10 bg-white',
        isEditing && 'ring-2 ring-excel-selection-border ring-inset z-20 bg-white'
      )}
      style={{
        height: '32px',
        minWidth: '100px',
      }}
      onClick={() => onSelect(row, col)}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => onKeyDown(e, row, col)}
      tabIndex={isSelected ? 0 : -1}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 w-full h-full px-2 border-none outline-none bg-white text-sm font-sans"
        />
      ) : (
        <span className="text-sm font-sans text-gray-900 truncate">
          {displayValue}
        </span>
      )}
    </div>
  )
}
