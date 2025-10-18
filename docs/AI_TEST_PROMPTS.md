# AI Test Prompts for Nexcell

This document contains comprehensive test prompts for validating Nexcell's calculation engine, sheet operations, and AI capabilities.

## 🎯 Quick Reference

| Category | Prompts | Complexity | Use Case |
|----------|---------|------------|----------|
| [Complex Calculations](#complex-calculations) | 1-10 | High | Formula validation |
| [Sheet Operations](#sheet-operations) | 11-20 | Medium-High | Operation integrity |
| [Edge Cases](#edge-cases) | 21-30 | Very High | Error handling |
| [Real-World Scenarios](#real-world-scenarios) | 31-35 | High | Production validation |

---

## 🧮 Complex Calculations

### 1. Advanced Lookup Functions
```
Create a sales dashboard with XLOOKUP to find product prices, INDEX-MATCH for 2D lookups across regions, and nested IFERROR to handle missing data gracefully
```

**Expected Outcome:**
- XLOOKUP formulas working across sheets
- INDEX-MATCH combinations for matrix lookups
- IFERROR preventing #N/A errors
- Proper handling of missing lookup values

**Test Coverage:**
- Cross-sheet references
- Error handling cascades
- Lookup performance with 100+ rows

---

### 2. Array Formulas & Dynamic Arrays
```
Build a budget tracker using FILTER to show expenses above $1000, SORT to rank by amount, UNIQUE to list distinct categories, and SEQUENCE to generate month numbers
```

**Expected Outcome:**
- Dynamic array spilling works correctly
- FILTER updates when source data changes
- SORT handles text and numbers properly
- UNIQUE removes duplicates accurately
- SEQUENCE generates integer sequences

**Test Coverage:**
- Array formula dependencies
- Spill range conflicts (#SPILL! errors)
- Performance with 500+ filtered rows

---

### 3. Nested Financial Functions
```
Create an investment calculator with PMT for loan payments, FV for future value with compound interest, NPV for net present value analysis, and IRR for internal rate of return on cash flows
```

**Expected Outcome:**
- PMT calculates monthly payments correctly
- FV handles compound interest periods
- NPV discounts cash flows properly
- IRR converges to correct rate
- Edge cases: 0% interest, negative values

**Test Coverage:**
- Financial precision (rounding)
- Date arithmetic in payment schedules
- Circular references in IRR calculations

---

### 4. Complex Conditional Aggregation
```
Build a sales report using SUMIFS with 3+ criteria (region, quarter, product type), AVERAGEIFS for conditional averages, and COUNTIFS to count records matching multiple conditions across different sheets
```

**Expected Outcome:**
- SUMIFS correctly applies all criteria
- AVERAGEIFS excludes non-matching values
- COUNTIFS handles blank cells
- Cross-sheet criteria ranges work
- Performance with 1000+ rows

**Test Coverage:**
- Multiple criteria with AND logic
- Wildcard matching in text criteria
- Date range criteria

---

### 5. Date/Time Edge Cases
```
Create a timesheet calculator handling midnight crossovers, leap years, daylight saving time, WORKDAY.INTL for international holidays, NETWORKDAYS for business days, and EDATE for month arithmetic
```

**Expected Outcome:**
- Time differences spanning midnight
- Feb 29 in leap years
- WORKDAY respects weekend patterns
- NETWORKDAYS excludes holidays
- EDATE handles month-end correctly (Jan 31 + 1 month = Feb 28/29)

**Test Coverage:**
- DST transitions (if supported)
- Different calendar systems
- Negative date arithmetic

---

### 6. Statistical Analysis
```
Build a grade analyzer using PERCENTILE for score distribution, STDEV for variance, CORREL for correlation between subjects, FORECAST for trend prediction, and RANK for student positioning
```

**Expected Outcome:**
- PERCENTILE calculates quartiles
- STDEV handles sample vs population
- CORREL returns -1 to 1
- FORECAST predicts linear trends
- RANK handles ties correctly

**Test Coverage:**
- Empty/blank values in datasets
- Outlier handling
- Non-numeric data filtering

---

### 7. Text Manipulation Pipeline
```
Parse email addresses using LEFT, RIGHT, MID, FIND, SUBSTITUTE, TRIM, PROPER, and TEXTJOIN to extract domains, validate formats, and create formatted lists
```

**Expected Outcome:**
- LEFT/RIGHT/MID extract substrings
- FIND locates "@" and "."
- SUBSTITUTE replaces characters
- TRIM removes extra spaces
- PROPER capitalizes correctly
- TEXTJOIN concatenates with delimiters

**Test Coverage:**
- Unicode/emoji handling
- Case sensitivity
- Empty string edge cases

---

### 8. Circular Reference Resolution
```
Create an iterative calculation model where A1 depends on B1, B1 on C1, and C1 back on A1 with convergence logic (like loan amortization with refinancing)
```

**Expected Outcome:**
- Circular reference detected
- Iterative calculation converges
- Max iterations respected
- #REF! error if no convergence

**Test Coverage:**
- Detection accuracy
- Convergence speed
- Multiple circular chains

---

### 9. Volatile Function Stress Test
```
Build a real-time dashboard with NOW(), TODAY(), RAND(), RANDBETWEEN() updating continuously, combined with conditional formatting rules that depend on current time
```

**Expected Outcome:**
- Volatile functions recalculate on every change
- Performance remains acceptable
- RAND generates 0-1
- RANDBETWEEN stays in range
- NOW() reflects current time

**Test Coverage:**
- Recalculation frequency
- Memory usage over time
- Conditional formatting updates

---

### 10. Cross-Sheet 3D Formulas
```
Create a consolidated report using SUM(Sheet1:Sheet12!A1) for 3D references, INDIRECT for dynamic sheet references, and mixed absolute/relative references that span workbooks
```

**Expected Outcome:**
- 3D references sum across sheets
- INDIRECT resolves sheet names dynamically
- Inserting/deleting sheets updates 3D ranges
- $A$1, $A1, A$1 adjust correctly on copy

**Test Coverage:**
- Sheet insertion in 3D range
- Sheet deletion handling
- INDIRECT with invalid sheets (#REF!)

---

## 🔧 Sheet Operations

### 11. Bulk Insert/Delete with Formula Preservation
```
Insert 50 rows in the middle of a sheet with 100+ formulas, then delete 30 rows, ensuring all formulas update correctly including named ranges and conditional formatting rules
```

**Expected Outcome:**
- Formulas adjust row references
- Named ranges expand/shrink
- Conditional formatting shifts
- No #REF! errors
- Undo restores original state

---

### 12. Merge Cell Cascades
```
Create a complex header with nested merged cells (A1:D1, then A2:B2, C2:D2), apply styles, insert rows above/below, and verify merge integrity is maintained
```

**Expected Outcome:**
- Nested merges display correctly
- Styles apply to entire merge
- Insert/delete preserves merge ranges
- Unmerge splits cells properly

---

### 13. Named Range Operations
```
Define 10 named ranges with overlapping regions, use them in formulas, insert columns within ranges, delete rows, and verify dynamic expansion/contraction behavior
```

**Expected Outcome:**
- Named ranges accessible in formulas
- Insert/delete updates ranges
- Overlapping ranges handled
- Scope (sheet vs workbook) respected

---

### 14. Conditional Formatting with Formulas
```
Apply 5 conditional formatting rules using formulas like =MOD(ROW(),2)=0, =INDIRECT(ADDRESS(ROW(),1))>100, with overlapping priorities, then insert rows and verify rules adjust
```

**Expected Outcome:**
- Formula-based rules evaluate correctly
- Priority determines display
- ROW()/COLUMN() update on insert
- Rules shift with row operations

---

### 15. Data Validation Chains
```
Create dependent dropdowns where B1 choices depend on A1, C1 on B1, using INDIRECT and named ranges, then insert rows and verify validation rules follow
```

**Expected Outcome:**
- Dropdown lists filter correctly
- INDIRECT resolves dynamically
- Invalid entries rejected
- Rules copy with cell copy

---

### 16. Pivot Table-like Aggregation
```
Build a manual pivot using SUMIFS/COUNTIFS with dynamic row headers from UNIQUE, column headers from SORT, and subtotals using SUBTOTAL for filtered data
```

**Expected Outcome:**
- UNIQUE generates row/column headers
- SUMIFS aggregates by dimensions
- SUBTOTAL respects filtered rows
- Dynamic updates on data change

---

### 17. Undo/Redo Stress Test
```
Perform 20 mixed operations (edit cells, insert rows, merge, format, add formulas), then undo all 20 steps one by one, redo 10 steps, and verify state integrity
```

**Expected Outcome:**
- Undo reverses each operation
- Redo re-applies correctly
- State matches expected at each step
- No orphaned data or formulas

---

### 18. Copy-Paste with Mixed References
```
Copy a range with mixed absolute ($A$1), relative (A1), and mixed ($A1, A$1) references, paste to multiple locations, verify reference adjustment logic
```

**Expected Outcome:**
- $A$1 stays fixed
- A1 adjusts both row and column
- $A1 fixes column, adjusts row
- A$1 fixes row, adjusts column

---

### 19. Large Dataset Operations
```
Import 10,000 rows of data, apply SUMIFS formulas referencing full columns (A:A), insert 100 rows at row 5000, delete 50 rows at row 2000, verify performance and correctness
```

**Expected Outcome:**
- Full column references (A:A) work
- Insert/delete completes in <5s
- Formulas remain correct
- No UI freezing

---

### 20. Multi-Sheet Synchronization
```
Create 5 sheets with interdependent formulas, modify Sheet1, verify Sheet2-5 recalculate correctly, then delete Sheet3 and ensure referencing formulas show #REF! errors
```

**Expected Outcome:**
- Changes propagate across sheets
- Dependency graph accurate
- Deleting sheet breaks references
- #REF! errors appear immediately

---

## 🌟 Edge Cases

### 21. Error Propagation Chain
```
Create a chain A1->B1->C1->D1 where A1 has #DIV/0!, verify error propagates, then use IFERROR in C1 to break the chain, ensure D1 recovers
```

---

### 22. Format Preservation During Operations
```
Apply currency formatting, custom number formats, date formats, then insert rows/columns, copy-paste, verify formats follow or stay with cells as appropriate
```

---

### 23. Mixed Content Types
```
Create cells with text, numbers, dates, formulas, errors, blanks, then apply operations (sort, filter, bulk edit) and verify each type handles correctly
```

---

### 24. Spilled Array Formula Management
```
Create array formulas that spill (=SEQUENCE(10)), insert rows within spill range, delete rows, verify spill boundaries adjust and #SPILL! errors handled
```

---

### 25. Performance: Formula Recalculation
```
Build a sheet with 500 cells each containing SUMIFS over 1000 rows, modify one source cell, measure recalculation time, verify only dependent cells recompute
```

---

### 26. Sheet Protection & Locked Cells
```
Protect a sheet with locked/unlocked ranges, attempt operations on locked cells, verify protection prevents edits but allows reads
```

---

### 27. Import/Export Fidelity
```
Create a workbook with all features (formulas, formatting, merged cells, named ranges), export to Excel, re-import, verify 100% fidelity with original
```

---

### 28. Internationalization
```
Use non-English decimal separators (comma), date formats (DD/MM/YYYY), currency symbols (€, ¥), verify formulas parse and display correctly
```

---

### 29. Memory & Cleanup
```
Create 100 sheets with 1000 cells each, delete 90 sheets, verify memory is released and workbook size shrinks appropriately
```

---

### 30. Concurrent Edit Simulation
```
Simulate two users editing different cells simultaneously, then same cell, verify conflict resolution strategy (last-write-wins, merge, error)
```

---

## 📊 Real-World Scenarios

### 31. Financial Statement Consolidation
```
Build a multi-entity consolidation with separate sheets per subsidiary, currency conversion, inter-company eliminations, and roll-up to parent company totals
```

**Complexity:** Very High  
**Features Tested:** Cross-sheet formulas, named ranges, SUMIFS with multiple criteria, currency functions

---

### 32. Project Management Gantt Chart
```
Create a Gantt chart using conditional formatting for bars, WORKDAY for date calculations, dependencies between tasks, critical path highlighting
```

**Complexity:** High  
**Features Tested:** Date functions, conditional formatting, array formulas, dependency tracking

---

### 33. Inventory Management System
```
Track inventory with FIFO/LIFO calculations, reorder point formulas, stock aging analysis using date functions, and automated alerts with conditional formatting
```

**Complexity:** High  
**Features Tested:** Complex lookups, date arithmetic, conditional aggregation, volatile functions

---

### 34. Commission Calculator
```
Calculate tiered commissions using nested IFs or VLOOKUP with approximate match, handle clawbacks, bonuses, and split commissions across multiple reps
```

**Complexity:** Medium-High  
**Features Tested:** Lookup functions, nested logic, financial math, error handling

---

### 35. Gradebook with Weighted Scores
```
Build a gradebook with weighted categories (tests 40%, homework 30%, projects 30%), drop lowest scores, curve grades, and calculate class statistics
```

**Complexity:** Medium  
**Features Tested:** AVERAGE, MIN/MAX, array formulas, PERCENTILE, statistical functions

---

## 🚀 Performance Benchmarks

| Operation | Target | Measured | Status |
|-----------|--------|----------|--------|
| Single cell edit | <100ms | - | ⏱️ |
| Batch 100 cells | <500ms | - | ⏱️ |
| Batch 1000 cells | <2s | - | ⏱️ |
| Insert 50 rows | <1s | - | ⏱️ |
| Full recalculation (1000 formulas) | <5s | - | ⏱️ |
| XLSX export (10MB) | <10s | - | ⏱️ |

---

## 📝 Usage Instructions

### For AI Testing
1. Start with prompts 1-10 to test calculation complexity
2. Use prompts 11-20 to test sheet operation robustness
3. Apply prompts 21-30 for edge case coverage
4. Use prompts 31-35 for real-world validation

### For Manual Testing
1. Pick prompts that match your feature priorities
2. Combine multiple prompts for stress testing
3. Modify prompts to focus on specific areas (dates, text, financials)
4. Track results in the benchmarks table

### For Automated Testing
1. Convert prompts to Vitest test cases
2. Use fixture workbooks from `samples/`
3. Assert on computed values, not UI state
4. Run in CI/CD pipeline

---

## 🐛 Known Issues

Track issues discovered during testing:

| Prompt # | Issue | Severity | Status |
|----------|-------|----------|--------|
| - | - | - | - |

---

## 📚 Related Documentation

- [AI Context Awareness](./AI_CONTEXT_AWARENESS.md)
- [Eager Compute Assessment](./EAGER_COMPUTE_ASSESSMENT.md)
- [Dependency Recalculation](./DEPENDENCY_AWARE_RECALCULATION_PROOF.md)
- [UI Checklist](./UI_CHECKLIST.md)

---

**Last Updated:** October 18, 2025  
**Maintainer:** Nexcell Development Team
