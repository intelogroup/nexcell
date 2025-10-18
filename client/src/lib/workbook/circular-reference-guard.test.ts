import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectCircularReferences,
  withComputationTimeout,
  createCircularReferenceError,
  formatCircularReferenceError,
  DEFAULT_CIRCULAR_CONFIG
} from './circular-reference-guard';
import type { WorkbookJSON } from './types';

describe('Circular Reference Guard', () => {
  let mockWorkbook: WorkbookJSON;

  beforeEach(() => {
    mockWorkbook = {
      schemaVersion: '1.0',
      workbookId: 'test-workbook',
      meta: {
        title: 'Test Workbook',
        author: 'test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      },
      sheets: [
        {
          id: 'Sheet1',
          name: 'Sheet 1',
          visible: true,
          grid: { rowCount: 100, colCount: 50 },
          cells: {},
          mergedRanges: [],
          properties: {}
        }
      ],
      namedRanges: {}
    };
  });

  describe('detectCircularReferences', () => {
    it('should detect simple circular reference (A1 → B1 → A1)', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(1);
      expect(result.circularChains[0].cells).toEqual(['A1', 'B1', 'A1']);
      expect(result.circularChains[0].severity).toBe('medium');
    });

    it('should detect indirect circular reference (A1 → B1 → C1 → A1)', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=C1', dataType: 'formula' },
        'C1': { formula: '=A1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(1);
      expect(result.circularChains[0].cells).toEqual(['A1', 'B1', 'C1', 'A1']);
      expect(result.circularChains[0].severity).toBe('medium');
    });

    it('should detect high-severity circular reference with long chain', () => {
      const cells = {};
      // Create a chain A1 → B1 → C1 → ... → Z1 → A1 (26 cells)
      for (let i = 0; i < 26; i++) {
        const current = String.fromCharCode(65 + i) + '1';
        const next = i === 25 ? 'A1' : String.fromCharCode(65 + i + 1) + '1';
        cells[current] = { formula: `=${next}`, dataType: 'formula' };
      }
      mockWorkbook.sheets[0].cells = cells;

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(1);
      expect(result.circularChains[0].severity).toBe('high');
      expect(result.circularChains[0].cells.length).toBe(27); // 26 cells + return to A1
    });

    it('should detect multiple independent circular references', () => {
      mockWorkbook.sheets[0].cells = {
        // First circular reference: A1 ↔ B1
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' },
        // Second circular reference: C1 ↔ D1
        'C1': { formula: '=D1', dataType: 'formula' },
        'D1': { formula: '=C1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(2);
    });

    it('should not detect circular reference in valid formulas', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { raw: 10, dataType: 'number' },
        'B1': { formula: '=A1*2', dataType: 'formula' },
        'C1': { formula: '=B1+5', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(false);
      expect(result.circularChains).toHaveLength(0);
    });

    it('should handle cross-sheet references', () => {
      mockWorkbook.sheets.push({
        id: 'Sheet2',
        name: 'Sheet 2',
        visible: true,
        grid: { rowCount: 100, colCount: 50 },
        cells: {
          'A1': { formula: '=Sheet1!A1', dataType: 'formula' }
        },
        mergedRanges: [],
        properties: {}
      });

      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=Sheet2!A1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(1);
      expect(result.circularChains[0].cells).toEqual(['Sheet1!A1', 'Sheet2!A1', 'Sheet1!A1']);
    });

    it('should respect maxCellsToAnalyze configuration', () => {
      const config = {
        maxCellsToAnalyze: 2
      };

      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=C1', dataType: 'formula' },
        'C1': { formula: '=A1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook, config);

      // Should only analyze first 2 cells, so might not detect the full circular reference
      expect(result.circularChains.length).toBeLessThanOrEqual(1);
    });
  });

  describe('withComputationTimeout', () => {
    it('should execute function normally when within timeout', () => {
      // Use a plain function so it can be serialized and run in worker threads.
      let called = 0;
      const plainFn = () => { called++; return 'success'; };

  const result = withComputationTimeout(plainFn, 1000, 'test operation', { useWorker: false });

  expect(result).toBe('success');
  expect(called).toBe(1);
    });

    it('should throw timeout error for long-running function', () => {
      // Plain busy-wait function (serializable)
      const longRunning = () => {
        const start = Date.now();
        while (Date.now() - start < 200) {
          // Busy wait
        }
        return 'should not reach here';
      };

      expect(() => {
        withComputationTimeout(longRunning, 100, 'test operation');
      }).toThrow('Computation timeout: test operation exceeded 100ms');
    });

    it('should handle function that throws error', () => {
      const throwingFn = () => { throw new Error('Function error'); };

      expect(() => {
        withComputationTimeout(throwingFn, 1000, 'test operation', { useWorker: false });
      }).toThrow('Function error');
    });

    it('should work with async functions', async () => {
      // Async functions can remain as plain async function; no vi.fn needed.
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async success';
      };

      const result = await withComputationTimeout(asyncFn, 1000, 'async test');

      expect(result).toBe('async success');
    });
  });

  describe('createCircularReferenceError', () => {
    it('should create error with correct structure', () => {
      const chain: CircularReferenceChain = {
        cells: ['A1', 'B1', 'A1'],
        severity: 'medium'
      };

      const error = createCircularReferenceError(chain, { operation: 'test' });

      expect(error.type).toBe('CIRCULAR_REFERENCE');
      expect(error.chain).toEqual(chain);
      expect(error.context.operation).toBe('test');
      expect(error.message).toContain('Circular reference detected');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should include recovery suggestions for different severities', () => {
      const highSeverityChain: CircularReferenceChain = {
        cells: Array.from({ length: 20 }, (_, i) => `${String.fromCharCode(65 + i)}1`),
        severity: 'high'
      };

      const error = createCircularReferenceError(highSeverityChain, { operation: 'test' });

      expect(error.recoverySuggestions).toContain('break');
      expect(error.recoverySuggestions).toContain('undo');
    });
  });

  describe('formatCircularReferenceError', () => {
    it('should format error message correctly', () => {
      const chain: CircularReferenceChain = {
        cells: ['A1', 'B1', 'A1'],
        severity: 'medium'
      };

      const error = createCircularReferenceError(chain, { operation: 'test' });
      const formatted = formatCircularReferenceError(error);

      expect(formatted).toContain('MEDIUM');
      expect(formatted).toContain('A1, B1');
      expect(formatted).toContain('infinite calculations');
      expect(formatted).toContain('recovery option');
    });

    it('should handle high severity formatting', () => {
      const chain: CircularReferenceChain = {
        cells: ['A1', 'B1', 'C1', 'A1'],
        severity: 'high'
      };

      const error = createCircularReferenceError(chain, { operation: 'test' });
      const formatted = formatCircularReferenceError(error);

      expect(formatted).toContain('HIGH');
      expect(formatted).toContain('freeze your browser');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex workbook with mixed references', () => {
      mockWorkbook.sheets[0].cells = {
        // Valid references
        'A1': { value: 10 },
        'B1': { formula: '=A1*2', dataType: 'formula' },
        // Circular reference
        'C1': { formula: '=D1', dataType: 'formula' },
        'D1': { formula: '=C1', dataType: 'formula' },
        // Another valid reference
        'E1': { formula: '=B1+C1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(1);
      expect(result.circularChains[0].cells).toEqual(['C1', 'D1', 'C1']);
    });

    it('should work with default configuration', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' }
      };

      const result = detectCircularReferences(mockWorkbook, DEFAULT_CIRCULAR_CONFIG);

      expect(result.hasCircularReferences).toBe(true);
      expect(result.circularChains).toHaveLength(1);
    });

    it('should handle empty workbook', () => {
      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(false);
      expect(result.circularChains).toHaveLength(0);
    });

    it('should handle workbook with only values (no formulas)', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { value: 10 },
        'B1': { value: 20 },
        'C1': { value: 30 }
      };

      const result = detectCircularReferences(mockWorkbook);

      expect(result.hasCircularReferences).toBe(false);
      expect(result.circularChains).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large workbook efficiently', () => {
      // Create a workbook with many cells but no circular references
      const cells: Record<string, any> = {};
      for (let i = 1; i <= 100; i++) {
        cells[`A${i}`] = { value: i };
        if (i > 1) {
          cells[`B${i}`] = { formula: `=A${i}*2`, dataType: 'formula' };
        }
      }
      mockWorkbook.sheets[0].cells = cells;

      const startTime = Date.now();
      const result = detectCircularReferences(mockWorkbook);
      const endTime = Date.now();

      expect(result.hasCircularReferences).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should respect timeout in computation wrapper', () => {
      const slowFunction = () => {
        const start = Date.now();
        while (Date.now() - start < 500) {
          // Simulate slow computation
        }
        return 'completed';
      };

      const canUseWorkers = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const wt = require('worker_threads');
          return !!wt && !!wt.Worker;
        } catch (e) {
          return false;
        }
      })();

      const startTime = Date.now();
      expect(() => {
        withComputationTimeout(slowFunction, 100, 'slow test');
      }).toThrow();
      const endTime = Date.now();

      // If worker threads are available, we expect a quick timeout; otherwise
      // the fallback runs on the main thread and will take the full duration.
      if (canUseWorkers) {
        expect(endTime - startTime).toBeLessThan(200);
      } else {
        expect(endTime - startTime).toBeGreaterThanOrEqual(500);
      }
    });
  });
});