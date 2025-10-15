import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type CellData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FormulaBar } from './FormulaBar';
import { FormatToolbar } from './FormatToolbar';
import { StyleToolbar } from './StyleToolbar';
import { excelTheme } from '../../lib/excel-theme';

interface CanvasRendererProps {
  data: CellData[][];
  onCellEdit: (row: number, col: number, value: string) => void;
}

const COLUMN_WIDTH = 120;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 32;

export function CanvasRenderer({ data, onCellEdit }: CanvasRendererProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: data[0]?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COLUMN_WIDTH,
    overscan: 3,
  });

  const handleCellClick = (row: number, col: number) => {
    if (editingCell) {
      commitEdit();
    }
    setSelectedCell({ row, col });
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    const cell = data[row][col];
    setEditingCell({ row, col });
    setEditValue(cell.formula || String(cell.value || ''));
  };

  const commitEdit = () => {
    if (editingCell) {
      onCellEdit(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Placeholder handlers for formatting (to be connected to workbook API)
  const handleStyleChange = (style: any) => {
    console.log('Style change requested:', style, 'for cell:', selectedCell);
    // TODO: Connect to workbook style API
  };

  const handleNumberFormatChange = (numFmt: string) => {
    console.log('Number format change requested:', numFmt, 'for cell:', selectedCell);
    // TODO: Connect to workbook number format API
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell && !editingCell) return;

    if (editingCell) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
      return;
    }

    // Navigation
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCell) {
        handleCellDoubleClick(selectedCell.row, selectedCell.col);
      }
    } else if (e.key === 'Escape') {
      setSelectedCell(null);
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (!selectedCell) return;

      let newRow = selectedCell.row;
      let newCol = selectedCell.col;

      if (e.key === 'ArrowUp') newRow = Math.max(0, newRow - 1);
      else if (e.key === 'ArrowDown') newRow = Math.min(data.length - 1, newRow + 1);
      else if (e.key === 'ArrowLeft') newCol = Math.max(0, newCol - 1);
      else if (e.key === 'ArrowRight') newCol = Math.min(data[0].length - 1, newCol + 1);

      setSelectedCell({ row: newRow, col: newCol });
    }
  };

  const getColumnLabel = (index: number): string => {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  };

  const currentCellValue = selectedCell 
    ? data[selectedCell.row][selectedCell.col]
    : null;

  return (
    <div 
      className="flex flex-col h-full"
      style={{ backgroundColor: excelTheme.canvas.background }}
    >
      {/* Format Toolbar */}
      <FormatToolbar
        selectedCell={selectedCell ? {
          address: `${getColumnLabel(selectedCell.col)}${selectedCell.row + 1}`,
          style: currentCellValue?.formatting as any, // TODO: Align CellFormatting and CellStyle types
          numFmt: currentCellValue?.formatting?.numberFormat,
        } : undefined}
        onStyleChange={handleStyleChange}
        onNumberFormatChange={handleNumberFormatChange}
        disabled={!selectedCell}
      />

      {/* Style Toolbar */}
      <StyleToolbar
        selectedCell={selectedCell ? {
          address: `${getColumnLabel(selectedCell.col)}${selectedCell.row + 1}`,
          style: currentCellValue?.formatting as any, // TODO: Align CellFormatting and CellStyle types
        } : undefined}
        onStyleChange={handleStyleChange}
        disabled={!selectedCell}
      />

      {/* Formula Bar */}
      <FormulaBar
        value={editingCell 
          ? editValue 
          : (currentCellValue?.formula || String(currentCellValue?.value || ''))
        }
        cellReference={selectedCell ? `${getColumnLabel(selectedCell.col)}${selectedCell.row + 1}` : ''}
        onCommit={(value) => {
          if (selectedCell) {
            onCellEdit(selectedCell.row, selectedCell.col, value);
          }
        }}
        onCancel={() => {}}
        readOnly={!editingCell && !selectedCell}
      />

      {/* Canvas */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ borderTop: `1px solid ${excelTheme.canvas.gridLines}` }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize() + HEADER_HEIGHT}px`,
            width: `${colVirtualizer.getTotalSize() + 60}px`,
            position: 'relative',
          }}
        >
          {/* Column Headers */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              left: 0,
              zIndex: 20,
              height: HEADER_HEIGHT,
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            {/* Corner cell */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 60,
                height: HEADER_HEIGHT,
                borderRight: '1px solid #e5e7eb',
                background: '#f9fafb',
              }}
            />
            
            {colVirtualizer.getVirtualItems().map((virtualCol) => (
              <div
                key={virtualCol.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${virtualCol.start + 60}px`,
                  width: `${virtualCol.size}px`,
                  height: HEADER_HEIGHT,
                  borderRight: '1px solid #e5e7eb',
                }}
                className="flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-50"
              >
                {getColumnLabel(virtualCol.index)}
              </div>
            ))}
          </div>

          {/* Row Headers and Cells */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: `${virtualRow.start + HEADER_HEIGHT}px`,
                left: 0,
                height: `${virtualRow.size}px`,
                width: '100%',
              }}
            >
              {/* Row Header */}
              <div
                style={{
                  position: 'sticky',
                  left: 0,
                  width: 60,
                  height: '100%',
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  zIndex: 10,
                }}
                className="flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-50"
              >
                {virtualRow.index + 1}
              </div>

              {/* Cells */}
              {colVirtualizer.getVirtualItems().map((virtualCol) => {
                const isSelected =
                  selectedCell?.row === virtualRow.index &&
                  selectedCell?.col === virtualCol.index;
                const isEditing =
                  editingCell?.row === virtualRow.index &&
                  editingCell?.col === virtualCol.index;
                const cell = data[virtualRow.index][virtualCol.index];

                return (
                  <div
                    key={virtualCol.key}
                    style={{
                      position: 'absolute',
                      left: `${virtualCol.start + 60}px`,
                      top: 0,
                      width: `${virtualCol.size}px`,
                      height: `${virtualRow.size}px`,
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                    className={cn(
                      'px-2 flex items-center text-sm cursor-cell',
                      isSelected && 'ring-2 ring-accent-500 ring-inset bg-accent-50',
                      !isSelected && 'hover:bg-gray-50'
                    )}
                    onClick={() => handleCellClick(virtualRow.index, virtualCol.index)}
                    onDoubleClick={() => handleCellDoubleClick(virtualRow.index, virtualCol.index)}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full h-full px-1 border-none outline-none bg-transparent"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate">
                        {cell.formula || cell.value || ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
