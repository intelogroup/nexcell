# Example 02: Multi-Department Budget

## User Prompt
```
Build a monthly budget for Sales, Marketing, and Operations with a summary sheet
```

## Intent Analysis
- **Category**: `create`
- **Type**: `create_budget`
- **Sub-type**: `multi_sheet_consolidation`
- **Confidence**: High (0.95)
- **Entities Extracted**:
  - `timePeriod`: "monthly" (12 months inferred)
  - `departments`: ["Sales", "Marketing", "Operations"]
  - `sheetNames`: ["Sales", "Marketing", "Operations", "Summary"]
  - `requiresConsolidation`: true

## Expected Operations

```json
{
  "operations": [
    {
      "type": "createWorkbook",
      "params": {
        "name": "Monthly Department Budget",
        "initialSheets": ["Sales", "Marketing", "Operations", "Summary"]
      }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "Sales",
        "cells": {
          "A1": { "raw": "Month", "dataType": "string", "style": { "bold": true } },
          "B1": { "raw": "Budget", "dataType": "string", "style": { "bold": true } },
          "C1": { "raw": "Actual", "dataType": "string", "style": { "bold": true } },
          "D1": { "raw": "Variance", "dataType": "string", "style": { "bold": true } },
          "A2": { "raw": "January", "dataType": "string" },
          "A3": { "raw": "February", "dataType": "string" },
          "A4": { "raw": "March", "dataType": "string" },
          "A5": { "raw": "April", "dataType": "string" },
          "A6": { "raw": "May", "dataType": "string" },
          "A7": { "raw": "June", "dataType": "string" },
          "A8": { "raw": "July", "dataType": "string" },
          "A9": { "raw": "August", "dataType": "string" },
          "A10": { "raw": "September", "dataType": "string" },
          "A11": { "raw": "October", "dataType": "string" },
          "A12": { "raw": "November", "dataType": "string" },
          "A13": { "raw": "December", "dataType": "string" },
          "A14": { "raw": "Total", "dataType": "string", "style": { "bold": true } },
          "B2": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B3": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B4": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B5": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B6": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B7": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B8": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B9": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B10": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B11": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B12": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "B13": { "raw": 50000, "dataType": "number", "numFmt": "$#,##0" },
          "C2": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C3": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C4": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C5": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C6": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C7": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C8": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C9": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C10": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C11": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C12": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C13": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" }
        }
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D2",
        "formula": "=C2-B2"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D3",
        "formula": "=C3-B3"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D4",
        "formula": "=C4-B4"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D5",
        "formula": "=C5-B5"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D6",
        "formula": "=C6-B6"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D7",
        "formula": "=C7-B7"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D8",
        "formula": "=C8-B8"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D9",
        "formula": "=C9-B9"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D10",
        "formula": "=C10-B10"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D11",
        "formula": "=C11-B11"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D12",
        "formula": "=C12-B12"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D13",
        "formula": "=C13-B13"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "B14",
        "formula": "=SUM(B2:B13)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "C14",
        "formula": "=SUM(C2:C13)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Sales",
        "cell": "D14",
        "formula": "=C14-B14"
      }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "Marketing",
        "cells": {
          "A1": { "raw": "Month", "dataType": "string", "style": { "bold": true } },
          "B1": { "raw": "Budget", "dataType": "string", "style": { "bold": true } },
          "C1": { "raw": "Actual", "dataType": "string", "style": { "bold": true } },
          "D1": { "raw": "Variance", "dataType": "string", "style": { "bold": true } },
          "A2": { "raw": "January", "dataType": "string" },
          "A3": { "raw": "February", "dataType": "string" },
          "A4": { "raw": "March", "dataType": "string" },
          "A5": { "raw": "April", "dataType": "string" },
          "A6": { "raw": "May", "dataType": "string" },
          "A7": { "raw": "June", "dataType": "string" },
          "A8": { "raw": "July", "dataType": "string" },
          "A9": { "raw": "August", "dataType": "string" },
          "A10": { "raw": "September", "dataType": "string" },
          "A11": { "raw": "October", "dataType": "string" },
          "A12": { "raw": "November", "dataType": "string" },
          "A13": { "raw": "December", "dataType": "string" },
          "A14": { "raw": "Total", "dataType": "string", "style": { "bold": true } },
          "B2": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B3": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B4": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B5": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B6": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B7": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B8": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B9": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B10": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B11": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B12": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "B13": { "raw": 30000, "dataType": "number", "numFmt": "$#,##0" },
          "C2": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C3": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C4": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C5": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C6": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C7": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C8": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C9": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C10": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C11": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C12": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C13": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" }
        }
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D2",
        "formula": "=C2-B2"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D3",
        "formula": "=C3-B3"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D4",
        "formula": "=C4-B4"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D5",
        "formula": "=C5-B5"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D6",
        "formula": "=C6-B6"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D7",
        "formula": "=C7-B7"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D8",
        "formula": "=C8-B8"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D9",
        "formula": "=C9-B9"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D10",
        "formula": "=C10-B10"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D11",
        "formula": "=C11-B11"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D12",
        "formula": "=C12-B12"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D13",
        "formula": "=C13-B13"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "B14",
        "formula": "=SUM(B2:B13)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "C14",
        "formula": "=SUM(C2:C13)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Marketing",
        "cell": "D14",
        "formula": "=C14-B14"
      }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "Operations",
        "cells": {
          "A1": { "raw": "Month", "dataType": "string", "style": { "bold": true } },
          "B1": { "raw": "Budget", "dataType": "string", "style": { "bold": true } },
          "C1": { "raw": "Actual", "dataType": "string", "style": { "bold": true } },
          "D1": { "raw": "Variance", "dataType": "string", "style": { "bold": true } },
          "A2": { "raw": "January", "dataType": "string" },
          "A3": { "raw": "February", "dataType": "string" },
          "A4": { "raw": "March", "dataType": "string" },
          "A5": { "raw": "April", "dataType": "string" },
          "A6": { "raw": "May", "dataType": "string" },
          "A7": { "raw": "June", "dataType": "string" },
          "A8": { "raw": "July", "dataType": "string" },
          "A9": { "raw": "August", "dataType": "string" },
          "A10": { "raw": "September", "dataType": "string" },
          "A11": { "raw": "October", "dataType": "string" },
          "A12": { "raw": "November", "dataType": "string" },
          "A13": { "raw": "December", "dataType": "string" },
          "A14": { "raw": "Total", "dataType": "string", "style": { "bold": true } },
          "B2": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B3": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B4": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B5": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B6": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B7": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B8": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B9": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B10": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B11": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B12": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "B13": { "raw": 40000, "dataType": "number", "numFmt": "$#,##0" },
          "C2": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C3": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C4": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C5": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C6": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C7": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C8": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C9": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C10": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C11": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C12": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C13": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" }
        }
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D2",
        "formula": "=C2-B2"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D3",
        "formula": "=C3-B3"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D4",
        "formula": "=C4-B4"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D5",
        "formula": "=C5-B5"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D6",
        "formula": "=C6-B6"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D7",
        "formula": "=C7-B7"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D8",
        "formula": "=C8-B8"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D9",
        "formula": "=C9-B9"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D10",
        "formula": "=C10-B10"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D11",
        "formula": "=C11-B11"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D12",
        "formula": "=C12-B12"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D13",
        "formula": "=C13-B13"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "B14",
        "formula": "=SUM(B2:B13)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "C14",
        "formula": "=SUM(C2:C13)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Operations",
        "cell": "D14",
        "formula": "=C14-B14"
      }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "Summary",
        "cells": {
          "A1": { "raw": "Department", "dataType": "string", "style": { "bold": true } },
          "B1": { "raw": "Budget", "dataType": "string", "style": { "bold": true } },
          "C1": { "raw": "Actual", "dataType": "string", "style": { "bold": true } },
          "D1": { "raw": "Variance", "dataType": "string", "style": { "bold": true } },
          "A2": { "raw": "Sales", "dataType": "string" },
          "A3": { "raw": "Marketing", "dataType": "string" },
          "A4": { "raw": "Operations", "dataType": "string" },
          "A5": { "raw": "Total", "dataType": "string", "style": { "bold": true } }
        }
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "B2",
        "formula": "=Sales!B14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "C2",
        "formula": "=Sales!C14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "D2",
        "formula": "=Sales!D14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "B3",
        "formula": "=Marketing!B14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "C3",
        "formula": "=Marketing!C14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "D3",
        "formula": "=Marketing!D14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "B4",
        "formula": "=Operations!B14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "C4",
        "formula": "=Operations!C14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "D4",
        "formula": "=Operations!D14"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "B5",
        "formula": "=SUM(B2:B4)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "C5",
        "formula": "=SUM(C2:C4)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Summary",
        "cell": "D5",
        "formula": "=SUM(D2:D4)"
      }
    },
    {
      "type": "applyFormat",
      "params": {
        "sheet": "Summary",
        "range": "B2:D5",
        "numFmt": "$#,##0"
      }
    },
    {
      "type": "compute",
      "params": {}
      }
    }
  ],
  "confidence": 0.95,
  "reasoning": "Multi-department budget with cross-sheet consolidation. Each department gets its own sheet with 12 months of data. Summary sheet consolidates totals using cross-sheet references."
}
```

## Validation Criteria

### Structure
- [x] Workbook named "Monthly Department Budget"
- [x] Four sheets: Sales, Marketing, Operations, Summary
- [x] Each department sheet has 12 months (Jan-Dec)
- [x] Summary sheet consolidates totals from all departments

### Cross-Sheet References
- [x] Summary sheet references correct department totals
- [x] Formula `=Sales!B14` pulls Sales budget total
- [x] All cross-sheet formulas compute correctly

### Formatting
- [x] All headers bold
- [x] All currency values use "$#,##0" format
- [x] Total rows bold on all sheets

### Computation
- [x] All formulas compute without errors
- [x] No circular references
- [x] Summary totals match sum of departments

## Edge Cases

### Variation 1: Different time periods
"Quarterly budget for Sales, Marketing, Operations"
- Should create Q1, Q2, Q3, Q4 rows instead of months

### Variation 2: More departments
"Budget for Sales, Marketing, Operations, IT, HR, Finance"
- Should create 6 department sheets + Summary

### Variation 3: Implicit summary
"Create budgets for 3 departments"
- Should infer Summary sheet is needed

## Common Mistakes

### ❌ Mistake 1: Forgetting Summary sheet
Must include summary/consolidation sheet when multiple departments mentioned.

### ❌ Mistake 2: Wrong cross-sheet syntax
```json
// WRONG
{ "formula": "=Sales.B14" }  // Dot notation doesn't work

// CORRECT
{ "formula": "=Sales!B14" }  // Excel uses exclamation mark
```

### ❌ Mistake 3: Different budget amounts without context
Sales=$50k, Marketing=$30k, Operations=$40k are reasonable defaults.
Don't make all departments the same unless user specifies.

### ❌ Mistake 4: Missing compute operation
Cross-sheet formulas won't work until compute() is called.

## Test Implementation

```typescript
describe('AI Example 02: Department Budget', () => {
  it('should create 4 sheets', async () => {
    const operations = await generateWorkbookOperations(prompt);
    expect(operations[0].params.initialSheets).toEqual([
      'Sales', 'Marketing', 'Operations', 'Summary'
    ]);
  });

  it('should set up cross-sheet references', async () => {
    const result = await executor.execute(operations);
    const summary = result.workbook.sheets.find(s => s.name === 'Summary');
    
    expect(summary.cells.B2.formula).toBe('=Sales!B14');
    expect(summary.cells.B3.formula).toBe('=Marketing!B14');
    expect(summary.cells.B4.formula).toBe('=Operations!B14');
  });

  it('should compute consolidation correctly', async () => {
    const summary = result.workbook.sheets.find(s => s.name === 'Summary');
    
    // Total budget = 50k*12 + 30k*12 + 40k*12 = 1,440,000
    expect(summary.cells.B5.computed.v).toBe(1440000);
  });
});
```

## References

- [multi-sheet-sync.test.ts](../../client/src/lib/workbook/__tests__/multi-sheet-sync.test.ts)
- [department-consolidation-scenario.test.ts](../../client/src/lib/workbook/__tests__/department-consolidation-scenario.test.ts)

---

**Status**: ⚪ Not yet tested  
**Priority**: High  
**Complexity**: Medium-High
