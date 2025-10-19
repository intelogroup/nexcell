# CanvasGridRenderer Component

## Overview

The `CanvasGridRenderer` component is a high-performance, pure canvas-based grid renderer that uses the Canvas 2D API to efficiently render large spreadsheet grids. Unlike DOM-based virtualization, this component draws directly to a canvas element for maximum performance.

## Features

- **True Canvas Rendering**: Uses Canvas 2D API for drawing, not DOM elements
- **Column Headers**: Excel-style letters (A, B, C, ..., Z, AA, AB, ...)
- **Row Headers**: Numbered rows (1, 2, 3, ...)
- **Grid Lines**: Subtle grid lines matching Excel theme
- **Cell Selection**: Visual highlight for selected cells
- **Cell Highlighting**: Support for highlighting cells (e.g., from AI operations)
- **Viewport Culling**: Only renders visible cells for performance
- **HiDPI Support**: Scales properly on high-resolution displays
- **Scrolling**: Smooth scrolling with efficient re-rendering

## Performance Characteristics

- **Render only visible cells**: Viewport culling ensures only cells in the visible area are drawn
- **requestAnimationFrame**: Uses browser's animation frame for smooth scrolling
- **Large Grid Support**: Can handle 10,000+ rows without performance degradation
- **Canvas 2D**: Direct pixel manipulation is faster than DOM rendering for large grids

## Usage

### Basic Usage

```tsx
import { CanvasGridRenderer } from '@/components/canvas';

function MySpreadsheet() {
  const data: CellData[][] = [
    [
      { value: 'Name', dataType: 'string' },
      { value: 'Age', dataType: 'string' },
    ],
    [
      { value: 'John', dataType: 'string' },
      { value: 25, dataType: 'number' },
    ],
  ];

  return (
    <CanvasGridRenderer
      data={data}
      onCellClick={(row, col) => console.log(`Clicked cell ${row}, ${col}`)}
    />
  );
}
```

### With Cell Selection

```tsx
function MySpreadsheet() {
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });

  return (
    <CanvasGridRenderer
      data={data}
      selectedCell={selectedCell}
      onCellClick={(row, col) => setSelectedCell({ row, col })}
      onCellDoubleClick={(row, col) => {
        console.log('Edit cell', row, col);
      }}
    />
  );
}
```

### With Highlighted Cells (AI Integration)

```tsx
function MySpreadsheet() {
  const highlightedCells = [
    { row: 2, col: 1 },
    { row: 3, col: 1 },
    { row: 4, col: 1 },
  ];

  return (
    <CanvasGridRenderer
      data={data}
      highlightedCells={highlightedCells}
    />
  );
}
```

### Custom Dimensions

```tsx
<CanvasGridRenderer
  data={data}
  columnWidth={150}
  rowHeight={30}
  rowHeaderWidth={60}
  columnHeaderHeight={32}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `CellData[][]` | required | 2D array of cell data to render |
| `columnWidth` | `number` | `100` | Width of each column in pixels |
| `rowHeight` | `number` | `24` | Height of each row in pixels |
| `rowHeaderWidth` | `number` | `50` | Width of row header column |
| `columnHeaderHeight` | `number` | `28` | Height of column header row |
| `selectedCell` | `{ row: number; col: number } \| null` | `null` | Currently selected cell |
| `highlightedCells` | `Array<{ row: number; col: number }>` | `[]` | Cells to highlight |
| `onCellClick` | `(row: number, col: number) => void` | `undefined` | Callback when cell is clicked |
| `onCellDoubleClick` | `(row: number, col: number) => void` | `undefined` | Callback when cell is double-clicked |

## Architecture

### Rendering Pipeline

1. **Viewport Calculation**: Determines which cells are visible based on scroll position
2. **Grid Drawing**: Draws grid lines for visible area
3. **Header Drawing**: Renders column and row headers
4. **Cell Drawing**: Renders cell content with proper formatting
5. **Selection Drawing**: Highlights selected and highlighted cells

### Canvas Coordinate System

```
(0,0) ┌─────────────────────────────┐
      │  Corner │  Column Headers   │ ← columnHeaderHeight
      ├─────────┼───────────────────┤
      │   Row   │                   │
      │ Headers │   Cell Grid       │
      │         │                   │
      └─────────┴───────────────────┘
      ↑
      rowHeaderWidth
```

### Performance Optimizations

1. **Viewport Culling**: Only cells in the visible viewport are rendered
2. **Canvas Scaling**: Uses `devicePixelRatio` for HiDPI displays
3. **Text Clipping**: Cell text is clipped to prevent overflow rendering
4. **Efficient Repaints**: Only redraws when dependencies change

## Comparison to CanvasRenderer

| Feature | CanvasGridRenderer | CanvasRenderer |
|---------|-------------------|----------------|
| Rendering | Canvas 2D API | DOM + Virtual Scrolling |
| Performance | Excellent for very large grids | Good for medium grids |
| Editing | External (via callbacks) | Built-in inline editing |
| Toolbars | Not included | Integrated toolbars |
| Complexity | Simple, focused | Full-featured |
| Use Case | Read-only display, AI preview | Interactive editing |

## Integration with WorkbookRenderer

The `CanvasGridRenderer` can be integrated into `WorkbookRenderer` for read-only canvas display:

```tsx
import { CanvasGridRenderer } from '@/components/canvas';

export function WorkbookRenderer({ workbook, activeSheet }) {
  const cellData = convertWorkbookToCellData(workbook, activeSheet);
  
  return (
    <CanvasGridRenderer
      data={cellData}
      onCellClick={handleCellClick}
    />
  );
}
```

## Testing

The component is fully tested with 13 test cases covering:
- Canvas rendering
- Empty grid handling
- Cell selection
- Cell highlighting
- Formula and value display
- Column/row headers
- Grid lines
- Custom dimensions
- Click/double-click events

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support with touch events

## Future Enhancements

- [ ] Offscreen canvas for double buffering
- [ ] Web Worker for rendering large grids
- [ ] Cell merging visualization
- [ ] Conditional formatting rendering
- [ ] Cell borders and styling
- [ ] Touch gestures (pinch-to-zoom)
- [ ] Keyboard navigation support
- [ ] Accessibility improvements (ARIA labels)

## See Also

- [`WorkbookRenderer`](./WORKBOOK_RENDERER.md) - High-level workbook renderer
- [`CanvasRenderer`](../src/components/canvas/CanvasRenderer.tsx) - Full-featured DOM-based renderer
- [Excel Theme](../src/lib/excel-theme.ts) - Color theme configuration
