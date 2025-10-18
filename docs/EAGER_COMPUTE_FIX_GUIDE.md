# Eager Compute Fix Guide

**Goal:** Remove redundant recompute calls so AI-written formulas show computed values immediately.

---

## Quick Summary

**Problem:** UI briefly shows `"=SUM(A1:A10)"` instead of `55` because recompute is delayed by `setTimeout`.

**Root Cause:** `operations.ts` already does eager compute, but AI flow adds 3 more redundant recomputes with delays.

**Fix:** Delete ~20 lines of code in 3 files (no new code needed).

---

## Step 1: Remove setTimeout Recompute in MainLayout (Lines 247-256)

### File: `client/src/components/layout/MainLayout.tsx`

### Find this code (around line 247):
```typescript
operations.forEach(op => {
  try {
    if (op.cell === null) {
      clearCell(op.address);
    } else {
      setCell(op.address, op.cell);
    }
  } catch (err) {
    logAIInteraction('Error applying operation', { op, error: err });
  }
});

// Force recompute formulas after AI operations
setTimeout(() => {
  try {
    console.log('[AI-Workbook] 🔄 Triggering formula recompute...');
    recompute();  // ← DELETE THIS ENTIRE BLOCK
  } catch (err) {
    logAIInteraction('Error recomputing formulas', err);
  }
}, 0);
```

### Replace with:
```typescript
operations.forEach(op => {
  try {
    if (op.cell === null) {
      clearCell(op.address);
    } else {
      setCell(op.address, op.cell);
    }
  } catch (err) {
    logAIInteraction('Error applying operation', { op, error: err });
  }
});
// Removed setTimeout recompute - operations.ts already handles eager compute
```

**Why:** `setCell()` and `clearCell()` already trigger eager recompute via `applyOperations(..., { sync: true })`. The setTimeout just delays the UI update.

---

## Step 2: Remove Microtask Recompute in useWorkbook (Lines ~120)

### File: `client/src/lib/workbook/useWorkbook.ts`

### Find this code (around line 115):
```typescript
const setCell = useCallback((address: string, cell: Cell) => {
  if (!currentSheetId) return;
  updateWorkbook(wb => {
    const op: EditCellOp = {
      type: 'editCell',
      sheetId: currentSheetId,
      address,
      cell,
    };
    applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
    return wb;
  });
  // Ensure formulas are recomputed promptly after programmatic edits.
  Promise.resolve().then(() => {  // ← DELETE THIS ENTIRE BLOCK
    if (enableFormulas) {
      try { recompute(); } catch (e) { /* best-effort */ }
    }
  });
}, [currentSheetId, updateWorkbook]);
```

### Replace with:
```typescript
const setCell = useCallback((address: string, cell: Cell) => {
  if (!currentSheetId) return;
  updateWorkbook(wb => {
    const op: EditCellOp = {
      type: 'editCell',
      sheetId: currentSheetId,
      address,
      cell,
    };
    applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
    return wb;
  });
  // Removed microtask recompute - applyOperations already handles it with sync:true
}, [currentSheetId, updateWorkbook]);
```

**Why:** `applyOperations` already computed formulas synchronously. The `Promise.resolve().then()` schedules a redundant recompute.

---

## Step 3: Remove Microtask Recompute in clearCell (Lines ~145)

### File: `client/src/lib/workbook/useWorkbook.ts`

### Find this code (around line 140):
```typescript
const clearCell = useCallback((address: string) => {
  if (!currentSheetId) return;
  updateWorkbook(wb => {
    const op: DeleteCellOp = {
      type: 'deleteCell',
      sheetId: currentSheetId,
      address,
    };
    applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
    return wb;
  });
  // Prompt an immediate recompute to keep computed cache in sync.
  Promise.resolve().then(() => {  // ← DELETE THIS ENTIRE BLOCK
    if (enableFormulas) {
      try { recompute(); } catch (e) { /* swallow */ }
    }
  });
}, [currentSheetId, updateWorkbook]);
```

### Replace with:
```typescript
const clearCell = useCallback((address: string) => {
  if (!currentSheetId) return;
  updateWorkbook(wb => {
    const op: DeleteCellOp = {
      type: 'deleteCell',
      sheetId: currentSheetId,
      address,
    };
    applyOperations(wb, [op], { hydration: hfRef.current || undefined, sync: true });
    return wb;
  });
  // Removed microtask recompute - applyOperations already handles it with sync:true
}, [currentSheetId, updateWorkbook]);
```

**Why:** Same reason as Step 2.

---

## Step 4: Remove Debounced Recompute in useEffect (Lines 400-408)

### File: `client/src/lib/workbook/useWorkbook.ts`

### Find this code (around line 395):
```typescript
// Recompute when workbook changes (debounced)
useEffect(() => {
  if (!enableFormulas || !isDirty) return;
  
  const timer = setTimeout(() => {
    recompute();  // ← DELETE THIS ENTIRE EFFECT
  }, 300); // Debounce 300ms
  
  return () => clearTimeout(timer);
}, [workbook, isDirty, enableFormulas, recompute]);
```

### Replace with:
```typescript
// Removed debounced recompute effect - eager compute in applyOperations handles all formula updates
```

**Why:** This effect fires on EVERY workbook change, causing a 4th recompute. Eager compute in `operations.ts` already handles formula updates.

---

## Testing After Fix

### Manual Test:
1. Open the app
2. Open chat sidebar
3. Set A1:A10 to values [1,2,3,4,5,6,7,8,9,10]
4. Send chat message: "Set B1 to =SUM(A1:A10)"
5. **Expected:** B1 immediately shows `55` (not the formula string)
6. **Expected:** Console shows only 1 recompute log (search for `[HF-ops]`)

### Automated Test:
```typescript
// Add this test to useWorkbook.test.ts or ai-formula-integration.test.ts
test('AI formulas show computed values immediately', () => {
  const { workbook, setCell, getCellValue, currentSheetId } = useWorkbook();
  
  // Set up data
  setCell('A1', { raw: 10 });
  
  // AI writes formula
  setCell('B1', { formula: '=A1*2' });
  
  // Check computed value is written immediately (no setTimeout delay)
  const cell = getCellValue('B1');
  expect(cell?.formula).toBe('=A1*2');
  expect(cell?.computed?.v).toBe(20); // ← Should pass after fix
});
```

### Console Verification:
Before fix, you'll see:
```
[HF-ops] Starting recompute...
[HF-ops] Syncing affected cells...
[HF-ops] Calling recomputeAndPatchCache...
[HF-ops] recompute result: { updatedCells: 1, ... }
[AI-Workbook] 🔄 Triggering formula recompute...  ← REDUNDANT
[HF-ops] Starting recompute...  ← REDUNDANT
[HF-ops] recompute result: { updatedCells: 0, ... }  ← No changes, wasteful
```

After fix, you'll see:
```
[HF-ops] Starting recompute...
[HF-ops] Syncing affected cells...
[HF-ops] Calling recomputeAndPatchCache...
[HF-ops] recompute result: { updatedCells: 1, ... }
(no redundant logs)
```

---

## Commit Message

```
fix: remove redundant formula recomputes in AI flow

The operations.ts module already performs eager compute when applying
operations (via applyOperations with sync:true). This removes 3 redundant
recompute calls that were causing:
1. Unnecessary CPU usage (4x recomputes instead of 1x)
2. Delayed UI updates (setTimeout caused formulas to flash briefly)

Changes:
- MainLayout.tsx: Removed setTimeout recompute after AI operations
- useWorkbook.ts: Removed Promise.resolve recomputes in setCell/clearCell
- useWorkbook.ts: Removed debounced recompute useEffect

Result: AI-written formulas now show computed values immediately,
just like Excel. No more formula string flashing in the UI.

Refs: #eager-compute, #ai-chat, #hyperformula
```

---

## Verification Checklist

- [ ] Deleted setTimeout block in MainLayout.tsx
- [ ] Deleted Promise.resolve blocks in useWorkbook.ts (2 places)
- [ ] Deleted debounced useEffect in useWorkbook.ts
- [ ] Ran manual test: AI formula shows computed value immediately
- [ ] Checked console: Only 1 recompute log per operation
- [ ] Ran test suite: `npm test -- ai-formula`
- [ ] No visible formula strings in UI (unless cell is in edit mode)
- [ ] Performance improved: recompute time reduced by ~75%

---

## Rollback Plan (If Something Breaks)

If after fix the UI stops showing computed values:

1. Check `operations.ts` line 480: Ensure `options.sync !== false` check exists
2. Check `useWorkbook.ts` line 115: Ensure `applyOperations` has `sync: true`
3. Check console for `[HF-ops]` logs — if missing, hydration failed
4. Git revert the changes and open a GitHub issue with:
   - Console logs
   - Screenshot of the issue
   - Steps to reproduce

---

## Summary

**Before:**
- 4 recomputes per AI operation
- Formula strings flash in UI
- Wasted CPU cycles

**After:**
- 1 recompute per AI operation
- Computed values show immediately
- Clean, efficient code

**Effort:** ~1 hour (mostly testing)  
**Risk:** Low (only deleting redundant code, core logic unchanged)  
**Benefit:** Better UX + 75% faster recompute
