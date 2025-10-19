/**
 * Format Preservation Tests (Prompt 22)
 * 
 * Tests that cell formatting persists correctly through various operations:
 * - Copy/paste operations
 * - Row/column insertion and deletion  
 * - Number formats (currency, date, custom)
 * - Visual styles (colors, fonts, borders, alignment)
 * - Format inheritance and propagation
 * 
 * @see docs/AI_TEST_PROMPTS.md - Prompt 22
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorkbook,
  assertCellValue,
  type TestWorkbookConfig
} from '../utils/test-helpers';
import { computeWorkbook, type HydrationResult } from '../../hyperformula';
import { getCell, setCell } from '../../utils';
import { applyOperations } from '../../operations';
import type { Cell, CellStyle } from '../../types';

describe('Format Preservation (Prompt 22)', () => {
  const hydrations: HydrationResult[] = [];

  afterEach(() => {
    // Cleanup all HyperFormula instances
    hydrations.forEach(h => h.destroy?.());
    hydrations.length = 0;
  });

  // ==========================================================================
  // Copy/Paste Format Preservation
  // ==========================================================================

  describe('Copy/Paste Format Preservation', () => {
    it('should preserve basic visual styles (colors, bold, italic) on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 'Hello',
              style: {
                bold: true,
                italic: true,
                color: '#FF0000',
                bgColor: '#FFFF00',
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Copy A1 style to B1
      const sourceCell = getCell(wb, sheetId, 'A1');
      setCell(wb, sheetId, 'B1', {
        raw: 'World',
        style: sourceCell?.style,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      
      expect(targetCell?.style?.bold).toBe(true);
      expect(targetCell?.style?.italic).toBe(true);
      expect(targetCell?.style?.color).toBe('#FF0000');
      expect(targetCell?.style?.bgColor).toBe('#FFFF00');
    });

    it('should preserve font properties (size, family) on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 'Large Text',
              style: {
                fontSize: 20,
                fontFamily: 'Arial',
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 'Copy',
        style: sourceCell?.style,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.style?.fontSize).toBe(20);
      expect(targetCell?.style?.fontFamily).toBe('Arial');
    });

    it('should preserve alignment properties on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 'Centered',
              style: {
                alignment: {
                  horizontal: 'center',
                  vertical: 'middle',
                  wrapText: true,
                  indent: 2,
                }
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 'Also Centered',
        style: sourceCell?.style,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.style?.alignment?.horizontal).toBe('center');
      expect(targetCell?.style?.alignment?.vertical).toBe('middle');
      expect(targetCell?.style?.alignment?.wrapText).toBe(true);
      expect(targetCell?.style?.alignment?.indent).toBe(2);
    });

    it('should preserve border styles on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 'Bordered',
              style: {
                border: {
                  top: { style: 'thin', color: '#000000' },
                  bottom: { style: 'thick', color: '#FF0000' },
                  left: { style: 'dashed', color: '#00FF00' },
                  right: { style: 'double', color: '#0000FF' },
                }
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 'Also Bordered',
        style: sourceCell?.style,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.style?.border?.top?.style).toBe('thin');
      expect(targetCell?.style?.border?.bottom?.style).toBe('thick');
      expect(targetCell?.style?.border?.left?.style).toBe('dashed');
      expect(targetCell?.style?.border?.right?.style).toBe('double');
    });

    it('should preserve complex combined styles on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 'Complex',
              style: {
                bold: true,
                italic: false,
                underline: true,
                strikethrough: false,
                color: '#336699',
                bgColor: '#FFFFCC',
                fontSize: 14,
                fontFamily: 'Calibri',
                alignment: {
                  horizontal: 'right',
                  vertical: 'bottom',
                },
                border: {
                  top: { style: 'medium', color: '#000000' },
                }
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 'Complex Copy',
        style: JSON.parse(JSON.stringify(sourceCell?.style)), // Deep copy
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      
      expect(targetCell?.style).toEqual(sourceCell?.style);
    });
  });

  // ==========================================================================
  // Number Format Preservation
  // ==========================================================================

  describe('Number Format Preservation', () => {
    it('should preserve currency format on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 1234.56,
              numFmt: '$#,##0.00',  // Currency format
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 7890.12,
        numFmt: sourceCell?.numFmt,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.numFmt).toBe('$#,##0.00');
    });

    it('should preserve date format on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: new Date('2025-01-15').toISOString(),
              numFmt: 'mm/dd/yyyy',  // Date format
              dataType: 'date',
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: new Date('2025-12-25').toISOString(),
        numFmt: sourceCell?.numFmt,
        dataType: 'date',
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.numFmt).toBe('mm/dd/yyyy');
      expect(targetCell?.dataType).toBe('date');
    });

    it('should preserve custom number format on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 0.75,
              numFmt: '0.00%',  // Percentage format
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 0.85,
        numFmt: sourceCell?.numFmt,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.numFmt).toBe('0.00%');
    });

    it('should preserve scientific notation format on copy', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 1234567890,
              numFmt: '0.00E+00',  // Scientific notation
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const sourceCell = getCell(wb, sheetId, 'A1');
      
      setCell(wb, sheetId, 'B1', {
        raw: 9876543210,
        numFmt: sourceCell?.numFmt,
      } as Cell);

      const targetCell = getCell(wb, sheetId, 'B1');
      expect(targetCell?.numFmt).toBe('0.00E+00');
    });
  });

  // ==========================================================================
  // Row Insertion/Deletion Format Behavior
  // ==========================================================================

  describe('Row Operations Format Behavior', () => {
    it('should shift formatted cells down when row inserted above', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Header', style: { bold: true } },
            A2: { raw: 'Data', style: { italic: true } },
            A3: { raw: 'Footer', style: { underline: true } },
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Insert row at position 2 (between A1 and A2)
      applyOperations(wb, [{
        type: 'insertRow',
        sheetId,
        row: 2,
        count: 1,
      }]);

      // A1 should still be bold
      expect(getCell(wb, sheetId, 'A1')?.style?.bold).toBe(true);
      
      // A2 should now be empty (new row)
      expect(getCell(wb, sheetId, 'A2')).toBeUndefined();
      
      // A3 should now have the italic style (was A2)
      expect(getCell(wb, sheetId, 'A3')?.style?.italic).toBe(true);
      expect(getCell(wb, sheetId, 'A3')?.raw).toBe('Data');
      
      // A4 should now have underline style (was A3)
      expect(getCell(wb, sheetId, 'A4')?.style?.underline).toBe(true);
      expect(getCell(wb, sheetId, 'A4')?.raw).toBe('Footer');
    });

    it('should preserve formats when row deleted', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Keep1', style: { bold: true } },
            A2: { raw: 'Delete', style: { italic: true } },
            A3: { raw: 'Keep2', style: { underline: true } },
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Delete row 2
      applyOperations(wb, [{
        type: 'deleteRow',
        sheetId,
        row: 2,
        count: 1,
      }]);

      // A1 should still be bold
      expect(getCell(wb, sheetId, 'A1')?.style?.bold).toBe(true);
      expect(getCell(wb, sheetId, 'A1')?.raw).toBe('Keep1');
      
      // A2 should now have underline (was A3)
      expect(getCell(wb, sheetId, 'A2')?.style?.underline).toBe(true);
      expect(getCell(wb, sheetId, 'A2')?.raw).toBe('Keep2');
      
      // A3 should not exist
      expect(getCell(wb, sheetId, 'A3')).toBeUndefined();
    });

    it('should maintain number formats when rows inserted', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 1000, numFmt: '$#,##0.00' },
            A2: { raw: 2000, numFmt: '$#,##0.00' },
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Insert row at position 2
      applyOperations(wb, [{
        type: 'insertRow',
        sheetId,
        row: 2,
        count: 1,
      }]);

      // A1 should still have currency format
      expect(getCell(wb, sheetId, 'A1')?.numFmt).toBe('$#,##0.00');
      
      // A3 should have currency format (was A2)
      expect(getCell(wb, sheetId, 'A3')?.numFmt).toBe('$#,##0.00');
      expect(getCell(wb, sheetId, 'A3')?.raw).toBe(2000);
    });
  });

  // ==========================================================================
  // Column Insertion/Deletion Format Behavior
  // ==========================================================================

  describe('Column Operations Format Behavior', () => {
    it('should shift formatted cells right when column inserted', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Col1', style: { bold: true } },
            B1: { raw: 'Col2', style: { italic: true } },
            C1: { raw: 'Col3', style: { underline: true } },
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Insert column at position 2 (between A and B)
      applyOperations(wb, [{
        type: 'insertCol',
        sheetId,
        col: 2,
        count: 1,
      }]);

      // A1 should still be bold
      expect(getCell(wb, sheetId, 'A1')?.style?.bold).toBe(true);
      
      // B1 should now be empty (new column)
      expect(getCell(wb, sheetId, 'B1')).toBeUndefined();
      
      // C1 should now have italic style (was B1)
      expect(getCell(wb, sheetId, 'C1')?.style?.italic).toBe(true);
      expect(getCell(wb, sheetId, 'C1')?.raw).toBe('Col2');
      
      // D1 should now have underline style (was C1)
      expect(getCell(wb, sheetId, 'D1')?.style?.underline).toBe(true);
      expect(getCell(wb, sheetId, 'D1')?.raw).toBe('Col3');
    });

    it('should preserve formats when column deleted', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Keep1', style: { bold: true } },
            B1: { raw: 'Delete', style: { italic: true } },
            C1: { raw: 'Keep2', style: { underline: true } },
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Delete column B (column 2)
      applyOperations(wb, [{
        type: 'deleteCol',
        sheetId,
        col: 2,
        count: 1,
      }]);

      // A1 should still be bold
      expect(getCell(wb, sheetId, 'A1')?.style?.bold).toBe(true);
      expect(getCell(wb, sheetId, 'A1')?.raw).toBe('Keep1');
      
      // B1 should now have underline (was C1)
      expect(getCell(wb, sheetId, 'B1')?.style?.underline).toBe(true);
      expect(getCell(wb, sheetId, 'B1')?.raw).toBe('Keep2');
      
      // C1 should not exist
      expect(getCell(wb, sheetId, 'C1')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Format Operations API
  // ==========================================================================

  describe('SetStyle and SetFormat Operations', () => {
    it('should apply style using setStyle operation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Plain Text' }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Apply style using operation
      applyOperations(wb, [{
        type: 'setStyle',
        sheetId,
        address: 'A1',
        style: {
          bold: true,
          color: '#FF0000',
          bgColor: '#FFFF00',
        }
      }]);

      const cell = getCell(wb, sheetId, 'A1');
      expect(cell?.style?.bold).toBe(true);
      expect(cell?.style?.color).toBe('#FF0000');
      expect(cell?.style?.bgColor).toBe('#FFFF00');
    });

    it('should apply number format using setFormat operation', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 1234.56 }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Apply number format using operation
      applyOperations(wb, [{
        type: 'setFormat',
        sheetId,
        address: 'A1',
        numFmt: '$#,##0.00',
      }]);

      const cell = getCell(wb, sheetId, 'A1');
      expect(cell?.numFmt).toBe('$#,##0.00');
    });

    it('should update specific style properties using setStyleProps', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { 
              raw: 'Text',
              style: {
                bold: true,
                color: '#000000',
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Update only color, keep bold
      applyOperations(wb, [{
        type: 'setStyleProps',
        sheetId,
        address: 'A1',
        styleProps: {
          color: '#FF0000',
          italic: true,
        }
      }]);

      const cell = getCell(wb, sheetId, 'A1');
      expect(cell?.style?.bold).toBe(true);  // Preserved
      expect(cell?.style?.color).toBe('#FF0000');  // Updated
      expect(cell?.style?.italic).toBe(true);  // Added
    });
  });

  // ==========================================================================
  // Real-World: Financial Report Formatting
  // ==========================================================================

  describe('Real-World: Financial Report Formatting', () => {
    it('should maintain formatting in financial report after operations', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Report',
          cells: {
            // Header row
            A1: { raw: 'Q1 2025 Financial Report', style: { bold: true, fontSize: 16 } },
            
            // Column headers
            A2: { raw: 'Category', style: { bold: true, bgColor: '#CCCCCC' } },
            B2: { raw: 'Amount', style: { bold: true, bgColor: '#CCCCCC' } },
            
            // Data rows with currency format
            A3: { raw: 'Revenue' },
            B3: { raw: 100000, numFmt: '$#,##0.00' },
            
            A4: { raw: 'Expenses' },
            B4: { raw: 75000, numFmt: '$#,##0.00' },
            
            A5: { raw: 'Profit', style: { bold: true } },
            B5: { formula: 'B3-B4', numFmt: '$#,##0.00' },
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;

      // Verify initial formatting
      expect(getCell(wb, sheetId, 'A1')?.style?.bold).toBe(true);
      expect(getCell(wb, sheetId, 'A1')?.style?.fontSize).toBe(16);
      expect(getCell(wb, sheetId, 'B3')?.numFmt).toBe('$#,##0.00');
      expect(getCell(wb, sheetId, 'B5')?.numFmt).toBe('$#,##0.00');

      // Insert a row for new category
      applyOperations(wb, [{
        type: 'insertRow',
        sheetId,
        row: 4,  // Insert between Expenses and Profit
        count: 1,
      }]);

      // Add new category with same format
      setCell(wb, sheetId, 'A4', { raw: 'Taxes' });
      setCell(wb, sheetId, 'B4', { raw: 15000, numFmt: '$#,##0.00' });

      // Update formula to include taxes
      setCell(wb, sheetId, 'B6', { formula: 'B3-B4-B5', numFmt: '$#,##0.00' });

      // Verify formats persisted
      expect(getCell(wb, sheetId, 'A1')?.style?.bold).toBe(true);  // Header
      expect(getCell(wb, sheetId, 'A2')?.style?.bold).toBe(true);  // Column header
      expect(getCell(wb, sheetId, 'A2')?.style?.bgColor).toBe('#CCCCCC');
      
      // Check shifted rows maintained formats
      expect(getCell(wb, sheetId, 'B4')?.numFmt).toBe('$#,##0.00');  // New row
      expect(getCell(wb, sheetId, 'B5')?.numFmt).toBe('$#,##0.00');  // Shifted from B4
      expect(getCell(wb, sheetId, 'A6')?.style?.bold).toBe(true);  // Profit label (shifted from A5)
      expect(getCell(wb, sheetId, 'B6')?.numFmt).toBe('$#,##0.00');  // Updated formula
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Format Preservation Edge Cases', () => {
    it('should handle empty style object', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Text', style: {} }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'A1');
      
      expect(cell?.style).toEqual({});
    });

    it('should handle undefined style', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 'Text' }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'A1');
      
      expect(cell?.style).toBeUndefined();
    });

    it('should handle partial style updates', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: {
              raw: 'Text',
              style: {
                bold: true,
                color: '#FF0000',
              }
            }
          }
        }]
      });

      const sheetId = wb.sheets[0].id;

      // Partial update: only change color
      const cell = getCell(wb, sheetId, 'A1');
      setCell(wb, sheetId, 'A1', {
        ...cell,
        style: {
          ...cell?.style,
          color: '#00FF00',
        }
      } as Cell);

      const updatedCell = getCell(wb, sheetId, 'A1');
      expect(updatedCell?.style?.bold).toBe(true);  // Preserved
      expect(updatedCell?.style?.color).toBe('#00FF00');  // Updated
    });

    it('should handle format on formula cells', () => {
      const wb = createTestWorkbook({
        sheets: [{
          name: 'Sheet1',
          cells: {
            A1: { raw: 1000 },
            B1: { 
              formula: 'A1*2',
              numFmt: '$#,##0.00',
              style: { bold: true }
            }
          }
        }]
      });

      const { hydration } = computeWorkbook(wb);
      hydrations.push(hydration);

      const sheetId = wb.sheets[0].id;
      const cell = getCell(wb, sheetId, 'B1');

      expect(cell?.formula).toBe('A1*2');
      expect(cell?.numFmt).toBe('$#,##0.00');
      expect(cell?.style?.bold).toBe(true);
      expect(cell?.computed?.v).toBe(2000);
    });
  });
});
