# RepoMix Summary — nexcell (compressed)

Short digest: this is a compact, navigable summary of the codebase focusing on the spreadsheet engine, HyperFormula integration, export adapters, tests, CI gates, telemetry, and recent edits (hfVersion invalidation).

## Project at a glance
- Repo: nexcell (owner: intelogroup)
- Primary app: `client/` (React + Vite + TypeScript)
- Backend: `apps/backend/` (not expanded here)
- CI: `.github/workflows/ci-workbook.yml` (workbook-focused gates)
- Languages: TypeScript, some shell/JSON
- Key libs: `hyperformula@^3.1.0`, `xlsx`, `exceljs`, `vitest`

## High-level areas (one-line pointers)
- Workbook model: `client/src/lib/workbook/types.ts` (WorkbookJSON, SheetJSON, Cell, ComputedCache)
- HF integration: `client/src/lib/workbook/hyperformula.ts` (hydrate, recompute, updateCells, helpers)
- JSON workbook helpers: `client/src/lib/db/jsonWorkbook.ts` (create, update, export/import JSON)
- Export adapters: `client/src/lib/workbook/adapters/sheetjs.ts`, `exceljs.ts`
- High-level API: `client/src/lib/workbook/api.ts` (load/export/compute/save, applyOperations)
- Telemetry & flags: `client/src/lib/telemetry.ts`, `client/src/lib/feature-flags.ts`
- Tests: `client/src/lib/workbook/*.test.ts` (roundtrip, hf-error-*, hydration, production-readiness)
- CI gating: `.github/workflows/ci-workbook.yml` (Priority-1 roundtrip tests + HF hydration)

## Recent critical change (hfVersion invalidation)
- Problem: HF upgrades can silently invalidate computed caches stored in `cell.computed`.
- Fix: hydration now checks `cell.computed.hfVersion` vs `HyperFormula.version` and skips cached `v` when versions differ. Warnings are emitted.
  - File changed: `client/src/lib/workbook/hyperformula.ts`
- Test added: `client/src/lib/workbook/hf-version-invalidation.test.ts` ensures stale caches are skipped and recompute regenerates values and `hfVersion`.

## Key functions & contracts (compact)
- hydrateHFFromWorkbook(workbook, options) -> { hf, sheetMap, addressMap, warnings }
  - Builds `HyperFormula` instance, adds sheets (hf.addSheet), sets cell contents (hf.setCellContents)
  - Behavior: will use `cell.computed.v` unless `options.skipCache` is true or `cell.computed.hfVersion` doesn't match current HF
- recomputeAndPatchCache(workbook, hydration) -> { updatedCells, errors, warnings }
  - Reads HF values (hf.getCellValue), generates `ComputedValue` objects, writes to `cell.computed` and `workbook.computed.hfCache` with `hfVersion`, `computedBy`, `ts`
- updateCellsAndRecompute(workbook, hydration, updates) -> RecomputeResult
  - Applies incremental updates via `hf.setCellContents` and recomputes affected formulas

## Tests & gates
- Critical tests (CI): `roundtrip.formatting.test`, `roundtrip.layout.test`, `roundtrip.full.test`, plus `hyperformula.hydration.test` are run in CI (`ci-workbook.yml`).
- New test: `hf-version-invalidation.test.ts` (validates hfVersion mismatch handling)
- Production-readiness suite: `production-readiness.test.ts` (contains skipped tests for named ranges, hfVersion invalidation placeholder — now addressed with added test)

## Observability
- Telemetry file: `client/src/lib/telemetry.ts` (local aggregator that currently logs to console; backend send is commented). Preference: wire `hfVersion` warnings to telemetry.
- Flags: `client/.env` contains `VITE_ENABLE_TELEMETRY=true` and DB URLs; `feature-flags.ts` exposes toggles for telemetry and export warnings.

## Export behavior notes
- SheetJS adapter writes formulas (`f`) without leading `=` and writes cached `v` values when available. If `computed.v` missing, adapter writes `v = 0` fallback and adds `workbook.exportWarnings`.
- Adapter limitations: named ranges (not implemented), charts, conditional formats, and comments are limited or flagged.

## Suggested next steps (short list)
1. Wire telemetry: emit an event when hydration skips cached `hfVersion` to track upgrade impact.
2. Add a one-off migration tool to re-run recompute across stored workbooks on HF major upgrades.
3. Expand tests to include `hydrateHFFromWorkbookPatch` + patch-based invalidation.
4. Consider running HF in a worker or remote service for very large workbooks.

## How to run the HF hydration test locally (PowerShell)
```powershell
cd c:\Users\jayve\projects\nexcell\client
npm ci
npm test -- hyperformula.hydration.test
# Run only hf-version-invalidation test
npm test -- hf-version-invalidation.test
```

## Files changed in this session
- Modified: `client/src/lib/workbook/hyperformula.ts` (hfVersion cache-skip logic)
- Added: `client/src/lib/workbook/hf-version-invalidation.test.ts`
- Added: `docs/repomix-summary.md` (this file)

---
Compressed view: this file is intentionally short; open referenced files for line-level details. If you want, I can also produce a single-file repomix that inlines key code snippets (hydration/recompute) for offline review.

Completion: next if you want — I can wire telemetry hooks and add a migration tool (small script + test) as the highest priority follow-ups.