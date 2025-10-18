/**
 * Demo component for testing lazy loading CanvasRenderer
 */

import { useState, useCallback, useEffect } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import { useWorkbookLazy } from '@/lib/workbook/useWorkbookLazy';
import { seedDemoData, type CellRange } from '@/lib/workbook/api-client';
// import type { CellData } from '@/lib/types'; (unused)

const ROW_COUNT = 10000;
const COL_COUNT = 1000;
const VIEWPORT_BUFFER = 5;

export function LazyCanvasDemo() {
  const [isInitialized, setIsInitialized] = useState(false);
  
  const workbook = useWorkbookLazy({
    enableFormulas: true,
    viewportBuffer: VIEWPORT_BUFFER,
  });

  const {
    currentSheetId,
    isLoading,
    error,
    getCellData,
    loadRange,
    setCell,
  } = workbook;

  // Initialize demo data
  useEffect(() => {
    async function init() {
      try {
        const result = await seedDemoData();
        console.log('Demo data seeded:', result);
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to seed demo data:', err);
      }
    }
    
    init();
  }, []);

  // Handle cell edit
  const handleCellEdit = useCallback((row: number, col: number, value: string) => {
    // Convert row/col to Excel address (A1 notation)
    const colLabel = getColumnLabel(col);
    const address = `${colLabel}${row + 1}`;
    
    setCell(address, {
      raw: value,
      formula: value.startsWith('=') ? value : undefined,
    });
  }, [setCell]);

  // Handle viewport changes for lazy loading
  const handleViewportChange = useCallback((range: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }) => {
    // Add buffer to range
    const bufferedRange: CellRange = {
      sheetId: currentSheetId,
      rowStart: Math.max(0, range.rowStart - VIEWPORT_BUFFER),
      rowEnd: Math.min(ROW_COUNT - 1, range.rowEnd + VIEWPORT_BUFFER),
      colStart: Math.max(0, range.colStart - VIEWPORT_BUFFER),
      colEnd: Math.min(COL_COUNT - 1, range.colEnd + VIEWPORT_BUFFER),
    };

    // Load the range asynchronously
    loadRange(bufferedRange).catch(err => {
      console.error('Failed to load range:', err);
    });
  }, [currentSheetId, loadRange]);

  // Convert column index to Excel letter (0 -> A, 1 -> B, etc.)
  function getColumnLabel(index: number): string {
    let label = '';
    let num = index;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing demo data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Loading...
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="text-sm text-gray-600">
          <p>Sheet: {currentSheetId}</p>
          <p>Grid: {ROW_COUNT} × {COL_COUNT} cells</p>
          <p>Mode: Lazy Loading with Virtualization</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <CanvasRenderer
          rowCount={ROW_COUNT}
          colCount={COL_COUNT}
          getCellAt={getCellData}
          onCellEdit={handleCellEdit}
          onViewportChange={handleViewportChange}
        />
      </div>
    </div>
  );
}