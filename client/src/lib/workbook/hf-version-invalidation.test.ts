import { describe, it, expect } from 'vitest';
import { createWorkbook } from './utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache, updateCellsAndRecompute } from './hyperformula';

describe('HyperFormula hfVersion invalidation', () => {
  it('should skip stale computed cache and recompute with current hfVersion', async () => {
    const workbook = createWorkbook('HF Version Invalidation Test');
    const sheet = workbook.sheets[0];

    // Set up a simple formula
    sheet.cells = {
      'A1': { raw: 10 },
      'A2': { formula: '=A1*2' },
    };

    // Initial hydration & recompute to produce fresh computed value
    const initialHydration = hydrateHFFromWorkbook(workbook);
    recomputeAndPatchCache(workbook, initialHydration);

    const computedA2 = sheet.cells?.['A2']?.computed;
    expect(computedA2).toBeDefined();
    const originalValue = computedA2?.v;
    const originalHFVersion = computedA2?.hfVersion;
    expect(originalHFVersion).toBeTruthy();

    // Simulate persisted workbook where formulas are stripped but computed cache exists
    const persisted = JSON.parse(JSON.stringify(workbook));
    // Remove formula to simulate a persisted-only cached value
    if (persisted.sheets[0].cells && persisted.sheets[0].cells['A2']) {
      delete persisted.sheets[0].cells['A2'].formula;
    }

    // Case 1: hfVersion matches - hydration should load cached value
    const hydrationMatch = hydrateHFFromWorkbook(persisted);
    // No hfVersion mismatch warnings expected here
    const mismatchWarnings1 = hydrationMatch.warnings.filter(w => /Skipping cached computed value/i.test(w));
    expect(mismatchWarnings1.length).toBe(0);
    // After hydration, since we loaded cached value, workbook computed should be present on the persisted object
    // Note: hydration doesn't mutate the input persisted object in place in our implementation, so we rely on hydration.warnings and the hydration.hf instance

    // Now simulate stale cache: set hfVersion to an old value and a stale marker
    if (persisted.sheets[0].cells && persisted.sheets[0].cells['A2'] && persisted.sheets[0].cells['A2'].computed) {
      persisted.sheets[0].cells['A2'].computed.hfVersion = '0.0.0-old';
      persisted.sheets[0].cells['A2'].computed.v = 'STALE_MARKER';
    }

    // Hydrate the persisted workbook - it should produce a warning and skip loading the stale cached value
    const hydrationStale = hydrateHFFromWorkbook(persisted);
    const mismatchWarnings = hydrationStale.warnings.filter(w => /Skipping cached computed value/i.test(w));
    expect(mismatchWarnings.length).toBeGreaterThanOrEqual(1);

    // Restore formula on the persisted workbook so recompute can actually regenerate the value
    if (persisted.sheets[0].cells && persisted.sheets[0].cells['A2']) {
      persisted.sheets[0].cells['A2'].formula = '=A1*2';
    }

    // Update HF internal state for the restored formula and recompute affected cells
    const sheetId = persisted.sheets[0].id;
  const updates = [{ sheetId, address: 'A2', value: persisted.sheets[0].cells['A2'].formula }];
  const recompute = updateCellsAndRecompute(persisted as any, hydrationStale as any, updates as any);
  // Ensure recompute did something
  expect(recompute.updatedCells).toBeGreaterThanOrEqual(1);
  const finalComputed = persisted.sheets[0].cells?.['A2']?.computed;
    expect(finalComputed).toBeDefined();
    expect(finalComputed?.v).not.toBe('STALE_MARKER');
    expect(finalComputed?.hfVersion).toBeTruthy();
    expect(finalComputed?.hfVersion).not.toBe('0.0.0-old');
    // Value should match original computed numeric result
    expect(finalComputed?.v).toBe(originalValue);
  });
});
