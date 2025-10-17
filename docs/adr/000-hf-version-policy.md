# ADR 000 — HyperFormula Version Policy and Computed Cache Invalidation

Status: Proposed
Date: 2025-10-15

## Context
HyperFormula (HF) is the formula evaluation engine used by the Nexcell client. Workbooks stored in our system may contain a computed cache (`cell.computed`) that includes values produced by HF along with metadata (timestamp, `hfVersion`, `computedBy`). HF upgrades can change evaluation behavior, error tokens, or result shapes. If cached computed values produced by an older HF version are trusted by the system, downstream functionality (dry-runs, Plan→Act, exports) may produce incorrect results.

This ADR defines the policy for tracking HF versions, how to detect stale computed caches, and migration/rollout practices to safely upgrade HF in production.

## Decision
1. Every computed value written into the workbook cache MUST include `hfVersion` and `computedBy` (already implemented).
2. On hydration (`hydrateHFFromWorkbook` and `hydrateHFFromWorkbookPatch`) the system MUST check `cell.computed.hfVersion` against `HyperFormula.version`:
   - If `cell.computed.hfVersion` is absent, assume untrusted and queue for recompute.
   - If `cell.computed.hfVersion !== HyperFormula.version`, mark the cache as stale by setting `cell.computed.stale = true` (or omit `computed.v` during HF hydration) and emit a telemetry event `hfVersion.mismatch` with safe metadata (workbookId, sheetCount, staleCount, cacheVersion, currentVersion).
   - Never blindly trust a computed `v` when hfVersion differs.
3. `recomputeAndPatchCache` MUST set `computed.hfVersion = HyperFormula.version` and update `computed.ts` and `computed.computedBy` when recomputing values.

## Migration Strategy
Upgrading HF in production must be staged to avoid huge recompute spikes.

1. Feature-flagged rollout
   - Deploy the new HF code path behind a feature flag (client-side and server-side if applicable). Start with a small % of customers.
2. Background migration queue
   - Provide a backend migration job (`/admin/hf-migrate`) that lists workbooks with stale `hfVersion` and enqueues them for background recompute.
   - Throttle the migration (e.g., 10 workbooks/hour per worker) and scale workers safely.
3. Dry-run support
   - Before bulk migration, run dry-run recomputes on a sample set and verify correctness differences.
4. Telemetry + monitoring
   - Emit telemetry `hfVersion.mismatch` during hydration and `hfVersion.migration` during background recompute (include counts, duration, result status). Alert on spikes.
5. Rollback
   - If the HF upgrade causes unacceptable results, disable the feature flag and stop background migration. Existing workbooks are unchanged; recompute operations can be rerun when safe.

## Implementation details
- Files to change:
  - `client/src/lib/workbook/hyperformula.ts`
    - hydration: skip cached computed.v if hfVersion mismatch and add `computed.stale = true` or strip `computed.v`.
    - recompute: write `hfVersion` and `computedBy`.
  - `client/src/lib/workbook/hf-version-invalidation.test.ts` (unit/integration tests for invalidation).
  - `client/src/lib/telemetry.ts`: add `hfVersion.mismatch` and `hfVersion.migration` event types.
- Telemetry payload example (no raw workbook data):
  ```json
  {
    "event": "hfVersion.mismatch",
    "workbookId": "<id>",
    "staleCount": 3,
    "cacheVersion": "2.6.0",
    "currentVersion": "3.1.0",
    "sheets": 2
  }
  ```

## Operational playbook
- Pre-upgrade:
  - Run the deterministic dry-run tests locally and in staging.
  - Create a sample set of 100 representative workbooks and run the migration dry-run.
- Upgrade rollout:
  - Enable HF upgrade feature flag for 1% of customers; monitor telemetry for 72 hours.
  - If OK, increase to 10% and run background migration for those orgs.
  - Continue staged increase while monitoring apply success %, undo rates, and telemetry.
- If adverse signals: revert feature flag, halt migration job, investigate diffs, and patch HF or mapping rules.

## Backwards compatibility
- The canonical workbook JSON schema must keep `computed.hfVersion` optional for older workbooks, but hydration treats missing versions as stale.

## Alternatives considered
- Automatic in-place migrations without feature flags — rejected due to risk of CPU spikes and potential data correctness issues.
- Not tracking hfVersion — rejected as unsafe.

## Consequences
- Positive: this avoids silent corruption of cached computed values after HF upgrades and enables safe, observable rollouts.
- Negative: upgrades require migration work and can increase compute costs during migration.

---
Approved-by: TBD

