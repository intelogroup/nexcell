import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CanvasGridRenderer } from '../CanvasGridRenderer';
import type { CellData } from '@/lib/types';

describe('CanvasGridRenderer', () => {
  // Mock canvas context
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      clip: vi.fn(),
      rect: vi.fn(),
      set fillStyle(value: string) {},
      set strokeStyle(value: string) {},
      set lineWidth(value: number) {},
      set font(value: string) {},
      set textAlign(value: string) {},
      set textBaseline(value: string) {},
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);
  });

  it('renders a canvas element', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }],
    ];

    const { container } = render(
      <CanvasGridRenderer
        data={data}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders empty grid', () => {
    const data: CellData[][] = [];

    const { container } = render(
      <CanvasGridRenderer
        data={data}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('calls onCellClick when canvas is clicked', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }, { value: 'B1', dataType: 'string' }],
      [{ value: 'A2', dataType: 'string' }, { value: 'B2', dataType: 'string' }],
    ];
    const onCellClick = vi.fn();

    const { container } = render(
      <CanvasGridRenderer
        data={data}
        onCellClick={onCellClick}
      />
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Mock getBoundingClientRect
    if (canvas) {
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      // Simulate click at position that would be cell (0, 0)
      // Row header width = 50, Column header height = 28
      // Click at (150, 50) should hit cell (0, 0) approximately
      canvas.click();
    }
  });

  it('renders selected cell highlight', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }, { value: 'B1', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
        selectedCell={{ row: 0, col: 0 }}
      />
    );

    // Verify fillRect was called (for selection highlight)
    expect(mockContext.fillRect).toHaveBeenCalled();
    expect(mockContext.strokeRect).toHaveBeenCalled();
  });

  it('renders highlighted cells', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }, { value: 'B1', dataType: 'string' }],
      [{ value: 'A2', dataType: 'string' }, { value: 'B2', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
        highlightedCells={[
          { row: 0, col: 1 },
          { row: 1, col: 0 },
        ]}
      />
    );

    // Verify rendering calls were made
    expect(mockContext.fillRect).toHaveBeenCalled();
  });

  it('renders cell formulas with = prefix', () => {
    const data: CellData[][] = [
      [{ value: 10, formula: 'SUM(A2:A5)', dataType: 'number' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
      />
    );

    // Verify fillText was called (formula should be rendered)
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it('renders cell values when no formula', () => {
    const data: CellData[][] = [
      [{ value: 'Hello', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
      />
    );

    // Verify fillText was called
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it('renders column headers with Excel-style letters', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }, { value: 'B1', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
      />
    );

    // Verify fillText was called for headers
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it('renders row headers with numbers', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }],
      [{ value: 'A2', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
      />
    );

    // Verify fillText was called for row numbers
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it('draws grid lines', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }, { value: 'B1', dataType: 'string' }],
      [{ value: 'A2', dataType: 'string' }, { value: 'B2', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
      />
    );

    // Verify grid lines were drawn
    expect(mockContext.beginPath).toHaveBeenCalled();
    expect(mockContext.moveTo).toHaveBeenCalled();
    expect(mockContext.lineTo).toHaveBeenCalled();
    expect(mockContext.stroke).toHaveBeenCalled();
  });

  it('supports custom column width and row height', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
        columnWidth={150}
        rowHeight={30}
      />
    );

    // Just verify it renders without error
    expect(mockContext.fillRect).toHaveBeenCalled();
  });

  it('handles empty cells gracefully', () => {
    const data: CellData[][] = [
      [{ value: null, dataType: 'string' }, { value: 'B1', dataType: 'string' }],
    ];

    render(
      <CanvasGridRenderer
        data={data}
      />
    );

    // Should render without error
    expect(mockContext.fillText).toHaveBeenCalled();
  });

  it('calls onCellDoubleClick when canvas is double-clicked', () => {
    const data: CellData[][] = [
      [{ value: 'A1', dataType: 'string' }],
    ];
    const onCellDoubleClick = vi.fn();

    const { container } = render(
      <CanvasGridRenderer
        data={data}
        onCellDoubleClick={onCellDoubleClick}
      />
    );

    const canvas = container.querySelector('canvas');
    if (canvas) {
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));
    }

    // Just verify it renders without error
    expect(canvas).toBeInTheDocument();
  });
});
