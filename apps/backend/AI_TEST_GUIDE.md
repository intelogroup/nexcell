# AI Integration E2E Testing Guide

This guide walks through manually testing the AI integration from the UI.

## Prerequisites

1. **Backend running**: `cd apps/backend && pnpm dev`
2. **Frontend running**: `cd apps/frontend && pnpm dev`
3. **OpenRouter API Key**: Set in `apps/backend/.env`
4. **User with credits**: Ensure test user has at least 15 credits (5 for plan + 10 for apply)

## Test Scenario 1: Simple SUM Formula

### Steps:

1. **Create a test workbook**
   - Navigate to http://localhost:5173
   - Sign in with your test account
   - Click "New Workbook"
   - Name it "AI Test - SUM"

2. **Add sample data**
   - Click on cell A1, enter `10`
   - Click on cell A2, enter `20`
   - Click on cell A3, enter `30`
   - Click on cell A4, enter `40`
   - Click on cell A5, enter `50`
   - Click "Save"

3. **Open AI Assistant**
   - Click the purple "AI Assistant" button in the toolbar
   - The sidebar should open on the right

4. **Generate AI Plan**
   - In the instructions textarea, enter:
     ```
     Create a SUM formula in cell A10 that adds all values from A1 to A5
     ```
   - Click "Generate Plan"
   - Wait for the plan to be generated (5 credits will be deducted)

5. **Verify Plan**
   - Check that the plan preview shows:
     - Reasoning/explanation
     - List of operations (should have 1 operation: set_cell A10)
     - No warnings (or acceptable warnings)
     - Token usage stats
   - The operation should look like:
     ```
     1. Set Sheet1!A10 to =SUM(A1:A5)
     ```

6. **Apply Plan**
   - Click "Apply Plan (10 credits)"
   - Wait for the operation to complete
   - 10 credits will be deducted

7. **Verify Result**
   - Check that cell A10 now shows `150` (the sum of 10+20+30+40+50)
   - Check that the formula bar shows `=SUM(A1:A5)` when A10 is selected
   - The workbook should show "Unsaved changes"
   - Click "Save" to persist

### Expected Results:
✅ Plan generated successfully with 1 operation
✅ 5 credits deducted for plan generation
✅ 10 credits deducted for applying plan
✅ Cell A10 contains formula `=SUM(A1:A5)`
✅ Cell A10 displays value `150`
✅ No errors in console
✅ Action logged in database

---

## Test Scenario 2: Multiple Operations

### Steps:

1. **Create new workbook** named "AI Test - Multi-Op"

2. **Generate AI Plan** with instructions:
   ```
   Create a table with headers in row 1: Name, Age, Score
   Then add 3 rows of sample data below it
   ```

3. **Verify Plan** shows multiple operations:
   - Set cells A1, B1, C1 with headers
   - Set cells with sample data

4. **Apply Plan** and verify all cells are populated

---

## Test Scenario 3: Sheet Management

### Steps:

1. **Create new workbook** named "AI Test - Sheets"

2. **Generate AI Plan** with instructions:
   ```
   Add a new sheet called "Budget" and add headers Income and Expense in A1 and B1
   ```

3. **Verify Plan** shows:
   - Add sheet operation
   - Set cell operations for headers

4. **Apply Plan** and verify new sheet exists with headers

---

## Test Scenario 4: Formatting

### Steps:

1. **Create new workbook** with some data in A1:C1

2. **Generate AI Plan** with instructions:
   ```
   Format cells A1 to C1 as bold with blue background
   ```

3. **Verify Plan** shows format_range operation

4. **Apply Plan** and verify formatting applied

---

## Test Scenario 5: Error Handling

### Steps:

1. **Test invalid instructions**:
   ```
   Do something impossible that makes no sense
   ```
   - Should either generate a sensible plan or show error

2. **Test with empty workbook**:
   - Create empty workbook
   - Try: "Sum column A"
   - Should handle gracefully

3. **Test insufficient credits**:
   - Use an account with <5 credits
   - Try to generate plan
   - Should show credit error

---

## Verification Checklist

After each test, verify:

- [ ] Credits deducted correctly (5 for plan, 10 for apply)
- [ ] Plan preview shows all information correctly
- [ ] Operations are human-readable
- [ ] Apply button is disabled while processing
- [ ] Loading states show properly
- [ ] Success/error toasts appear
- [ ] Workbook data updates correctly
- [ ] No console errors
- [ ] Actions logged in database (check `Action` table)

---

## Database Verification

To check Action logging, run this SQL query:

```sql
-- View recent AI actions
SELECT 
  id,
  type,
  message,
  applied,
  "createdAt",
  "userId",
  "workbookId"
FROM "Action"
WHERE type IN ('ai_plan', 'workbook_ops')
ORDER BY "createdAt" DESC
LIMIT 10;
```

To check credit deduction:

```sql
-- View user credits and recent transactions
SELECT 
  u.id,
  u.email,
  u.credits,
  ct.amount,
  ct.description,
  ct."createdAt"
FROM "User" u
LEFT JOIN "CreditTransaction" ct ON u.id = ct."userId"
ORDER BY ct."createdAt" DESC
LIMIT 10;
```

---

## Troubleshooting

### Plan generation fails
- Check OpenRouter API key is set in backend `.env`
- Check backend logs for errors
- Verify user has ≥5 credits

### Apply fails
- Check workbook ownership
- Verify user has ≥10 credits
- Check for operation validation errors in response

### Workbook doesn't update
- Check browser console for errors
- Verify React Query is invalidating the workbook query
- Try manually refreshing the page

### Credits not deducting
- Check credits middleware is registered
- Verify deductCredits is called after successful operations
- Check database transactions are committed

---

## Success Criteria

The AI integration is working correctly if:

1. ✅ Users can generate plans from natural language
2. ✅ Plans are previewed with all details
3. ✅ Plans can be applied successfully
4. ✅ Credits are deducted correctly (5 + 10 = 15 total)
5. ✅ Workbook data updates after apply
6. ✅ Actions are logged for audit trail
7. ✅ Error handling works for edge cases
8. ✅ UI is responsive and shows proper loading states
9. ✅ No console errors or warnings
10. ✅ Formula evaluation works correctly
