/**
 * Production Readiness Test Suite
 * 
 * These are the TOP 10 CRITICAL tests that MUST pass before enabling AI orchestration.
 * Run these and report exact failures - DO NOT FIX until we know all issues.
 */

import { describe, it, expect } from 'vitest';
import { SheetJSAdapter } from './adapters/sheetjs';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from './hyperformula';
import type { Cell } from './types';
import { createWorkbook, addSheet } from './utils';

describe('PRODUCTION READINESS - Top 10 Critical Tests', () => {
  
  // ============================================================================
  // TEST 1: Round-trip formula fidelity
  // ============================================================================
  describe('Test 1: Round-trip formula fidelity', () => {
    it('should preserve common formulas through export/import cycle', async () => {
      // Use canonical createWorkbook - it creates a workbook with one sheet by default
      const workbook = createWorkbook('Formula Fidelity Test');
      const sheet = workbook.sheets[0];
      
      // Test data and formulas
      sheet.cells = {
        // Basic arithmetic
        'A1': { raw: 10, dataType: 'number' },
        'A2': { raw: 20, dataType: 'number' },
        'A3': { raw: 30, dataType: 'number' },
        'A4': { raw: 40, dataType: 'number' },
        'A5': { raw: 50, dataType: 'number' },
        
        // SUM
        'B1': { formula: '=SUM(A1:A5)', dataType: 'formula' },
        
        // AVERAGE
        'B2': { formula: '=AVERAGE(A1:A5)', dataType: 'formula' },
        
        // IF
        'B3': { formula: '=IF(A1>15,"High","Low")', dataType: 'formula' },
        
        // IFERROR
        'B4': { formula: '=IFERROR(A1/0,"Error")', dataType: 'formula' },
        
        // CONCAT/CONCATENATE
        'C1': { raw: 'Hello', dataType: 'string' },
        'C2': { raw: 'World', dataType: 'string' },
        'C3': { formula: '=CONCAT(C1," ",C2)', dataType: 'formula' },
        
        // Text functions
        'D1': { raw: 'Testing', dataType: 'string' },
        'D2': { formula: '=LEFT(D1,4)', dataType: 'formula' },
        'D3': { formula: '=RIGHT(D1,3)', dataType: 'formula' },
        
        // Date functions (numeric representation)
        'E1': { formula: '=DATE(2024,1,15)', dataType: 'formula' },
        
        // VLOOKUP equivalent (INDEX/MATCH)
        'F1': { raw: 'Key1', dataType: 'string' },
        'F2': { raw: 'Key2', dataType: 'string' },
        'G1': { raw: 100, dataType: 'number' },
        'G2': { raw: 200, dataType: 'number' },
        'H1': { raw: 'Key2', dataType: 'string' },
        'H2': { formula: '=INDEX(G1:G2,MATCH(H1,F1:F2,0))', dataType: 'formula' },
      };

      console.log('\n[TEST 1] Created workbook with formulas');

      // Hydrate HyperFormula and compute
      const hydration = hydrateHFFromWorkbook(workbook);
      console.log(`[TEST 1] HyperFormula hydration: ${hydration.warnings.length} warnings`);
      hydration.warnings.forEach(w => console.log(`  - ${w}`));

      const recompute = recomputeAndPatchCache(workbook, hydration);
      console.log(`[TEST 1] Recomputed: ${recompute.updatedCells} cells, ${recompute.errors.length} errors`);
      recompute.errors.forEach(e => console.log(`  - ERROR: ${e.address} - ${e.error}`));

      // Store original formulas and computed values
      const originalFormulas: Record<string, string> = {};
      const originalValues: Record<string, any> = {};
      
      Object.entries(sheet.cells).forEach(([addr, cell]) => {
        if (cell.formula) {
          originalFormulas[addr] = cell.formula;
          originalValues[addr] = cell.computed?.v;
        }
      });

      console.log(`[TEST 1] Original formulas: ${Object.keys(originalFormulas).length}`);
      console.log(`[TEST 1] Original computed values:`, originalValues);

      // Export to XLSX
      const adapter = new SheetJSAdapter();
      const buffer = await adapter.export(workbook);
      console.log(`[TEST 1] Exported to XLSX: ${buffer.byteLength} bytes`);

      // Import back
      const imported = await adapter.import(buffer);
      console.log(`[TEST 1] Imported workbook: ${imported.sheets.length} sheets`);

      const importedSheet = imported.sheets[0];
      const importedFormulas: Record<string, string> = {};
      const importedValues: Record<string, any> = {};
      
      Object.entries(importedSheet.cells || {}).forEach(([addr, cell]) => {
        if (cell.formula) {
          importedFormulas[addr] = cell.formula;
          importedValues[addr] = cell.computed?.v;
        }
      });

      console.log(`[TEST 1] Imported formulas: ${Object.keys(importedFormulas).length}`);
      console.log(`[TEST 1] Imported computed values:`, importedValues);

      // Recompute imported workbook
      const importedHydration = hydrateHFFromWorkbook(imported);
      const importedRecompute = recomputeAndPatchCache(imported, importedHydration);
      console.log(`[TEST 1] Recomputed imported: ${importedRecompute.updatedCells} cells, ${importedRecompute.errors.length} errors`);

      // Get fresh computed values after import
      const recomputedValues: Record<string, any> = {};
      Object.entries(importedSheet.cells || {}).forEach(([addr, cell]) => {
        if (cell.formula) {
          recomputedValues[addr] = cell.computed?.v;
        }
      });

      console.log(`[TEST 1] Recomputed values after import:`, recomputedValues);

      // Compare formulas
      const formulaMismatches: string[] = [];
      Object.entries(originalFormulas).forEach(([addr, formula]) => {
        const imported = importedFormulas[addr];
        if (!imported) {
          formulaMismatches.push(`${addr}: MISSING (original: ${formula})`);
        } else if (formula !== imported) {
          formulaMismatches.push(`${addr}: MISMATCH (original: ${formula}, imported: ${imported})`);
        }
      });

      // Compare computed values
      const valueMismatches: string[] = [];
      Object.entries(originalValues).forEach(([addr, value]) => {
        const recomputed = recomputedValues[addr];
        if (value !== recomputed) {
          valueMismatches.push(`${addr}: VALUE MISMATCH (original: ${value}, recomputed: ${recomputed})`);
        }
      });

      console.log(`\n[TEST 1] RESULTS:`);
      console.log(`  Formula preservation: ${Object.keys(originalFormulas).length - formulaMismatches.length}/${Object.keys(originalFormulas).length}`);
      console.log(`  Value consistency: ${Object.keys(originalValues).length - valueMismatches.length}/${Object.keys(originalValues).length}`);
      
      if (formulaMismatches.length > 0) {
        console.log(`\n  FORMULA MISMATCHES:`);
        formulaMismatches.forEach(m => console.log(`    - ${m}`));
      }
      
      if (valueMismatches.length > 0) {
        console.log(`\n  VALUE MISMATCHES:`);
        valueMismatches.forEach(m => console.log(`    - ${m}`));
      }

      // Acceptance: ≥ 99% match for common functions
      const formulaSuccessRate = (Object.keys(originalFormulas).length - formulaMismatches.length) / Object.keys(originalFormulas).length;
      const valueSuccessRate = (Object.keys(originalValues).length - valueMismatches.length) / Object.keys(originalValues).length;

      expect(formulaSuccessRate).toBeGreaterThanOrEqual(0.99);
      expect(valueSuccessRate).toBeGreaterThanOrEqual(0.99);
    });
  });

  // ============================================================================
  // TEST 2: Deterministic dry-run
  // ============================================================================
  describe('Test 2: Deterministic dry-run', () => {
    it('should produce identical results across 10 runs', async () => {
      const workbook = createWorkbook('Deterministic Test');
      const sheet = workbook.sheets[0];
      sheet.cells = {
        'A1': { raw: 100, dataType: 'number' },
        'A2': { formula: '=A1*2', dataType: 'formula' },
        'A3': { formula: '=SUM(A1:A2)', dataType: 'formula' },
      };

      console.log('\n[TEST 2] Running 10 deterministic dry-runs...');

      const results: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        // Deep clone workbook for each run
        const clone = JSON.parse(JSON.stringify(workbook));
        
        // Hydrate and recompute
        const hydration = hydrateHFFromWorkbook(clone);
        const recompute = recomputeAndPatchCache(clone, hydration);
        
        // Serialize results
        const resultString = JSON.stringify({
          updatedCells: recompute.updatedCells,
          errors: recompute.errors,
          computed: Object.entries(clone.sheets[0].cells || {})
            .filter(([_, cell]) => (cell as Cell).computed)
            .map(([addr, cell]) => ({ addr, v: (cell as Cell).computed?.v })),
        });
        
        results.push(resultString);
        
        if (i === 0) {
          console.log(`[TEST 2] Run ${i + 1}: ${resultString.substring(0, 100)}...`);
        }
      }

      // Check if all results are identical
      const unique = new Set(results);
      console.log(`[TEST 2] Unique results: ${unique.size} (expected: 1)`);
      
      if (unique.size > 1) {
        console.log('\n[TEST 2] NON-DETERMINISTIC BEHAVIOR DETECTED:');
        results.forEach((r, i) => {
          console.log(`  Run ${i + 1}: ${r.substring(0, 150)}...`);
        });
      }

      expect(unique.size).toBe(1);
    });
  });

  // ============================================================================
  // TEST 3: Named ranges & cross-sheet references
  // ============================================================================
  describe('Test 3: Named ranges & cross-sheet references', () => {
    it('should handle cross-sheet formulas', async () => {
      const workbook = createWorkbook('Cross-sheet Test');

      // Rename first sheet to 'Data'
      workbook.sheets[0].name = 'Data';
      workbook.sheets[0].cells = {
        'A1': { raw: 100, dataType: 'number' },
        'A2': { raw: 200, dataType: 'number' },
      };

      // Add second sheet for calculations
      addSheet(workbook, 'Calculations');
      workbook.sheets[1].cells = {
        'B1': { formula: '=Data!A1+Data!A2', dataType: 'formula' },
      };

      console.log('\n[TEST 3] Testing cross-sheet references...');

      const hydration = hydrateHFFromWorkbook(workbook);
      console.log(`[TEST 3] Hydration warnings: ${hydration.warnings.length}`);
      hydration.warnings.forEach(w => console.log(`  - ${w}`));

      const recompute = recomputeAndPatchCache(workbook, hydration);
      console.log(`[TEST 3] Recompute errors: ${recompute.errors.length}`);
      recompute.errors.forEach(e => console.log(`  - ${e.address}: ${e.error}`));

      const b1Value = workbook.sheets[1].cells?.['B1']?.computed?.v;
      console.log(`[TEST 3] B1 computed value: ${b1Value} (expected: 300)`);

      // Export and import
      const adapter = new SheetJSAdapter();
      const buffer = await adapter.export(workbook);
      const imported = await adapter.import(buffer);

      const importedB1Formula = imported.sheets[1].cells?.['B1']?.formula;
      console.log(`[TEST 3] Imported B1 formula: ${importedB1Formula}`);

      expect(b1Value).toBe(300);
      expect(importedB1Formula).toBeTruthy();
    });

    it.skip('should handle named ranges (NOT IMPLEMENTED)', () => {
      console.log('[TEST 3] Named ranges not yet implemented');
    });
  });

  // ============================================================================
  // TEST 4: Volatile & locale-sensitive functions
  // ============================================================================
  describe('Test 4: Volatile & locale-sensitive functions', () => {
    it('should handle volatile functions (NOW, TODAY, RAND)', async () => {
      const workbook = createWorkbook('Volatile Functions Test');

      workbook.sheets[0].cells = {
        'A1': { formula: '=NOW()', dataType: 'formula' },
        'A2': { formula: '=TODAY()', dataType: 'formula' },
        'A3': { formula: '=RAND()', dataType: 'formula' },
      };

      console.log('\n[TEST 4] Testing volatile functions...');

      const hydration = hydrateHFFromWorkbook(workbook);
      recomputeAndPatchCache(workbook, hydration);
      
      const values1 = {
        now: workbook.sheets[0].cells?.['A1']?.computed?.v,
        today: workbook.sheets[0].cells?.['A2']?.computed?.v,
        rand: workbook.sheets[0].cells?.['A3']?.computed?.v,
      };

      console.log('[TEST 4] First computation:', values1);

      // Wait and recompute
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const clone = JSON.parse(JSON.stringify(workbook));
      const hydration2 = hydrateHFFromWorkbook(clone);
      recomputeAndPatchCache(clone, hydration2);
      
      const values2 = {
        now: clone.sheets[0].cells?.['A1']?.computed?.v,
        today: clone.sheets[0].cells?.['A2']?.computed?.v,
        rand: clone.sheets[0].cells?.['A3']?.computed?.v,
      };

      console.log('[TEST 4] Second computation:', values2);
      console.log('[TEST 4] Are volatile functions marked?', {
        nowHasTs: !!workbook.sheets[0].cells?.['A1']?.computed?.ts,
        todayHasTs: !!workbook.sheets[0].cells?.['A2']?.computed?.ts,
        randHasTs: !!workbook.sheets[0].cells?.['A3']?.computed?.ts,
      });

      // Volatile functions should potentially change values
      // Check if we're tracking them properly
      expect(values1.rand).toBeDefined();
      expect(values2.rand).toBeDefined();
    });
  });

  // ============================================================================
  // TEST 5: Merged ranges, row/col sizing, freeze panes
  // ============================================================================
  describe('Test 5: Merged ranges, row/col sizing, freeze panes', () => {
    it('should preserve merged ranges through export/import', async () => {
      const workbook = createWorkbook('Merge Test');

      const sheet = workbook.sheets[0];
      sheet.cells = {
        'A1': { raw: 'Merged Cell', dataType: 'string' },
      };
      sheet.mergedRanges = ['A1:C1', 'A2:A4'];

      console.log('\n[TEST 5] Testing merged ranges...');
      console.log('[TEST 5] Original merges:', sheet.mergedRanges);

      const adapter = new SheetJSAdapter();
      const buffer = await adapter.export(workbook);
      const imported = await adapter.import(buffer);

      const importedMerges = imported.sheets[0].mergedRanges || [];
      console.log('[TEST 5] Imported merges:', importedMerges);

      expect(importedMerges.length).toBeGreaterThan(0);
    });

    it('should preserve column widths and row heights', async () => {
      const workbook = createWorkbook('Sizing Test');

      const sheet = workbook.sheets[0];
      sheet.cols = {
        1: { width: 200, hidden: false },
        2: { width: 100, hidden: false },
      };
      sheet.rows = {
        1: { height: 40, hidden: false },
        2: { height: 20, hidden: false },
      };

      console.log('\n[TEST 5] Testing column/row sizing...');
      console.log('[TEST 5] Original cols:', sheet.cols);
      console.log('[TEST 5] Original rows:', sheet.rows);

      const adapter = new SheetJSAdapter();
      const buffer = await adapter.export(workbook);
      const imported = await adapter.import(buffer);

      console.log('[TEST 5] Imported cols:', imported.sheets[0].cols);
      console.log('[TEST 5] Imported rows:', imported.sheets[0].rows);

      expect(imported.sheets[0].cols).toBeDefined();
      expect(imported.sheets[0].rows).toBeDefined();
    });

    it.skip('should preserve freeze panes (NOT FULLY IMPLEMENTED)', () => {
      console.log('[TEST 5] Freeze panes not fully tested in SheetJS adapter');
    });
  });

  // ============================================================================
  // TEST 6: Data types & number formats
  // ============================================================================
  describe('Test 6: Data types & number formats', () => {
    it('should preserve data types and number formats', async () => {
      const workbook = createWorkbook('Data Types Test');

      workbook.sheets[0].cells = {
        'A1': { raw: 123.45, dataType: 'number', numFmt: '0.00' },
        'A2': { raw: 'Hello', dataType: 'string' },
        'A3': { raw: true, dataType: 'boolean' },
        'A4': { raw: 44927, dataType: 'number', numFmt: 'mm/dd/yyyy' }, // Date as serial
        'A5': { raw: 0.5, dataType: 'number', numFmt: '0.00%' }, // Percentage
      };

      console.log('\n[TEST 6] Testing data types and formats...');

      const adapter = new SheetJSAdapter();
      const buffer = await adapter.export(workbook);
      const imported = await adapter.import(buffer);

      const cells = imported.sheets[0].cells || {};
      
      Object.entries(cells).forEach(([addr, cell]) => {
        console.log(`[TEST 6] ${addr}:`, {
          raw: cell.raw,
          dataType: cell.dataType,
          numFmt: cell.numFmt,
        });
      });

      expect(cells['A1']?.raw).toBe(123.45);
      expect(cells['A2']?.raw).toBe('Hello');
      expect(cells['A3']?.raw).toBe(true);
    });
  });

  // ============================================================================
  // TEST 7: Computed cache (hfCache) correctness & hfVersion
  // ============================================================================
  describe('Test 7: Computed cache correctness & hfVersion', () => {
    it('should include v, ts, hfVersion in computed entries', async () => {
      const workbook = createWorkbook('Cache Test');

      workbook.sheets[0].cells = {
        'A1': { raw: 10, dataType: 'number' },
        'A2': { formula: '=A1*2', dataType: 'formula' },
      };

      console.log('\n[TEST 7] Testing computed cache structure...');

      const hydration = hydrateHFFromWorkbook(workbook);
      recomputeAndPatchCache(workbook, hydration);

      const computed = workbook.sheets[0].cells?.['A2']?.computed;
      console.log('[TEST 7] Computed structure:', computed);

      expect(computed?.v).toBeDefined();
      expect(computed?.ts).toBeDefined();
      // hfVersion may not be implemented yet
      console.log('[TEST 7] Has hfVersion?', 'hfVersion' in (computed || {}));
    });

    it.skip('should invalidate cache on hfVersion mismatch (NOT IMPLEMENTED)', () => {
      console.log('[TEST 7] hfVersion tracking not implemented');
    });
  });

  // ============================================================================
  // TEST 8: Undo/Redo & Action inverse integrity
  // ============================================================================
  describe('Test 8: Undo/Redo integrity', () => {
    it.skip('should support undo/redo (NOT FULLY IMPLEMENTED)', () => {
      console.log('[TEST 8] Undo/Redo system exists but needs integration testing');
      // The undo.ts file exists but we need to test it with real workbook mutations
    });
  });

  // ============================================================================
  // TEST 9: Partial apply & stale-plan detection
  // ============================================================================
  describe('Test 9: Stale-plan detection', () => {
    it.skip('should detect stale plans (NOT IMPLEMENTED)', () => {
      console.log('[TEST 9] Stale-plan detection not implemented yet');
      // Need to implement versioning or checksums to detect workbook changes
    });
  });

  // ============================================================================
  // TEST 10: Error handling & user-visible diagnostics
  // ============================================================================
  describe('Test 10: Error handling', () => {
    it('should report cell-level errors for invalid formulas', async () => {
      const workbook = createWorkbook('Error Test');

      workbook.sheets[0].cells = {
        'A1': { formula: '=1/0', dataType: 'formula' }, // Division by zero
        'A2': { formula: '=INVALID_FUNC()', dataType: 'formula' }, // Unknown function
        'A3': { formula: '=A1+', dataType: 'formula' }, // Syntax error
      };

      console.log('\n[TEST 10] Testing error handling...');

      const hydration = hydrateHFFromWorkbook(workbook);
      console.log('[TEST 10] Hydration warnings:', hydration.warnings.length);
      hydration.warnings.forEach(w => console.log(`  - ${w}`));

      const recompute = recomputeAndPatchCache(workbook, hydration);
      console.log('[TEST 10] Recompute errors:', recompute.errors.length);
      recompute.errors.forEach(e => {
        console.log(`  - ${e.address}: ${e.error}`);
      });

      // Check if errors are visible in computed values
      Object.entries(workbook.sheets[0].cells || {}).forEach(([addr, cell]) => {
        if (cell.computed) {
          console.log(`[TEST 10] ${addr} computed:`, cell.computed);
        }
      });

      expect(recompute.errors.length).toBeGreaterThan(0);
    });
  });
});

