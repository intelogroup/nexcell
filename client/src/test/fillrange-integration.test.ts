/**
 * Integration tests for fillRange and setRange AI action converters
 * Tests both the conversion logic and simulated MainLayout integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { convertToWorkbookActions, type StructuredAction } from '@/lib/ai/openrouter';

describe('fillRange converter integration', () => {
  const mockWorkbookContext = {
    currentSheet: {
      cells: {},
      grid: { rowCount: 1000, colCount: 50 }
    }
  };

  describe('AI-generated fillRange actions with action.target', () => {
    it('should convert single-column fillRange with nested arrays (A3:A12)', () => {
      const action: StructuredAction = {
        type: 'fillRange',
        target: { start: 'A3', end: 'A12' },
        values: [
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample'],
          ['Original Text Sample']
        ]
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(10);
      expect(operations[0]).toEqual({
        address: 'A3',
        cell: { raw: 'Original Text Sample', dataType: 'string' }
      });
      expect(operations[9]).toEqual({
        address: 'A12',
        cell: { raw: 'Original Text Sample', dataType: 'string' }
      });
    });

    it('should handle 4 fillRange actions (40 total operations for A3:D12)', () => {
      const actions: StructuredAction[] = [
        { type: 'fillRange', target: { start: 'A3', end: 'A12' }, values: Array(10).fill(['Sample A']) },
        { type: 'fillRange', target: { start: 'B3', end: 'B12' }, values: Array(10).fill(['Sample B']) },
        { type: 'fillRange', target: { start: 'C3', end: 'C12' }, values: Array(10).fill(['Sample C']) },
        { type: 'fillRange', target: { start: 'D3', end: 'D12' }, values: Array(10).fill(['Sample D']) }
      ];

      const operations = convertToWorkbookActions(actions, mockWorkbookContext);

      expect(operations).toHaveLength(40);
      
      // Verify first column
      expect(operations[0].address).toBe('A3');
      expect(operations[9].address).toBe('A12');
      
      // Verify last column
      expect(operations[39].address).toBe('D12');
    });
  });

  describe('fillRange with action.range property', () => {
    it('should handle multi-column fillRange with 2D array', () => {
      const action: StructuredAction = {
        type: 'fillRange',
        range: { start: 'A20', end: 'C22' },
        values: [
          ['a1', 'b1', 'c1'],
          ['a2', 'b2', 'c2'],
          ['a3', 'b3', 'c3']
        ]
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(9);
      expect(operations[0]).toEqual({ address: 'A20', cell: { raw: 'a1', dataType: 'string' } });
      expect(operations[4]).toEqual({ address: 'B21', cell: { raw: 'b2', dataType: 'string' } });
      expect(operations[8]).toEqual({ address: 'C22', cell: { raw: 'c3', dataType: 'string' } });
    });
  });

  describe('edge cases', () => {
    it('should handle flat array values for single column', () => {
      const action: StructuredAction = {
        type: 'fillRange',
        range: { start: 'E3', end: 'E7' },
        values: [1, 2, 3, 4, 5] as any // AI might send flat array
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(5);
      expect(operations[0]).toEqual({ address: 'E3', cell: { raw: 1, dataType: 'number' } });
      expect(operations[4]).toEqual({ address: 'E7', cell: { raw: 5, dataType: 'number' } });
    });

    it('should handle missing end (treat as start-only range)', () => {
      const action: StructuredAction = {
        type: 'fillRange',
        target: { start: 'G3' } as any,
        values: [['x'], ['y']]
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(2);
      expect(operations[0]).toEqual({ address: 'G3', cell: { raw: 'x', dataType: 'string' } });
      expect(operations[1]).toEqual({ address: 'G4', cell: { raw: 'y', dataType: 'string' } });
    });

    it('should handle large range with fewer values (only create ops for provided)', () => {
      const action: StructuredAction = {
        type: 'fillRange',
        target: { start: 'H3', end: 'H100' },
        values: [['a'], ['b']]
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(2);
      expect(operations[0].address).toBe('H3');
      expect(operations[1].address).toBe('H4');
    });
  });
});

describe('setRange converter integration', () => {
  const mockWorkbookContext = {
    currentSheet: {
      cells: {},
      grid: { rowCount: 1000, colCount: 50 }
    }
  };

  describe('setRange with range and values (2D array)', () => {
    it('should convert 2x4 block starting at A5', () => {
      const action: StructuredAction = {
        type: 'setRange',
        range: { start: 'A5', end: 'D6' },
        values: [
          [1, 2, 3, 4],
          [5, 6, 7, 8]
        ]
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(8);
      expect(operations[0]).toEqual({ address: 'A5', cell: { raw: 1, dataType: 'number' } });
      expect(operations[3]).toEqual({ address: 'D5', cell: { raw: 4, dataType: 'number' } });
      expect(operations[7]).toEqual({ address: 'D6', cell: { raw: 8, dataType: 'number' } });
    });

    it('should handle mixed data types in 2D array', () => {
      const action: StructuredAction = {
        type: 'setRange',
        range: { start: 'B2', end: 'C3' },
        values: [
          ['text', 42],
          [true, '2024-01-15']
        ]
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(4);
      expect(operations[0].cell.dataType).toBe('string');
      expect(operations[1].cell.dataType).toBe('number');
      expect(operations[2].cell.dataType).toBe('boolean');
      expect(operations[3].cell.dataType).toBe('date');
    });
  });

  describe('setRange with cells object', () => {
    it('should convert cells object format', () => {
      const action: StructuredAction = {
        type: 'setRange',
        cells: {
          'A1': 'Header',
          'B1': 100,
          'C1': true
        }
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(3);
      expect(operations.find(op => op.address === 'A1')?.cell).toEqual({
        raw: 'Header',
        dataType: 'string'
      });
      expect(operations.find(op => op.address === 'B1')?.cell).toEqual({
        raw: 100,
        dataType: 'number'
      });
    });

    it('should handle formulas in cells object', () => {
      const action: StructuredAction = {
        type: 'setRange',
        cells: {
          'D10': { formula: '=SUM(D1:D9)', dataType: 'formula' } as any
        }
      };

      const operations = convertToWorkbookActions([action], mockWorkbookContext);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        address: 'D10',
        cell: { formula: '=SUM(D1:D9)', dataType: 'formula' }
      });
    });
  });
});

describe('Simulated MainLayout integration', () => {
  it('should simulate the AI training data scenario end-to-end', () => {
    // Simulate AI extracting actions from "add sample data" prompt
    const extractedActions: StructuredAction[] = [
      {
        type: 'fillRange',
        target: { start: 'A3', end: 'A12' },
        values: Array(10).fill(['Original Text Sample'])
      },
      {
        type: 'fillRange',
        target: { start: 'B3', end: 'B12' },
        values: Array(10).fill(['Kreyol Text Sample'])
      },
      {
        type: 'fillRange',
        target: { start: 'C3', end: 'C12' },
        values: Array(10).fill(['Source Info'])
      },
      {
        type: 'fillRange',
        target: { start: 'D3', end: 'D12' },
        values: Array(10).fill(['Context Info'])
      }
    ];

    // Simulate convertToWorkbookActions call from MainLayout
    const mockContext = {
      currentSheet: {
        cells: {
          'A1': { raw: 'Original Text', dataType: 'string' },
          'B1': { raw: 'Translated Text', dataType: 'string' },
          'C1': { raw: 'Source', dataType: 'string' },
          'D1': { raw: 'Context', dataType: 'string' }
        },
        grid: { rowCount: 1000, colCount: 50 }
      }
    };

    const operations = convertToWorkbookActions(extractedActions, mockContext);

    // Verify the operations that would be passed to batchSetCells
    expect(operations).toHaveLength(40);
    
    // Verify first row of data (row 3)
    expect(operations[0]).toEqual({
      address: 'A3',
      cell: { raw: 'Original Text Sample', dataType: 'string' }
    });
    
    // Verify last row of data (row 12)
    expect(operations[39]).toEqual({
      address: 'D12',
      cell: { raw: 'Context Info', dataType: 'string' }
    });

    // Verify addresses are distributed correctly across columns
    const addressesByColumn = operations.reduce((acc, op) => {
      const col = op.address[0];
      acc[col] = (acc[col] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(addressesByColumn).toEqual({
      A: 10,
      B: 10,
      C: 10,
      D: 10
    });
  });

  it('should simulate budget table creation scenario', () => {
    const actions: StructuredAction[] = [
      {
        type: 'setRange',
        range: { start: 'A1', end: 'E1' },
        values: [['Item', 'Category', 'Amount', 'Date', 'Notes']]
      },
      {
        type: 'fillRange',
        target: { start: 'A2', end: 'A11' },
        values: [
          ['Groceries'], ['Gas'], ['Utilities'], ['Rent'],
          ['Insurance'], ['Entertainment'], ['Healthcare'],
          ['Transportation'], ['Education'], ['Savings']
        ]
      }
    ];

    const operations = convertToWorkbookActions(actions, {
      currentSheet: { cells: {}, grid: { rowCount: 1000, colCount: 50 } }
    });

    // 5 header cells + 10 item cells = 15 total
    expect(operations).toHaveLength(15);
    
    // Verify headers
    expect(operations.slice(0, 5).map(op => op.cell.raw)).toEqual([
      'Item', 'Category', 'Amount', 'Date', 'Notes'
    ]);
    
    // Verify first and last items
    expect(operations[5].cell.raw).toBe('Groceries');
    expect(operations[14].cell.raw).toBe('Savings');
  });
});
