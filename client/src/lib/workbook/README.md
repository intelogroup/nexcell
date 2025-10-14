# Workbook JSON Module

**Battle-tested, production-ready workbook JSON schema for Nexcell.**

This module provides a single source of truth for spreadsheet data that survives formula engines, export formats, and UI changes.

## 🎯 Features

- ✅ **Address-based cells** (`"A1"`, `"B2"`) for Excel compatibility
- ✅ **Separated number formats and styles** (matches ExcelJS/SheetJS APIs)
- ✅ **Formula + computed value caching** (store user formulas AND results)
- ✅ **HyperFormula integration** (internal coordinates for fast rehydration)
- ✅ **Export adapter pattern** (swappable export formats)
- ✅ **Versioned schema** (`schemaVersion` for migrations)
- ✅ **Undo/redo support** (action log with inverse operations)
- ✅ **Full feature set** (merges, validations, conditional formats, charts, comments)

## 📦 Quick Start

```typescript
import { createWorkbook, setCell, SheetJSAdapter } from '@/lib/workbook';

// Create workbook
const wb = createWorkbook("My Workbook");
const sheet = wb.sheets[0];

// Add cells
setCell(wb, sheet.id, "A1", {
  raw: "Hello",
  dataType: "string",
  style: { bold: true }
});

setCell(wb, sheet.id, "A2", {
  formula: "=UPPER(A1)",
  dataType: "formula",
  computed: { v: "HELLO", ts: new Date().toISOString() }
});

// Export to XLSX
const adapter = new SheetJSAdapter();
const buffer = await adapter.export(wb);
```

## 📁 Module Structure

```
src/lib/workbook/
├── types.ts              # TypeScript interfaces (WorkbookJSON, Cell, etc.)
├── utils.ts              # Core utilities (createWorkbook, setCell, etc.)
├── index.ts              # Public API exports
├── adapters/
│   └── sheetjs.ts        # SheetJS export adapter
├── demo.ts               # Interactive demo (run in browser)
├── test.ts               # Unit tests
├── MIGRATION.md          # Migration guide from old schema
└── README.md             # This file
```

## 🧪 Testing

### Run Round-Trip Test (Critical Quality Gate)

The round-trip test verifies that formulas, values, merges, and structure survive export → import cycle without data loss. **This test MUST pass before shipping any export functionality.**

Run in browser console:
```javascript
import('@/lib/workbook/test-runner').then(m => m.runTests())
```

Or manually:
```javascript
import { runRoundTripTest } from '@/lib/workbook';
const success = await runRoundTripTest();
```

The test verifies:
- ✅ Formula preservation (both `f` and `v` fields)
- ✅ Computed value caching
- ✅ Number formats
- ✅ Merged ranges
- ✅ Column widths
- ✅ Row heights
- ✅ Data types (string, number, boolean)
- ✅ Complex formulas (SUM, IF, string concatenation)

### Run Demo in Browser

1. Start dev server:
   ```bash
   cd client
   npm run dev
   ```

2. Open browser console and run:
   ```javascript
   import('@/lib/workbook/demo').then(m => m.quickTest())
   ```

3. Download generated XLSX:
   ```javascript
   downloadWorkbook(workbookData.buffer, 'test.xlsx')
   ```

### Run Unit Tests

```javascript
import('@/lib/workbook/test')
```

## 📖 API Reference

### Core Functions

#### `createWorkbook(title?: string): WorkbookJSON`
Create a new empty workbook with one default sheet.

#### `addSheet(workbook, name?): SheetJSON`
Add a new sheet to the workbook.

#### `setCell(workbook, sheetId, address, cell): void`
Set cell value at address (e.g., "A1", "B5").

#### `getCell(workbook, sheetId, address): Cell | undefined`
Get cell at address.

#### `deleteCell(workbook, sheetId, address): void`
Delete cell at address.

### Address Utilities

#### `parseAddress(address: string): { row: number, col: number }`
Parse "A1" → `{ row: 1, col: 1 }` (1-based).

#### `toAddress(row: number, col: number): string`
Convert `{ row: 1, col: 1 }` → "A1".

#### `getCellsInRange(range: string): string[]`
Get all addresses in range: "A1:B2" → `["A1", "A2", "B1", "B2"]`.

#### `isInRange(address: string, range: string): boolean`
Check if address is within range.

### HyperFormula Utilities

#### `hfToAddress(row: number, col: number): string`
Convert HyperFormula 0-based coords to Excel address.

#### `addressToHf(address: string): { row: number, col: number }`
Convert Excel address to HyperFormula 0-based coords.

### Export Adapters

#### `SheetJSAdapter`
Basic export using SheetJS (xlsx).

**Features:**
- ✅ Formulas
- ✅ Merges
- ✅ Column widths / row heights
- ✅ Number formats
- ❌ Styles (requires SheetJS Pro)
- ❌ Comments (limited)

```typescript
const adapter = new SheetJSAdapter();
const buffer = await adapter.export(workbook);
const imported = await adapter.import(buffer);
```

## 🔧 Cell Object Structure

```typescript
{
  // User input
  raw?: string | number | boolean | null;  // What user typed
  dataType?: "string" | "number" | "boolean" | "date" | "formula" | "error";

  // Formula
  formula?: string;                        // "=SUM(A1:A3)"
  hfInternal?: {                           // HyperFormula internals
    sheetId: number;                       // 0-based
    row: number;
    col: number;
    formulaId?: string;
  };

  // Computed cache
  computed?: {
    v: any;                                // Result value
    t?: "n" | "s" | "b" | "e" | "d";     // SheetJS type
    ts: string;                            // Timestamp
    hfVersion?: string;                    // HF version
    computedBy?: string;                   // Who computed
    error?: string;
  };

  // Formatting
  numFmt?: string;                         // "#,##0.00", "mm/dd/yyyy"
  style?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    bgColor?: string;
    fontSize?: number;
    fontFamily?: string;
    alignment?: { horizontal?, vertical?, wrapText? };
    border?: { top?, bottom?, left?, right? };
  };
  hyperlink?: { url: string, tooltip?: string };

  // Metadata
  notes?: string;
  metadata?: Record<string, any>;
  readOnly?: boolean;
}
```

## 📊 Workbook Structure

```typescript
{
  schemaVersion: "1.0",
  workbookId: "uuid",
  meta: {
    title: string;
    author: string;
    createdAt: string;      // ISO timestamp
    modifiedAt: string;
  },
  sheets: [
    {
      id: "sheet-id",
      name: "Sheet1",
      cells: { "A1": { ... }, "B2": { ... } },
      mergedRanges: ["A1:B2"],
      cols: { 1: { width: 100 } },
      rows: { 1: { height: 21 } },
      properties: {
        freeze: { row: 1, col: 0 },
        zoom: 100,
        gridLines: true
      },
      charts: [...],
      pivots: [...],
      comments: { "A1": [...] }
    }
  ],
  computed: {
    hfCache: { "Sheet1!A1": { v: "result", ts: "..." } },
    dependencyGraph: { "Sheet1!A1": ["Sheet1!B1"] }
  },
  actionLog: {
    actions: [...],
    currentIndex: 0
  }
}
```

## 🔄 Migration from Old Schema

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide from the old `jsonWorkbook.ts` schema.

**Key differences:**
- Cell keys: `"R0C0"` → `"A1"`
- Formatting: single object → `numFmt` + `style`
- Added: `computed` cache, `hfInternal`, `actionLog`

## 🎨 Examples

### Basic Spreadsheet

```typescript
const wb = createWorkbook("Budget");
const sheet = wb.sheets[0];

// Header
setCell(wb, sheet.id, "A1", {
  raw: "Category",
  dataType: "string",
  style: { bold: true }
});

setCell(wb, sheet.id, "B1", {
  raw: "Amount",
  dataType: "string",
  style: { bold: true }
});

// Data
setCell(wb, sheet.id, "A2", { raw: "Food", dataType: "string" });
setCell(wb, sheet.id, "B2", { raw: 500, dataType: "number", numFmt: "$#,##0.00" });

setCell(wb, sheet.id, "A3", { raw: "Rent", dataType: "string" });
setCell(wb, sheet.id, "B3", { raw: 1200, dataType: "number", numFmt: "$#,##0.00" });

// Total
setCell(wb, sheet.id, "B4", {
  formula: "=SUM(B2:B3)",
  dataType: "formula",
  numFmt: "$#,##0.00",
  style: { bold: true }
});
```

### With Styling and Merges

```typescript
// Merge header
sheet.mergedRanges = ["A1:B1"];
setCell(wb, sheet.id, "A1", {
  raw: "Monthly Budget",
  dataType: "string",
  style: {
    bold: true,
    fontSize: 16,
    bgColor: "#4472C4",
    color: "#FFFFFF",
    alignment: { horizontal: "center" }
  }
});

// Set column widths
sheet.cols = {
  1: { width: 150 },
  2: { width: 100 }
};
```

### Export to XLSX

```typescript
import { SheetJSAdapter } from '@/lib/workbook';

const adapter = new SheetJSAdapter();
const buffer = await adapter.export(wb);

// Download in browser
const blob = new Blob([buffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'budget.xlsx';
a.click();
```

## 🚀 Roadmap

### Phase 1: Core (Complete)
- [x] TypeScript types
- [x] Core utilities
- [x] SheetJS adapter
- [x] Round-trip tests
- [x] Demo

### Phase 2: Integration (Next)
- [ ] React hook (`useWorkbook`)
- [ ] HyperFormula integration
- [ ] Undo/redo implementation
- [ ] UI components

### Phase 3: Advanced
- [ ] ExcelJS adapter (rich features)
- [ ] CSV adapter
- [ ] Collaborative editing
- [ ] Real-time sync

## 📝 Design Decisions

### Why address-based keys?
Direct mapping to Excel/SheetJS APIs. No coordinate translation needed.

### Why separate `numFmt` and `style`?
Matches Excel's internal model and ExcelJS/SheetJS APIs.

### Why store both `formula` and `computed`?
- `formula`: Source of truth (user intent)
- `computed`: Cache for UI performance (avoid re-calc)

### Why `hfInternal`?
Dramatically speeds up HyperFormula rehydration. Store HF's internal representation to avoid re-parsing.

### Why `ExportAdapter` interface?
Future-proof. Swap exporters (SheetJS, ExcelJS, CSV, Google Sheets) without touching core code.

## 🤝 Contributing

1. Run tests before committing
2. Update types if adding fields
3. Bump `schemaVersion` if breaking changes
4. Add migration guide for schema changes

## 📄 License

MIT

---

**Built with ❤️ for Nexcell**
