# WorkbookRenderer Component

## Overview

The `WorkbookRenderer` component is a high-level React component that renders a workbook using a canvas-based grid. It serves as the bridge between the AI operation system and the visual grid representation.

## Architecture

```
WorkbookRenderer (High-level)
    ↓
    Converts WorkbookJSON → CellData[][]
    ↓
CanvasRenderer (Low-level)
    ↓
    Virtual scrolling with @tanstack/react-virtual
```

## Features

- **WorkbookJSON Support**: Accepts the standard NexCell WorkbookJSON format
- **Sparse to Dense Conversion**: Efficiently converts sparse cell storage to dense 2D arrays
- **Sheet Management**: Handles multiple sheets with active sheet selection
- **Cell Highlighting**: Supports highlighting specific cells (useful for AI operations)
- **Error Handling**: Graceful error states for missing sheets or empty data
- **Minimum Grid Size**: Creates a 100×26 grid minimum (Excel-like experience)
- **Auto-expansion**: Automatically expands grid to accommodate all cells

## Props

```typescript
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
```

## Usage

### Basic Usage

```tsx
import { WorkbookRenderer } from '@/components/canvas';
import type { JSONWorkbook } from '@/lib/types';

function MyApp() {
  const [workbook, setWorkbook] = useState<JSONWorkbook>({
    version: '1.0',
    id: 'wb-1',
    name: 'My Workbook',
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
        },
      },
    ],
  });

  return (
    <WorkbookRenderer
      workbook={workbook}
      activeSheet="sheet1"
    />
  );
}
```

### With Cell Editing

```tsx
function MyApp() {
  const [workbook, setWorkbook] = useState<JSONWorkbook>(/* ... */);

  const handleCellEdit = (sheetId: string, row: number, col: number, value: string) => {
    // Update the workbook with the new cell value
    setWorkbook(prev => {
      const updatedWorkbook = { ...prev };
      const sheet = updatedWorkbook.sheets.find(s => s.id === sheetId);
      if (sheet) {
        const cellKey = `R${row}C${col}`;
        sheet.cells[cellKey] = {
          ...sheet.cells[cellKey],
          value,
          dataType: 'string',
        };
      }
      return updatedWorkbook;
    });
  };

  return (
    <WorkbookRenderer
      workbook={workbook}
      activeSheet="sheet1"
      onCellEdit={handleCellEdit}
    />
  );
}
```

### With AI Operation Highlighting

```tsx
function MyApp() {
  const [workbook, setWorkbook] = useState<JSONWorkbook>(/* ... */);
  const [highlightedCells, setHighlightedCells] = useState<Array<{ row: number; col: number }>>([]);

  // After AI operation, highlight affected cells
  const handleAIOperation = async (operation: WorkbookOperation) => {
    // Execute operation...
    const result = await executeOperation(operation);
    
    // Highlight cells that were modified
    if (operation.type === 'setCells') {
      setHighlightedCells(operation.cells.map(c => ({ row: c.row, col: c.col })));
      
      // Clear highlights after 2 seconds
      setTimeout(() => setHighlightedCells([]), 2000);
    }
  };

  return (
    <WorkbookRenderer
      workbook={workbook}
      activeSheet="sheet1"
      highlightedCells={highlightedCells}
    />
  );
}
```

## Cell Key Format

The WorkbookRenderer expects cells to be stored in the sparse format with keys like `R{row}C{col}`:

- `R0C0` = Row 0, Column 0 (A1 in Excel notation)
- `R5C10` = Row 5, Column 10 (K6 in Excel notation)

## Performance Considerations

- **Sparse Storage**: Only non-empty cells are stored in the workbook JSON
- **Dense Rendering**: Converted to dense 2D array for fast rendering
- **Virtual Scrolling**: Uses `@tanstack/react-virtual` for efficient large grid rendering
- **Memoization**: Cell data conversion is memoized with `useMemo`

## Integration with AI Operations

The WorkbookRenderer is designed to work seamlessly with the AI operation system:

1. **AI generates operations** → `WorkbookOperation[]`
2. **Operations executed** → Updates `WorkbookJSON`
3. **WorkbookRenderer displays result** → Renders updated grid
4. **Optional highlighting** → Shows which cells were affected

## Error States

### Sheet Not Found
```
┌─────────────────────────────────┐
│      Sheet not found            │
│  The sheet "xyz" does not       │
│  exist in this workbook.        │
└─────────────────────────────────┘
```

### Empty Sheet
```
┌─────────────────────────────────┐
│      Empty sheet                │
│  Start by asking the AI to      │
│  add data to this sheet.        │
└─────────────────────────────────┘
```

## Testing

The component has comprehensive test coverage:

- ✅ Rendering with active sheet
- ✅ Sheet not found error
- ✅ Empty sheet state
- ✅ Sparse to dense conversion
- ✅ Cell edit callbacks
- ✅ Highlighted cells
- ✅ Minimum 100×26 grid
- ✅ Grid expansion for large data
- ✅ Formula and formatting preservation
- ✅ Multiple sheets
- ✅ Null value handling
- ✅ Default dataType

Run tests:
```bash
npm test -- WorkbookRenderer.test.tsx
```

## Future Enhancements

- [ ] Cell highlighting animations
- [ ] Formula bar integration
- [ ] Selection range support
- [ ] Copy/paste functionality
- [ ] Undo/redo support
- [ ] Cell comments display
- [ ] Conditional formatting rendering
- [ ] Chart overlays

## Related Components

- `CanvasRenderer` - Low-level canvas grid renderer
- `FormulaBar` - Formula input/display
- `FormatToolbar` - Cell formatting controls
- `StyleToolbar` - Cell styling controls
