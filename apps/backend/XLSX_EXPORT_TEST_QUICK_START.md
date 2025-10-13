# XLSX Export Test - Quick Start

## Step 1: Get Authentication Token

### Option A: From Browser (Recommended)
1. Start the frontend (if not running):
   ```powershell
   cd C:\Users\jayve\projects\nexcell\apps\frontend
   pnpm dev
   ```

2. Open http://localhost:5173 and sign in

3. Open browser Developer Tools (F12) → Console tab

4. Run this command:
   ```javascript
   (async () => {
     const token = await window.Clerk.session.getToken();
     console.log('Token:', token);
   })();
   ```

5. Copy the token

### Option B: Use Existing Token
If you have a saved token, use it directly.

## Step 2: Run the Test

Set the token and run:

```powershell
cd C:\Users\jayve\projects\nexcell\apps\backend
$env:AUTH_TOKEN="your-token-here"
pnpm test:xlsx-export
```

Or pass directly:
```powershell
pnpm tsx test-xlsx-export.ts "your-token-here"
```

## Step 3: Verify Results

The test will:
1. ✅ Create a test workbook with 3 sheets
2. ✅ Add data with formulas (SUM, AVERAGE)
3. ✅ Apply formatting (bold, colors, backgrounds)
4. ✅ Export to `test-export.xlsx`

Open `test-export.xlsx` in Excel/LibreOffice and check:
- All 3 sheets exist (Budget Summary, Product Sales, Employees)
- Formulas calculate correctly
- Formatting is applied (bold headers, colored backgrounds)
- No errors (#REF!, #VALUE!, etc.)

## What's Being Tested

### Sheet 1: Budget Summary
- Headers with blue background
- SUM formulas for quarterly totals
- Profit calculations
- AVERAGE formulas
- Green background for profit row

### Sheet 2: Product Sales  
- Headers with red background
- Revenue formulas (units × price)
- Total calculations
- Bold and underlined totals

### Sheet 3: Employees
- Headers with purple background
- Employee records
- Average salary formula
- Total payroll formula
- Gray background for statistics

## Expected Results

All formulas should calculate correctly:
- Budget Summary Total: 230,000 (revenue), 135,000 (expenses), 95,000 (profit)
- Product Sales Revenue: 4,498.50, 11,497.70, 8,999.11 (Total: 24,995.31)
- Employee Payroll: Average 85,000, Total 255,000

## Troubleshooting

**Error: AUTH_TOKEN not provided**
→ Set the environment variable or pass token as argument

**Error: HTTP 401**
→ Token expired (valid 1 hour), get a new one

**Error: Connection refused to localhost:3001**
→ Start backend: `cd apps/backend && pnpm dev`

**File doesn't open in Excel**
→ Check console for export errors, verify ExcelJS is working

## Documentation

For detailed verification checklist, see: `XLSX_EXPORT_TEST_GUIDE.md`
