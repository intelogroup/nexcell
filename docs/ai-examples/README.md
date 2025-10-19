# AI Prompt Examples

**Document Version:** 1.0  
**Last Updated:** October 19, 2025  
**Purpose:** Real-world test cases for AI intent recognition and operation generation

---

## Overview

This directory contains 20+ real-world user prompts with expected AI operations. Each example demonstrates:
- **User Prompt**: Natural language input
- **Expected Operations**: JSON WorkbookOperation array
- **Validation Criteria**: How to verify successful execution
- **Edge Cases**: Common variations and error scenarios

---

## Example Categories

### 📊 Budget & Financial Planning
- [01-simple-budget.md](./01-simple-budget.md) - Basic quarterly budget tracker
- [02-department-budget.md](./02-department-budget.md) - Multi-department budget with consolidation
- [03-ytd-budget.md](./03-ytd-budget.md) - Budget with year-to-date tracking
- [04-budget-vs-actual.md](./04-budget-vs-actual.md) - Budget vs actual variance analysis

### 🔄 Multi-Sheet Consolidation
- [05-regional-sales.md](./05-regional-sales.md) - Regional sales rollup
- [06-department-rollup.md](./06-department-rollup.md) - Department expense consolidation
- [07-product-summary.md](./07-product-summary.md) - Product line summary sheet

### 📈 Analysis & Reports
- [08-variance-analysis.md](./08-variance-analysis.md) - Variance with status flags
- [09-trend-analysis.md](./09-trend-analysis.md) - Month-over-month trends
- [10-performance-metrics.md](./10-performance-metrics.md) - KPI dashboard

### 📝 Data Entry & Tracking
- [11-expense-tracker.md](./11-expense-tracker.md) - Daily expense log
- [12-timesheet.md](./12-timesheet.md) - Employee timesheet
- [13-inventory-tracker.md](./13-inventory-tracker.md) - Stock level tracking

### 🔢 Formula-Heavy Scenarios
- [14-loan-calculator.md](./14-loan-calculator.md) - Loan amortization schedule
- [15-commission-calculator.md](./15-commission-calculator.md) - Tiered commission structure
- [16-allocation-formulas.md](./16-allocation-formulas.md) - Percentage-based allocation

### 📊 Formatting & Presentation
- [17-number-formatting.md](./17-number-formatting.md) - Currency, percentage, accounting formats
- [18-conditional-formatting.md](./18-conditional-formatting.md) - Status-based cell colors
- [19-professional-report.md](./19-professional-report.md) - Formatted executive report

### 🔍 Query & Information Retrieval
- [20-query-operations.md](./20-query-operations.md) - Read workbook data
- [21-lookup-scenarios.md](./21-lookup-scenarios.md) - VLOOKUP and reference lookups

### 📥 Import & Export
- [22-import-csv.md](./22-import-csv.md) - Import and analyze CSV data
- [23-export-report.md](./23-export-report.md) - Export formatted Excel file

### 🎯 Real-World Accounting Scenarios
- [24-accounting-journal.md](./24-accounting-journal.md) - T-account style journal entries
- [25-financial-statements.md](./25-financial-statements.md) - P&L and Balance Sheet

---

## Using These Examples

### For Testing
```typescript
import { generateWorkbookOperations } from './operation-generator';
import { WorkbookOperationExecutor } from './executor';

// Load example from file
const example = await import('./ai-examples/01-simple-budget.md');

// Test AI generation
const operations = await generateWorkbookOperations(example.prompt);

// Validate structure matches expected
expect(operations).toMatchExpectedStructure(example.expectedOperations);

// Execute and validate results
const executor = new WorkbookOperationExecutor();
const result = await executor.execute(operations);
expect(result).toMatchValidationCriteria(example.validation);
```

### For Training
- Use prompts to build training dataset
- Validate AI responses against expected operations
- Collect failure cases for improvement

### For Documentation
- Show users what the AI can do
- Provide example prompts to get started
- Demonstrate best practices for prompting

---

## Adding New Examples

Each example should include:

```markdown
# Example Title

## User Prompt
```
The exact natural language prompt
```

## Intent Analysis
- **Category**: create/modify/analyze/etc.
- **Type**: create_budget/add_formulas/etc.
- **Confidence**: High/Medium/Low
- **Entities**: Extracted information

## Expected Operations
\```json
[
  {
    "type": "createWorkbook",
    "params": { ... }
  },
  ...
]
\```

## Validation Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Edge Cases
- Variation 1: What if user says X instead?
- Variation 2: What if missing Y?

## Common Mistakes
- Mistake 1: AI might do X when it should do Y
- Mistake 2: Watch out for Z
```

---

## References

- [AI_INTENT_TAXONOMY.md](../AI_INTENT_TAXONOMY.md) - Intent categories and patterns
- [system-prompts.ts](../../client/src/lib/ai/system-prompts.ts) - AI system instructions
- [operations/types.ts](../../client/src/lib/ai/operations/types.ts) - Operation type definitions
- [workbook-capabilities.ts](../../client/src/lib/ai/workbook-capabilities.ts) - Capability mapping

---

## Test Coverage

| Category | Examples | Tested | Pass Rate |
|----------|----------|--------|-----------|
| Budget & Financial | 4 | 0 | - |
| Consolidation | 3 | 0 | - |
| Analysis | 3 | 0 | - |
| Data Entry | 3 | 0 | - |
| Formula-Heavy | 3 | 0 | - |
| Formatting | 3 | 0 | - |
| Query | 2 | 0 | - |
| Import/Export | 2 | 0 | - |
| Accounting | 2 | 0 | - |
| **Total** | **25** | **0** | **-** |

---

## Version History

- **v1.0** (Oct 19, 2025) - Initial structure with 25 example categories
