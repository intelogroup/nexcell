import { useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type CellData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FormulaBar } from './FormulaBar';
import { FormatToolbar } from './FormatToolbar';
import { StyleToolbar } from './StyleToolbar';
import { excelTheme } from '../../lib/excel-theme';

interface CanvasRendererStaticProps {
  data: CellData[][];
  onCellEdit: (row: number, col: number, value: string) => void;
  rowCount?: number;
  colCount?: number;
  getCellAt?: never;
  onViewportChange?: never;
}

interface CanvasRendererLazyProps {
  data?: never;
  onCellEdit: (row: number, col: number, value: string) => void;
  rowCount: number;
  colCount: number;
  getCellAt: (row: number, col: number) => CellData | undefined;
  onViewportChange?: (range: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }) => void;
}

type CanvasRendererProps = CanvasRendererStaticProps | CanvasRendererLazyProps;

const COLUMN_WIDTH = 120;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 32;

export function CanvasRenderer(props: CanvasRendererProps) {
  const { onCellEdit } = props;
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isStartingEdit, setIsStartingEdit] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  // Determine if we're in lazy loading mode
  const isLazyMode = 'getCellAt' in props;

  // Narrow props per mode to satisfy TypeScript
  const lazyProps = props as CanvasRendererLazyProps;
  const staticProps = props as CanvasRendererStaticProps;

  // Get data access functions based on mode (assert non-null for lazy props)
  const getCellData = isLazyMode
    ? lazyProps.getCellAt
    : (row: number, col: number) => staticProps.data[row]?.[col];

  const rowCount = (isLazyMode ? lazyProps.rowCount : staticProps.data.length) as number;
  const colCount = (isLazyMode ? lazyProps.colCount : (staticProps.data[0]?.length || 0)) as number;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: colCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COLUMN_WIDTH,
    overscan: 3,
  });

  // Handle viewport changes for lazy loading
  useEffect(() => {
    if (!isLazyMode || !props.onViewportChange) return;
    
    const virtualRows = rowVirtualizer.getVirtualItems();
    const virtualCols = colVirtualizer.getVirtualItems();
    
    if (virtualRows.length > 0 && virtualCols.length > 0) {
      const range = {
        rowStart: virtualRows[0].index,
        rowEnd: virtualRows[virtualRows.length - 1].index,
        colStart: virtualCols[0].index,
        colEnd: virtualCols[virtualCols.length - 1].index,
      };
      
      props.onViewportChange(range);
    }
  }, [isLazyMode, props.onViewportChange, rowVirtualizer, colVirtualizer]);

  const handleCellClick = (row: number, col: number) => {
    if (editingCell) {
      commitEdit();
    }
    setSelectedCell({ row, col });
    // Ensure the canvas container receives keyboard events after clicking a cell
    // so typing while a cell is selected will be handled by handleKeyDown.
    try {
      parentRef.current?.focus();
    } catch (e) {
      // ignore
    }
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    const cell = getCellData(row, col);
    setEditingCell({ row, col });
    setEditValue(cell?.formula ?? String(cell?.value ?? ''));
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
        setIsStartingEdit(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
        setIsStartingEdit(false);
      } else if (isStartingEdit) {
        // While starting edit and input is rendering, accumulate typed characters
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (isPrintable) {
          e.preventDefault();
          setEditValue(prev => prev + e.key);
        }
      }
      return;
    }

    // If a printable character is typed while a cell is selected (not already editing),
    // start edit mode and seed the input with that character. This mirrors spreadsheet UX
    // where typing replaces the cell contents and begins editing.
    const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!editingCell && selectedCell && isPrintable) {
      e.preventDefault();
      const seed = e.key;
      setEditingCell({ row: selectedCell.row, col: selectedCell.col });
      setEditValue(seed);
      setIsStartingEdit(true);
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
      else if (e.key === 'ArrowDown') newRow = Math.min(rowCount - 1, newRow + 1);
      else if (e.key === 'ArrowLeft') newCol = Math.max(0, newCol - 1);
      else if (e.key === 'ArrowRight') newCol = Math.min(colCount - 1, newCol + 1);

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
    ? getCellData(selectedCell.row, selectedCell.col)
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
        onCancel={() => { 
          // Cancel editing via formula bar -> close edit mode
          cancelEdit();
        }}
        onFocus={() => {
          // When formula bar is focused, enter edit mode for the selected cell so both inputs sync
          if (selectedCell && !editingCell) {
            const cell = getCellData(selectedCell.row, selectedCell.col);
            setEditingCell({ row: selectedCell.row, col: selectedCell.col });
            setEditValue(cell?.formula ?? String(cell?.value ?? ''));
          }
        }}
        onChange={(v) => {
          // Live-update the editing value when user types in the formula bar
          if (editingCell) {
            setEditValue(v);
          }
        }}
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
                const cell = getCellData(virtualRow.index, virtualCol.index);

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
                        onFocus={() => setIsStartingEdit(false)}
                        className="w-full h-full px-1 border-none outline-none bg-transparent"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate">
                        {cell?.value !== null && cell?.value !== undefined 
                          ? String(cell?.value ?? '') 
                          : (cell?.formula ?? '')}
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
