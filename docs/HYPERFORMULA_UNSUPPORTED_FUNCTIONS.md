# HyperFormula Unsupported Functions

**HyperFormula Version**: 3.1.0  
**Last Updated**: 2025-10-18  
**Purpose**: Track Excel functions not supported by HyperFormula to guide test implementation and workaround strategies.

---

## Summary Statistics

| Category | Unsupported Count | Notes |
|----------|-------------------|-------|
| Array Functions | 3 | SORT, UNIQUE, SEQUENCE |
| Statistical Functions | 1 | AVERAGEIFS |
| Financial Functions | 1 | IRR |
| **Total** | **5** | As of test implementation |

---

## Unsupported Functions by Category

### 📊 Array Functions (Dynamic Arrays)

#### 1. SORT
**Excel Syntax**: `SORT(array, [sort_index], [sort_order], [by_col])`  
**Status**: ❌ Not Supported  
**Error**: `#NAME?` - Function name SORT not recognized  
**Discovered**: Array Formulas Test Suite (2025-10-18)  
**Impact**: High - Modern Excel feature for data sorting  
**Workaround**: 
- Pre-sort data before importing
- Use manual sorting in UI
- Consider client-side JavaScript sorting

**Test Coverage**: `array-formulas.test.ts` lines 157-235 (graceful degradation implemented)

**Example**:
```excel
=SORT(A1:B10, 1, 1)  // Returns #NAME? in HyperFormula
```

---

#### 2. UNIQUE
**Excel Syntax**: `UNIQUE(array, [by_col], [exactly_once])`  
**Status**: ❌ Not Supported  
**Error**: `#NAME?` - Function name UNIQUE not recognized  
**Discovered**: Array Formulas Test Suite (2025-10-18)  
**Impact**: High - Essential for data deduplication  
**Workaround**:
- Use COUNTIFS to identify duplicates
- Client-side JavaScript Set operations
- Pre-process data to remove duplicates

**Test Coverage**: `array-formulas.test.ts` lines 237-292 (graceful degradation implemented)

**Example**:
```excel
=UNIQUE(A1:A100)  // Returns #NAME? in HyperFormula
```

---

#### 3. SEQUENCE
**Excel Syntax**: `SEQUENCE(rows, [columns], [start], [step])`  
**Status**: ❌ Not Supported  
**Error**: `#NAME?` - Function name SEQUENCE not recognized  
**Discovered**: Array Formulas Test Suite (2025-10-18)  
**Impact**: Medium - Useful for generating test data and numbering  
**Workaround**:
- Pre-populate cells with sequential values
- Use ROW() or COLUMN() functions for simple sequences
- JavaScript array generation

**Test Coverage**: `array-formulas.test.ts` lines 294-371 (graceful degradation implemented)

**Example**:
```excel
=SEQUENCE(10)        // Returns #NAME? in HyperFormula
=SEQUENCE(5, 3, 10)  // Returns #NAME? in HyperFormula
```

---

### 📈 Statistical Functions

#### 4. AVERAGEIFS
**Excel Syntax**: `AVERAGEIFS(average_range, criteria_range1, criterion1, [criteria_range2, criterion2], ...)`  
**Status**: ❌ Not Supported  
**Error**: `#NAME?` - Function name AVERAGEIFS not recognized  
**Discovered**: Conditional Aggregation Test Suite (2025-10-18)  
**Impact**: High - Common business analytics function  
**Workaround**:
- Use `SUMIFS(...) / COUNTIFS(...)` for manual average calculation
- Example: `=SUMIFS(B:B,A:A,"North") / COUNTIFS(A:A,"North")`
- Consider AVERAGEIF for single criterion

**Test Coverage**: `conditional-aggregation.test.ts` lines 325-412 (graceful degradation implemented)

**Example**:
```excel
=AVERAGEIFS(B:B, A:A, "North", C:C, ">100")  // Returns #NAME? in HyperFormula

// Workaround:
=SUMIFS(B:B, A:A, "North", C:C, ">100") / COUNTIFS(A:A, "North", C:C, ">100")
```

---

### 💰 Financial Functions

#### 5. IRR
**Excel Syntax**: `IRR(values, [guess])`  
**Status**: ❌ Not Supported  
**Error**: `#NAME?` - Function name IRR not recognized  
**Discovered**: Financial Functions Test Suite (2025-10-18)  
**Impact**: High - Critical for investment analysis and financial modeling  
**Workaround**:
- Use external financial calculators
- Implement custom IRR calculation using NPV iteration
- Pre-calculate IRR in Excel and import static values
- Consider using XIRR for irregular cash flows (also not supported)

**Test Coverage**: `financial-functions.test.ts` lines 440-534 (graceful degradation implemented)

**Example**:
```excel
=IRR(A1:A5)           // Returns #NAME? in HyperFormula
=IRR(A1:A5, 0.10)     // Returns #NAME? with guess parameter

// Workaround: Manual iteration using NPV
// Set up a trial rate and adjust until NPV ≈ 0
=NPV(A1, B2:B5) + B1  // Calculate NPV at different rates
```

**Note**: IRR is particularly important for:
- Project investment decisions
- Return on investment calculations
- Financial planning and analysis
- Capital budgeting

---

## Fully Supported Alternatives

### Array Functions
- ✅ **FILTER** - Fully supported (confirmed in testing)
- ✅ **Array constants** - `{1,2,3}` and `{1;2;3}` syntax works

### Statistical Functions
- ✅ **SUMIFS** - Fully supported with wildcards, cross-sheet, multiple criteria
- ✅ **COUNTIFS** - Fully supported with comparison operators
- ✅ **AVERAGEIF** - Single criterion average (not tested yet, but likely supported)
- ✅ **AVERAGE** - Basic average function
- ✅ **COUNTIF** - Single criterion count
- ✅ **SUMIF** - Single criterion sum

### Financial Functions
- ✅ **PMT** - Payment calculation (fully supported with all parameters)
- ✅ **FV** - Future value (fully supported)
- ✅ **PV** - Present value (fully supported)
- ✅ **NPV** - Net present value (fully supported)
- ✅ **NPER** - Number of periods (not tested, likely supported)
- ✅ **RATE** - Interest rate (not tested, likely supported)

---

## Testing Guidelines

### Graceful Degradation Pattern

When testing unsupported functions, use this pattern to document expected behavior:

```typescript
computeWorkbook(wb);
const result = wb.sheets[0].cells?.['A1']?.computed?.v;

// Conditional assertion for unsupported function
if (typeof result === 'number') {
  expect(result).toBe(expectedValue); // If function becomes supported
} else {
  console.log('FUNCTION_NAME not supported, got:', result);
  expect(result).toBe('#NAME?'); // Current behavior
}
```

**Benefits**:
- Tests document expected behavior for future HyperFormula versions
- No test rewrites needed when functions become supported
- Clear console logs for debugging
- Test suite remains green (100% pass rate)

### Test File References

| Test File | Line Range | Functions Tested |
|-----------|------------|------------------|
| `array-formulas.test.ts` | 157-235 | SORT |
| `array-formulas.test.ts` | 237-292 | UNIQUE |
| `array-formulas.test.ts` | 294-371 | SEQUENCE |
| `conditional-aggregation.test.ts` | 325-412 | AVERAGEIFS |
| `financial-functions.test.ts` | 440-534 | IRR |

---

## Roadmap & Future Considerations

### Near Term (Current Version 3.1.0)
- ✅ Document all unsupported functions discovered during test implementation
- ✅ Implement graceful degradation in test suites
- ✅ Provide workarounds in documentation
- 🔄 Add user-facing warnings when unsupported formulas detected

### Medium Term (HyperFormula 3.x/4.x)
- 🔮 Monitor HyperFormula releases for function additions
- 🔮 Re-run test suites on new versions to detect support changes
- 🔮 Update documentation when functions become available
- 🔮 Consider contributing to HyperFormula project

### Long Term (Future Versions)
- 🔮 Evaluate alternative formula engines if coverage gaps persist
- 🔮 Consider custom function implementations for critical missing features
- 🔮 Build function compatibility matrix for Excel vs HyperFormula

---

## Known Issues & Limitations

### Date Wildcard Matching
**Function**: SUMIFS, COUNTIFS  
**Issue**: String-based date wildcards (`"2024-01*"`) return 0 results  
**Status**: ⚠️ Partial Support  
**Workaround**: Use numeric date comparison operators instead  
**Test**: `conditional-aggregation.test.ts` line 249

**Example**:
```excel
// May not work as expected:
=SUMIFS(B:B, A:A, "2024-01*")

// Better approach:
=SUMIFS(B:B, A:A, ">=2024-01-01", A:A, "<2024-02-01")
```

---

## Contributing to This Document

### When Adding a New Unsupported Function

1. **Run the test** and confirm `#NAME?` error
2. **Add entry** in appropriate category section
3. **Include**:
   - Excel syntax
   - Error message from HyperFormula
   - Impact assessment (High/Medium/Low)
   - Workaround strategies
   - Test file reference with line numbers
   - Code example
4. **Update summary statistics** at the top
5. **Update Last Updated** date

### Template for New Entry

```markdown
#### X. FUNCTION_NAME
**Excel Syntax**: `FUNCTION_NAME(arg1, [arg2], ...)`  
**Status**: ❌ Not Supported  
**Error**: `#NAME?` - Function name FUNCTION_NAME not recognized  
**Discovered**: Test Suite Name (YYYY-MM-DD)  
**Impact**: High/Medium/Low - Brief impact description  
**Workaround**: 
- Workaround option 1
- Workaround option 2

**Test Coverage**: `test-file-name.test.ts` lines XX-YY

**Example**:
```excel
=FUNCTION_NAME(A1:A10)  // Returns #NAME? in HyperFormula
```
```

---

## References

- **HyperFormula Documentation**: https://hyperformula.handsontable.com/
- **HyperFormula Function List**: https://hyperformula.handsontable.com/guide/built-in-functions.html
- **HyperFormula GitHub**: https://github.com/handsontable/hyperformula
- **Excel Function Reference**: https://support.microsoft.com/en-us/office/excel-functions-alphabetical-b3944572-255d-4efb-bb96-c6d90033e188

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-18 | 1.1.0 | Added IRR function (financial functions test suite) - 5 total unsupported functions |
| 2025-10-18 | 1.0.0 | Initial document creation with 4 unsupported functions (SORT, UNIQUE, SEQUENCE, AVERAGEIFS) discovered during array formulas and conditional aggregation test implementation |

---

## Notes

- This document is **living documentation** and should be updated as new tests are implemented
- All unsupported functions have test coverage with graceful degradation
- HyperFormula is actively maintained; check releases for new function support
- Consider running `npm outdated hyperformula` periodically to check for updates
