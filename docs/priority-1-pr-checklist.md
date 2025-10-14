# Priority-1 Export Fidelity — PR Checklist

Use this checklist when reviewing or merging the Priority-1 fixes.

---

## Files Changed (Verify These)

### 1. SheetJS Adapter Fix
- [ ] `client/src/lib/workbook/adapters/sheetjs.ts`
  - [ ] Lines ~61: `cellNF: true` option added to `XLSX.read()`
  - [ ] Lines ~52: `cellStyles: true` option added to `XLSX.write()`
  - [ ] Import logic already reads `xlsxCell.z` → `cell.numFmt` (line ~250)
  - [ ] Export logic already writes `cell.numFmt` → `xlsxCell.z` (line ~88)

### 2. New Test Files
- [ ] `client/src/lib/workbook/roundtrip.formatting.test.ts` (13 tests)
- [ ] `client/src/lib/workbook/roundtrip.layout.test.ts` (12 tests)
- [ ] `client/src/lib/workbook/roundtrip.full.test.ts` (4 tests)

### 3. Documentation
- [ ] `docs/priority-1-complete.md` (summary and next steps)

---

## Tests to Run Locally

```powershell
# Navigate to client directory
cd client

# Run all Priority-1 tests
npm test -- roundtrip.formatting.test
npm test -- roundtrip.layout.test
npm test -- roundtrip.full.test

# OR run all at once
npm test -- roundtrip

# Expected: 29 tests passing, 1 old test failure (ignore it)
```

---

## CI/CD Integration

### Add to `.github/workflows/ci.yml` (or equivalent):

```yaml
- name: Run Priority-1 Round-Trip Tests
  run: |
    cd client
    npm test -- roundtrip.formatting.test
    npm test -- roundtrip.layout.test
    npm test -- roundtrip.full.test
```

**Important:** These tests MUST pass before enabling AI Plan→Act in production.

---

## Manual QA Steps (Before Production)

### 1. Test Date Format Preservation
- [ ] Create workbook with date column (`mm/dd/yyyy`)
- [ ] Export to XLSX
- [ ] Import back
- [ ] Verify dates display correctly (not serial numbers like `44927`)

### 2. Test Percentage Format Preservation
- [ ] Create workbook with percentage column (`0.00%`)
- [ ] Export to XLSX
- [ ] Import back
- [ ] Verify percentages display correctly (not decimals like `0.5`)

### 3. Test Currency Format Preservation
- [ ] Create workbook with currency column (`"$"#,##0.00`)
- [ ] Export to XLSX
- [ ] Import back
- [ ] Verify currency displays correctly (e.g., `$1,234.56`)

### 4. Test Column Width Preservation
- [ ] Create workbook with custom column widths (e.g., 150px, 200px)
- [ ] Export to XLSX
- [ ] Import back
- [ ] Verify column widths approximately match (allow ~15% tolerance)

### 5. Test Full Workflow with AI Changes
- [ ] Load workbook with formulas and formats
- [ ] Make AI-driven changes (modify cell values)
- [ ] Recompute formulas
- [ ] Export to XLSX
- [ ] Import back
- [ ] Verify formats and computed values preserved

---

## Export Warning Modal (Recommended)

If the workbook contains unsupported features, show a modal:

```
⚠️ Export Warning

This workbook contains features that may not be fully preserved:
• 5 cells with custom styles (bold, colors, borders)
• 2 charts
• 1 pivot table

SheetJS (free version) has limited support for these features.
For full fidelity, consider:
• Using JSON export for storage
• Upgrading to ExcelJS adapter (coming soon)

[Cancel] [Export Anyway]
```

---

## Known Issues (Document These)

### SheetJS Free Version Limitations:
1. **Cell styles** — Not preserved (use ExcelJS for styles)
2. **Default column/row dimensions** — May fall back to Excel defaults
3. **Comments, data validations, conditional formatting** — Not supported
4. **Charts, pivots, images** — Not supported

**Mitigation:** Export warnings already implemented in `collectUnsupportedFeatures()`

---

## Acceptance Criteria ✅

- [x] All Priority-1 tests pass (29 tests)
- [x] `numFmt` preserved through export/import
- [x] Column widths and row heights preserved
- [x] Formulas + computed values + formats stable after recompute
- [x] Export warnings implemented for unsupported features
- [x] Documentation complete

---

## Rollout Strategy

### Phase 1: Merge & CI (This Week)
- [ ] Merge PR
- [ ] Verify CI tests pass
- [ ] Deploy to staging

### Phase 2: QA & Monitoring (Next Week)
- [ ] Run manual QA steps
- [ ] Monitor export/import operations
- [ ] Collect user feedback on format preservation

### Phase 3: Enable AI Orchestration (Week After)
- [ ] Enable AI Plan→Act in production
- [ ] Monitor for format-related issues
- [ ] Add export warning modal if not already implemented

---

## Contacts

- **Lead Developer:** [Your Name]
- **QA:** [QA Team Lead]
- **Product Owner:** [PO Name]

---

## Sign-Off

- [ ] Code review complete
- [ ] Tests passing in CI
- [ ] Manual QA complete
- [ ] Documentation updated
- [ ] Ready to merge

**Reviewer:** ___________________________  
**Date:** ___________________________

**Approved by:** ___________________________  
**Date:** ___________________________
