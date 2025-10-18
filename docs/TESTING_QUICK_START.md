# Testing Quick Start Guide

Get started with Nexcell testing in 5 minutes! 🚀

---

## 🎯 Quick Examples

### Example 1: Simple Formula Test
```typescript
import { describe, test } from 'vitest';
import { createTestWorkbook, assertFormulaResult } from '../utils/test-helpers';

describe('Basic Math', () => {
  test('SUM should add numbers', () => {
    const wb = createTestWorkbook({
      sheets: [{
        cells: {
          'A1': { raw: 10 },
          'A2': { raw: 20 },
          'A3': { formula: 'SUM(A1:A2)' },
        },
      }],
    });
    
    assertFormulaResult(wb, 'SUM(A1:A2)', 30);
  });
});
```

### Example 2: Using Fixtures
```typescript
import { generateSalesData } from '../fixtures/sample-data-generators';

test('Sales data aggregation', () => {
  const wb = createWorkbook('Test');
  const sheet = wb.sheets[0];
  
  // Generate 100 rows of sales data
  generateSalesData(wb, sheet.id, 100);
  
  // Add aggregation formula
  setCellUtil(wb, sheet.id, 'I1', { formula: 'SUM(H2:H101)' });
  
  // Compute and verify
  const { hydration } = computeWorkbook(wb);
  const total = wb.sheets[0].cells?.['I1']?.computed?.v;
  
  expect(typeof total).toBe('number');
  expect(total).toBeGreaterThan(0);
});
```

### Example 3: Performance Test
```typescript
import { assertPerformance } from '../utils/test-helpers';

test('Bulk insert performance', () => {
  const wb = createWorkbook('Perf Test');
  
  const result = assertPerformance(
    () => {
      // Insert 50 rows
      applyOperations(wb, [{
        type: 'insertRow',
        sheetId: wb.sheets[0].id,
        row: 10,
        count: 50,
      }]);
    },
    1000, // Must complete in 1 second
    'Insert 50 rows'
  );
  
  expect(result.success).toBe(true);
});
```

---

## 📚 Available Helpers

### Workbook Creation
```typescript
// Empty workbook
const wb = createWorkbook('MyWorkbook');

// Workbook with data
const wb = createTestWorkbook({
  title: 'Test',
  sheets: [{
    name: 'Sheet1',
    cells: { 'A1': { raw: 'Hello' } },
  }],
});

// Grid of data
const wb = createGridWorkbook(100, 10, 'Test');
```

### Assertions
```typescript
// Cell value
assertCellValue(wb, 'A1', 100);

// Formula result
assertFormulaResult(wb, 'SUM(A1:A10)', 550);

// Cell has error
assertCellError(wb, 'A1', '#DIV/0!');

// No errors in workbook
assertNoErrors(wb);

// Operation succeeded
assertOperationSuccess(wb, [operation]);
```

### Fixtures
```typescript
// Sales data
generateSalesData(wb, sheetId, 50);

// Financial data
generateFinancialData(wb, sheetId, 100);

// Gradebook data
generateGradebookData(wb, sheetId, 30);

// Date/time scenarios
generateDateTimeData(wb, sheetId, 20);

// Large dataset
generateLargeDataset(wb, sheetId, 10000, 10);

// Formula dataset
generateFormulaDataset(wb, sheetId, 1000, 500);
```

### Performance
```typescript
// Measure time
const { result, elapsed } = measurePerformance(
  () => computeWorkbook(wb),
  'Compute workbook'
);

// Assert time limit
assertPerformance(
  () => doSomething(),
  5000, // max 5 seconds
  'Operation name'
);

// Statistical benchmark
const stats = benchmark(
  () => doSomething(),
  10 // iterations
);
console.log(`Mean: ${stats.mean}ms`);
```

---

## 🎨 Test Templates

### Unit Test Template
```typescript
import { describe, test, expect } from 'vitest';
import { createTestWorkbook, assertFormulaResult } from '../utils/test-helpers';

describe('Feature Name', () => {
  describe('Subfeature', () => {
    test('should behave as expected', () => {
      // Arrange
      const wb = createTestWorkbook({
        sheets: [{ cells: { /* data */ } }],
      });
      
      // Act
      const { hydration } = computeWorkbook(wb);
      
      // Assert
      assertCellValue(wb, 'A1', expectedValue);
    });
    
    test('should handle edge case', () => {
      // Test edge case
    });
  });
});
```

### Integration Test Template
```typescript
import { describe, test } from 'vitest';
import { createWorkbook, applyOperations } from '../../workbook';

describe('Multi-Step Operation', () => {
  test('should maintain integrity', () => {
    // Setup
    const wb = createWorkbook('Test');
    
    // Perform operations
    const result = applyOperations(wb, [
      { type: 'editCell', /* ... */ },
      { type: 'insertRow', /* ... */ },
    ]);
    
    // Verify
    expect(result.success).toBe(true);
    // Additional assertions
  });
});
```

### Performance Test Template
```typescript
import { describe, test } from 'vitest';
import { assertPerformance, benchmark } from '../utils/test-helpers';

describe('Performance', () => {
  test('should complete within time limit', () => {
    const wb = createLargeWorkbook();
    
    assertPerformance(
      () => computeWorkbook(wb),
      5000,
      'Large workbook computation'
    );
  });
  
  test('should maintain consistent performance', () => {
    const stats = benchmark(() => doOperation(), 10);
    
    expect(stats.mean).toBeLessThan(100);
    expect(stats.stdDev).toBeLessThan(20); // Low variance
  });
});
```

---

## 🔥 Common Patterns

### Pattern 1: Test Cross-Sheet References
```typescript
const wb = createTestWorkbook({
  sheets: [
    {
      name: 'Data',
      cells: { 'A1': { raw: 100 } },
    },
    {
      name: 'Summary',
      cells: { 'A1': { formula: 'Data!A1*2' } },
    },
  ],
});

const summarySheet = wb.sheets.find(s => s.name === 'Summary')!;
assertCellValue(wb, 'A1', 200, summarySheet.id);
```

### Pattern 2: Test Error Handling
```typescript
const wb = createTestWorkbook({
  sheets: [{
    cells: {
      'A1': { formula: '1/0' }, // Division by zero
      'A2': { formula: 'A1*2' }, // Should propagate error
      'A3': { formula: 'IFERROR(A2,0)' }, // Should catch error
    },
  }],
});

assertCellError(wb, 'A1', '#DIV/0!');
assertCellError(wb, 'A2'); // Has an error
assertCellValue(wb, 'A3', 0); // Error caught
```

### Pattern 3: Test Operations
```typescript
const wb = createWorkbook('Test');
const sheetId = wb.sheets[0].id;

// Setup initial state
setCellUtil(wb, sheetId, 'A1', { raw: 100 });
setCellUtil(wb, sheetId, 'A2', { formula: 'A1*2' });

// Apply operation
const result = applyOperations(wb, [{
  type: 'insertRow',
  sheetId,
  row: 2,
  count: 1,
}]);

// Verify operation succeeded
expect(result.success).toBe(true);

// Verify formula updated
const cell = getCell(wb, sheetId, 'A3'); // Formula moved from A2 to A3
expect(cell?.formula).toBe('A1*2');
```

---

## 🐛 Debugging Tests

### Enable Verbose Logging
```typescript
test('debug test', () => {
  const wb = createTestWorkbook({ /* ... */ });
  const { hydration, recompute } = computeWorkbook(wb, { 
    validateFormulas: true 
  });
  
  console.log('Errors:', recompute.errors);
  console.log('Warnings:', recompute.warnings);
  console.log('Cell A1:', wb.sheets[0].cells?.['A1']);
});
```

### Inspect Workbook State
```typescript
import { getFormulaCells, getErrorCells } from '../utils/test-helpers';

const formulaCells = getFormulaCells(wb, sheetId);
console.log('Formulas:', formulaCells);

const errorCells = getErrorCells(wb, sheetId);
console.log('Errors:', errorCells);
```

### Compare Workbooks
```typescript
import { workbooksEqual, cloneWorkbook } from '../utils/test-helpers';

const original = cloneWorkbook(wb);
// Perform operation
const modified = performOperation(wb);

if (!workbooksEqual(original, modified)) {
  console.log('Workbooks differ!');
}
```

---

## ⚡ Pro Tips

1. **Use descriptive test names**
   ```typescript
   // Bad
   test('test1', () => { ... });
   
   // Good
   test('should calculate weighted average correctly', () => { ... });
   ```

2. **Test one thing per test**
   ```typescript
   // Bad
   test('everything', () => {
     testFeatureA();
     testFeatureB();
     testFeatureC();
   });
   
   // Good
   test('should handle feature A', () => { ... });
   test('should handle feature B', () => { ... });
   ```

3. **Use fixtures for large data**
   ```typescript
   // Bad: 50 lines of setCellUtil calls
   
   // Good
   generateSalesData(wb, sheetId, 50);
   ```

4. **Assert on computed values, not UI state**
   ```typescript
   // Good: Test the calculation
   assertCellValue(wb, 'A1', 100);
   
   // Bad: Test UI rendering (not in unit tests)
   // expect(screen.getByText('100')).toBeInTheDocument();
   ```

5. **Use beforeEach for common setup**
   ```typescript
   describe('Suite', () => {
     let wb: WorkbookJSON;
     
     beforeEach(() => {
       wb = createTestWorkbook({ /* ... */ });
     });
     
     test('test 1', () => { /* use wb */ });
     test('test 2', () => { /* use wb */ });
   });
   ```

---

## 📖 Related Docs

- [AI Test Prompts](./AI_TEST_PROMPTS.md) - Test scenarios
- [Automated Test Plan](./AUTOMATED_TEST_PLAN.md) - Implementation roadmap
- [Implementation Summary](./TEST_IMPLEMENTATION_SUMMARY.md) - Progress tracking

---

## 🚀 Next Steps

1. **Read existing tests** in `tests/unit/advanced-lookup-functions.test.ts`
2. **Try writing a simple test** using the examples above
3. **Pick a test from the backlog** and implement it
4. **Contribute!** Follow the patterns and submit a PR

---

**Happy Testing!** 🎉

*Last Updated: October 18, 2025*
