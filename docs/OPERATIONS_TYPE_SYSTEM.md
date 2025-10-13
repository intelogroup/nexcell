# Workbook Operations Type System

## Overview

This document describes the operation type system for the Nexcel spreadsheet application. The types and schemas defined here are used for programmatic manipulation of workbook data, including AI-generated operations and manual API interactions.

## Location

- **Main Types File**: `apps/backend/src/types/operations.ts`
- **Test Suite**: `apps/backend/src/types/operations.test.ts`

## Core Concepts

### 1. Cell References

#### CellRef
A cell reference in A1 notation (e.g., "A1", "B2", "AA100").

```typescript
type CellRef = string // Must match pattern: /^[A-Z]+[0-9]+$/
```

**Valid Examples**: `A1`, `B2`, `AA100`, `ZZ999`  
**Invalid Examples**: `1A`, `a1`, `A`, `1`

#### RangeRef
A range reference in A1:A1 notation (e.g., "A1:B10").

```typescript
type RangeRef = string // Must match pattern: /^[A-Z]+[0-9]+:[A-Z]+[0-9]+$/
```

**Valid Examples**: `A1:B10`, `C5:C5`, `AA1:ZZ100`  
**Invalid Examples**: `A1`, `A1-B10`, `A1:B`

### 2. Cell Values and Formatting

#### CellValueType
The possible types for a cell value:
- `string`: Text content
- `number`: Numeric content
- `boolean`: TRUE/FALSE
- `null`: Empty cell

#### CellFormat
Formatting options for cells:

```typescript
interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string // CSS color string
  backgroundColor?: string // CSS color string
  fontSize?: number
  fontFamily?: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  numberFormat?: string // e.g., "0.00", "$#,##0.00", "0%"
}
```

## Operation Types

All operations use a discriminated union pattern with a `kind` field for type safety.

### 1. set_cell - Set Cell Value or Formula

Sets a single cell's value, formula, or format.

```typescript
interface SetCellOp {
  kind: 'set_cell'
  sheet: string // Sheet name
  cell: CellRef // e.g., "A1"
  value?: string | number | boolean | null
  formula?: string // Should start with '='
  format?: CellFormat
}
```

**Example**:
```typescript
{
  kind: 'set_cell',
  sheet: 'Sheet1',
  cell: 'A1',
  value: 100
}
```

**Example with Formula**:
```typescript
{
  kind: 'set_cell',
  sheet: 'Sheet1',
  cell: 'B1',
  formula: '=SUM(A1:A10)'
}
```

### 2. fill_range - Fill Range with Value or Formula

Fills a range of cells with the same value, formula, or format.

```typescript
interface FillRangeOp {
  kind: 'fill_range'
  sheet: string
  range: RangeRef // e.g., "A1:B10"
  value?: string | number | boolean | null
  formula?: string
  format?: CellFormat
}
```

**Example**:
```typescript
{
  kind: 'fill_range',
  sheet: 'Sheet1',
  range: 'A1:A10',
  value: 0
}
```

### 3. insert_rows - Insert Rows

Inserts one or more rows at a specified position.

```typescript
interface InsertRowsOp {
  kind: 'insert_rows'
  sheet: string
  startRow: number // 1-indexed, must be positive
  count?: number // Default: 1
}
```

**Example**:
```typescript
{
  kind: 'insert_rows',
  sheet: 'Sheet1',
  startRow: 5,
  count: 3 // Insert 3 rows starting at row 5
}
```

### 4. insert_cols - Insert Columns

Inserts one or more columns at a specified position.

```typescript
interface InsertColsOp {
  kind: 'insert_cols'
  sheet: string
  startCol: number // 1-indexed, must be positive
  count?: number // Default: 1
}
```

### 5. delete_rows - Delete Rows

Deletes one or more rows starting at a specified position.

```typescript
interface DeleteRowsOp {
  kind: 'delete_rows'
  sheet: string
  startRow: number // 1-indexed, must be positive
  count?: number // Default: 1
}
```

### 6. delete_cols - Delete Columns

Deletes one or more columns starting at a specified position.

```typescript
interface DeleteColsOp {
  kind: 'delete_cols'
  sheet: string
  startCol: number // 1-indexed, must be positive
  count?: number // Default: 1
}
```

### 7. add_sheet - Add New Sheet

Creates a new sheet with the specified name.

```typescript
interface AddSheetOp {
  kind: 'add_sheet'
  name: string // 1-100 characters
}
```

**Example**:
```typescript
{
  kind: 'add_sheet',
  name: 'Data Analysis'
}
```

### 8. rename_sheet - Rename Sheet

Renames an existing sheet.

```typescript
interface RenameSheetOp {
  kind: 'rename_sheet'
  oldName: string
  newName: string // 1-100 characters
}
```

### 9. delete_sheet - Delete Sheet

Deletes a sheet by name.

```typescript
interface DeleteSheetOp {
  kind: 'delete_sheet'
  name: string
}
```

### 10. format_range - Format Range

Applies formatting to a range of cells.

```typescript
interface FormatRangeOp {
  kind: 'format_range'
  sheet: string
  range: RangeRef
  format: CellFormat
}
```

**Example**:
```typescript
{
  kind: 'format_range',
  sheet: 'Sheet1',
  range: 'A1:D1',
  format: {
    bold: true,
    backgroundColor: '#EFEFEF',
    align: 'center'
  }
}
```

## Union Types

### Operation
A discriminated union of all operation types:

```typescript
type Operation = 
  | SetCellOp
  | FillRangeOp
  | InsertRowsOp
  | InsertColsOp
  | DeleteRowsOp
  | DeleteColsOp
  | AddSheetOp
  | RenameSheetOp
  | DeleteSheetOp
  | FormatRangeOp
```

### Operations
An array of operations:

```typescript
type Operations = Operation[]
```

## AI Integration Types

### AiPlan

Represents a plan generated by the AI service.

```typescript
interface AiPlan {
  id?: string // Plan ID if stored
  instructions: string // Original user instructions
  reasoning?: string // AI's explanation of the plan
  operations: Operations // List of operations to execute
  confidence?: number // 0.0 - 1.0
  warnings?: string[] // Any warnings about the plan
  estimatedCost?: number // Credit cost estimate
}
```

**Example**:
```typescript
{
  id: 'plan-abc123',
  instructions: 'Sum column A and put result in A10',
  reasoning: 'I will create a SUM formula in cell A10 to total values in A1:A9',
  operations: [
    {
      kind: 'set_cell',
      sheet: 'Sheet1',
      cell: 'A10',
      formula: '=SUM(A1:A9)'
    }
  ],
  confidence: 0.95,
  warnings: [],
  estimatedCost: 0.5
}
```

### ApplyResult

Result of applying operations to a workbook.

```typescript
interface ApplyResult {
  success: boolean
  appliedOps: number // Number of operations successfully applied
  errors: OpValidationError[] // Array of errors encountered
  newVersion?: number // New workbook version after applying ops
  actionId?: string // ID of the Action record created
}
```

### OpValidationError

Details about an operation that failed validation or execution.

```typescript
interface OpValidationError {
  opIndex: number // Index in operations array
  operation: Operation // The operation that failed
  error: string // Error message
}
```

## Validation

All types are validated using Zod schemas. The schemas provide:

1. **Type Safety**: Compile-time TypeScript type checking
2. **Runtime Validation**: Parse and validate incoming data
3. **Error Messages**: Clear error messages for invalid data
4. **Defaults**: Sensible defaults (e.g., `count: 1` for insert/delete operations)

### Example Usage

```typescript
import { OperationSchema, OperationsSchema } from './types/operations'

// Validate a single operation
const op = {
  kind: 'set_cell',
  sheet: 'Sheet1',
  cell: 'A1',
  value: 42
}

try {
  const validOp = OperationSchema.parse(op)
  // validOp is now type-safe and validated
} catch (error) {
  // Handle validation error
  console.error('Invalid operation:', error)
}

// Validate an array of operations
const ops = [
  { kind: 'set_cell', sheet: 'Sheet1', cell: 'A1', value: 100 },
  { kind: 'set_cell', sheet: 'Sheet1', cell: 'A2', value: 200 },
  { kind: 'set_cell', sheet: 'Sheet1', cell: 'A3', formula: '=A1+A2' }
]

try {
  const validOps = OperationsSchema.parse(ops)
  // validOps is now a validated array of operations
} catch (error) {
  console.error('Invalid operations:', error)
}
```

## Testing

The type system includes comprehensive unit tests covering:

- Cell reference validation (valid and invalid patterns)
- Range reference validation
- All operation types with valid data
- Edge cases and validation errors
- AI plan validation
- Array operations validation

**Test Results**: 27 tests, all passing ✓

Run tests with:
```bash
cd apps/backend
pnpm test run operations.test.ts
```

## Next Steps

This type system will be used by:

1. **Operation Service** (`workbook-ops.service.ts`): Applies operations to workbook data
2. **API Endpoints**: Validates incoming operation requests
3. **AI Service** (`ai.service.ts`): Generates operation plans
4. **Frontend Services**: Type-safe operation creation and submission

## Design Decisions

### Why Discriminated Unions?

Using a discriminated union with a `kind` field provides:
- Type narrowing in TypeScript
- Exhaustive pattern matching
- Clear operation identification
- Easy extensibility

### Why Zod for Validation?

Zod provides:
- Type-safe schema definitions
- Runtime validation
- Type inference
- Excellent error messages
- Easy composition

### Why A1 Notation?

A1 notation (e.g., "A1", "B2") is:
- Familiar to spreadsheet users
- Human-readable
- Standard in spreadsheet applications
- Easy to parse and validate

### Future Enhancements

Potential future operations:
- `copy_range`: Copy cells from one range to another
- `move_range`: Move cells from one location to another
- `merge_cells`: Merge a range of cells
- `unmerge_cells`: Unmerge cells
- `sort_range`: Sort data in a range
- `filter_range`: Apply filters to data
- `insert_chart`: Add charts/visualizations
- `protect_range`: Lock cells or ranges
- `add_conditional_format`: Add conditional formatting rules
