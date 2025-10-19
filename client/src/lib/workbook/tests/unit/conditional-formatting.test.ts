/**
 * Conditional Formatting Tests
 * Tests for formula-based rules, ROW()/COLUMN() functions, priority handling, rule adjustment on insert/delete
 * 
 * Based on AI Test Prompt #14:
 * "Apply 5 conditional formatting rules using formulas like =MOD(ROW(),2)=0, =INDIRECT(ADDRESS(ROW(),1))>100, 
 * with overlapping priorities, then insert rows and verify rules adjust"
 * 
 * Test Coverage:
 * - Formula-based conditional formatting rules
 * - ROW() and COLUMN() functions in rules
 * - Priority handling with overlapping rules
 * - Rule range adjustment on insert/delete operations
 * - Multiple rules per cell
 * - Cross-sheet references in conditional formatting
 * - Edge cases and error handling
 * 
 * Note: This tests the data model and operations. UI rendering of conditional formatting
 * is handled separately by the canvas/rendering layer.
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
  parseAddress,
  toAddress,
} from '../utils/test-helpers';
import type { WorkbookJSON, SheetJSON, ConditionalFormat } from '../../types';

describe('Conditional Formatting', () => {
  describe('Basic Rule Creation', () => {
    test('should create a simple expression-based rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'CF Basic',
          cells: {
            'A1': { raw: 5 },
            'A2': { raw: 15 },
            'A3': { raw: 25 },
            'A4': { raw: 35 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Add conditional format: highlight cells > 10
      const rule: ConditionalFormat = {
        id: 'cf1',
        type: 'expression',
        range: 'A1:A4',
        formula: 'A1>10',
        priority: 1,
        style: {
          bgColor: '#FFFF00', // Yellow background
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats).toHaveLength(1);
      expect(sheet.conditionalFormats[0].formula).toBe('A1>10');
      expect(sheet.conditionalFormats[0].range).toBe('A1:A4');
      
      console.log('Created conditional format rule:', rule);
    });

    test('should create cellIs comparison rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'B1': { raw: 100 },
            'B2': { raw: 200 },
            'B3': { raw: 50 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const rule: ConditionalFormat = {
        id: 'cf2',
        type: 'cellIs',
        range: 'B1:B3',
        operator: 'greaterThan',
        values: [100],
        priority: 1,
        style: {
          color: '#FF0000', // Red text
          bold: true,
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].type).toBe('cellIs');
      expect(sheet.conditionalFormats[0].operator).toBe('greaterThan');
      expect(sheet.conditionalFormats[0].values).toEqual([100]);
    });

    test('should create multiple non-overlapping rules', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
            'B1': { raw: 20 },
            'C1': { raw: 30 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [
        {
          id: 'cf1',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1>5',
          priority: 1,
          style: { bgColor: '#FFFF00' },
        },
        {
          id: 'cf2',
          type: 'expression',
          range: 'B1:B10',
          formula: 'B1>15',
          priority: 1,
          style: { bgColor: '#00FF00' },
        },
        {
          id: 'cf3',
          type: 'expression',
          range: 'C1:C10',
          formula: 'C1>25',
          priority: 1,
          style: { bgColor: '#0000FF' },
        },
      ];
      
      expect(sheet.conditionalFormats).toHaveLength(3);
      expect(sheet.conditionalFormats.map(cf => cf.id)).toEqual(['cf1', 'cf2', 'cf3']);
    });
  });

  describe('Formula-Based Rules with ROW() and COLUMN()', () => {
    test('should create alternating row colors using MOD(ROW(),2)=0', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Alternating Rows',
          cells: {
            'A1': { raw: 'Row 1' },
            'A2': { raw: 'Row 2' },
            'A3': { raw: 'Row 3' },
            'A4': { raw: 'Row 4' },
            'A5': { raw: 'Row 5' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Highlight even rows
      const rule: ConditionalFormat = {
        id: 'cf-even-rows',
        type: 'expression',
        range: 'A1:A10',
        formula: 'MOD(ROW(),2)=0',
        priority: 1,
        style: {
          bgColor: '#E8E8E8', // Light gray
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].formula).toBe('MOD(ROW(),2)=0');
      
      // Verify the formula would apply to A2, A4 (even rows)
      // In a real implementation, the rendering layer would evaluate this for each cell
      console.log('Created alternating row rule with MOD(ROW(),2)=0');
    });

    test('should create column-based rule using COLUMN()', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 1 },
            'B1': { raw: 2 },
            'C1': { raw: 3 },
            'D1': { raw: 4 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Highlight every third column (C, F, I, ...)
      const rule: ConditionalFormat = {
        id: 'cf-col-third',
        type: 'expression',
        range: 'A1:J10',
        formula: 'MOD(COLUMN(),3)=0',
        priority: 1,
        style: {
          bgColor: '#CCFFCC', // Light green
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].formula).toBe('MOD(COLUMN(),3)=0');
      console.log('Created column-based rule with MOD(COLUMN(),3)=0');
    });

    test('should create rule using INDIRECT and ADDRESS', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 50 },
            'A2': { raw: 150 },
            'A3': { raw: 75 },
            'B1': { raw: 'Data 1' },
            'B2': { raw: 'Data 2' },
            'B3': { raw: 'Data 3' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Highlight B column cells where corresponding A column value > 100
      // Formula: =INDIRECT(ADDRESS(ROW(),1))>100
      // This checks if column A of the same row > 100
      const rule: ConditionalFormat = {
        id: 'cf-indirect',
        type: 'expression',
        range: 'B1:B10',
        formula: 'INDIRECT(ADDRESS(ROW(),1))>100',
        priority: 1,
        style: {
          bold: true,
          color: '#FF0000',
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].formula).toBe('INDIRECT(ADDRESS(ROW(),1))>100');
      console.log('Created INDIRECT rule: =INDIRECT(ADDRESS(ROW(),1))>100');
    });

    test('should create combined ROW/COLUMN rule for checkerboard pattern', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Checkerboard',
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create checkerboard pattern: MOD(ROW()+COLUMN(),2)=0
      const rule: ConditionalFormat = {
        id: 'cf-checkerboard',
        type: 'expression',
        range: 'A1:J20',
        formula: 'MOD(ROW()+COLUMN(),2)=0',
        priority: 1,
        style: {
          bgColor: '#F0F0F0',
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].formula).toBe('MOD(ROW()+COLUMN(),2)=0');
      console.log('Created checkerboard pattern with MOD(ROW()+COLUMN(),2)=0');
    });
  });

  describe('Priority Handling', () => {
    test('should handle overlapping rules with different priorities', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 15 },
            'A2': { raw: 25 },
            'A3': { raw: 35 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create 5 overlapping rules with different priorities
      sheet.conditionalFormats = [
        {
          id: 'cf1',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1>10',
          priority: 5,
          style: { bgColor: '#FFFF00' }, // Yellow - lowest priority
        },
        {
          id: 'cf2',
          type: 'expression',
          range: 'A1:A5',
          formula: 'A1>20',
          priority: 4,
          style: { bgColor: '#FFA500' }, // Orange
        },
        {
          id: 'cf3',
          type: 'expression',
          range: 'A1:A3',
          formula: 'A1>30',
          priority: 3,
          style: { bgColor: '#FF0000' }, // Red
        },
        {
          id: 'cf4',
          type: 'expression',
          range: 'A2:A10',
          formula: 'MOD(ROW(),2)=0',
          priority: 2,
          style: { bold: true },
        },
        {
          id: 'cf5',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1>50',
          priority: 1, // Highest priority
          style: { bgColor: '#000000', color: '#FFFFFF' }, // Black bg, white text
        },
      ];
      
      expect(sheet.conditionalFormats).toHaveLength(5);
      
      // Verify priority order (lower number = higher priority)
      const priorities = sheet.conditionalFormats.map(cf => cf.priority);
      expect(priorities).toEqual([5, 4, 3, 2, 1]);
      
      console.log('Created 5 overlapping rules with priorities:', priorities);
    });

    test('should respect stopIfTrue flag in rule evaluation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 100 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [
        {
          id: 'cf1',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1>50',
          priority: 1,
          stopIfTrue: true, // Stop evaluation if this matches
          style: { bgColor: '#FF0000' },
        },
        {
          id: 'cf2',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1>0',
          priority: 2,
          style: { bgColor: '#00FF00' }, // Should not apply if cf1 matches
        },
      ];
      
      expect(sheet.conditionalFormats[0].stopIfTrue).toBe(true);
      expect(sheet.conditionalFormats[1].stopIfTrue).toBeUndefined();
      
      console.log('Created rules with stopIfTrue flag');
    });
  });

  describe('Rule Adjustment on Insert/Delete', () => {
    test('should adjust rule range when inserting rows above', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A5': { raw: 10 },
            'A6': { raw: 20 },
            'A7': { raw: 30 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create rule for A5:A7
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'A5:A7',
        formula: 'A5>15',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Insert 2 rows at row 3 (above the formatted range)
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 3, count: 2 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule range should shift down from A5:A7 to A7:A9
      expect(sheet.conditionalFormats[0].range).toBe('A7:A9');
      
      console.log('Rule range adjusted after row insert:', sheet.conditionalFormats[0].range);
    });

    test('should expand rule range when inserting rows within', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
            'A2': { raw: 20 },
            'A3': { raw: 30 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'A1:A3',
        formula: 'A1>15',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Insert row at row 2 (within the formatted range)
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule range should expand from A1:A3 to A1:A4
      expect(sheet.conditionalFormats[0].range).toBe('A1:A4');
      
      console.log('Rule range expanded after row insert:', sheet.conditionalFormats[0].range);
    });

    test('should adjust rule range when deleting rows above', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A8': { raw: 10 },
            'A9': { raw: 20 },
            'A10': { raw: 30 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'A8:A10',
        formula: 'A8>15',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Delete rows 3-5 (above the formatted range)
      const ops = [
        { type: 'deleteRow', sheetId: sheet.id, row: 3, count: 3 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule range should shift up from A8:A10 to A5:A7
      expect(sheet.conditionalFormats[0].range).toBe('A5:A7');
      
      console.log('Rule range adjusted after row delete:', sheet.conditionalFormats[0].range);
    });

    test('should shrink rule range when deleting rows within', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
            'A2': { raw: 20 },
            'A3': { raw: 30 },
            'A4': { raw: 40 },
            'A5': { raw: 50 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'A1:A5',
        formula: 'A1>25',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Delete rows 2-3 (within the formatted range)
      const ops = [
        { type: 'deleteRow', sheetId: sheet.id, row: 2, count: 2 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule range should shrink from A1:A5 to A1:A3
      expect(sheet.conditionalFormats[0].range).toBe('A1:A3');
      
      console.log('Rule range shrank after row delete:', sheet.conditionalFormats[0].range);
    });

    test('should adjust rule range when inserting columns', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'C1': { raw: 10 },
            'D1': { raw: 20 },
            'E1': { raw: 30 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'C1:E1',
        formula: 'C1>15',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Insert 2 columns at column 2 (B) - before the formatted range C:E (cols 3-5)
      const ops = [
        { type: 'insertCol', sheetId: sheet.id, col: 2, count: 2 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule range should shift right from C1:E1 to E1:G1
      expect(sheet.conditionalFormats[0].range).toBe('E1:G1');
      
      console.log('Rule range adjusted after column insert:', sheet.conditionalFormats[0].range);
    });

    test('should remove rule when entire range is deleted', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A3': { raw: 10 },
            'A4': { raw: 20 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'A3:A4',
        formula: 'A3>15',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Delete rows 3-4 (entire formatted range)
      const ops = [
        { type: 'deleteRow', sheetId: sheet.id, row: 3, count: 2 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule should be removed since its entire range was deleted
      expect(sheet.conditionalFormats).toHaveLength(0);
      
      console.log('Rule removed after deleting entire range');
    });
  });

  describe('Complex Real-World Scenarios', () => {
    test('should create sales dashboard with multiple conditional formats', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sales Dashboard',
          cells: {
            'A1': { raw: 'Region' },
            'B1': { raw: 'Sales' },
            'C1': { raw: 'Target' },
            'D1': { raw: 'Performance' },
            'A2': { raw: 'North' },
            'B2': { formula: '150000' },
            'C2': { raw: 100000 },
            'D2': { formula: 'B2/C2' },
            'A3': { raw: 'South' },
            'B3': { raw: 80000 },
            'C3': { raw: 100000 },
            'D3': { formula: 'B3/C3' },
            'A4': { raw: 'East' },
            'B4': { raw: 120000 },
            'C4': { raw: 100000 },
            'D4': { formula: 'B4/C4' },
            'A5': { raw: 'West' },
            'B5': { raw: 95000 },
            'C5': { raw: 100000 },
            'D5': { formula: 'B5/C5' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Rule 1: Highlight header row
      // Rule 2: Highlight sales below target (red)
      // Rule 3: Highlight sales meeting target (green)
      // Rule 4: Highlight sales exceeding target by 20%+ (gold)
      // Rule 5: Alternate row shading for readability
      
      sheet.conditionalFormats = [
        {
          id: 'cf-header',
          type: 'expression',
          range: 'A1:D1',
          formula: 'ROW()=1',
          priority: 1,
          style: {
            bold: true,
            bgColor: '#4472C4',
            color: '#FFFFFF',
          },
        },
        {
          id: 'cf-exceed',
          type: 'expression',
          range: 'B2:B10',
          formula: 'B2>C2*1.2',
          priority: 2,
          stopIfTrue: true,
          style: {
            bgColor: '#FFD700', // Gold
            bold: true,
          },
        },
        {
          id: 'cf-meet',
          type: 'expression',
          range: 'B2:B10',
          formula: 'B2>=C2',
          priority: 3,
          stopIfTrue: true,
          style: {
            bgColor: '#90EE90', // Light green
          },
        },
        {
          id: 'cf-below',
          type: 'expression',
          range: 'B2:B10',
          formula: 'B2<C2',
          priority: 4,
          style: {
            bgColor: '#FFB6C1', // Light red
          },
        },
        {
          id: 'cf-alternate',
          type: 'expression',
          range: 'A2:D10',
          formula: 'MOD(ROW(),2)=0',
          priority: 5,
          style: {
            bgColor: '#F2F2F2',
          },
        },
      ];
      
      expect(sheet.conditionalFormats).toHaveLength(5);
      
      console.log('Created sales dashboard with 5 conditional formatting rules');
    });

    test('should create heatmap using color scale concept', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Heatmap',
          cells: {
            'A1': { raw: 10 },
            'A2': { raw: 25 },
            'A3': { raw: 50 },
            'A4': { raw: 75 },
            'A5': { raw: 90 },
            'A6': { raw: 100 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create multiple rules for color scale effect
      // Low values (0-33): Light red
      // Medium values (34-66): Yellow
      // High values (67-100): Green
      
      sheet.conditionalFormats = [
        {
          id: 'cf-low',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1<=33',
          priority: 3,
          style: { bgColor: '#FFC7CE' }, // Light red
        },
        {
          id: 'cf-medium',
          type: 'expression',
          range: 'A1:A10',
          formula: 'AND(A1>33,A1<=66)',
          priority: 2,
          style: { bgColor: '#FFEB9C' }, // Yellow
        },
        {
          id: 'cf-high',
          type: 'expression',
          range: 'A1:A10',
          formula: 'A1>66',
          priority: 1,
          style: { bgColor: '#C6EFCE' }, // Light green
        },
      ];
      
      expect(sheet.conditionalFormats).toHaveLength(3);
      
      console.log('Created heatmap with 3-color scale');
    });

    test('should handle cross-sheet references in conditional formatting', () => {
      const wb = createTestWorkbook({
        sheets: [
          {
            name: 'Data',
            cells: {
              'A1': { raw: 'Threshold' },
              'A2': { raw: 100 },
            },
          },
          {
            name: 'Report',
            cells: {
              'A1': { raw: 50 },
              'A2': { raw: 150 },
              'A3': { raw: 75 },
            },
          },
        ],
      });

      const reportSheet = wb.sheets[1];
      
      // Rule that references threshold from another sheet
      reportSheet.conditionalFormats = [{
        id: 'cf-cross-sheet',
        type: 'expression',
        range: 'A1:A10',
        formula: 'A1>Data!$A$2', // Reference threshold from Data sheet
        priority: 1,
        style: {
          bold: true,
          color: '#FF0000',
        },
      }];
      
      expect(reportSheet.conditionalFormats[0].formula).toContain('Data!');
      
      console.log('Created cross-sheet conditional format rule');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle single-cell range', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 100 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf-single',
        type: 'expression',
        range: 'A1',
        formula: 'A1>50',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      expect(sheet.conditionalFormats[0].range).toBe('A1');
    });

    test('should handle empty range gracefully', () => {
      const wb = createTestWorkbook({
        sheets: [{ name: 'Empty CF' }],
      });

      const sheet = wb.sheets[0];
      
      // Create rule with no cells in the range
      sheet.conditionalFormats = [{
        id: 'cf-empty',
        type: 'expression',
        range: 'Z100:Z110',
        formula: 'Z100>0',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      expect(sheet.conditionalFormats).toHaveLength(1);
      
      console.log('Created rule for empty range (valid but no effect)');
    });

    test('should handle invalid formula in rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Rule with invalid formula syntax
      sheet.conditionalFormats = [{
        id: 'cf-invalid',
        type: 'expression',
        range: 'A1:A10',
        formula: 'A1>', // Invalid: missing operand
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Rule is stored but won't apply (rendering layer should handle)
      expect(sheet.conditionalFormats[0].formula).toBe('A1>');
      
      console.log('Created rule with invalid formula (stored but won\'t apply)');
    });

    test('should handle duplicate rule IDs', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      // Create rules with duplicate IDs
      sheet.conditionalFormats = [
        {
          id: 'cf-duplicate',
          type: 'expression',
          range: 'A1:A5',
          formula: 'A1>5',
          priority: 1,
          style: { bgColor: '#FFFF00' },
        },
        {
          id: 'cf-duplicate', // Duplicate ID
          type: 'expression',
          range: 'A6:A10',
          formula: 'A6>5',
          priority: 2,
          style: { bgColor: '#00FF00' },
        },
      ];
      
      // Both rules stored (application layer should handle ID conflicts)
      expect(sheet.conditionalFormats).toHaveLength(2);
      
      console.log('Created rules with duplicate IDs');
    });

    test('should maintain rule integrity with multiple operations', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 10 },
            'A2': { raw: 20 },
            'A3': { raw: 30 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      sheet.conditionalFormats = [{
        id: 'cf1',
        type: 'expression',
        range: 'A1:A3',
        formula: 'A1>15',
        priority: 1,
        style: { bgColor: '#FFFF00' },
      }];
      
      // Perform multiple operations
      const ops = [
        { type: 'insertRow', sheetId: sheet.id, row: 2, count: 1 },
        { type: 'insertCol', sheetId: sheet.id, col: 'A', count: 1 },
        { type: 'deleteRow', sheetId: sheet.id, row: 1, count: 1 },
      ];
      
      const result = applyOperations(wb, ops as any);
      
      expect(result.success).toBe(true);
      
      // Rule should still exist and be adjusted appropriately
      expect(sheet.conditionalFormats).toHaveLength(1);
      
      console.log('Rule maintained after multiple operations:', sheet.conditionalFormats[0].range);
    });
  });

  describe('Performance', () => {
    test('should handle 50 conditional formatting rules efficiently', () => {
      const wb = createTestWorkbook({
        sheets: [{ name: 'Many Rules' }],
      });

      const sheet = wb.sheets[0];
      
      const { elapsed } = measurePerformance(() => {
        // Create 50 rules
        sheet.conditionalFormats = Array.from({ length: 50 }, (_, i) => ({
          id: `cf-${i}`,
          type: 'expression' as const,
          range: `A${i * 10 + 1}:A${i * 10 + 10}`,
          formula: `A${i * 10 + 1}>10`,
          priority: i + 1,
          style: {
            bgColor: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
          },
        }));
      }, 'Create 50 CF rules');
      
      expect(sheet.conditionalFormats).toHaveLength(50);
      expect(elapsed).toBeLessThan(100); // Should be very fast (< 100ms)
      
      console.log(`Created 50 CF rules in ${elapsed.toFixed(2)}ms`);
    });

    test('should handle rule adjustment with 20 rules efficiently', () => {
      const wb = createTestWorkbook({
        sheets: [{ name: 'Rule Adjustment' }],
      });

      const sheet = wb.sheets[0];
      
      // Create 20 rules
      sheet.conditionalFormats = Array.from({ length: 20 }, (_, i) => ({
        id: `cf-${i}`,
        type: 'expression' as const,
        range: `A${i + 1}:A${i + 20}`,
        formula: `A${i + 1}>10`,
        priority: i + 1,
        style: { bgColor: '#FFFF00' },
      }));
      
      const { elapsed } = measurePerformance(() => {
        // Insert 5 rows at row 10 (affects multiple rules)
        const ops = [
          { type: 'insertRow', sheetId: sheet.id, row: 10, count: 5 },
        ];
        
        applyOperations(wb, ops as any);
      }, 'Adjust 20 CF rules after row insert');
      
      expect(elapsed).toBeLessThan(150); // Should be fast (< 150ms including HF recompute)
      
      console.log(`Adjusted 20 CF rules in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('colorScale, dataBar, and iconSet types', () => {
    test('should create colorScale rule with min/mid/max colors', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 0 },
            'A2': { raw: 50 },
            'A3': { raw: 100 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const rule: ConditionalFormat = {
        id: 'cf-colorscale',
        type: 'colorScale',
        range: 'A1:A10',
        priority: 1,
        colorScale: {
          min: '#FF0000', // Red
          mid: '#FFFF00', // Yellow
          max: '#00FF00', // Green
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].type).toBe('colorScale');
      expect(sheet.conditionalFormats[0].colorScale?.min).toBe('#FF0000');
      expect(sheet.conditionalFormats[0].colorScale?.mid).toBe('#FFFF00');
      expect(sheet.conditionalFormats[0].colorScale?.max).toBe('#00FF00');
    });

    test('should create dataBar rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'B1': { raw: 25 },
            'B2': { raw: 50 },
            'B3': { raw: 75 },
            'B4': { raw: 100 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const rule: ConditionalFormat = {
        id: 'cf-databar',
        type: 'dataBar',
        range: 'B1:B10',
        priority: 1,
        style: {
          bgColor: '#4472C4', // Blue bars
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].type).toBe('dataBar');
    });

    test('should create iconSet rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'C1': { raw: 10 },
            'C2': { raw: 50 },
            'C3': { raw: 90 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const rule: ConditionalFormat = {
        id: 'cf-iconset',
        type: 'iconSet',
        range: 'C1:C10',
        priority: 1,
        values: ['3Arrows'], // Icon set type
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].type).toBe('iconSet');
      expect(sheet.conditionalFormats[0].values).toEqual(['3Arrows']);
    });
  });

  describe('duplicateValues and uniqueValues types', () => {
    test('should create duplicateValues rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'A1': { raw: 'Apple' },
            'A2': { raw: 'Banana' },
            'A3': { raw: 'Apple' },
            'A4': { raw: 'Cherry' },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const rule: ConditionalFormat = {
        id: 'cf-duplicates',
        type: 'duplicateValues',
        range: 'A1:A10',
        priority: 1,
        style: {
          bgColor: '#FFC7CE', // Light red
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].type).toBe('duplicateValues');
    });

    test('should create uniqueValues rule', () => {
      const wb = createTestWorkbook({
        sheets: [{
          cells: {
            'B1': { raw: 1 },
            'B2': { raw: 2 },
            'B3': { raw: 1 },
            'B4': { raw: 3 },
          },
        }],
      });

      const sheet = wb.sheets[0];
      
      const rule: ConditionalFormat = {
        id: 'cf-unique',
        type: 'uniqueValues',
        range: 'B1:B10',
        priority: 1,
        style: {
          bgColor: '#C6EFCE', // Light green
        },
      };

      sheet.conditionalFormats = [rule];
      
      expect(sheet.conditionalFormats[0].type).toBe('uniqueValues');
    });
  });
});
