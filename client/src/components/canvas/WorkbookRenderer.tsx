import { useMemo } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import type { JSONWorkbook, JSONSheet, CellData } from '@/lib/types';

interface WorkbookRendererProps {
  /** The workbook to render */
  workbook: JSONWorkbook;
  
  /** The active sheet ID to display */
  activeSheet: string;
  
  /** Optional: Cells to highlight (e.g., from AI operations or search results) */
  highlightedCells?: Array<{ row: number; col: number }>;
  
  /** Callback when user edits a cell */
  onCellEdit?: (sheetId: string, row: number, col: number, value: string) => void;
}

/**
 * WorkbookRenderer - High-level component that renders a workbook using canvas-based grid
 * 
 * This component:
 * - Accepts WorkbookJSON format (JSONWorkbook)
 * - Converts sparse cell storage to dense 2D array for CanvasRenderer
 * - Handles active sheet switching
 * - Supports cell highlighting for AI-driven interactions
 * 
 * Architecture:
 * - Read-only rendering by default (edits through onCellEdit callback)
 * - Canvas-based for performance with large grids
 * - Integrates with AI operation system through highlightedCells
 */
export function WorkbookRenderer({
  workbook,
  activeSheet,
  highlightedCells = [],
  onCellEdit,
}: WorkbookRendererProps) {
  // Find the active sheet
  const sheet = useMemo(() => {
    return workbook.sheets.find(s => s.id === activeSheet);
  }, [workbook.sheets, activeSheet]);

  // Convert sparse cell storage (Record<string, JSONCell>) to dense 2D array (CellData[][])
  const cellData = useMemo(() => {
    if (!sheet) return [];

    // Check if sheet has any cells
    const cellKeys = Object.keys(sheet.cells);
    if (cellKeys.length === 0) {
      // Return empty array for truly empty sheets
      return [];
    }

    // Determine grid dimensions
    let maxRow = 0;
    let maxCol = 0;

    // Parse all cell keys to find max dimensions
    cellKeys.forEach(key => {
      const match = key.match(/^R(\d+)C(\d+)$/);
      if (match) {
        const row = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, col);
      }
    });

    // Create dense 2D array with minimum 100x26 (Excel-like initial size)
    const rowCount = Math.max(maxRow + 1, 100);
    const colCount = Math.max(maxCol + 1, 26);
    const data: CellData[][] = Array.from({ length: rowCount }, () =>
      Array.from({ length: colCount }, () => ({
        value: null,
        dataType: 'string',
      }))
    );

    // Populate cells from sparse storage
    Object.entries(sheet.cells).forEach(([key, cell]) => {
      const match = key.match(/^R(\d+)C(\d+)$/);
      if (match) {
        const row = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);

        data[row][col] = {
          value: cell.value ?? null,
          formula: cell.formula,
          formatting: cell.formatting,
          dataType: cell.dataType || 'string',
        };
      }
    });

    return data;
  }, [sheet]);

  // Handle cell edit callback
  const handleCellEdit = (row: number, col: number, value: string) => {
    if (onCellEdit && sheet) {
      onCellEdit(sheet.id, row, col, value);
    }
  };

  // If no sheet found, show error state
  if (!sheet) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Sheet not found</p>
          <p className="text-sm text-gray-500 mt-1">
            The sheet "{activeSheet}" does not exist in this workbook.
          </p>
        </div>
      </div>
    );
  }

  // If no data, show empty state
  if (cellData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Empty sheet</p>
          <p className="text-sm text-gray-500 mt-1">
            Start by asking the AI to add data to this sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CanvasRenderer
      data={cellData}
      onCellEdit={handleCellEdit}
    />
  );
}
