# Eager Compute Implementation Assessment

**Date:** October 18, 2025  
**Scope:** Review whether Nexcell implements "eager compute" (Option A) correctly  
**Status:** ⚠️ **Partial Implementation — Needs Minor Fixes**

---

## Executive Summary

**You are 95% there.** The core eager compute infrastructure exists in `operations.ts` and works correctly. However, the AI chat flow has **redundant, delayed recompute logic** that causes formulas to briefly show as text before displaying computed values.

**Fixing this requires deleting ~10 lines of code**, not a major refactor.

---

## Current Architecture Review

### ✅ What's Working (Already Implemented)

#### 1. Operations System with Eager Compute (`operations.ts` lines 480-570)
```typescript
// After applying operations, check if recompute needed
if (options.sync !== false && affectedRanges.length > 0 && !options.skipRecompute) {
  // Get or create HyperFormula instance
  let hydrationToUse = options.hydration || getOrCreateHydration(workbook);
  
  // Sync affected cells to HyperFormula
  for (const range of affectedRanges) {
    // Update HF with new cell contents
    hydrationToUse.hf.setCellContents(...);
  }
  
  // Recompute and patch computed values back to JSON
  recomputeAndPatchCache(workbook, hydrationToUse, { affectedRanges });
}
```

**This is exactly Option A (eager compute):**
- ✅ HyperFormula is hydrated from workbook
- ✅ Operations apply changes to JSON workbook
- ✅ Affected cells are synced to HF immediately
- ✅ HF recomputes formulas synchronously
- ✅ `cell.computed.v` is written back to JSON
- ✅ All happens in the same call stack (no setTimeout)

#### 2. HyperFormula Integration (`hyperformula.ts`)
- ✅ `hydrateHFFromWorkbook()` creates HF instance from JSON
- ✅ `recomputeAndPatchCache()` reads HF results → writes `computed.v/t/ts/hfVersion`
- ✅ `getOrCreateHydration()` reuses existing HF instance or creates new one
- ✅ Batch operations via `suspendEvaluation`/`resumeEvaluation` (TODO but not blocking)

#### 3. Workbook Hook (`useWorkbook.ts`)
- ✅ `setCell()` and `clearCell()` call `applyOperations()` with `sync: true`
- ✅ HF instance persisted in `hfRef` across renders
- ✅ Hydration attached to `workbook.hf` for reuse

---

### ❌ What's Broken (Needs Fixing)

#### Problem 1: Duplicate Recompute in AI Chat Flow (`MainLayout.tsx` lines 247-256)

**Current code:**
```typescript
// Apply operations
operations.forEach(op => {
  setCell(op.address, op.cell);  // This calls applyOperations with sync:true → recomputes
});

// Then ANOTHER recompute is scheduled!
setTimeout(() => {
  recompute();  // ← REDUNDANT and DELAYS the computed value update
}, 0);
```

**Why this is broken:**
1. `setCell()` already triggers eager recompute via `applyOperations(..., { sync: true })`
2. The `setTimeout` schedules a SECOND recompute on the next tick
3. React renders the workbook state BEFORE the `setTimeout` fires
4. **Result:** UI shows `"=SUM(A1:A10)"` for 1 frame, then shows `55` after setTimeout

**Fix:** Delete lines 247-256. The recompute already happened inside `setCell()`.

---

#### Problem 2: Microtask Recompute in `useWorkbook.ts` (lines 120, 145)

**Current code:**
```typescript
const setCell = useCallback((address: string, cell: Cell) => {
  updateWorkbook(wb => {
    applyOperations(wb, [op], { hydration: hfRef.current, sync: true }); // ← Already recomputes!
    return wb;
  });
  
  // Then ANOTHER recompute is scheduled!
  Promise.resolve().then(() => {
    if (enableFormulas) recompute();  // ← REDUNDANT
  });
}, []);
```

**Why this is broken:**
- `applyOperations` already computed formulas with `sync: true`
- The `Promise.resolve().then()` schedules a THIRD recompute (first was in operations, second in MainLayout setTimeout)
- This is "defensive programming" that became redundant after operations.ts was fixed

**Fix:** Delete the `Promise.resolve().then()` blocks after `setCell()` and `clearCell()`.

---

#### Problem 3: Debounced Recompute in `useWorkbook` (lines 400-408)

**Current code:**
```typescript
useEffect(() => {
  if (!enableFormulas || !isDirty) return;
  
  const timer = setTimeout(() => {
    recompute();  // ← Fires 300ms after ANY workbook change
  }, 300);
  
  return () => clearTimeout(timer);
}, [workbook, isDirty, enableFormulas]);
```

**Why this is broken:**
- Fires on EVERY workbook change, even non-formula edits
- Causes FOURTH recompute (operations sync → setCell microtask → MainLayout setTimeout → debounced useEffect)
- Wastes CPU and delays UI updates

**Fix:** Remove this effect entirely. Eager compute in `applyOperations` handles it.

---

## Comparison with "Option A" Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| **1. AI modifies JSON** | ✅ Working | `setCell()` writes to workbook via operations |
| **2. Create HF instance** | ✅ Working | `getOrCreateHydration()` in operations.ts |
| **3. Load workbook into HF** | ✅ Working | `hydrateHFFromWorkbook()` + patch updates |
| **4. Compute formulas** | ⚠️ Works but delayed | Happens in operations, but UI updates are delayed by setTimeout |
| **5. Destroy HF instance** | ✅ Working | `hfRef` cleanup in useEffect unmount |
| **Sync behavior (no setTimeout)** | ❌ Broken | AI flow adds setTimeout, defeating eager compute |
| **Write computed.v immediately** | ✅ Working | `recomputeAndPatchCache()` writes synchronously |
| **UI shows values, not formulas** | ❌ Broken | Delay causes formulas to flash briefly |

---

## What Happens Today vs. What Should Happen

### Current (Broken) Flow:
```
User: "Set B1 to =SUM(A1:A10)"
  ↓
AI sends: { type: 'setCellFormula', address: 'B1', formula: '=SUM(A1:A10)' }
  ↓
MainLayout calls: setCell('B1', { formula: '=SUM(A1:A10)' })
  ↓
useWorkbook.setCell() calls: applyOperations(..., { sync: true })
  ↓
operations.ts: writes formula → syncs to HF → computes → writes computed.v = 55
  ↓
React renders: workbook state updated → UI should show 55 ✅
  ↓
BUT THEN...
  ↓
Promise.resolve().then() fires → calls recompute() again (redundant)
  ↓
setTimeout(0) in MainLayout fires → calls recompute() again (redundant)
  ↓
300ms later: debounced useEffect fires → calls recompute() again (redundant)
  ↓
Result: 4 recomputes instead of 1, and UI updates are delayed
```

### Fixed Flow (Option A):
```
User: "Set B1 to =SUM(A1:A10)"
  ↓
AI sends: { type: 'setCellFormula', address: 'B1', formula: '=SUM(A1:A10)' }
  ↓
MainLayout calls: setCell('B1', { formula: '=SUM(A1:A10)' })
  ↓
useWorkbook.setCell() calls: applyOperations(..., { sync: true })
  ↓
operations.ts: writes formula → syncs to HF → computes → writes computed.v = 55
  ↓
React renders: workbook state updated → UI shows 55 immediately ✅
  ↓
DONE. No redundant recomputes, no setTimeout delays.
```

---

## How Hard to Refactor?

### Difficulty: **EASY** (1-2 hours)

You are NOT missing infrastructure. The core eager compute is **already implemented correctly** in `operations.ts`. You just need to:

1. **Delete redundant recompute calls** (3 locations)
2. **Test that UI shows computed values immediately**
3. **Remove defensive "just in case" recomputes** that predated the operations.ts fix

### Changes Required:

| File | Line Range | Action | Reason |
|------|-----------|--------|--------|
| `MainLayout.tsx` | 247-256 | **DELETE** setTimeout recompute block | operations.ts already did it |
| `useWorkbook.ts` | ~120 | **DELETE** Promise.resolve recompute | operations.ts already did it |
| `useWorkbook.ts` | ~145 | **DELETE** Promise.resolve recompute | operations.ts already did it |
| `useWorkbook.ts` | 400-408 | **DELETE** debounced useEffect recompute | operations.ts already did it |

**Total lines removed:** ~20 lines  
**Total lines added:** 0 lines

This is a **DELETION-ONLY refactor** — no new code needed!

---

## Telemetry & Safety (Already Implemented)

Your codebase already has:
- ✅ `cell.computed.hfVersion` tracking (prevents stale cache)
- ✅ `cell.computed.ts` timestamp (audit trail)
- ✅ `cell.computed.computedBy` attribution
- ✅ Warning logs for HF errors
- ✅ Undo/redo with inverse actions

You **don't need** to add these — they exist and work.

---

## Performance Considerations

### Current Performance:
- ❌ 4 recomputes per AI operation (wasted CPU)
- ❌ setTimeout delays cause visible formula flashing

### After Fix:
- ✅ 1 recompute per AI operation (optimal)
- ✅ UI updates immediately (no flashing)

### Future Optimizations (Not Needed Now):
1. **Web Worker for HF** (if sheets >10k cells) — Medium effort
2. **Batch AI operations** (apply 50 edits, compute once) — Already possible via `suspendEvaluation`
3. **Incremental hydration** (only sync changed cells) — Already implemented via `hydrateHFFromWorkbookPatch`

---

## Test Plan (After Fix)

### Manual Test:
1. Open chat sidebar
2. Type: "Set B1 to =SUM(A1:A10)" where A1:A10 contains [1,2,3,4,5,6,7,8,9,10]
3. **Expected:** B1 immediately shows `55` (not `"=SUM(A1:A10)"`)
4. **Expected:** Console shows 1 recompute log, not 4

### Automated Test:
```typescript
test('AI chat formulas show computed values immediately', () => {
  const { setCell, getCellValue } = useWorkbook();
  
  // Simulate AI action
  setCell('A1', { raw: 10 });
  setCell('B1', { formula: '=A1*2' });
  
  // Check computed value is written immediately
  const cell = getCellValue('B1');
  expect(cell?.formula).toBe('=A1*2');
  expect(cell?.computed?.v).toBe(20); // ← Should pass after fix
});
```

---

## Recommendation

**Approve Option A (eager compute).** You've already built it — just remove the redundant recompute calls that are defeating it.

**Do NOT implement Option B (lazy compute)** — it's more complex and provides worse UX (formulas show until user hovers/clicks).

**Do NOT implement worker pool yet** — current sync approach is fast enough for sheets <10k cells. Add workers only if you see >100ms recompute times in telemetry.

---

## Next Steps

1. ✅ **Delete redundant recomputes** (see todo list)
2. ✅ **Run test:** AI writes formula → UI shows computed value immediately
3. ✅ **Monitor telemetry:** Confirm 1 recompute per operation, not 4
4. ✅ **Update docs:** Mark "eager compute" as implemented
5. 🔜 **Future:** Add worker pool if sheets grow beyond 10k cells

---

## Conclusion

**You already have Option A (eager compute) working in `operations.ts`.**  

The only problem is that **AI chat flow adds extra recompute calls** that delay the UI update and waste CPU.

**Fix:** Delete ~20 lines of redundant recompute code.  
**Result:** UI shows computed values immediately, just like Excel.

**Estimated time to fix:** 1-2 hours (mostly testing).

---

## References

- `client/src/lib/workbook/operations.ts` (lines 480-570) — Eager compute implementation
- `client/src/lib/workbook/hyperformula.ts` — HF integration
- `client/src/lib/workbook/useWorkbook.ts` — Workbook hook with HF lifecycle
- `client/src/components/layout/MainLayout.tsx` (lines 247-256) — Redundant recompute
- HyperFormula docs: https://hyperformula.handsontable.com/guide/batch-operations.html
