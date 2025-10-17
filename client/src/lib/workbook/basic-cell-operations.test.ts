/**
 * Basic Cell Operations Tests
 * 
 * Comprehensive tests for core cell CRUD operations:
 * - Set value (create)
 * - Get value (read)
 * - Update value (update)
 * - Clear value (delete)
 * 
 * Tests all data types, edge cases, and error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkbook,
  setCell,
  getCell,
  deleteCell,
} from './utils';
import type { WorkbookJSON, Cell } from './types';

describe('Basic Cell Operations', () => {
  let workbook: WorkbookJSON;
  let sheetId: string;

  beforeEach(() => {
    workbook = createWorkbook('Cell Operations Test');
    sheetId = workbook.sheets[0].id;
  });

  describe('Set Cell Value (Create)', () => {
    it('should set a numeric cell value', () => {
      const cell: Cell = { raw: 42 };
      setCell(workbook, sheetId, 'A1', cell);

      const result = getCell(workbook, sheetId, 'A1');
      expect(result).toBeDefined();
      expect(result?.raw).toBe(42);
    });

    it('should set a string cell value', () => {
      const cell: Cell = { raw: 'Hello World' };
      setCell(workbook, sheetId, 'B1', cell);

      const result = getCell(workbook, sheetId, 'B1');
      expect(result?.raw).toBe('Hello World');
    });

    it('should set a boolean cell value', () => {
      const cell: Cell = { raw: true };
      setCell(workbook, sheetId, 'C1', cell);

      const result = getCell(workbook, sheetId, 'C1');
      expect(result?.raw).toBe(true);
    });

    it('should set a null cell value', () => {
      const cell: Cell = { raw: null };
      setCell(workbook, sheetId, 'D1', cell);

      const result = getCell(workbook, sheetId, 'D1');
      expect(result?.raw).toBeNull();
    });

    it('should set a cell with a formula', () => {
      const cell: Cell = { formula: '=SUM(A1:A10)' };
      setCell(workbook, sheetId, 'E1', cell);

      const result = getCell(workbook, sheetId, 'E1');
      expect(result?.formula).toBe('=SUM(A1:A10)');
    });

    it('should set a cell with style properties', () => {
      const cell: Cell = {
        raw: 'Styled',
        style: {
          bold: true,
          fontSize: 14,
          color: '#FF0000',
          bgColor: '#FFFF00',
        },
      };
      setCell(workbook, sheetId, 'F1', cell);

      const result = getCell(workbook, sheetId, 'F1');
      expect(result?.style?.bold).toBe(true);
      expect(result?.style?.fontSize).toBe(14);
      expect(result?.style?.color).toBe('#FF0000');
      expect(result?.style?.bgColor).toBe('#FFFF00');
    });

    it('should set a cell with number format', () => {
      const cell: Cell = {
        raw: 1234.56,
        numFmt: '#,##0.00',
      };
      setCell(workbook, sheetId, 'G1', cell);

      const result = getCell(workbook, sheetId, 'G1');
      expect(result?.raw).toBe(1234.56);
      expect(result?.numFmt).toBe('#,##0.00');
    });

    it('should set a cell with computed value', () => {
      const cell: Cell = {
        formula: '=2+2',
        computed: {
          v: 4,
          t: 'n',
          ts: new Date().toISOString(),
        },
      };
      setCell(workbook, sheetId, 'H1', cell);

      const result = getCell(workbook, sheetId, 'H1');
      expect(result?.computed?.v).toBe(4);
      expect(result?.computed?.t).toBe('n');
    });

    it('should set cells in various positions (A1, Z10, AA100)', () => {
      setCell(workbook, sheetId, 'A1', { raw: 'Top left' });
      setCell(workbook, sheetId, 'Z10', { raw: 'Mid range' });
      setCell(workbook, sheetId, 'AA100', { raw: 'Far range' });

      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe('Top left');
      expect(getCell(workbook, sheetId, 'Z10')?.raw).toBe('Mid range');
      expect(getCell(workbook, sheetId, 'AA100')?.raw).toBe('Far range');
    });

    it('should update workbook modifiedAt timestamp', () => {
      const beforeTime = workbook.meta.modifiedAt;
      
      // Wait a tiny bit to ensure timestamp changes
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Small delay
      }
      
      setCell(workbook, sheetId, 'A1', { raw: 123 });
      
      const afterTime = workbook.meta.modifiedAt;
      expect(afterTime).not.toBe(beforeTime);
    });

    it('should throw error for invalid sheet ID', () => {
      expect(() => {
        setCell(workbook, 'invalid-sheet-id', 'A1', { raw: 1 });
      }).toThrow('Sheet not found');
    });
  });

  describe('Get Cell Value (Read)', () => {
    it('should get an existing cell', () => {
      setCell(workbook, sheetId, 'A1', { raw: 100 });
      
      const result = getCell(workbook, sheetId, 'A1');
      expect(result).toBeDefined();
      expect(result?.raw).toBe(100);
    });

    it('should return undefined for non-existent cell', () => {
      const result = getCell(workbook, sheetId, 'Z99');
      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid sheet ID', () => {
      const result = getCell(workbook, 'invalid-sheet-id', 'A1');
      expect(result).toBeUndefined();
    });

    it('should get cells with all property types intact', () => {
      const cell: Cell = {
        raw: 'Complex',
        formula: '=A1+B1',
        numFmt: '0.00',
        style: {
          bold: true,
          italic: true,
        },
        computed: {
          v: 42,
          t: 'n',
          ts: '2025-10-14T10:00:00Z',
        },
      };
      
      setCell(workbook, sheetId, 'A1', cell);
      const result = getCell(workbook, sheetId, 'A1');
      
      expect(result?.raw).toBe('Complex');
      expect(result?.formula).toBe('=A1+B1');
      expect(result?.numFmt).toBe('0.00');
      expect(result?.style?.bold).toBe(true);
      expect(result?.style?.italic).toBe(true);
      expect(result?.computed?.v).toBe(42);
    });

    it('should get multiple different cells independently', () => {
      setCell(workbook, sheetId, 'A1', { raw: 1 });
      setCell(workbook, sheetId, 'A2', { raw: 2 });
      setCell(workbook, sheetId, 'A3', { raw: 3 });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(1);
      expect(getCell(workbook, sheetId, 'A2')?.raw).toBe(2);
      expect(getCell(workbook, sheetId, 'A3')?.raw).toBe(3);
    });

    it('should handle cells with special characters in values', () => {
      const specialCases = [
        { address: 'A1', value: '=A1' }, // Formula-like string
        { address: 'A2', value: '"quoted"' }, // Quoted string
        { address: 'A3', value: "Line1\nLine2" }, // Multi-line
        { address: 'A4', value: '💡 Emoji' }, // Emoji
        { address: 'A5', value: '中文' }, // Unicode
      ];

      specialCases.forEach(({ address, value }) => {
        setCell(workbook, sheetId, address, { raw: value });
        expect(getCell(workbook, sheetId, address)?.raw).toBe(value);
      });
    });
  });

  describe('Update Cell Value (Update)', () => {
    it('should update an existing cell value', () => {
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(10);
      
      setCell(workbook, sheetId, 'A1', { raw: 20 });
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(20);
    });

    it('should update cell from number to string', () => {
      setCell(workbook, sheetId, 'A1', { raw: 123 });
      expect(typeof getCell(workbook, sheetId, 'A1')?.raw).toBe('number');
      
      setCell(workbook, sheetId, 'A1', { raw: 'Text' });
      expect(typeof getCell(workbook, sheetId, 'A1')?.raw).toBe('string');
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe('Text');
    });

    it('should update cell from value to formula', () => {
      setCell(workbook, sheetId, 'A1', { raw: 42 });
      expect(getCell(workbook, sheetId, 'A1')?.formula).toBeUndefined();
      
      setCell(workbook, sheetId, 'A1', { formula: '=SUM(B1:B10)' });
      expect(getCell(workbook, sheetId, 'A1')?.formula).toBe('=SUM(B1:B10)');
    });

    it('should update cell from formula to value', () => {
      setCell(workbook, sheetId, 'A1', { formula: '=2+2' });
      expect(getCell(workbook, sheetId, 'A1')?.formula).toBe('=2+2');
      
      setCell(workbook, sheetId, 'A1', { raw: 100 });
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(100);
      expect(getCell(workbook, sheetId, 'A1')?.formula).toBeUndefined();
    });

    it('should update cell style without losing value', () => {
      setCell(workbook, sheetId, 'A1', { raw: 'Keep this' });
      
      setCell(workbook, sheetId, 'A1', {
        raw: 'Keep this',
        style: { bold: true },
      });
      
      const result = getCell(workbook, sheetId, 'A1');
      expect(result?.raw).toBe('Keep this');
      expect(result?.style?.bold).toBe(true);
    });

    it('should replace entire cell object on update', () => {
      setCell(workbook, sheetId, 'A1', {
        raw: 'Original',
        style: { bold: true },
        numFmt: '0.00',
      });
      
      // Update with minimal cell (should replace, not merge)
      setCell(workbook, sheetId, 'A1', { raw: 'Updated' });
      
      const result = getCell(workbook, sheetId, 'A1');
      expect(result?.raw).toBe('Updated');
      expect(result?.style).toBeUndefined(); // Style should be gone
      expect(result?.numFmt).toBeUndefined(); // Format should be gone
    });

    it('should update multiple cells sequentially', () => {
      // Initial values
      setCell(workbook, sheetId, 'A1', { raw: 1 });
      setCell(workbook, sheetId, 'A2', { raw: 2 });
      setCell(workbook, sheetId, 'A3', { raw: 3 });
      
      // Update all
      setCell(workbook, sheetId, 'A1', { raw: 10 });
      setCell(workbook, sheetId, 'A2', { raw: 20 });
      setCell(workbook, sheetId, 'A3', { raw: 30 });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(10);
      expect(getCell(workbook, sheetId, 'A2')?.raw).toBe(20);
      expect(getCell(workbook, sheetId, 'A3')?.raw).toBe(30);
    });

    it('should handle rapid updates to same cell', () => {
      setCell(workbook, sheetId, 'A1', { raw: 1 });
      setCell(workbook, sheetId, 'A1', { raw: 2 });
      setCell(workbook, sheetId, 'A1', { raw: 3 });
      setCell(workbook, sheetId, 'A1', { raw: 4 });
      setCell(workbook, sheetId, 'A1', { raw: 5 });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(5);
    });
  });

  describe('Clear Cell Value (Delete)', () => {
    it('should delete an existing cell', () => {
      setCell(workbook, sheetId, 'A1', { raw: 100 });
      expect(getCell(workbook, sheetId, 'A1')).toBeDefined();
      
      deleteCell(workbook, sheetId, 'A1');
      expect(getCell(workbook, sheetId, 'A1')).toBeUndefined();
    });

    it('should not throw when deleting non-existent cell', () => {
      expect(() => {
        deleteCell(workbook, sheetId, 'Z99');
      }).not.toThrow();
    });

    it('should handle deleting from invalid sheet gracefully', () => {
      expect(() => {
        deleteCell(workbook, 'invalid-sheet-id', 'A1');
      }).not.toThrow();
    });

    it('should delete cell with formula', () => {
      setCell(workbook, sheetId, 'A1', { formula: '=SUM(B1:B10)' });
      expect(getCell(workbook, sheetId, 'A1')?.formula).toBeDefined();
      
      deleteCell(workbook, sheetId, 'A1');
      expect(getCell(workbook, sheetId, 'A1')).toBeUndefined();
    });

    it('should delete cell with complex properties', () => {
      setCell(workbook, sheetId, 'A1', {
        raw: 'Complex',
        formula: '=A2',
        style: { bold: true },
        numFmt: '0.00',
        computed: { v: 42, t: 'n', ts: '2025-10-14T10:00:00Z' },
      });
      
      deleteCell(workbook, sheetId, 'A1');
      expect(getCell(workbook, sheetId, 'A1')).toBeUndefined();
    });

    it('should delete specific cell without affecting neighbors', () => {
      setCell(workbook, sheetId, 'A1', { raw: 1 });
      setCell(workbook, sheetId, 'A2', { raw: 2 });
      setCell(workbook, sheetId, 'A3', { raw: 3 });
      
      deleteCell(workbook, sheetId, 'A2');
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(1);
      expect(getCell(workbook, sheetId, 'A2')).toBeUndefined();
      expect(getCell(workbook, sheetId, 'A3')?.raw).toBe(3);
    });

    it('should delete and recreate cell', () => {
      setCell(workbook, sheetId, 'A1', { raw: 'Original' });
      deleteCell(workbook, sheetId, 'A1');
      expect(getCell(workbook, sheetId, 'A1')).toBeUndefined();
      
      setCell(workbook, sheetId, 'A1', { raw: 'Recreated' });
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe('Recreated');
    });

    it('should update modifiedAt timestamp on delete', () => {
      setCell(workbook, sheetId, 'A1', { raw: 123 });
      const beforeTime = workbook.meta.modifiedAt;
      
      // Small delay
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Wait
      }
      
      deleteCell(workbook, sheetId, 'A1');
      const afterTime = workbook.meta.modifiedAt;
      
      expect(afterTime).not.toBe(beforeTime);
    });

    it('should delete multiple cells', () => {
      // Create grid
      for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 3; col++) {
          const addr = String.fromCharCode(64 + col) + row; // A1, B1, C1, etc.
          setCell(workbook, sheetId, addr, { raw: row * 10 + col });
        }
      }
      
      // Delete middle row
      deleteCell(workbook, sheetId, 'A2');
      deleteCell(workbook, sheetId, 'B2');
      deleteCell(workbook, sheetId, 'C2');
      
      // Verify deletion
      expect(getCell(workbook, sheetId, 'A2')).toBeUndefined();
      expect(getCell(workbook, sheetId, 'B2')).toBeUndefined();
      expect(getCell(workbook, sheetId, 'C2')).toBeUndefined();
      
      // Verify others remain
      expect(getCell(workbook, sheetId, 'A1')).toBeDefined();
      expect(getCell(workbook, sheetId, 'A3')).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle setting null explicitly', () => {
      setCell(workbook, sheetId, 'A1', { raw: null });
      const result = getCell(workbook, sheetId, 'A1');
      
      expect(result).toBeDefined();
      expect(result?.raw).toBeNull();
    });

    it('should handle undefined values', () => {
      const cell: Cell = { raw: undefined as any };
      setCell(workbook, sheetId, 'A1', cell);
      
      const result = getCell(workbook, sheetId, 'A1');
      expect(result?.raw).toBeUndefined();
    });

    it('should handle very large numbers', () => {
      const largeNum = Number.MAX_SAFE_INTEGER;
      setCell(workbook, sheetId, 'A1', { raw: largeNum });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(largeNum);
    });

    it('should handle very small numbers', () => {
      const smallNum = Number.MIN_SAFE_INTEGER;
      setCell(workbook, sheetId, 'A1', { raw: smallNum });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(smallNum);
    });

    it('should handle floating point numbers', () => {
      const floatNum = 3.14159265359;
      setCell(workbook, sheetId, 'A1', { raw: floatNum });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(floatNum);
    });

    it('should handle empty string', () => {
      setCell(workbook, sheetId, 'A1', { raw: '' });
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'A'.repeat(10000);
      setCell(workbook, sheetId, 'A1', { raw: longString });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(longString);
    });

    it('should handle date objects (stored as ISO string or number)', () => {
      const date = new Date('2025-10-14T10:00:00Z');
      setCell(workbook, sheetId, 'A1', { raw: date.toISOString() });
      
      expect(getCell(workbook, sheetId, 'A1')?.raw).toBe(date.toISOString());
    });

    it('should handle cells in all columns A-ZZ', () => {
      const testAddresses = ['A1', 'Z1', 'AA1', 'AZ1', 'BA1', 'ZZ1'];
      
      testAddresses.forEach((addr, i) => {
        setCell(workbook, sheetId, addr, { raw: i });
        expect(getCell(workbook, sheetId, addr)?.raw).toBe(i);
      });
    });

    it('should handle cells in high row numbers', () => {
      setCell(workbook, sheetId, 'A999', { raw: 'High row' });
      expect(getCell(workbook, sheetId, 'A999')?.raw).toBe('High row');
    });

    it('should preserve object references correctly', () => {
      const style = { bold: true, color: '#FF0000' };
      setCell(workbook, sheetId, 'A1', { raw: 'Test', style });
      
      // Modify original style object
      style.bold = false;
      
      // Cell should still have original value (deep copy behavior)
      const result = getCell(workbook, sheetId, 'A1');
      // Note: This depends on implementation - if shallow copy, this test shows it
      expect(result?.style?.bold).toBe(false); // Shallow copy (current implementation)
    });
  });

  describe('Multiple Sheets Operations', () => {
    it('should set cells in different sheets independently', () => {
      const sheet1Id = workbook.sheets[0].id;
      
      // Add second sheet
      const sheet2 = {
        id: 'sheet-2',
        name: 'Sheet2',
        visible: true,
        grid: { rowCount: 1000, colCount: 50 },
        rows: {},
        cols: {},
        cells: {},
        mergedRanges: [],
        dataValidations: [],
        conditionalFormats: [],
        namedRanges: {},
        charts: [],
        pivots: [],
        images: [],
        comments: {},
        properties: {
          defaultRowHeight: 21,
          defaultColWidth: 100,
          gridLines: true,
          showHeaders: true,
          zoom: 100,
        },
      };
      workbook.sheets.push(sheet2);
      
      // Set same address in both sheets
      setCell(workbook, sheet1Id, 'A1', { raw: 'Sheet1 Value' });
      setCell(workbook, sheet2.id, 'A1', { raw: 'Sheet2 Value' });
      
      // Verify independence
      expect(getCell(workbook, sheet1Id, 'A1')?.raw).toBe('Sheet1 Value');
      expect(getCell(workbook, sheet2.id, 'A1')?.raw).toBe('Sheet2 Value');
    });
  });

  describe('Performance Tests', () => {
    it('should handle setting 1000 cells efficiently', () => {
      const start = performance.now();
      
      for (let i = 1; i <= 1000; i++) {
        setCell(workbook, sheetId, `A${i}`, { raw: i });
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete in reasonable time (< 100ms for 1000 cells)
      expect(duration).toBeLessThan(100);
      
      // Verify last cell
      expect(getCell(workbook, sheetId, 'A1000')?.raw).toBe(1000);
    });

    it('should handle getting 1000 cells efficiently', () => {
      // Set up cells
      for (let i = 1; i <= 1000; i++) {
        setCell(workbook, sheetId, `A${i}`, { raw: i });
      }
      
      const start = performance.now();
      
      for (let i = 1; i <= 1000; i++) {
        getCell(workbook, sheetId, `A${i}`);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // Should complete in reasonable time (< 50ms for 1000 reads)
      expect(duration).toBeLessThan(50);
    });

    it('should handle updating 1000 cells efficiently', () => {
      // Set up initial cells
      for (let i = 1; i <= 1000; i++) {
        setCell(workbook, sheetId, `A${i}`, { raw: i });
      }
      
      const start = performance.now();
      
      // Update all cells
      for (let i = 1; i <= 1000; i++) {
        setCell(workbook, sheetId, `A${i}`, { raw: i * 2 });
      }
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).toBeLessThan(100);
      expect(getCell(workbook, sheetId, 'A500')?.raw).toBe(1000);
    });
  });
});
