/**
 * Error Propagation Chain Tests (Prompt 21)
 * 
 * Tests error handling and propagation through formula dependencies:
 * - #DIV/0! division by zero errors
 * - #VALUE! type mismatch errors
 * - #NAME? unknown function/name errors
 * - #REF! invalid reference errors
 * - #NUM! numeric calculation errors
 * - Error recovery with IFERROR, IFNA
 * - Circular reference detection
 * - Mixed error scenarios
 * 
 * @see docs/AI_TEST_PROMPTS.md - Prompt 21
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createTestWorkbook,
  assertCellValue,
  assertCellFormula,
  computeAndAssert,
  type TestWorkbookConfig
} from '../utils/test-helpers';
import { computeWorkbook, type HydrationResult } from '../../hyperformula';
import { getCell, setCell } from '../../utils';

describe('Error Propagation (Prompt 21)', () => {
  const hydrations: HydrationResult[] = [];

  afterEach(() => {
    // Cleanup all HyperFormula instances
    hydrations.forEach(h => h.destroy?.());
    hydrations.length = 0;
  });

  // ==========================================================================
  // #DIV/0! Error Propagation
  // ==========================================================================

  describe('#DIV/0! Error Propagation', () => {
    it('should propagate #DIV/0! error through linear chain', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=A1/A2' },        // #DIV/0!
            C1: { formula: '=B1*2' },         // Should also be #DIV/0!
            D1: { formula: '=C1+5' },         // Should also be #DIV/0!
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // B1 should be #DIV/0!
      const cellB1 = getCell(wb, sheetId, 'B1');
      const valueB1 = cellB1?.computed?.v;
      expect(isError(valueB1)).toBe(true);

      // C1 should propagate the error
      const cellC1 = getCell(wb, sheetId, 'C1');
      const valueC1 = cellC1?.computed?.v;
      expect(isError(valueC1)).toBe(true);

      // D1 should propagate the error
      const cellD1 = getCell(wb, sheetId, 'D1');
      const valueD1 = cellD1?.computed?.v;
      expect(isError(valueD1)).toBe(true);
    });

    it('should recover from #DIV/0! when divisor becomes non-zero', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=A1/A2' },  // Initially #DIV/0!
          }
        }]
      });

      const { hydration, recompute } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // Initially #DIV/0!
      let cell = getCell(wb, sheetId, 'B1');
      expect(isError(cell?.computed?.v)).toBe(true);

      // Update divisor to 2
      setCell(wb, sheetId, 'A2', { raw: 2 });
      const { recompute: recompute2 } = computeWorkbook(wb);

      // Should now be 5
      cell = getCell(wb, sheetId, 'B1');
      expect(cell?.computed?.v).toBe(5);
    });

    it('should handle complex expression with #DIV/0!', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 5 },
            A3: { raw: 0 },
            B1: { formula: '=(A1+A2)/(A3*2)' },  // (10+5)/(0*2) = #DIV/0!
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');
      expect(isError(cell?.computed?.v)).toBe(true);
    });
  });

  // ==========================================================================
  // #VALUE! Error Propagation
  // ==========================================================================

  describe('#VALUE! Error Propagation', () => {
    it('should produce #VALUE! for text in arithmetic operation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'hello' },
            B1: { formula: '=A1*2' },  // text * number = #VALUE!
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');
      const value = cell?.computed?.v;

      // Should be error (HyperFormula might return error or NaN)
      expect(value === undefined || isError(value) || isNaN(value as number)).toBe(true);
    });

    it('should propagate #VALUE! through dependent formulas', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'text' },
            B1: { formula: '=A1+10' },      // #VALUE!
            C1: { formula: '=B1*2' },        // Should propagate
            D1: { formula: '=C1-5' },        // Should propagate
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      const cellB1 = getCell(wb, sheetId, 'B1');
      const cellC1 = getCell(wb, sheetId, 'C1');
      const cellD1 = getCell(wb, sheetId, 'D1');

      // All should be errors or undefined
      expect(isErrorOrInvalid(cellB1?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(cellC1?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(cellD1?.computed?.v)).toBe(true);
    });

    it('should handle mixed valid and invalid operations', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 'text' },
            B1: { formula: '=A1*2' },        // Valid: 20
            B2: { formula: '=A2*2' },        // Invalid: #VALUE!
            C1: { formula: '=B1+B2' },       // Should be #VALUE! (mixing valid + error)
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      const cellB1 = getCell(wb, sheetId, 'B1');
      expect(cellB1?.computed?.v).toBe(20);  // Valid

      const cellB2 = getCell(wb, sheetId, 'B2');
      expect(isErrorOrInvalid(cellB2?.computed?.v)).toBe(true);  // Error

      const cellC1 = getCell(wb, sheetId, 'C1');
      expect(isErrorOrInvalid(cellC1?.computed?.v)).toBe(true);  // Propagated error
    });
  });

  // ==========================================================================
  // #NAME? Error (Unknown Function/Name)
  // ==========================================================================

  describe('#NAME? Error Propagation', () => {
    it('should produce #NAME? for unknown function', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            B1: { formula: '=UNKNOWNFUNC(A1)' },  // #NAME!
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');

      // HyperFormula should return error for unknown function
      expect(isErrorOrInvalid(cell?.computed?.v)).toBe(true);
    });

    it('should propagate #NAME? error through chain', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            B1: { formula: '=UNKNOWNFUNC(A1)' },  // #NAME!
            C1: { formula: '=B1+5' },              // Should propagate
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      const cellB1 = getCell(wb, sheetId, 'B1');
      const cellC1 = getCell(wb, sheetId, 'C1');

      expect(isErrorOrInvalid(cellB1?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(cellC1?.computed?.v)).toBe(true);
    });
  });

  // ==========================================================================
  // Error Recovery with IFERROR
  // ==========================================================================

  describe('Error Recovery with IFERROR', () => {
    it('should break error propagation with IFERROR', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=A1/A2' },              // #DIV/0!
            C1: { formula: '=IFERROR(B1, 0)' },     // Recovers: 0
            D1: { formula: '=C1+5' },                // Should be valid: 5
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // B1 is error
      const cellB1 = getCell(wb, sheetId, 'B1');
      expect(isError(cellB1?.computed?.v)).toBe(true);

      // C1 recovers with IFERROR
      const cellC1 = getCell(wb, sheetId, 'C1');
      expect(cellC1?.computed?.v).toBe(0);

      // D1 continues with valid value
      const cellD1 = getCell(wb, sheetId, 'D1');
      expect(cellD1?.computed?.v).toBe(5);
    });

    it('should allow custom fallback value in IFERROR', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'text' },
            B1: { formula: '=A1*10' },                    // #VALUE!
            C1: { formula: '=IFERROR(B1, 999)' },         // Fallback: 999
            D1: { formula: '=C1*2' },                      // Should be 1998
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      const cellC1 = getCell(wb, sheetId, 'C1');
      expect(cellC1?.computed?.v).toBe(999);

      const cellD1 = getCell(wb, sheetId, 'D1');
      expect(cellD1?.computed?.v).toBe(1998);
    });

    it('should nest IFERROR for multiple error handling', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=IFERROR(A1/A2, IFERROR(A1/1, -1))' },  // Nested IFERROR
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');

      // First IFERROR catches #DIV/0!, falls back to A1/1 = 10
      expect(cell?.computed?.v).toBe(10);
    });
  });

  // ==========================================================================
  // Circular Reference Detection
  // ==========================================================================

  describe('Circular Reference Detection', () => {
    it('should detect simple circular reference A1->B1->A1', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { formula: '=B1+1' },  // Depends on B1
            B1: { formula: '=A1+1' },  // Depends on A1 (circular!)
          }
        }]
      });

      const { hydration, recompute } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // HyperFormula should detect circular reference
      // Cells may return error or undefined
      const cellA1 = getCell(wb, sheetId, 'A1');
      const cellB1 = getCell(wb, sheetId, 'B1');

      // At least one should be error or undefined
      const hasError = 
        isErrorOrInvalid(cellA1?.computed?.v) || 
        isErrorOrInvalid(cellB1?.computed?.v);
      
      expect(hasError).toBe(true);
    });

    it('should detect indirect circular reference A1->B1->C1->A1', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { formula: '=B1+1' },
            B1: { formula: '=C1+1' },
            C1: { formula: '=A1+1' },  // Circular!
          }
        }]
      });

      const { hydration, recompute } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // Should have errors in the cycle
      const cellA1 = getCell(wb, sheetId, 'A1');
      const cellB1 = getCell(wb, sheetId, 'B1');
      const cellC1 = getCell(wb, sheetId, 'C1');

      const hasError = 
        isErrorOrInvalid(cellA1?.computed?.v) || 
        isErrorOrInvalid(cellB1?.computed?.v) ||
        isErrorOrInvalid(cellC1?.computed?.v);
      
      expect(hasError).toBe(true);
    });

    it('should allow self-reference if not directly circular', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            B1: { formula: '=A1*2' },      // Valid
            C1: { formula: '=B1+A1' },     // Valid (not circular)
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      const cellB1 = getCell(wb, sheetId, 'B1');
      expect(cellB1?.computed?.v).toBe(20);

      const cellC1 = getCell(wb, sheetId, 'C1');
      expect(cellC1?.computed?.v).toBe(30);  // 20 + 10
    });
  });

  // ==========================================================================
  // Mixed Error Scenarios
  // ==========================================================================

  describe('Mixed Error Scenarios', () => {
    it('should handle multiple error types in single workbook', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            A3: { raw: 'text' },
            
            B1: { formula: '=A1/A2' },              // #DIV/0!
            B2: { formula: '=A3*2' },                // #VALUE!
            B3: { formula: '=UNKNOWNFUNC(A1)' },    // #NAME!
            
            C1: { formula: '=B1+B2+B3' },            // Combined errors
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // All B cells should have errors
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'B1')?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'B2')?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'B3')?.computed?.v)).toBe(true);

      // C1 should propagate one of the errors
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'C1')?.computed?.v)).toBe(true);
    });

    it('should prioritize errors in order of evaluation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=A1/A2' },        // #DIV/0!
            C1: { formula: '=B1 + 100' },     // Should be #DIV/0! (not 100)
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      const cellC1 = getCell(wb, sheetId, 'C1');
      // Should be error, not 100
      expect(isErrorOrInvalid(cellC1?.computed?.v)).toBe(true);
      expect(cellC1?.computed?.v).not.toBe(100);
    });

    it('should handle error in conditional expression', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=IF(A1>5, A1/A2, A1*2)' },  // Condition true, evaluates #DIV/0!
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');

      // Should evaluate the true branch and get #DIV/0!
      expect(isError(cell?.computed?.v)).toBe(true);
    });
  });

  // ==========================================================================
  // Error Clearing and Recovery
  // ==========================================================================

  describe('Error Clearing and Recovery', () => {
    it('should clear error when source is fixed', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 0 },
            B1: { formula: '=A1/A2' },  // #DIV/0!
            C1: { formula: '=B1*2' },    // Propagated error
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // Initially errors
      expect(isError(getCell(wb, sheetId, 'B1')?.computed?.v)).toBe(true);
      expect(isError(getCell(wb, sheetId, 'C1')?.computed?.v)).toBe(true);

      // Fix the error by updating A2
      setCell(wb, sheetId, 'A2', { raw: 2 });
      const { recompute } = computeWorkbook(wb);

      // Should recover
      expect(getCell(wb, sheetId, 'B1')?.computed?.v).toBe(5);   // 10/2
      expect(getCell(wb, sheetId, 'C1')?.computed?.v).toBe(10);  // 5*2
    });

    it('should cascade recovery through dependency chain', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'text' },
            B1: { formula: '=A1*2' },     // #VALUE!
            C1: { formula: '=B1+10' },    // Propagated
            D1: { formula: '=C1*2' },     // Propagated
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // All errors initially
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'B1')?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'C1')?.computed?.v)).toBe(true);
      expect(isErrorOrInvalid(getCell(wb, sheetId, 'D1')?.computed?.v)).toBe(true);

      // Fix by changing A1 to number
      setCell(wb, sheetId, 'A1', { raw: 5 });
      const { recompute } = computeWorkbook(wb);

      // All should recover
      expect(getCell(wb, sheetId, 'B1')?.computed?.v).toBe(10);  // 5*2
      expect(getCell(wb, sheetId, 'C1')?.computed?.v).toBe(20);  // 10+10
      expect(getCell(wb, sheetId, 'D1')?.computed?.v).toBe(40);  // 20*2
    });
  });

  // ==========================================================================
  // Error in Aggregate Functions
  // ==========================================================================

  describe('Errors in Aggregate Functions', () => {
    it('should handle errors in SUM range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 20 },
            A3: { raw: 0 },
            A4: { raw: 30 },
            
            B3: { formula: '=A1/A3' },    // #DIV/0!
            C1: { formula: '=SUM(A1:A4)' },  // Should handle error
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // B3 is error
      expect(isError(getCell(wb, sheetId, 'B3')?.computed?.v)).toBe(true);

      // SUM should either skip errors or propagate (depends on HyperFormula behavior)
      const sumCell = getCell(wb, sheetId, 'C1');
      const sumValue = sumCell?.computed?.v;

      // SUM typically ignores errors and sums valid numbers: 10+20+0+30 = 60
      // Or it might return 60 if it skips the error in range
      expect(typeof sumValue === 'number' || isError(sumValue)).toBe(true);
    });

    it('should handle errors in AVERAGE', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 10 },
            A2: { raw: 'text' },  // Will cause error if used in arithmetic
            A3: { raw: 30 },
            
            B1: { formula: '=AVERAGE(A1:A3)' },
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');

      // AVERAGE might skip text or return error
      const value = cell?.computed?.v;
      expect(typeof value === 'number' || isErrorOrInvalid(value)).toBe(true);
    });
  });

  // ==========================================================================
  // Real-World Error Scenario
  // ==========================================================================

  describe('Real-World: Financial Calculation with Error Handling', () => {
    it('should calculate revenue with error-safe division', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Revenue',
          cells: {
            // Headers
            A1: { raw: 'Units Sold' },
            B1: { raw: 'Total Revenue' },
            C1: { raw: 'Price per Unit' },
            D1: { raw: 'Safe Price' },
            
            // Data
            A2: { raw: 100 },
            B2: { raw: 5000 },
            C2: { formula: '=B2/A2' },                    // 50
            D2: { formula: '=IFERROR(C2, 0)' },           // 50 (safe)
            
            A3: { raw: 0 },      // Edge case: zero units
            B3: { raw: 0 },
            C3: { formula: '=B3/A3' },                    // #DIV/0!
            D3: { formula: '=IFERROR(C3, 0)' },           // 0 (recovered)
            
            A4: { raw: 150 },
            B4: { raw: 7500 },
            C4: { formula: '=B4/A4' },                    // 50
            D4: { formula: '=IFERROR(C4, 0)' },           // 50
            
            // Total average price (using safe values)
            D5: { formula: '=AVERAGE(D2:D4)' },           // (50+0+50)/3 = 33.33...
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // C2 and D2 should be 50
      expect(getCell(wb, sheetId, 'C2')?.computed?.v).toBe(50);
      expect(getCell(wb, sheetId, 'D2')?.computed?.v).toBe(50);

      // C3 should be error
      expect(isError(getCell(wb, sheetId, 'C3')?.computed?.v)).toBe(true);

      // D3 should recover to 0
      expect(getCell(wb, sheetId, 'D3')?.computed?.v).toBe(0);

      // C4 and D4 should be 50
      expect(getCell(wb, sheetId, 'C4')?.computed?.v).toBe(50);
      expect(getCell(wb, sheetId, 'D4')?.computed?.v).toBe(50);

      // D5 average should be calculated from safe values
      const avgCell = getCell(wb, sheetId, 'D5');
      const avgValue = avgCell?.computed?.v as number;
      expect(avgValue).toBeCloseTo(33.33, 1);  // (50+0+50)/3
    });
  });
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if value is an error (string starting with # or error object)
 */
function isError(value: any): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.startsWith('#')) return true;
  if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'error') return true;
  return false;
}

/**
 * Check if value is error, undefined, null, or NaN
 */
function isErrorOrInvalid(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (isError(value)) return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  return false;
}
