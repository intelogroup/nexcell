# Example 01: Simple Quarterly Budget

## User Prompt
```
Create a Q1 budget tracker
```

## Intent Analysis
- **Category**: `create`
- **Type**: `create_budget`
- **Confidence**: High (0.9)
- **Entities Extracted**:
  - `timePeriod`: "Q1" (Quarter 1)
  - `workbookName`: "Q1 Budget" (inferred)
  - `sheetNames`: ["Budget"] (default)

## Expected Operations

```json
{
  "operations": [
    {
      "type": "createWorkbook",
      "params": {
        "name": "Q1 Budget",
        "initialSheets": ["Budget"]
      }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "Budget",
        "cells": {
          "A1": { "raw": "Month", "dataType": "string", "style": { "bold": true } },
          "B1": { "raw": "Budget", "dataType": "string", "style": { "bold": true } },
          "C1": { "raw": "Actual", "dataType": "string", "style": { "bold": true } },
          "D1": { "raw": "Variance", "dataType": "string", "style": { "bold": true } },
          "A2": { "raw": "January", "dataType": "string" },
          "A3": { "raw": "February", "dataType": "string" },
          "A4": { "raw": "March", "dataType": "string" },
          "A5": { "raw": "Total", "dataType": "string", "style": { "bold": true } },
          "B2": { "raw": 10000, "dataType": "number", "numFmt": "$#,##0" },
          "B3": { "raw": 10000, "dataType": "number", "numFmt": "$#,##0" },
          "B4": { "raw": 10000, "dataType": "number", "numFmt": "$#,##0" },
          "C2": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C3": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" },
          "C4": { "raw": 0, "dataType": "number", "numFmt": "$#,##0" }
        }
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Budget",
        "cell": "D2",
        "formula": "=C2-B2"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Budget",
        "cell": "D3",
        "formula": "=C3-B3"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Budget",
        "cell": "D4",
        "formula": "=C4-B4"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Budget",
        "cell": "B5",
        "formula": "=SUM(B2:B4)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Budget",
        "cell": "C5",
        "formula": "=SUM(C2:C4)"
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "Budget",
        "cell": "D5",
        "formula": "=C5-B5"
      }
    },
    {
      "type": "compute",
      "params": {
        "sheet": "Budget"
      }
    }
  ],
  "confidence": 0.9,
  "reasoning": "Simple budget tracker with standard Q1 structure (Jan-Mar). User wants to track budget vs actual spending with variance calculations."
}
```

## Validation Criteria

### Structure
- [x] Workbook named "Q1 Budget"
- [x] Single sheet named "Budget"
- [x] Headers in row 1 (Month, Budget, Actual, Variance)
- [x] Three data rows (January, February, March)
- [x] Total row in row 5

### Formatting
- [x] Headers are bold
- [x] Currency values use "$#,##0" format
- [x] Total row is bold

### Formulas
- [x] Variance cells (D2:D4) calculate Actual - Budget
- [x] Total cells (B5, C5, D5) use SUM formulas
- [x] All formulas compute without errors

### Data
- [x] Budget values default to $10,000 per month
- [x] Actual values default to $0 (user will fill in)
- [x] Variance formulas show correct calculations

## Edge Cases

### Variation 1: "Create Q1 budget"
Same as above, system should handle with/without "tracker"

### Variation 2: "Make a budget for first quarter"
Should recognize "first quarter" = Q1

### Variation 3: "Create Q1 2024 budget"
Should include year in workbook name: "Q1 2024 Budget"

### Variation 4: "Q1 budget with categories"
Should add Category column before amounts:
```
A: Category, B: Budget, C: Actual, D: Variance
Rows: Revenue, Expenses, etc.
```

## Common Mistakes

### ❌ Mistake 1: Using percentage for variance
```json
// WRONG
{ "formula": "=(C2-B2)/B2", "numFmt": "0.00%" }
```
Variance should be dollar amount, not percentage. If user wants percentage, they'll ask for "% variance" explicitly.

### ❌ Mistake 2: Not handling division by zero
```json
// WRONG - if B2 is zero, this errors
{ "formula": "=C2/B2" }

// CORRECT
{ "formula": "=IF(B2=0,0,C2/B2)" }
```

### ❌ Mistake 3: Forgetting to compute
Must include `compute` operation at the end to calculate formulas.

### ❌ Mistake 4: Wrong data types
```json
// WRONG
{ "raw": "10000", "dataType": "string" }

// CORRECT
{ "raw": 10000, "dataType": "number", "numFmt": "$#,##0" }
```

## Alternative Prompts

All these should generate similar structure:
- "Create a Q1 budget tracker"
- "Make a budget for Q1"
- "Set up a quarterly budget for Q1"
- "Build a Q1 budget spreadsheet"
- "Create first quarter budget"

## Follow-up Prompts

After creating the budget, user might say:
- "Add a % Variance column" → Add column E with formula `=IF(B2=0,0,(C2-B2)/B2)`
- "Fill in actual values" → Set specific values in C2:C4
- "Add more categories" → Insert rows for different expense categories
- "Make it for all four quarters" → Create Q2, Q3, Q4 sheets

## Test Implementation

```typescript
describe('AI Example 01: Simple Budget', () => {
  it('should generate correct operations for "Create a Q1 budget tracker"', async () => {
    const operations = await generateWorkbookOperations('Create a Q1 budget tracker');
    
    expect(operations).toHaveLength(9);
    expect(operations[0].type).toBe('createWorkbook');
    expect(operations[0].params.name).toContain('Q1');
    expect(operations[1].type).toBe('setCells');
    expect(operations[1].params.cells.A1.raw).toBe('Month');
  });

  it('should execute without errors', async () => {
    const executor = new WorkbookOperationExecutor();
    const result = await executor.execute(operations);
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should compute variance formulas correctly', async () => {
    const workbook = result.workbook;
    const sheet = workbook.sheets[0];
    
    // After computation, D2 should be -10000 (0 - 10000)
    expect(sheet.cells.D2.computed.v).toBe(-10000);
    expect(sheet.cells.D5.computed.v).toBe(-30000); // Total variance
  });
});
```

## References

- [AI_INTENT_TAXONOMY.md](../AI_INTENT_TAXONOMY.md#1-budget-creation--tracking) - Budget intent definition
- [budget-tracker-scenario.test.ts](../../client/src/lib/workbook/__tests__/budget-tracker-scenario.test.ts) - Reference implementation
- [system-prompts.ts](../../client/src/lib/ai/system-prompts.ts) - Budget scenario prompt

---

**Status**: ⚪ Not yet tested  
**Priority**: High  
**Complexity**: Low
