import { useState } from 'react';
import { CanvasGridRenderer } from '@/components/canvas/CanvasGridRenderer';
import type { CellData } from '@/lib/types';

/**
 * Test page for CanvasGridRenderer with horizontal scrolling
 * 
 * This page demonstrates:
 * - Large grid (50 columns x 100 rows)
 * - Horizontal and vertical scrolling
 * - Cell selection
 * - Cell content rendering
 */
export function CanvasGridTest() {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  // Generate a large grid: 100 rows x 50 columns
  const ROWS = 100;
  const COLS = 50;

  const data: CellData[][] = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => {
      // Create sample data
      if (row === 0) {
        // Header row
        return {
          value: `Column ${col + 1}`,
          dataType: 'string' as const,
        };
      } else if (col === 0) {
        // First column
        return {
          value: `Row ${row}`,
          dataType: 'string' as const,
        };
      } else {
        // Data cells
        return {
          value: row * col,
          dataType: 'number' as const,
        };
      }
    })
  );

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
    console.log(`Clicked cell: ${String.fromCharCode(65 + col)}${row + 1}`);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    console.log(`Double-clicked cell: ${String.fromCharCode(65 + col)}${row + 1}`);
    alert(`Edit cell ${String.fromCharCode(65 + col)}${row + 1}`);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      <div className="bg-white border-b border-gray-300 px-4 py-3">
        <h1 className="text-xl font-bold text-gray-900">Canvas Grid Renderer Test</h1>
        <p className="text-sm text-gray-600 mt-1">
          {ROWS} rows × {COLS} columns • Try scrolling horizontally and vertically
        </p>
        {selectedCell && (
          <p className="text-sm text-blue-600 mt-1">
            Selected: {String.fromCharCode(65 + selectedCell.col)}{selectedCell.row + 1} = {data[selectedCell.row][selectedCell.col].value}
          </p>
        )}
      </div>

      <div className="flex-1 p-4">
        <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden shadow-lg bg-white">
          <CanvasGridRenderer
            data={data}
            columnWidth={120}
            rowHeight={28}
            rowHeaderWidth={60}
            columnHeaderHeight={32}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
          />
        </div>
      </div>

      <div className="bg-white border-t border-gray-300 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Instructions:</h2>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Scroll down to see more rows (up to row {ROWS})</li>
          <li>• <strong>Scroll right to see more columns (up to column {String.fromCharCode(64 + COLS)})</strong></li>
          <li>• Click any cell to select it</li>
          <li>• Double-click a cell to trigger edit</li>
        </ul>
      </div>
    </div>
  );
}
