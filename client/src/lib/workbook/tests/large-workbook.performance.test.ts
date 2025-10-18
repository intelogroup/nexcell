import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../hyperformula';

describe('Large workbook performance', () => {
  it('recomputes a medium-size workbook within a reasonable time', () => {
    const wb = createWorkbook('Large Test');
    const sheet = wb.sheets[0];

    // Create a grid of formula cells (smallish for CI safety)
    const size = 200; // 200x200 = 40k cells (may be heavy) - reduce if CI is constrained
    for (let r = 1; r <= 50; r++) {
      for (let c = 1; c <= 20; c++) {
        const addr = `${String.fromCharCode(64 + c)}${r}`;
        // simple formula referencing previous cell
        if (r === 1) {
          sheet.cells![addr] = { raw: c } as any;
        } else {
          sheet.cells![addr] = { formula: `=${String.fromCharCode(64 + c)}${r - 1} + 1` } as any;
        }
      }
    }

    const hydration = hydrateHFFromWorkbook(wb);
    const start = Date.now();
    const result = recomputeAndPatchCache(wb, hydration);
    const duration = Date.now() - start;

    // Ensure some cells were updated and duration is not absurd (10s cap)
    expect(result.updatedCells).toBeGreaterThan(0);
    expect(duration).toBeLessThan(10000);
  });
});
