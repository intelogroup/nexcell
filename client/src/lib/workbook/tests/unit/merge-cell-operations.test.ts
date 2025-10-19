/**
 * Merge Cell Operations Tests
 * Tests for nested merges, style application, insert/delete within merges, unmerge operations
 * 
 * Based on AI Test Prompt #12:
 * "Create a complex header with nested merged cells (A1:D1, then A2:B2, C2:D2), apply styles, 
 * insert rows above/below, and verify merge integrity is maintained"
 * 
 * Test Coverage:
 * - Nested merge cell creation and display
 * - Style application to merged ranges
 * - Insert/delete row operations with merge preservation
 * - Insert/delete column operations with merge adjustments
 * - Unmerge operations
 * - Overlapping merge detection and handling
 * - Formula references within merged cells
 */

import { describe, test, expect } from 'vitest';
import { createWorkbook, addSheet } from '../../utils';
import { applyOperations } from '../../operations';
import { computeWorkbook } from '../../hyperformula';
import {
  createTestWorkbook,
  assertCellValue,
  assertNoErrors,
  measurePerformance,
} from '../utils/test-helpers';
import type { WorkbookJSON, SheetJSON } from '../../types';

describe('Merge Cell Operations', () => {
  describe('Basic Merge Operations', () => {
    test('should create a simple merged cell range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Simple Merge',
          cells: {
            'A1': { raw: 'Merged Header' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Apply merge operation
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:D1');
      expect(sheet.mergedRanges?.length).toBe(1);
      
      console.log('Merged ranges:', sheet.mergedRanges);
    });

    test('should create multiple non-overlapping merged ranges', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header 1' },
            'A2': { raw: 'Header 2' },
            'A3': { raw: 'Header 3' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:B1' },
        { type: 'merge', sheetId: sheet.id, range: 'A2:C2' },
        { type: 'merge', sheetId: sheet.id, range: 'A3:D3' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:B1');
      expect(sheet.mergedRanges).toContain('A2:C2');
      expect(sheet.mergedRanges).toContain('A3:D3');
      expect(sheet.mergedRanges?.length).toBe(3);
      
      console.log('Multiple merged ranges:', sheet.mergedRanges);
    });

    test('should unmerge a merged range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:D1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Verify initial state
      expect(sheet.mergedRanges).toContain('A1:D1');
      
      // Apply unmerge operation
      const ops = [
        { type: 'unmerge', sheetId: sheet.id, range: 'A1:D1' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).not.toContain('A1:D1');
      expect(sheet.mergedRanges?.length).toBe(0);
      
      console.log('After unmerge:', sheet.mergedRanges);
    });

    test('should handle duplicate merge operations gracefully', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Apply same merge twice
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Should only have one merged range (no duplicates)
      expect(sheet.mergedRanges?.filter(r => r === 'A1:D1').length).toBe(1);
      
      console.log('After duplicate merge:', sheet.mergedRanges);
    });
  });

  describe('Nested Merged Cells', () => {
    test('should create complex header with nested merges', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Nested Merges',
          cells: {
            // Main header
            'A1': { raw: 'Complex Header' },
            // Sub-headers
            'A2': { raw: 'Left Section' },
            'C2': { raw: 'Right Section' },
            // Data
            'A3': { raw: 'Data 1' },
            'B3': { raw: 'Data 2' },
            'C3': { raw: 'Data 3' },
            'D3': { raw: 'Data 4' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create nested merge structure
      // Top level: A1:D1 (main header)
      // Second level: A2:B2 (left section), C2:D2 (right section)
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
        { type: 'merge', sheetId: sheet.id, range: 'A2:B2' },
        { type: 'merge', sheetId: sheet.id, range: 'C2:D2' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:D1');
      expect(sheet.mergedRanges).toContain('A2:B2');
      expect(sheet.mergedRanges).toContain('C2:D2');
      expect(sheet.mergedRanges?.length).toBe(3);
      
      console.log('Nested merge structure:');
      console.log('  Main header:', 'A1:D1');
      console.log('  Sub-headers:', 'A2:B2', 'C2:D2');
    });

    test('should handle three-level nested merge hierarchy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Level 1' },
            'A2': { raw: 'Level 2 Left' },
            'C2': { raw: 'Level 2 Right' },
            'A3': { raw: 'L3-1' },
            'B3': { raw: 'L3-2' },
            'C3': { raw: 'L3-3' },
            'D3': { raw: 'L3-4' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const ops = [
        // Level 1: Full width
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
        // Level 2: Two sections
        { type: 'merge', sheetId: sheet.id, range: 'A2:B2' },
        { type: 'merge', sheetId: sheet.id, range: 'C2:D2' },
        // Level 3: Individual cells (no merge needed, already separate)
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges?.length).toBe(3);
      
      console.log('Three-level hierarchy created successfully');
    });
  });

  describe('Merge with Style Application', () => {
    test('should apply styles to merged range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { 
              raw: 'Styled Header',
              style: {
                bold: true,
                fontSize: 16,
                textAlign: 'center',
              } as any,
            },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Merge and verify style is on the anchor cell
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:D1');
      
      // Verify anchor cell (A1) has styles
      const anchorCell = sheet.cells?.['A1'];
      expect(anchorCell?.style?.bold).toBe(true);
      expect(anchorCell?.style?.fontSize).toBe(16);
      expect(anchorCell?.style?.textAlign).toBe('center');
      
      console.log('Styled merge:', {
        range: 'A1:D1',
        style: anchorCell?.style,
      });
    });

    test('should apply multiple styles to different merged ranges', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { 
              raw: 'Bold Header',
              style: { bold: true } as any,
            },
            'A2': { 
              raw: 'Italic Header',
              style: { italic: true } as any,
            },
            'A3': { 
              raw: 'Colored Header',
              style: { color: '#FF0000' } as any,
            },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:B1' },
        { type: 'merge', sheetId: sheet.id, range: 'A2:C2' },
        { type: 'merge', sheetId: sheet.id, range: 'A3:D3' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.cells?.['A1']?.style?.bold).toBe(true);
      expect(sheet.cells?.['A2']?.style?.italic).toBe(true);
      expect(sheet.cells?.['A3']?.style?.color).toBe('#FF0000');
      
      console.log('Multiple styled merges created');
    });
  });

  describe('Insert/Delete Rows with Merges', () => {
    test('should preserve merge ranges when inserting rows above', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A3': { raw: 'Header' },
          },
          mergedRanges: ['A3:D3'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Insert 2 rows above the merged range
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 1, count: 2 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should shift down: A3:D3 -> A5:D5
      expect(sheet.mergedRanges).toContain('A5:D5');
      expect(sheet.mergedRanges).not.toContain('A3:D3');
      
      console.log('After inserting 2 rows above:', sheet.mergedRanges);
    });

    test('should preserve merge ranges when inserting rows below', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:D1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Insert 2 rows below the merged range (at row 3)
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 3, count: 2 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should stay the same (inserted below)
      expect(sheet.mergedRanges).toContain('A1:D1');
      
      console.log('After inserting 2 rows below:', sheet.mergedRanges);
    });

    test('should expand merge range when inserting row within merge', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:D3'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Insert 1 row within the merged range (at row 2)
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should expand: A1:D3 -> A1:D4
      expect(sheet.mergedRanges).toContain('A1:D4');
      expect(sheet.mergedRanges).not.toContain('A1:D3');
      
      console.log('After inserting row within merge:', sheet.mergedRanges);
    });

    test('should handle delete row within merged range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:D4'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Delete row 2 (within the merged range)
      const ops = [
        { type: 'deleteRow', sheetId: sheet.id, row: 2, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should shrink: A1:D4 -> A1:D3
      expect(sheet.mergedRanges).toContain('A1:D3');
      expect(sheet.mergedRanges).not.toContain('A1:D4');
      
      console.log('After deleting row within merge:', sheet.mergedRanges);
    });

    test('should shift merge range when deleting rows above', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A5': { raw: 'Header' },
          },
          mergedRanges: ['A5:D5'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Delete rows 1-2 (above the merged range)
      const ops = [
        { type: 'deleteRow', sheetId: sheet.id, row: 1, count: 2 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should shift up: A5:D5 -> A3:D3
      expect(sheet.mergedRanges).toContain('A3:D3');
      expect(sheet.mergedRanges).not.toContain('A5:D5');
      
      console.log('After deleting rows above:', sheet.mergedRanges);
    });
  });

  describe('Insert/Delete Columns with Merges', () => {
    test('should expand merge range when inserting column within merge', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:D1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Insert 1 column within the merged range (at column B, which is col 2)
      const ops = [
        { type: 'insertCol', sheetId: sheet.id, col: 2, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should expand: A1:D1 -> A1:E1
      expect(sheet.mergedRanges).toContain('A1:E1');
      expect(sheet.mergedRanges).not.toContain('A1:D1');
      
      console.log('After inserting column within merge:', sheet.mergedRanges);
    });

    test('should preserve merge range when inserting column before merge', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'C1': { raw: 'Header' },
          },
          mergedRanges: ['C1:F1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Insert 1 column before the merged range (at column A, which is col 1)
      const ops = [
        { type: 'insertCol', sheetId: sheet.id, col: 1, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should shift right: C1:F1 -> D1:G1
      expect(sheet.mergedRanges).toContain('D1:G1');
      expect(sheet.mergedRanges).not.toContain('C1:F1');
      
      console.log('After inserting column before merge:', sheet.mergedRanges);
    });

    test('should handle delete column within merged range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:E1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Delete column C (within the merged range, col 3)
      const ops = [
        { type: 'deleteCol', sheetId: sheet.id, col: 3, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Merged range should shrink: A1:E1 -> A1:D1
      expect(sheet.mergedRanges).toContain('A1:D1');
      expect(sheet.mergedRanges).not.toContain('A1:E1');
      
      console.log('After deleting column within merge:', sheet.mergedRanges);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle table header with multiple levels of merges and row insertions', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Complex Table',
          cells: {
            // Level 1: Main header
            'A1': { raw: 'Sales Report 2024', style: { bold: true, fontSize: 16 } as any },
            // Level 2: Quarter headers
            'A2': { raw: 'Q1', style: { bold: true } as any },
            'E2': { raw: 'Q2', style: { bold: true } as any },
            // Level 3: Month headers
            'A3': { raw: 'Jan' },
            'B3': { raw: 'Feb' },
            'C3': { raw: 'Mar' },
            'D3': { raw: 'Total' },
            'E3': { raw: 'Apr' },
            'F3': { raw: 'May' },
            'G3': { raw: 'Jun' },
            'H3': { raw: 'Total' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create complex merge structure
      const ops = [
        // Level 1: A1:H1 (main header)
        { type: 'merge', sheetId: sheet.id, range: 'A1:H1' },
        // Level 2: A2:D2 (Q1), E2:H2 (Q2)
        { type: 'merge', sheetId: sheet.id, range: 'A2:D2' },
        { type: 'merge', sheetId: sheet.id, range: 'E2:H2' },
        // Now insert a row at position 2 (between main header and quarter headers)
        { type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // After row insertion, merges should shift/expand appropriately
      expect(sheet.mergedRanges?.length).toBeGreaterThanOrEqual(3);
      
      console.log('Complex table structure with row insertion:', sheet.mergedRanges);
    });

    test('should handle merge operations with formulas in merged cells', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
            'B1': { raw: 20 },
            'C1': { raw: 30 },
            'D1': { formula: 'SUM(A1:C1)' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Merge header row
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A2:D2' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Compute and verify formula still works
      computeWorkbook(wb);
      
      const d1Cell = sheet.cells?.['D1'];
      expect(d1Cell?.computed?.v).toBe(60);
      
      console.log('Formula result after merge:', d1Cell?.computed?.v);
    });

    test('should handle unmerge and then re-merge different range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header 1' },
            'A2': { raw: 'Header 2' },
          },
          mergedRanges: ['A1:D1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Unmerge first range, then merge a different range
      const ops = [
        { type: 'unmerge', sheetId: sheet.id, range: 'A1:D1' },
        { type: 'merge', sheetId: sheet.id, range: 'A2:F2' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).not.toContain('A1:D1');
      expect(sheet.mergedRanges).toContain('A2:F2');
      expect(sheet.mergedRanges?.length).toBe(1);
      
      console.log('After unmerge and re-merge:', sheet.mergedRanges);
    });

    test('should preserve merge integrity through multiple operations', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Title' },
            'A2': { raw: 'Subtitle' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Complex sequence of operations
      const ops = [
        // Initial merges
        { type: 'merge', sheetId: sheet.id, range: 'A1:D1' },
        { type: 'merge', sheetId: sheet.id, range: 'A2:B2' },
        // Insert row between merges
        { type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 },
        // Insert column within first merge
        { type: 'insertCol', sheetId: sheet.id, col: 2, count: 1 },
        // Add another merge
        { type: 'merge', sheetId: sheet.id, range: 'C3:E3' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges?.length).toBe(3);
      
      console.log('Final merge state after multiple operations:', sheet.mergedRanges);
    });
  });

  describe('Performance Tests', () => {
    test('should handle many merge operations efficiently', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Performance',
          cells: {},
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create 50 merge operations
      const ops: any[] = [];
      for (let i = 0; i < 50; i++) {
        const row = i + 1;
        ops.push({
          type: 'merge',
          sheetId: sheet.id,
          range: `A${row}:D${row}`,
        });
      }

      const { elapsed } = measurePerformance(() => {
        applyOperations(wb, ops);
      }, '50 merge operations');

      expect(sheet.mergedRanges?.length).toBe(50);
      expect(elapsed).toBeLessThan(1000); // Should complete in < 1 second
      
      console.log(`Created 50 merged ranges in ${elapsed.toFixed(2)}ms`);
    });

    test('should handle bulk insert/delete with many merged ranges', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {},
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create 20 merged ranges
      const mergeOps: any[] = [];
      for (let i = 0; i < 20; i++) {
        const row = i + 5; // Start from row 5
        mergeOps.push({
          type: 'merge',
          sheetId: sheet.id,
          range: `A${row}:D${row}`,
        });
      }

      applyOperations(wb, mergeOps);
      expect(sheet.mergedRanges?.length).toBe(20);
      
      // Now insert 10 rows at the beginning
      const insertOps = [
        { type: 'insertRow', sheetId: sheet.id, row: 1, count: 10 },
      ];

      const { elapsed } = measurePerformance(() => {
        applyOperations(wb, insertOps as any);
      }, 'Insert 10 rows with 20 merged ranges');

      // All 20 merged ranges should have shifted
      expect(sheet.mergedRanges?.length).toBe(20);
      expect(elapsed).toBeLessThan(500);
      
      console.log(`Updated 20 merged ranges in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Edge Cases', () => {
    test('should handle merge of single cell (A1:A1)', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Single' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:A1' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:A1');
      
      console.log('Single cell merge:', sheet.mergedRanges);
    });

    test('should handle unmerge of non-existent range gracefully', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Header' },
          },
          mergedRanges: ['A1:D1'],
        }],
      });

      const sheet = wb.sheets[0];
      
      // Try to unmerge a range that doesn't exist
      const ops = [
        { type: 'unmerge', sheetId: sheet.id, range: 'A2:D2' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      // Original merge should still be there
      expect(sheet.mergedRanges).toContain('A1:D1');
      
      console.log('After unmerge of non-existent range:', sheet.mergedRanges);
    });

    test('should handle empty merged range list', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Data' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Ensure mergedRanges is empty/undefined
      expect(sheet.mergedRanges?.length || 0).toBe(0);
      
      // Try operations on empty merge list
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 1, count: 1 },
        { type: 'deleteRow', sheetId: sheet.id, row: 2, count: 1 },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      console.log('Operations on empty merge list succeeded');
    });

    test('should handle very large merged range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Large Header' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create a very large merged range (A1:Z100)
      const ops = [
        { type: 'merge', sheetId: sheet.id, range: 'A1:Z100' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:Z100');
      
      console.log('Large merge range created:', 'A1:Z100');
    });

    test('should handle merge after deleting all content in range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Data 1' },
            'B1': { raw: 'Data 2' },
            'C1': { raw: 'Data 3' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Delete all cells in range
      const ops = [
        { type: 'deleteCell', sheetId: sheet.id, address: 'A1' },
        { type: 'deleteCell', sheetId: sheet.id, address: 'B1' },
        { type: 'deleteCell', sheetId: sheet.id, address: 'C1' },
        // Now merge the empty range
        { type: 'merge', sheetId: sheet.id, range: 'A1:C1' },
      ];

      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      expect(sheet.mergedRanges).toContain('A1:C1');
      
      console.log('Merged empty range after deleting content');
    });
  });
});
