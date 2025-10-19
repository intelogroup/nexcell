/**
 * Unit tests for validation.ts
 * 
 * Tests workbook validation rules, error detection, and suggestion generation.
 */

import { describe, it, expect } from 'vitest';
import { 
  validateWorkbook, 
  formatValidationResult,
  type ValidationResult,
  type ValidationOptions,
} from '../validation';
import { createWorkbook, setCell } from '../../../workbook/utils';
import type { WorkbookJSON } from '../../../workbook/types';

describe('validateWorkbook', () => {
  describe('null/undefined workbook', () => {
    it('should return error for null workbook', () => {
      const result = validateWorkbook(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('null or undefined');
      expect(result.errors[0].category).toBe('missing-data');
    });

    it('should return error for undefined workbook', () => {
      const result = validateWorkbook(undefined);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('empty workbook', () => {
    it('should return error for workbook with no sheets', () => {
      const workbook = createWorkbook('Empty');
      workbook.sheets = []; // Remove all sheets

      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('no sheets');
    });
  });

  describe('valid workbook', () => {
    it('should pass validation for minimal valid workbook', () => {
      const workbook = createWorkbook('Valid');
      
      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.totalIssues).toBe(0);
      expect(result.summary).toContain('passed with no issues');
    });

    it('should pass validation for workbook with data but no formulas', () => {
      const workbook = createWorkbook('Data Only');
      setCell(workbook, workbook.sheets[0].id, 'A1', { raw: 'Hello', dataType: 'string' });
      setCell(workbook, workbook.sheets[0].id, 'B1', { raw: 123, dataType: 'number' });

      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('formula errors', () => {
    it('should detect #DIV/0! errors', () => {
      const workbook = createWorkbook('DivByZero');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10/0', 
        dataType: 'formula',
        computed: { v: '#DIV/0!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(true); // Warnings don't fail validation
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const divError = result.warnings.find(w => w.message.includes('#DIV/0!'));
      expect(divError).toBeDefined();
      expect(divError?.category).toBe('formula-error');
      expect(divError?.cellAddress).toBe('A1');
      expect(divError?.suggestion).toContain('division by zero');
    });

    it('should detect #REF! errors', () => {
      const workbook = createWorkbook('RefError');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'B1', { 
        formula: '=A999', 
        dataType: 'formula',
        computed: { v: '#REF!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      const refError = result.warnings.find(w => w.message.includes('#REF!'));
      expect(refError).toBeDefined();
      expect(refError?.suggestion).toContain('Invalid cell reference');
    });

    it('should detect #NAME? errors', () => {
      const workbook = createWorkbook('NameError');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'C1', { 
        formula: '=UNKNOWNFUNC()', 
        dataType: 'formula',
        computed: { v: '#NAME?', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      const nameError = result.warnings.find(w => w.message.includes('#NAME?'));
      expect(nameError).toBeDefined();
      expect(nameError?.suggestion).toContain('not recognized');
    });

    it('should detect #VALUE! errors', () => {
      const workbook = createWorkbook('ValueError');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'D1', { 
        formula: '=1+"text"', 
        dataType: 'formula',
        computed: { v: '#VALUE!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      const valueError = result.warnings.find(w => w.message.includes('#VALUE!'));
      expect(valueError).toBeDefined();
      expect(valueError?.suggestion).toContain('Wrong type of argument');
    });

    it('should detect #N/A errors', () => {
      const workbook = createWorkbook('NAError');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'E1', { 
        formula: '=VLOOKUP("missing", A1:B10, 2, FALSE)', 
        dataType: 'formula',
        computed: { v: '#N/A', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      const naError = result.warnings.find(w => w.message.includes('#N/A'));
      expect(naError).toBeDefined();
      expect(naError?.suggestion).toContain('not available');
    });

    it('should detect multiple formula errors', () => {
      const workbook = createWorkbook('MultiError');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=1/0', 
        dataType: 'formula',
        computed: { v: '#DIV/0!', t: 'e', ts: new Date().toISOString() }
      });
      setCell(workbook, sheetId, 'A2', { 
        formula: '=BAD()', 
        dataType: 'formula',
        computed: { v: '#NAME?', t: 'e', ts: new Date().toISOString() }
      });
      setCell(workbook, sheetId, 'A3', { 
        formula: '=A999', 
        dataType: 'formula',
        computed: { v: '#REF!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    });

    it('should respect maxIssuesPerCategory limit', () => {
      const workbook = createWorkbook('ManyErrors');
      const sheetId = workbook.sheets[0].id;
      
      // Create 20 errors
      for (let i = 1; i <= 20; i++) {
        setCell(workbook, sheetId, `A${i}`, { 
          formula: '=1/0', 
          dataType: 'formula',
          computed: { v: '#DIV/0!', t: 'e', ts: new Date().toISOString() }
        });
      }

      const result = validateWorkbook(workbook, { maxIssuesPerCategory: 5 });

      // Should only report up to 5 issues
      const divErrors = result.warnings.filter(w => w.category === 'formula-error');
      expect(divErrors.length).toBeLessThanOrEqual(5);
    });
  });

  describe('circular references', () => {
    it('should detect #CYCLE! errors as critical', () => {
      const workbook = createWorkbook('Circular');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=A1+1', 
        dataType: 'formula',
        computed: { v: '#CYCLE!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(false); // CYCLE errors are critical
      expect(result.errors.length).toBeGreaterThan(0);
      
      const cycleError = result.errors.find(e => e.category === 'circular-reference');
      expect(cycleError).toBeDefined();
      expect(cycleError?.message).toContain('Circular reference');
      expect(cycleError?.severity).toBe('error');
    });

    it('should detect multiple circular references', () => {
      const workbook = createWorkbook('MultiCircular');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=B1', 
        dataType: 'formula',
        computed: { v: '#CYCLE!', t: 'e', ts: new Date().toISOString() }
      });
      setCell(workbook, sheetId, 'B1', { 
        formula: '=C1', 
        dataType: 'formula',
        computed: { v: '#CYCLE!', t: 'e', ts: new Date().toISOString() }
      });
      setCell(workbook, sheetId, 'C1', { 
        formula: '=A1', 
        dataType: 'formula',
        computed: { v: '#CYCLE!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);

      const cycleErrors = result.errors.filter(e => e.category === 'circular-reference');
      expect(cycleErrors.length).toBe(3);
    });
  });

  describe('missing compute', () => {
    it('should warn about uncomputed formulas', () => {
      const workbook = createWorkbook('Uncomputed');
      const sheetId = workbook.sheets[0].id;
      
      // Formula without computed value
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula'
        // No computed property
      });

      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      const missingCompute = result.warnings.find(w => w.category === 'missing-compute');
      expect(missingCompute).toBeDefined();
      expect(missingCompute?.message).toContain('not computed');
      expect(missingCompute?.suggestion).toContain('compute operation');
    });

    it('should count multiple uncomputed formulas', () => {
      const workbook = createWorkbook('ManyUncomputed');
      const sheetId = workbook.sheets[0].id;
      
      for (let i = 1; i <= 5; i++) {
        setCell(workbook, sheetId, `A${i}`, { 
          formula: `=${i}*2`, 
          dataType: 'formula'
        });
      }

      const result = validateWorkbook(workbook);

      const missingCompute = result.warnings.find(w => w.category === 'missing-compute');
      expect(missingCompute).toBeDefined();
      expect(missingCompute?.message).toContain('5 formula');
    });

    it('should not warn if formulas are computed', () => {
      const workbook = createWorkbook('Computed');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula',
        computed: { v: 30, t: 'n', ts: new Date().toISOString(), hfVersion: '3.1.0' }
      });

      const result = validateWorkbook(workbook);

      const missingCompute = result.warnings.find(w => w.category === 'missing-compute');
      expect(missingCompute).toBeUndefined();
    });
  });

  describe('stale compute', () => {
    it('should warn about stale computed values', () => {
      const workbook = createWorkbook('Stale');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula',
        computed: { v: 30, t: 'n', ts: new Date().toISOString(), stale: true }
      });

      const result = validateWorkbook(workbook);

      const staleCompute = result.warnings.find(w => w.category === 'stale-compute');
      expect(staleCompute).toBeDefined();
      expect(staleCompute?.message).toContain('stale');
    });

    it('should warn about missing hfVersion', () => {
      const workbook = createWorkbook('NoVersion');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula',
        computed: { v: 30, t: 'n', ts: new Date().toISOString() }
        // Missing hfVersion
      });

      const result = validateWorkbook(workbook);

      const staleCompute = result.warnings.find(w => w.category === 'stale-compute');
      expect(staleCompute).toBeDefined();
    });
  });

  describe('invalid references', () => {
    it('should detect invalid sheet references', () => {
      const workbook = createWorkbook('InvalidRef');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=NonExistentSheet!B1', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook);

      expect(result.isValid).toBe(false);
      const invalidRef = result.errors.find(e => e.category === 'invalid-reference');
      expect(invalidRef).toBeDefined();
      expect(invalidRef?.message).toContain('NonExistentSheet');
    });

    it('should allow valid cross-sheet references', () => {
      const workbook = createWorkbook('ValidCrossSheet');
      const sheet1Id = workbook.sheets[0].id;
      
      // Add second sheet
      workbook.sheets.push({
        id: 'sheet2',
        name: 'Data',
        cells: {},
        mergedRanges: [],
      });
      
      setCell(workbook, sheet1Id, 'A1', { 
        formula: '=Data!B1', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook);

      const invalidRef = result.errors.find(e => e.category === 'invalid-reference');
      expect(invalidRef).toBeUndefined();
    });

    it('should detect multiple invalid references', () => {
      const workbook = createWorkbook('MultiInvalid');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=Sheet2!B1 + Sheet3!C1', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('performance issues', () => {
    it('should warn about too many formulas', () => {
      const workbook = createWorkbook('ManyFormulas');
      const sheetId = workbook.sheets[0].id;
      
      // Add 1001 formulas (threshold is 1000)
      for (let i = 1; i <= 1001; i++) {
        setCell(workbook, sheetId, `A${i}`, { 
          formula: '=1+1', 
          dataType: 'formula'
        });
      }

      const result = validateWorkbook(workbook);

      const perfWarning = result.warnings.find(w => w.category === 'performance');
      expect(perfWarning).toBeDefined();
      expect(perfWarning?.message).toContain('1001 formulas');
    });

    it('should warn about volatile functions', () => {
      const workbook = createWorkbook('Volatile');
      const sheetId = workbook.sheets[0].id;
      
      // Add 51 volatile functions (threshold is 50)
      for (let i = 1; i <= 51; i++) {
        setCell(workbook, sheetId, `A${i}`, { 
          formula: '=NOW()', 
          dataType: 'formula'
        });
      }

      const result = validateWorkbook(workbook);

      const volatileWarning = result.warnings.find(w => 
        w.category === 'performance' && w.message.includes('volatile')
      );
      expect(volatileWarning).toBeDefined();
    });

    it('should detect various volatile functions', () => {
      const workbook = createWorkbook('VolatileTypes');
      const sheetId = workbook.sheets[0].id;
      
      const volatileFunctions = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'INDIRECT', 'OFFSET'];
      
      for (let i = 0; i < 60; i++) {
        const fn = volatileFunctions[i % volatileFunctions.length];
        setCell(workbook, sheetId, `A${i + 1}`, { 
          formula: `=${fn}()`, 
          dataType: 'formula'
        });
      }

      const result = validateWorkbook(workbook);

      const volatileWarning = result.warnings.find(w => 
        w.category === 'performance' && w.message.includes('volatile')
      );
      expect(volatileWarning).toBeDefined();
    });
  });

  describe('best practices', () => {
    it('should suggest named ranges for repeated references', () => {
      const workbook = createWorkbook('RepeatedRanges');
      const sheetId = workbook.sheets[0].id;
      
      // Use the same range 4 times (threshold is 3)
      setCell(workbook, sheetId, 'B1', { formula: '=SUM(A1:A10)', dataType: 'formula' });
      setCell(workbook, sheetId, 'B2', { formula: '=AVERAGE(A1:A10)', dataType: 'formula' });
      setCell(workbook, sheetId, 'B3', { formula: '=MAX(A1:A10)', dataType: 'formula' });
      setCell(workbook, sheetId, 'B4', { formula: '=MIN(A1:A10)', dataType: 'formula' });

      const result = validateWorkbook(workbook);

      const namedRangeSuggestion = result.suggestions.find(s => 
        s.message.includes('named ranges')
      );
      expect(namedRangeSuggestion).toBeDefined();
      expect(namedRangeSuggestion?.suggestion).toContain('A1:A10');
    });

    it('should suggest compute operation for uncomputed formulas', () => {
      const workbook = createWorkbook('NeedCompute');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula'
        // No computed value
      });

      const result = validateWorkbook(workbook);

      const computeSuggestion = result.suggestions.find(s => 
        s.message.includes('uncomputed formulas')
      );
      expect(computeSuggestion).toBeDefined();
      expect(computeSuggestion?.suggestion).toContain('compute operation');
    });
  });

  describe('validation options', () => {
    it('should respect checkFormulaErrors=false', () => {
      const workbook = createWorkbook('NoCheck');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=1/0', 
        dataType: 'formula',
        computed: { v: '#DIV/0!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook, { checkFormulaErrors: false });

      const formulaError = result.warnings.find(w => w.category === 'formula-error');
      expect(formulaError).toBeUndefined();
    });

    it('should respect checkMissingCompute=false', () => {
      const workbook = createWorkbook('NoCheckMissing');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook, { checkMissingCompute: false });

      const missingCompute = result.warnings.find(w => w.category === 'missing-compute');
      expect(missingCompute).toBeUndefined();
    });

    it('should respect checkPerformance=false', () => {
      const workbook = createWorkbook('NoCheckPerf');
      const sheetId = workbook.sheets[0].id;
      
      for (let i = 1; i <= 1001; i++) {
        setCell(workbook, sheetId, `A${i}`, { 
          formula: '=1+1', 
          dataType: 'formula'
        });
      }

      const result = validateWorkbook(workbook, { checkPerformance: false });

      const perfWarning = result.warnings.find(w => w.category === 'performance');
      expect(perfWarning).toBeUndefined();
    });

    it('should respect provideSuggestions=false', () => {
      const workbook = createWorkbook('NoSuggestions');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=10+20', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook, { provideSuggestions: false });

      expect(result.suggestions).toHaveLength(0);
    });

    it('should allow all checks disabled', () => {
      const workbook = createWorkbook('AllDisabled');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=1/0', 
        dataType: 'formula',
        computed: { v: '#DIV/0!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook, {
        checkFormulaErrors: false,
        checkCircularReferences: false,
        checkMissingCompute: false,
        checkStaleCompute: false,
        checkInvalidReferences: false,
        checkPerformance: false,
        provideSuggestions: false,
      });

      expect(result.totalIssues).toBe(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validation result structure', () => {
    it('should include all required fields', () => {
      const workbook = createWorkbook('Complete');
      
      const result = validateWorkbook(workbook);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('totalIssues');
      expect(result).toHaveProperty('validatedAt');
      expect(result).toHaveProperty('summary');
      
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(typeof result.isValid).toBe('boolean');
      expect(typeof result.totalIssues).toBe('number');
      expect(typeof result.validatedAt).toBe('string');
      expect(typeof result.summary).toBe('string');
    });

    it('should calculate totalIssues correctly', () => {
      const workbook = createWorkbook('Total');
      const sheetId = workbook.sheets[0].id;
      
      // 1 error (invalid reference)
      setCell(workbook, sheetId, 'A1', { 
        formula: '=BadSheet!B1', 
        dataType: 'formula'
      });
      
      // 1 warning (uncomputed)
      setCell(workbook, sheetId, 'A2', { 
        formula: '=10+20', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook);

      expect(result.totalIssues).toBe(result.errors.length + result.warnings.length + result.suggestions.length);
    });

    it('should generate appropriate summary messages', () => {
      const valid = createWorkbook('Valid');
      const validResult = validateWorkbook(valid);
      expect(validResult.summary).toContain('passed with no issues');

      const withWarnings = createWorkbook('Warnings');
      setCell(withWarnings, withWarnings.sheets[0].id, 'A1', { 
        formula: '=1+1', 
        dataType: 'formula'
      });
      const warningsResult = validateWorkbook(withWarnings);
      expect(warningsResult.summary).toContain('valid but has');

      const withErrors = createWorkbook('Errors');
      setCell(withErrors, withErrors.sheets[0].id, 'A1', { 
        formula: '=BadSheet!B1', 
        dataType: 'formula'
      });
      const errorsResult = validateWorkbook(withErrors);
      expect(errorsResult.summary).toContain('failed');
    });
  });

  describe('formatValidationResult', () => {
    it('should format result as readable text', () => {
      const workbook = createWorkbook('Format');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=BadSheet!B1', 
        dataType: 'formula'
      });

      const result = validateWorkbook(workbook);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('WORKBOOK VALIDATION REPORT');
      expect(formatted).toContain('Status:');
      expect(formatted).toContain('Total Issues:');
      expect(formatted).toContain('ERRORS');
    });

    it('should include error details in formatted output', () => {
      const workbook = createWorkbook('Details');
      const sheetId = workbook.sheets[0].id;
      
      setCell(workbook, sheetId, 'A1', { 
        formula: '=1/0', 
        dataType: 'formula',
        computed: { v: '#DIV/0!', t: 'e', ts: new Date().toISOString() }
      });

      const result = validateWorkbook(workbook);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('Sheet1');
      expect(formatted).toContain('A1');
      expect(formatted).toContain('#DIV/0!');
    });

    it('should format clean workbooks correctly', () => {
      const workbook = createWorkbook('Clean');
      
      const result = validateWorkbook(workbook);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('✅ VALID');
      expect(formatted).toContain('passed with no issues');
    });
  });
});
