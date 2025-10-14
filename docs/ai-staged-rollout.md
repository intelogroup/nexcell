# AI Plan→Act Feature: Staged Rollout Guide

## ⚠️ CRITICAL: Do NOT enable in production until all gates pass

This document describes the staged rollout process for the AI Plan→Act feature.

---

## Prerequisites (MUST PASS)

- [ ] All Priority-1 tests pass in CI (29 tests)
- [ ] Manual QA complete (see QA checklist below)
- [ ] Telemetry and monitoring deployed
- [ ] Backup/undo infrastructure tested
- [ ] Feature flags configured
- [ ] Export warnings functional

---

## Feature Flag Configuration

### Environment Variables

Control AI Plan→Act via environment variables:

```bash
# Enable/disable AI Plan→Act
VITE_AI_PLAN_ACT_ENABLED=false

# Stage: internal | beta | gradual | public
VITE_AI_PLAN_ACT_STAGE=internal

# For gradual rollout: percentage 0-100
VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=10
```

### Stages

1. **internal** (default)
   - Only allowed users (engineering team)
   - Edit `feature-flags.ts` to add user IDs to `allowedUsers`
   
2. **beta**
   - Expanded set of beta testers
   - Add beta user IDs to `allowedUsers`
   
3. **gradual**
   - Percentage-based rollout
   - Hash user ID and compare to `rolloutPercent`
   - Example: `VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=10` = 10% of users
   
4. **public**
   - Available to all users
   - Only enable after gradual rollout shows stability

---

## Staged Rollout Process

### Stage 0: Internal Testing (Week 1)

**Goal:** Verify in production environment with engineering team

```bash
# .env.production
VITE_AI_PLAN_ACT_ENABLED=true
VITE_AI_PLAN_ACT_STAGE=internal
```

**Add engineering user IDs:**

```typescript
// src/lib/feature-flags.ts
production: {
  aiPlanAct: {
    enabled: true,
    stage: 'internal',
    allowedUsers: [
      'user-id-1',
      'user-id-2',
      'user-id-3',
    ],
    // ...
  }
}
```

**Success Criteria:**
- [ ] No critical bugs in 3 days
- [ ] Apply success rate > 95%
- [ ] Undo rate < 3%
- [ ] All internal team members tested

### Stage 1: Beta Testing (Week 2-3)

**Goal:** Expand to 10-20 power users

```bash
VITE_AI_PLAN_ACT_ENABLED=true
VITE_AI_PLAN_ACT_STAGE=beta
```

**Add beta user IDs** to `allowedUsers` array.

**Success Criteria:**
- [ ] No critical bugs in 1 week
- [ ] Apply success rate > 90%
- [ ] Undo rate < 5%
- [ ] Positive user feedback
- [ ] <5 support tickets related to AI operations

### Stage 2: Gradual Rollout (Week 4-6)

**Goal:** Slowly ramp to full availability

```bash
VITE_AI_PLAN_ACT_ENABLED=true
VITE_AI_PLAN_ACT_STAGE=gradual
```

**Ramp schedule:**

| Week | Rollout % | Users | Monitor For |
|------|-----------|-------|-------------|
| 4    | 5%        | ~50   | Errors, undo rate |
| 5    | 10%       | ~100  | Apply success, performance |
| 6    | 25%       | ~250  | Support tickets |
| 7    | 50%       | ~500  | Telemetry alerts |
| 8    | 100%      | All   | Stability |

**Update rollout percent:**

```bash
# Week 4
VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=5

# Week 5
VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=10

# Week 6
VITE_AI_PLAN_ACT_ROLLOUT_PERCENT=25

# etc.
```

**Success Criteria per week:**
- [ ] Apply success rate > 90%
- [ ] Undo rate < 5%
- [ ] No spike in support tickets
- [ ] No telemetry alerts for 3+ days

**Rollback criteria:**
- Apply success < 80% for 2 days
- Undo rate > 10% for 2 days
- >10 critical support tickets in 1 week
- Data corruption reports

### Stage 3: Public Release (Week 9+)

**Goal:** Feature available to all users

```bash
VITE_AI_PLAN_ACT_ENABLED=true
VITE_AI_PLAN_ACT_STAGE=public
```

**Success Criteria:**
- [ ] All previous stages passed
- [ ] Telemetry stable for 2 weeks
- [ ] Support team trained on AI-related issues
- [ ] Documentation complete

---

## Manual QA Checklist

### Before Internal Stage:

- [ ] **Test 1: Date format preservation**
  - Create workbook with date column (`mm/dd/yyyy`)
  - Run AI operation (e.g., "add 7 days to all dates")
  - Verify dates stay formatted, not serial numbers

- [ ] **Test 2: Percentage format preservation**
  - Create workbook with percentage column (`0.00%`)
  - Run AI operation (e.g., "increase all by 10%")
  - Verify percentages stay formatted, not decimals

- [ ] **Test 3: Currency format preservation**
  - Create workbook with currency column (`"$"#,##0.00`)
  - Run AI operation (e.g., "add $100 to all")
  - Verify currency stays formatted

- [ ] **Test 4: Formula dependency tracking**
  - Create workbook with formulas (e.g., `=A1*B1`)
  - Run AI operation that changes A1
  - Verify formulas recompute correctly

- [ ] **Test 5: Undo/redo after AI apply**
  - Run AI operation
  - Click undo
  - Verify workbook returns to exact previous state
  - Click redo
  - Verify workbook returns to post-AI state

- [ ] **Test 6: Stale plan detection**
  - Create AI plan
  - Manually edit a cell that the plan references
  - Try to apply plan
  - Verify rejection with clear error message

- [ ] **Test 7: Large operation (>100 cells)**
  - Run AI operation affecting 200+ cells
  - Verify confirmation dialog appears
  - Verify apply succeeds
  - Verify undo works

- [ ] **Test 8: Export after AI changes**
  - Run AI operation
  - Export to XLSX
  - Open in Excel
  - Verify formats, formulas, layout preserved

---

## Monitoring & Alerts

### Telemetry Dashboard

Track these metrics in real-time:

- **Plan Validity %** — % of plans that pass validation
- **Apply Success %** — % of applies that succeed
- **Undo Rate** — undos / successful applies
- **Avg Plan Size** — operations per plan
- **Dry-run Errors** — count of dry-run failures
- **Hallucination Errors** — references to nonexistent ranges

### Alert Thresholds

Configure alerts when:

- Apply success < 90% for 6 hours
- Undo rate > 5% for 6 hours
- Hallucination rate > 30% of failures
- Dry-run errors > 50/hour

### Alert Channels

- **Slack:** #ai-operations-alerts
- **Email:** engineering-oncall@company.com
- **PagerDuty:** For critical issues (apply success < 80%)

---

## Rollback Procedure

If critical issues detected:

1. **Immediate:**
   ```bash
   # Disable feature for all users
   VITE_AI_PLAN_ACT_ENABLED=false
   ```

2. **Deploy hotfix:**
   - Fix issue
   - Add regression test
   - Deploy to staging
   - Test manually

3. **Resume rollout:**
   - Start from previous stage
   - Monitor closely for 2 days
   - Resume ramp if stable

---

## Support Training

### Common Issues & Solutions

**Issue:** "AI changes lost my formatting"
- **Cause:** Export without proper options
- **Solution:** Ensure `cellNF: true` in SheetJS adapter
- **Check:** Run `roundtrip.formatting.test`

**Issue:** "Undo doesn't restore everything"
- **Cause:** Action log not capturing all changes
- **Solution:** Verify `createUndoAction` stores full snapshot
- **Check:** Test manually with complex workbook

**Issue:** "AI operation failed with no error"
- **Cause:** Dry-run failed silently
- **Solution:** Check browser console for errors
- **Escalate:** If dry-run passes but apply fails

---

## Files Modified

- `src/lib/feature-flags.ts` — Feature flag configuration
- `src/lib/safety-checks.ts` — Pre-apply validation
- `src/lib/telemetry.ts` — Metrics tracking
- `.github/workflows/ci-workbook.yml` — CI tests
- `client/src/lib/workbook/adapters/sheetjs.ts` — Format preservation

---

## Contacts

- **Lead Engineer:** [Name]
- **Product Owner:** [Name]
- **Support Lead:** [Name]
- **On-Call:** [PagerDuty schedule]

---

## Sign-Off

**Stage 0 (Internal) Approved:** _________________________  
**Date:** _________________________

**Stage 1 (Beta) Approved:** _________________________  
**Date:** _________________________

**Stage 2 (Gradual) Approved:** _________________________  
**Date:** _________________________

**Stage 3 (Public) Approved:** _________________________  
**Date:** _________________________
