# PR: Priority-0 HF Hydration + Priority-1 Export Fidelity + AI Staged Rollout Infrastructure

## Summary

This PR closes **Priority-0** (HyperFormula hydration) and **Priority-1** (export fidelity) technical debt, plus adds the infrastructure for safe AI Plan→Act staged rollout.

**Status:** ✅ All 29 Priority-1 tests pass. Ready for internal testing.

---

## Changes

### 1. Fixed SheetJS Export Fidelity (Priority-1) ✅

**Problem:** Number formats (`numFmt`), column widths, and row heights were lost during export/import cycles.

**Fix:**
- Added `cellNF: true` to SheetJS `read()` options
- Added `cellFormula: true` and `cellStyles: true` for better preservation
- Already had correct export logic — just needed import options

**File:** `client/src/lib/workbook/adapters/sheetjs.ts`

**Impact:**
- Dates stay formatted (not serial numbers)
- Percentages stay formatted (not decimals)
- Currency stays formatted (not raw numbers)
- Column widths and row heights preserved

---

### 2. Added Priority-1 Test Suite (29 tests) ✅

**New test files:**

1. `roundtrip.formatting.test.ts` — 13 tests
   - Date formats (`mm/dd/yyyy`, date-time)
   - Percentage formats (`0.00%`, `0%`)
   - Currency formats (`"$"#,##0.00`)
   - Custom formats (scientific, fractions, text)

2. `roundtrip.layout.test.ts` — 12 tests
   - Column widths (normal, sparse, very wide)
   - Row heights (normal, sparse, very tall)
   - Hidden columns/rows
   - Layout with merges and formulas

3. `roundtrip.full.test.ts` — 4 tests
   - Full integration: formats + formulas + layout + HF recompute
   - Date/percentage formulas with formats
   - Multiple export/import cycles (stress test)

**Test Results:**
```
✅ 13/13 formatting tests pass
✅ 12/12 layout tests pass
✅ 4/4 full integration tests pass
---
✅ 29/29 Priority-1 tests PASS
```

---

### 3. Feature Flag Infrastructure ✅

**File:** `client/src/lib/feature-flags.ts`

**Purpose:** Gate AI Plan→Act behind configurable flags for staged rollout.

**Stages:**
- `internal` — Only engineering team (default)
- `beta` — Expanded beta testers
- `gradual` — Percentage-based rollout (5% → 10% → 50% → 100%)
- `public` — Available to all

**Environment variables:**
```bash
VITE_AI_PLAN_ACT_ENABLED=false  # Disabled by default in production
VITE_AI_PLAN_ACT_STAGE=internal
VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=10
```

---

### 4. Pre-Apply Safety Checks ✅

**File:** `client/src/lib/safety-checks.ts`

**Purpose:** Prevent data corruption and user frustration.

**Checks:**
1. **Backup snapshot** — Clone workbook before apply
2. **Stale plan detection** — Reject if workbook changed since plan created
3. **Final dry-run** — Compute actual diff before apply
4. **Diff comparison** — Verify actual matches expected (allow 10% tolerance)
5. **User confirmation** — Require explicit approval for large ops (>200 cells)
6. **Undo action** — Generate invertible action for rollback

---

### 5. Telemetry & Monitoring ✅

**File:** `client/src/lib/telemetry.ts`

**Purpose:** Detect issues early via metrics tracking.

**Metrics tracked:**
- Plan Validity % — % of plans that pass validation
- Apply Success % — % of applies that succeed
- Undo Rate — undos / successful applies
- Hallucination errors — References to nonexistent ranges
- Performance — Dry-run time, apply time

**Alert thresholds:**
- Apply success < 90% for 6 hours
- Undo rate > 5% for 6 hours
- Hallucination rate > 30% of failures

---

### 6. CI Integration ✅

**File:** `.github/workflows/ci-workbook.yml`

**Purpose:** Gate merges on Priority-1 tests passing.

**CI runs:**
- `roundtrip.formatting.test` (13 tests)
- `roundtrip.layout.test` (12 tests)
- `roundtrip.full.test` (4 tests)
- `hyperformula.hydration.test` (HF correctness)

**Matrix:** Node 18.x, 20.x

**Build fails if any Priority-1 test fails.**

---

### 7. Documentation ✅

- `docs/priority-1-complete.md` — Technical summary
- `docs/priority-1-pr-checklist.md` — Review checklist
- `docs/ai-staged-rollout.md` — Rollout guide (8-week plan)
- `docs/production-readiness-summary.md` — Executive summary

---

## Testing

### Automated Tests

```bash
cd client
npm test -- roundtrip.formatting.test  # 13 pass
npm test -- roundtrip.layout.test      # 12 pass
npm test -- roundtrip.full.test        # 4 pass
```

### Manual QA Checklist

- [ ] Date format preservation
- [ ] Percentage format preservation
- [ ] Currency format preservation
- [ ] Formula dependency tracking
- [ ] Undo/redo after AI apply
- [ ] Stale plan detection
- [ ] Large operation confirmation
- [ ] Export after AI changes

---

## Deployment Plan

### Stage 0: Merge & CI (This Week)
- [ ] PR reviewed and approved
- [ ] CI tests pass
- [ ] Deploy to staging

### Stage 1: Internal Testing (Week 1)
- [ ] Enable for engineering team only
- [ ] Monitor telemetry (apply success %, undo rate)
- [ ] Fix critical bugs if any

### Stage 2: Beta Testing (Week 2-3)
- [ ] Expand to 10-20 power users
- [ ] Collect feedback
- [ ] Verify no data corruption reports

### Stage 3: Gradual Rollout (Week 4-8)
- [ ] 5% → 10% → 25% → 50% → 100%
- [ ] Monitor metrics at each stage
- [ ] Rollback if thresholds breached

### Stage 4: Public Release (Week 9+)
- [ ] Feature available to all
- [ ] Documentation published
- [ ] Support team trained

---

## Rollback Plan

If critical issues detected:

```bash
# Immediate disable
VITE_AI_PLAN_ACT_ENABLED=false

# OR reduce rollout
VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=5
```

**Rollback triggers:**
- Apply success < 80% for 2 days
- Undo rate > 10% for 2 days
- >10 critical support tickets/week
- Data corruption reports

---

## Files Changed

### Core Fixes
- `client/src/lib/workbook/adapters/sheetjs.ts`

### Tests
- `client/src/lib/workbook/roundtrip.formatting.test.ts`
- `client/src/lib/workbook/roundtrip.layout.test.ts`
- `client/src/lib/workbook/roundtrip.full.test.ts`

### Infrastructure
- `client/src/lib/feature-flags.ts`
- `client/src/lib/safety-checks.ts`
- `client/src/lib/telemetry.ts`
- `.github/workflows/ci-workbook.yml`

### Documentation
- `docs/priority-1-complete.md`
- `docs/priority-1-pr-checklist.md`
- `docs/ai-staged-rollout.md`
- `docs/production-readiness-summary.md`

---

## Acceptance Criteria ✅

- [x] Priority-1 tests pass (29/29)
- [x] SheetJS preserves `numFmt`, cols, rows
- [x] Feature flags implemented
- [x] Safety checks implemented
- [x] Telemetry tracking implemented
- [x] CI integration complete
- [x] Documentation complete
- [x] Default: AI Plan→Act disabled in production

---

## Breaking Changes

None. All changes are additive and gated behind feature flags.

---

## Reviewers

@engineering-lead
@product-owner
@qa-lead

---

## Sign-Off

- [ ] Code review complete
- [ ] Tests passing in CI
- [ ] Documentation reviewed
- [ ] Deployment plan approved
- [ ] Ready to merge

---

## Post-Merge Actions

1. Deploy to staging
2. Run manual QA (8 tests)
3. Enable for internal team
4. Monitor telemetry for 3 days
5. Proceed to beta if stable
