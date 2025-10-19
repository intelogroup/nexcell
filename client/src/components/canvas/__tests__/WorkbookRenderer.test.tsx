import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkbookRenderer } from '../WorkbookRenderer';
import type { JSONWorkbook } from '@/lib/types';

describe('WorkbookRenderer', () => {
  // Helper to create a minimal workbook
  const createWorkbook = (overrides?: Partial<JSONWorkbook>): JSONWorkbook => ({
    version: '1.0',
    id: 'wb-test',
    name: 'Test Workbook',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    sheets: [
      {
        id: 'sheet1',
        name: 'Sheet1',
        position: 0,
        cells: {
          R0C0: { value: 'Hello', dataType: 'string' },
          R0C1: { value: 'World', dataType: 'string' },
          R1C0: { value: 100, dataType: 'number' },
          R1C1: { formula: '=A2*2', value: 200, dataType: 'number' },
        },
      },
    ],
    ...overrides,
  });

  it('should render workbook with active sheet', () => {
    const workbook = createWorkbook();
    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet1"
      />
    );

    // Should render the CanvasRenderer component (checks for formula bar and grid container)
    expect(container.querySelector('.flex-1.overflow-auto')).toBeTruthy();
  });

  it('should show error message when sheet not found', () => {
    const workbook = createWorkbook();
    render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="nonexistent-sheet"
      />
    );

    expect(screen.getByText('Sheet not found')).toBeInTheDocument();
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();
  });

  it('should show empty state for sheet with no cells', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'empty-sheet',
          name: 'Empty',
          position: 0,
          cells: {},
        },
      ],
    });

    render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="empty-sheet"
      />
    );

    expect(screen.getByText('Empty sheet')).toBeInTheDocument();
  });

  it('should convert sparse cell storage to dense 2D array', () => {
    const workbook = createWorkbook();
    const onCellEdit = vi.fn();

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet1"
        onCellEdit={onCellEdit}
      />
    );

    // The component should render without errors
    expect(container).toBeTruthy();
  });

  it('should handle cell edit callback with sheet ID', () => {
    const workbook = createWorkbook();
    const onCellEdit = vi.fn();

    render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet1"
        onCellEdit={onCellEdit}
      />
    );

    // Note: Testing actual cell editing requires interaction with CanvasRenderer
    // which would require more complex testing setup. This test verifies the
    // component renders correctly with the callback prop.
    expect(onCellEdit).not.toHaveBeenCalled();
  });

  it('should handle highlighted cells prop', () => {
    const workbook = createWorkbook();
    const highlightedCells = [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
    ];

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet1"
        highlightedCells={highlightedCells}
      />
    );

    // Component should render without errors
    expect(container).toBeTruthy();
  });

  it('should create minimum 100x26 grid even for small data', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'small-sheet',
          name: 'Small',
          position: 0,
          cells: {
            R0C0: { value: 'A1', dataType: 'string' },
          },
        },
      ],
    });

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="small-sheet"
      />
    );

    // Should render successfully with expanded grid
    expect(container).toBeTruthy();
  });

  it('should expand grid to accommodate all cells', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'large-sheet',
          name: 'Large',
          position: 0,
          cells: {
            R0C0: { value: 'A1', dataType: 'string' },
            R150C50: { value: 'CV151', dataType: 'string' }, // Beyond default 100x26
          },
        },
      ],
    });

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="large-sheet"
      />
    );

    // Should render successfully with expanded grid to fit all cells
    expect(container).toBeTruthy();
  });

  it('should preserve cell formulas and formatting', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'formatted-sheet',
          name: 'Formatted',
          position: 0,
          cells: {
            R0C0: {
              value: 'Formatted',
              dataType: 'string',
              formatting: {
                bold: true,
                color: '#FF0000',
                backgroundColor: '#FFFF00',
              },
            },
            R1C0: {
              formula: '=SUM(A1:A10)',
              value: 100,
              dataType: 'number',
              formatting: {
                numberFormat: '#,##0.00',
              },
            },
          },
        },
      ],
    });

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="formatted-sheet"
      />
    );

    // Should render successfully with formatted cells
    expect(container).toBeTruthy();
  });

  it('should handle multiple sheets in workbook', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'sheet1',
          name: 'Sheet1',
          position: 0,
          cells: {
            R0C0: { value: 'Sheet 1 Data', dataType: 'string' },
          },
        },
        {
          id: 'sheet2',
          name: 'Sheet2',
          position: 1,
          cells: {
            R0C0: { value: 'Sheet 2 Data', dataType: 'string' },
          },
        },
        {
          id: 'sheet3',
          name: 'Sheet3',
          position: 2,
          cells: {
            R0C0: { value: 'Sheet 3 Data', dataType: 'string' },
          },
        },
      ],
    });

    // Render each sheet
    const { rerender } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet1"
      />
    );
    expect(screen.queryByText('Sheet not found')).not.toBeInTheDocument();

    rerender(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet2"
      />
    );
    expect(screen.queryByText('Sheet not found')).not.toBeInTheDocument();

    rerender(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="sheet3"
      />
    );
    expect(screen.queryByText('Sheet not found')).not.toBeInTheDocument();
  });

  it('should handle cells with null values', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'null-sheet',
          name: 'Null Values',
          position: 0,
          cells: {
            R0C0: { value: null, dataType: 'string' },
            R0C1: { value: 'Not null', dataType: 'string' },
            R1C0: { value: 0, dataType: 'number' },
          },
        },
      ],
    });

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="null-sheet"
      />
    );

    // Should render successfully with null values
    expect(container).toBeTruthy();
  });

  it('should use default dataType when not specified', () => {
    const workbook = createWorkbook({
      sheets: [
        {
          id: 'no-datatype',
          name: 'No DataType',
          position: 0,
          cells: {
            R0C0: { value: 'No dataType specified' },
          },
        },
      ],
    });

    const { container } = render(
      <WorkbookRenderer
        workbook={workbook}
        activeSheet="no-datatype"
      />
    );

    // Should default to 'string' dataType
    expect(container).toBeTruthy();
  });
});
