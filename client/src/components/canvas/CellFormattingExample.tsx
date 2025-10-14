/**
 * CellFormattingExample Component
 * Example demonstrating how to integrate FormatToolbar with useWorkbook
 */

import { useWorkbook } from '@/lib/workbook/useWorkbook';
import { FormulaBar } from './FormulaBar';
import { FormatToolbar } from './FormatToolbar';
import { StyleToolbar } from './StyleToolbar';
import type { Cell, CellStyle } from '@/lib/workbook/types';

export function CellFormattingExample() {
  const workbook = useWorkbook();
  const selectedAddress = 'A1';
  
  // Note: In a real implementation, you would have state for selectedAddress
  // that updates when users click on cells in the canvas

  // Get current cell
  const currentCell = workbook.getCellValue(selectedAddress);
  const cellValue = currentCell?.raw || currentCell?.computed?.v || '';
  const cellFormula = currentCell?.formula || '';
  const displayValue = cellFormula ? `=${cellFormula}` : String(cellValue);

  /**
   * Handle cell value changes from FormulaBar
   */
  const handleCellCommit = (value: string) => {
    const newCell: Cell = {};

    if (value.startsWith('=')) {
      // Formula
      newCell.formula = value.substring(1);
      newCell.dataType = 'formula';
    } else {
      // Regular value
      newCell.raw = value;
      // Auto-detect data type
      if (!isNaN(Number(value)) && value.trim() !== '') {
        newCell.dataType = 'number';
      } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        newCell.dataType = 'boolean';
        newCell.raw = value.toLowerCase() === 'true';
      } else {
        newCell.dataType = 'string';
      }
    }

    // Preserve existing style and numFmt
    if (currentCell?.style) {
      newCell.style = currentCell.style;
    }
    if (currentCell?.numFmt) {
      newCell.numFmt = currentCell.numFmt;
    }

    workbook.setCell(selectedAddress, newCell);
  };

  /**
   * Handle style changes from FormatToolbar
   */
  const handleStyleChange = (styleChanges: Partial<CellStyle>) => {
    const existingCell = currentCell || {};
    const updatedCell: Cell = {
      ...existingCell,
      style: {
        ...existingCell.style,
        ...styleChanges,
      },
    };

    workbook.setCell(selectedAddress, updatedCell);
  };

  /**
   * Handle number format changes from FormatToolbar
   */
  const handleNumberFormatChange = (numFmt: string) => {
    const existingCell = currentCell || {};
    const updatedCell: Cell = {
      ...existingCell,
      numFmt,
    };

    workbook.setCell(selectedAddress, updatedCell);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Formula Bar */}
      <FormulaBar
        value={displayValue}
        cellReference={selectedAddress}
        onCommit={handleCellCommit}
        onCancel={() => {
          // Reset to original value
        }}
      />

      {/* Format Toolbar */}
      <FormatToolbar
        selectedCell={{
          address: selectedAddress,
          style: currentCell?.style,
          numFmt: currentCell?.numFmt,
        }}
        onStyleChange={handleStyleChange}
        onNumberFormatChange={handleNumberFormatChange}
      />

      {/* Style Toolbar (additional styling options) */}
      <StyleToolbar
        selectedCell={{
          address: selectedAddress,
          style: currentCell?.style,
        }}
        onStyleChange={handleStyleChange}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {/* 
          CanvasRenderer would go here
          Pass handleCellSelect to handle cell selection events
        */}
        <div className="p-4 text-center text-gray-500">
          <p>Canvas Renderer Component Here</p>
          <p className="text-sm mt-2">
            Selected Cell: {selectedAddress}
          </p>
          <p className="text-xs mt-1">
            Value: {String(cellValue)}
          </p>
          {currentCell?.style && (
            <p className="text-xs mt-1">
              Style: {JSON.stringify(currentCell.style)}
            </p>
          )}
          {currentCell?.numFmt && (
            <p className="text-xs mt-1">
              Format: {currentCell.numFmt}
            </p>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 border-t border-gray-200 bg-gray-50 flex items-center px-4 gap-4 text-xs text-gray-600">
        <span>Sheet: {workbook.currentSheet?.name}</span>
        <span>Cells: {workbook.stats.cells}</span>
        <span>Formulas: {workbook.stats.formulas}</span>
        {workbook.isDirty && <span className="text-orange-600">● Unsaved</span>}
        {workbook.isComputing && <span className="text-blue-600">⏳ Computing...</span>}
      </div>
    </div>
  );
}
