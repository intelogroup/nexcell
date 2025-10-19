# AI Prompt Examples and Expected Operations

This file contains 22 real-world user prompts mapped to the expected AI operation sequences. Use these as test-cases for intent recognition, operation generation, and executor integration. Each example includes:

- user_prompt: the natural language request
- expected_operations: a short, precise ordered list of WorkbookOperation objects or sequences the AI should produce
- validation_criteria: how to confirm the operations are correct

---

1) Create a simple monthly budget workbook

user_prompt: "Create a monthly budget workbook for 'Marketing' with sheets 'Inputs' and 'Budget'. On 'Inputs' add headers: Category, Jan, Feb, Mar. On 'Budget' create Categories in A2:A6 and link Jan-Mar cells to Inputs by formula."

expected_operations:
- CreateWorkbook { name: "Marketing Budget", sheets: ["Inputs","Budget"] }
- SetCells { sheet: "Inputs", cells: [{ ref: "A1", raw: "Category" }, { ref: "B1", raw: "Jan" }, { ref: "C1", raw: "Feb" }, { ref: "D1", raw: "Mar" }] }
- SetCells { sheet: "Budget", cells: [{ ref: "A2", raw: "Advertising" }, { ref: "A3", raw: "Events" }, { ref: "A4", raw: "SaaS" }, { ref: "A5", raw: "Contractors" }] }
- SetFormula { sheet: "Budget", cell: "B2", formula: "=Inputs!B2" } (and similar for other months/cells or a SetFormula batch)
- Compute { reason: "initial compute" }

validation_criteria:
- Workbook has two sheets named correctly
- Headers on Inputs present
- Budget cells reference Inputs via formulas
- After compute, computed values mirror Inputs values

---

2) Add variance % column for actual vs budget

user_prompt: "On sheet 'Budget' add an 'Actual' column after 'Mar' and a 'Variance %' column that computes (Actual - Budget)/Budget formatted as percentage. Fill variance formula for all categories."

expected_operations:
- SetCells { sheet: "Budget", cells: [{ ref: "E1", raw: "Actual" }, { ref: "F1", raw: "Variance %" }] }
- SetFormula batch { sheet: "Budget", cells: [ { cell: "F2", formula: "=IF(B2=0,NA(),(E2-B2)/B2)", numFmt: "0.00%" }, ... fill for F3:F5 ] }
- Compute {}

validation_criteria:
- 'Actual' and 'Variance %' columns created
- Variance formula present and uses guard for divide-by-zero
- Cells formatted as percentage

---

3) Consolidate three departmental sheets into a rollup

user_prompt: "I have sheets: 'Sales', 'Ops', 'HR' each with same structure: Category, Amount. Create 'Consolidated' sheet that sums Amount by Category across all three sheets."

expected_operations:
- AddSheet { name: "Consolidated" }
- SetCells { sheet: "Consolidated", cells: [ { ref: "A1", raw: "Category" }, { ref: "B1", raw: "Total" } ] }
- For each category row: SetFormula { sheet: "Consolidated", cell: "B2", formula: "=SUMIF(Sales!A:A,A2,Sales!B:B)+SUMIF(Ops!A:A,A2,Ops!B:B)+SUMIF(HR!A:A,A2,HR!B:B)" }
- Compute {}

validation_criteria:
- Consolidated sheet exists
- Sum formulas referencing three sheets
- Compute results equal manual sums of sheet amounts

---

4) Import CSV and create pivot-like summary

user_prompt: "Import the attached CSV of transactions into a sheet 'Data' (columns: Date, Dept, Category, Amount). Create a new sheet 'Summary' with total Amount by Dept."

expected_operations:
- ImportXLSX or ImportCSV { targetSheet: "Data", fileName: "transactions.csv" }
- AddSheet { name: "Summary" }
- SetCells { sheet: "Summary", cells: [{ ref: "A1", raw: "Dept" }, { ref: "B1", raw: "Total" }] }
- SetFormula { sheet: "Summary", cell: "B2", formula: "=SUMIF(Data!B:B,A2,Data!D:D)" } (fill down)
- Compute {}

validation_criteria:
- Data sheet contains imported rows
- Summary totals match grouped sums from Data

---

5) Fix #DIV/0! errors by adding IF guard

user_prompt: "I see #DIV/0! errors in column 'D' of sheet 'Forecast'. Replace formula with a version that returns 0 when denominator is zero."

expected_operations:
- Find cells in Forecast!D:D with error values (operation can return locations)
- SetFormula batch { sheet: "Forecast", cells: [ { cell: "D2", formula: "=IF(ISERROR(originalFormula),IF(denominator=0,0,originalFormula),originalFormula)" } ] }
- Compute {}

validation_criteria:
- Previously error-producing cells now compute to 0 or valid values
- Formulas include a divide-by-zero guard or ISERROR check

---

6) Create Year-to-Date (YTD) running total

user_prompt: "On 'Sales' sheet calculate a YTD running total in column 'C' where C2 = B2 and C3 = C2 + B3 etc. Apply for all rows."

expected_operations:
- SetFormula batch { sheet: "Sales", cells: [ { cell: "C2", formula: "=B2" }, { cell: "C3", formula: "=C2+B3" }, ... ] }
- Compute {}

validation_criteria:
- Column C contains cumulative sums matching expected running totals

---

7) Format currency and headers

user_prompt: "Format columns B:D as currency with 2 decimals on sheet 'Budget' and make the header row bold with background #f3f4f6."

expected_operations:
- ApplyFormat { sheet: "Budget", range: "B:D", formats: { numFmt: "$#,##0.00" } }
- ApplyFormat { sheet: "Budget", range: "1:1", formats: { fontBold: true, fill: "#f3f4f6" } }

validation_criteria:
- Columns B-D have currency numFmt
- Header row styled bold with given background

---

8) Rename sheet and update cross-sheet formulas

user_prompt: "Rename sheet 'OldName' to 'NewName' and update any formulas referencing 'OldName' accordingly."

expected_operations:
- RenameSheet { from: "OldName", to: "NewName" }
- Scan all sheets for formulas containing 'OldName!' and update to 'NewName!'
- Compute {}

validation_criteria:
- Sheet renamed
- No formulas still referencing 'OldName'

---

9) Create conditional formatting for low inventory

user_prompt: "On 'Inventory' sheet add conditional formatting to column 'C' (Quantity) to apply red fill when value < ReorderLevel in column D."

expected_operations:
- DefineConditionalFormat { sheet: "Inventory", range: "C2:C1000", rule: "C2 < D2", format: { fill: "#ffcccc" } }

validation_criteria:
- Conditional rule exists and marks rows where C < D

---

10) Batch update number formats from comma decimals to dot decimals

user_prompt: "Change number format in sheet 'Imported' from European style (1.234,56) to US style (1,234.56) for columns E:G."

expected_operations:
- ApplyFormat { sheet: "Imported", range: "E:G", formats: { numFmt: "#,##0.00" } }
- Optionally reparse text-to-number if values are strings using SetCells with parsed numbers
- Compute {}

validation_criteria:
- Cells in E:G are numeric types with US-style formatting

---

11) Create named range and use in formula

user_prompt: "Define named range 'Expenses' as Expenses!A2:B100 and compute total with =SUM(Expenses[Amount]) on sheet 'Summary' cell B2."

expected_operations:
- DefineNamedRange { name: "Expenses", sheet: "Expenses", range: "A2:B100" }
- SetFormula { sheet: "Summary", cell: "B2", formula: "=SUM(Expenses[Amount])" }
- Compute {}

validation_criteria:
- Named range exists and formula uses it
- Compute returns sum of the named range's Amount column

---

12) Fill down a formula across table rows

user_prompt: "On sheet 'Invoices' column 'D' compute Tax as Amount*0.07 and fill down for existing rows 2:200."

expected_operations:
- SetFormula batch { sheet: "Invoices", cells: [ { cell: "D2", formula: "=B2*0.07" }, { cell: "D3", formula: "=B3*0.07" }, ... through D200 ] }
- Compute {}

validation_criteria:
- D2:D200 contain formulas referencing row-relative Amounts

---

13) Remove duplicate rows based on columns A:C

user_prompt: "On sheet 'Leads' remove duplicate rows where columns A:C have the same values, keeping the first occurrence."

expected_operations:
- FindDuplicates { sheet: "Leads", keyCols: ["A","B","C"] }
- DeleteRows { sheet: "Leads", rows: [list of duplicate row indexes] }
- Compute {}

validation_criteria:
- Remaining rows are unique by A:C

---

14) Create a chart config for monthly sales

user_prompt: "Create a bar chart on sheet 'Dashboard' showing monthly sales from Sales!A1:M2 (labels in row 1, values in row 2)."

expected_operations:
- AddChart { sheet: "Dashboard", type: "bar", dataRange: "Sales!A1:M2", title: "Monthly Sales", position: { col: 2, row: 2 } }

validation_criteria:
- Chart object exists on Dashboard with correct data range and type

---

15) Protect a sheet except for column A

user_prompt: "Protect sheet 'Payroll' so users cannot edit except column A (employee IDs)."

expected_operations:
- ProtectSheet { sheet: "Payroll", editableRanges: ["A:A"], permissions: "read-only" }

validation_criteria:
- Sheet is protected and column A editable

---

16) Split full name into first and last name

user_prompt: "On 'Contacts' sheet split column 'FullName' into 'FirstName' and 'LastName' using formulas, put them in columns B and C."

expected_operations:
- SetCells { sheet: "Contacts", cells: [{ ref: "B1", raw: "FirstName" }, { ref: "C1", raw: "LastName" }] }
- SetFormula batch { sheet: "Contacts", cells: [ { cell: "B2", formula: "=LEFT(A2,IFERROR(FIND(' ',A2)-1,LEN(A2)))" }, { cell: "C2", formula: "=TRIM(MID(A2,FIND(' ',A2)+1,999))" }, ... fill down ] }
- Compute {}

validation_criteria:
- First and last names extracted correctly for common cases

---

17) Convert text amounts to numbers and trim spaces

user_prompt: "Convert column C on 'Imported' sheet from text amounts with leading/trailing spaces into numbers stored as values."

expected_operations:
- For cells in Imported!C:C that are text: SetCells { sheet: "Imported", cells: [ { ref: "C2", raw: parsedNumber }, ... ] }
- Optionally SetFormula with VALUE(TRIM()) then paste values
- Compute {}

validation_criteria:
- Column C contains numeric types and no leading/trailing spaces

---

18) Add totals row with SUBTOTAL to ignore filtered rows

user_prompt: "Add a totals row at bottom of 'Data' that computes subtotal of Amount column using SUBTOTAL(9, Data!D:D)."

expected_operations:
- SetCells { sheet: "Data", cells: [ { ref: "D999", raw: "=SUBTOTAL(9, D2:D998)" } ] }
- Compute {}

validation_criteria:
- Totals row uses SUBTOTAL and updates correctly when filters applied

---

19) Back up current workbook into a new sheet

user_prompt: "Create a backup of current workbook state in a sheet named 'Backup-YYYYMMDD-HHMM' and copy all sheets' raw values there."

expected_operations:
- Create backup sheet or multiple sheets prefixed with 'Backup-<timestamp>'
- For each existing sheet: Copy values into corresponding backup sheet using SetCells with raw values
- Compute {}

validation_criteria:
- Backup sheets exist and contain raw values matching originals

---

20) Suggest formula to compute weighted average

user_prompt: "Tell me the formula to compute weighted average of values in column B with weights in column C, and put it in Summary!B2."

expected_operations:
- SetFormula { sheet: "Summary", cell: "B2", formula: "=SUMPRODUCT(B2:B100,C2:C100)/SUM(C2:C100)" }
- Compute {}

validation_criteria:
- Formula present and computes correct weighted average

---

21) Automate recurring monthly sheet creation

user_prompt: "Create a new sheet for next month named '2025-11' based on template sheet 'MonthTemplate' and clear any values in input ranges A2:E100."

expected_operations:
- AddSheet { name: "2025-11", fromTemplate: "MonthTemplate" }
- SetCells { sheet: "2025-11", cells: [ { ref: "A2:E100", raw: null } ] }
- Compute {}

validation_criteria:
- New sheet created with template formatting and cleared inputs

---

22) Explain why a cell shows #REF! and propose fix

user_prompt: "Cell D10 on sheet 'Report' shows #REF!. Explain likely reasons and propose an automated fix."

expected_operations (explain + optional fix):
- AnalysisResponse { explanation: "#REF! typically means referenced cell was deleted or named range invalid. Check formulas referencing deleted ranges or moved sheets." }
- If user requests fix: SetFormula { sheet: "Report", cell: "D10", formula: "=IFERROR(look for alternative reference, 0)" } or attempt to repair by searching nearby ranges and rewriting formula

validation_criteria:
- Explanation present. If an automated fix applied, error resolved and formula updated sensibly.

---

Notes
- Use these examples when writing unit and integration tests for the AI operation generator.
- For operations that mention scanning or searching (find duplicates, find errors), operation-generator may return a DiscoveryOperation listing target locations followed by Set* operations.
- Keep formulas relative where appropriate and prefer guarded formulas (IF/ISERROR/IFERROR) to avoid error propagation.


