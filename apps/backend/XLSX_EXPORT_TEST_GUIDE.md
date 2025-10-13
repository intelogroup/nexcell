# XLSX Export Test Guide

This guide explains how to test the XLSX export functionality with formulas, formatting, and multiple sheets.

## Prerequisites

1. **Backend server running** on `http://localhost:3001`
   ```powershell
   cd apps/backend
   pnpm dev
   ```

2. **Frontend running** on `http://localhost:5173` (for getting auth token)
   ```powershell
   cd apps/frontend
   pnpm dev
   ```

3. **Valid authentication token**

## Getting an Authentication Token

1. Open `http://localhost:5173` in your browser
2. Sign in with your test account
3. Open Developer Tools (F12)
4. Go to Console tab
5. Paste and run this code:

```javascript
(async () => {
  try {
    const token = await window.Clerk.session.getToken();
    console.log('\n🔑 Auth Token (valid for 1 hour):\n');
    console.log(token);
    console.log('\n📋 Copy this token and set it as AUTH_TOKEN environment variable\n');
    console.log('PowerShell: $env:AUTH_TOKEN="' + token + '"');
    console.log('Bash: export AUTH_TOKEN="' + token + '"');
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = new Date(payload.exp * 1000);
    console.log('\n⏰ Token expires at:', expiry.toLocaleString());
  } catch (error) {
    console.error('Error getting token:', error);
  }
})();
```

6. Copy the token from the console output
7. Set it as an environment variable in PowerShell:
   ```powershell
   $env:AUTH_TOKEN="your-token-here"
   ```

## Running the Automated Test

```powershell
cd apps/backend
pnpm test:xlsx-export
```

Or pass the token directly:

```powershell
pnpm tsx test-xlsx-export.ts "your-token-here"
```

## What the Test Creates

The automated test creates a workbook with 3 sheets:

### Sheet 1: Budget Summary
- **Headers**: Category, Q1, Q2, Q3, Q4, Total (bold, blue background, white text)
- **Revenue row**: Values for each quarter with SUM formula in Total column
- **Expenses row**: Values for each quarter with SUM formula in Total column
- **Profit row**: Formulas calculating Q revenue - expenses (bold, green background)
- **Average row**: AVERAGE formulas for each quarter (italic, gray text)

### Sheet 2: Product Sales
- **Headers**: Product, Units Sold, Price, Revenue (bold, red background, white text)
- **Product rows**: 3 products with revenue calculated as Units × Price
- **Total row**: SUM formulas for totals (bold, underlined)

### Sheet 3: Employees
- **Headers**: Name, Department, Salary, Years, Status (bold, purple background, white text)
- **Employee rows**: 3 employee records
- **Statistics**: Average Salary and Total Payroll with formulas (bold, gray background)

## Manual Verification

After the test completes, it will generate `test-export.xlsx` in the `apps/backend` directory.

Open this file in **Excel** or **LibreOffice Calc** and verify:

### ✅ Sheet 1: Budget Summary
- [ ] Headers (A1:F1) are bold with blue (#4F46E5) background and white text
- [ ] Cell F2 shows **230000** (sum of 50000+55000+60000+65000)
- [ ] Cell F3 shows **135000** (sum of 30000+32000+35000+38000)
- [ ] Cell F4 shows **95000** (230000-135000)
- [ ] Cells B4:E4 calculate correctly (20000, 23000, 25000, 27000)
- [ ] Row 4 (Profit) has green (#10B981) background with white text
- [ ] Row 6 shows correct averages
- [ ] Row 6 is italic with gray text

### ✅ Sheet 2: Product Sales
- [ ] Headers (A1:D1) are bold with red (#EF4444) background and white text
- [ ] Cell D2 shows **4498.50** (150 × 29.99)
- [ ] Cell D3 shows **11497.70** (230 × 49.99)
- [ ] Cell D4 shows **8999.11** (89 × 99.99)
- [ ] Cell B5 shows **469** (total units: 150+230+89)
- [ ] Cell D5 shows **24995.31** (total revenue)
- [ ] Row 5 (Total) is bold and underlined

### ✅ Sheet 3: Employees
- [ ] Headers (A1:E1) are bold with purple (#8B5CF6) background and white text
- [ ] Three employee records present with correct data
- [ ] Cell C6 shows **85000** (average of 95000, 78000, 82000)
- [ ] Cell C7 shows **255000** (sum of salaries)
- [ ] Rows 6-7 have gray (#F3F4F6) background

### ✅ General Checks
- [ ] All sheet names are correct (Budget Summary, Product Sales, Employees)
- [ ] No formula errors (#REF!, #VALUE!, #DIV/0!, etc.)
- [ ] Numbers display with proper precision (decimals for money)
- [ ] Text is readable and not truncated
- [ ] Columns auto-fit content width appropriately
- [ ] File opens without errors
- [ ] All formulas are editable (not hard-coded values)
- [ ] Changing a source cell updates dependent formulas correctly

## Testing Specific Features

### Formula Export
1. Click on cells with formulas (F2, F3, F4, etc.)
2. Verify the formula bar shows the correct formula (e.g., `=SUM(B2:E2)`)
3. Change a source value and verify the formula recalculates

### Formatting Export
1. Check that bold text appears bold
2. Check that italic text appears italic
3. Check that underlined text appears underlined
4. Verify background colors match expectations
5. Verify text colors match expectations (especially white text on colored backgrounds)

### Multi-Sheet Export
1. Verify all 3 sheets exist in the exported file
2. Check that sheet names match (Budget Summary, Product Sales, Employees)
3. Navigate between sheets to ensure all data is present

### Edge Cases to Test Manually

Create additional workbooks and test:

1. **Empty cells**: Workbook with sparse data
2. **Large numbers**: Values > 1 million, scientific notation
3. **Special characters**: Text with quotes, commas, newlines
4. **Long formulas**: Complex nested formulas
5. **Cross-sheet references**: Formulas referencing other sheets (if supported)
6. **Date values**: Test date formatting
7. **Percentage values**: Test percentage formatting

## Common Issues and Solutions

### Issue: "AUTH_TOKEN not provided"
**Solution**: Make sure you've set the AUTH_TOKEN environment variable or passed it as an argument.

### Issue: "HTTP 401: Unauthorized"
**Solution**: Token may have expired (valid for 1 hour). Generate a new token using the browser console script.

### Issue: "Connection refused to localhost:3001"
**Solution**: Backend server is not running. Start it with `pnpm dev` in apps/backend.

### Issue: Formulas show as text in Excel
**Solution**: This shouldn't happen with ExcelJS. Check that formulas start with `=` in the source data.

### Issue: Colors don't match
**Solution**: Some color precision may be lost in conversion. Check that colors are "close enough" and readable.

### Issue: Column widths are too narrow/wide
**Solution**: The auto-width calculation is an estimate. You can manually adjust in Excel.

## Success Criteria

The XLSX export test is considered successful if:

1. ✅ File exports without errors
2. ✅ File opens in Excel/LibreOffice without errors
3. ✅ All sheets are present with correct names
4. ✅ All cell values are correct
5. ✅ All formulas calculate correctly
6. ✅ All formatting is applied (bold, italic, underline, colors)
7. ✅ Formulas are editable and recalculate when source cells change
8. ✅ No data corruption or loss

## Next Steps After Testing

Once XLSX export is verified:

1. Mark the `test-xlsx-export` todo as completed
2. Document any issues or limitations discovered
3. Consider edge cases that need additional handling
4. Update XLSX export service if improvements are needed
5. Add any additional tests for edge cases
6. Proceed to next todo item

## Additional Resources

- ExcelJS Documentation: https://github.com/exceljs/exceljs
- XLSX Format Specification: https://docs.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/
- HyperFormula Documentation: https://hyperformula.handsontable.com/
