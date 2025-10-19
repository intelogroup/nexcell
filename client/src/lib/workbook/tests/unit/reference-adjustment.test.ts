/**
 * Copy-Paste Reference Adjustment Tests (Prompt 18)
 * 
 * Tests copy-paste operations with mixed absolute ($A$1), relative (A1),
 * and mixed ($A1, A$1) references to verify correct reference adjustment logic.
 * 
 * Reference Types:
 * - $A$1: Absolute (both row and column fixed)
 * - A1: Relative (both row and column adjust)
 * - $A1: Column absolute, row relative
 * - A$1: Row absolute, column relative
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkbookJSON } from '../../types';
import { createTestWorkbook, assertCellFormula, computeAndAssert } from '../utils/test-helpers';
import { setCell, getCell, parseAddress } from '../../utils';

// ============================================================================
// Helper: Copy Cell with Reference Adjustment
// ============================================================================

/**
 * Adjusts a cell reference based on row/column offset
 * Handles $A$1, A1, $A1, A$1 patterns
 */
function adjustReference(ref: string, rowOffset: number, colOffset: number): string {
  // Match patterns like $A$1, A$1, $A1, A1
  const match = ref.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
  if (!match) return ref;

  const [, colFixed, col, rowFixed, row] = match;
  
  // Parse column (A=1, B=2, etc. - 1-based)
  let colNum = 0;
  for (let i = 0; i < col.length; i++) {
    colNum = colNum * 26 + (col.charCodeAt(i) - 64);
  }

  let rowNum = parseInt(row, 10);

  // Apply offsets if not fixed
  if (!colFixed) colNum += colOffset;
  if (!rowFixed) rowNum += rowOffset;

  // Prevent negative values
  if (colNum < 1) colNum = 1;
  if (rowNum < 1) rowNum = 1;

  // Convert back to column letter
  let newCol = '';
  let n = colNum;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    newCol = String.fromCharCode(65 + remainder) + newCol;
    n = Math.floor((n - 1) / 26);
  }

  return `${colFixed}${newCol}${rowFixed}${rowNum}`;
}

/**
 * Adjusts all references in a formula
 */
function adjustFormulaReferences(formula: string, rowOffset: number, colOffset: number): string {
  // Match all cell references in the formula
  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (match) => {
    return adjustReference(match, rowOffset, colOffset);
  });
}

/**
 * Copies a cell with reference adjustment
 */
function copyCellWithReferenceAdjustment(
  wb: WorkbookJSON,
  sheetId: string,
  sourceAddress: string,
  targetAddress: string
): void {
  const sourceCell = getCell(wb, sheetId, sourceAddress);
  if (!sourceCell) return;

  const sourceParsed = parseAddress(sourceAddress);
  const targetParsed = parseAddress(targetAddress);

  const rowOffset = targetParsed.row - sourceParsed.row;
  const colOffset = targetParsed.col - sourceParsed.col;

  if (sourceCell.formula) {
    // Adjust formula references
    let adjustedFormula = sourceCell.formula;
    
    // Remove leading '=' if present
    if (adjustedFormula.startsWith('=')) {
      adjustedFormula = adjustedFormula.slice(1);
    }

    adjustedFormula = adjustFormulaReferences(adjustedFormula, rowOffset, colOffset);

    setCell(wb, sheetId, targetAddress, {
      formula: adjustedFormula,
    });
  } else if (sourceCell.raw !== undefined) {
    // Copy raw value
    setCell(wb, sheetId, targetAddress, {
      raw: sourceCell.raw,
    });
  }

  // Copy style if present
  if (sourceCell.style) {
    const targetCell = getCell(wb, sheetId, targetAddress);
    if (targetCell) {
      targetCell.style = { ...sourceCell.style };
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Copy-Paste Reference Adjustment (Prompt 18)', () => {
  let wb: WorkbookJSON;
  let sheetId: string;

  beforeEach(() => {
    wb = createTestWorkbook({
      title: 'Reference Adjustment Test',
      sheets: [{
        name: 'Sheet1',
        cells: {
          // Source data
          A1: { raw: 10 },
          B1: { raw: 20 },
          C1: { raw: 30 },
          A2: { raw: 40 },
          B2: { raw: 50 },
          C2: { raw: 60 },
          A3: { raw: 70 },
          B3: { raw: 80 },
          C3: { raw: 90 },
        },
      }],
    });
    sheetId = wb.sheets[0].id;
  });

  // ==========================================================================
  // Absolute References ($A$1)
  // ==========================================================================

  describe('Absolute References ($A$1)', () => {
    it('should not adjust absolute references when copied down', () => {
      // D1 = $A$1 + $B$1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=$A$1+$B$1' });

      // Copy D1 to D2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');

      // D2 should still reference $A$1 + $B$1 (no adjustment)
      assertCellFormula(wb, 'D2', '=$A$1+$B$1');
      computeAndAssert(wb, 'D2', 30); // 10 + 20
    });

    it('should not adjust absolute references when copied right', () => {
      // D1 = $A$1 + $B$1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=$A$1+$B$1' });

      // Copy D1 to E1
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E1');

      // E1 should still reference $A$1 + $B$1 (no adjustment)
      assertCellFormula(wb, 'E1', '=$A$1+$B$1');
      computeAndAssert(wb, 'E1', 30); // 10 + 20
    });

    it('should not adjust absolute references when copied diagonally', () => {
      // D1 = $A$1 * $B$1 (10 * 20 = 200)
      setCell(wb, sheetId, 'D1', { formula: '=$A$1*$B$1' });

      // Copy D1 to E3
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E3');

      // E3 should still reference $A$1 * $B$1 (no adjustment)
      assertCellFormula(wb, 'E3', '=$A$1*$B$1');
      computeAndAssert(wb, 'E3', 200); // 10 * 20
    });
  });

  // ==========================================================================
  // Relative References (A1)
  // ==========================================================================

  describe('Relative References (A1)', () => {
    it('should adjust both row and column when copied down', () => {
      // D1 = A1 + B1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=A1+B1' });

      // Copy D1 to D2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');

      // D2 should reference A2 + B2 (row adjusted)
      assertCellFormula(wb, 'D2', '=A2+B2');
      computeAndAssert(wb, 'D2', 90); // 40 + 50
    });

    it('should adjust both row and column when copied right', () => {
      // D1 = A1 + B1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=A1+B1' });

      // Copy D1 to E1
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E1');

      // E1 should reference B1 + C1 (column adjusted)
      assertCellFormula(wb, 'E1', '=B1+C1');
      computeAndAssert(wb, 'E1', 50); // 20 + 30
    });

    it('should adjust both row and column when copied diagonally', () => {
      // D1 = A1 * B1 (10 * 20 = 200)
      setCell(wb, sheetId, 'D1', { formula: '=A1*B1' });

      // Copy D1 to E2 (1 down, 1 right)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E2');

      // E2 should reference B2 * C2 (both adjusted)
      assertCellFormula(wb, 'E2', '=B2*C2');
      computeAndAssert(wb, 'E2', 3000); // 50 * 60
    });

    it('should handle negative offsets when copying up and left', () => {
      // D3 = A3 + B3 (70 + 80 = 150)
      setCell(wb, sheetId, 'D3', { formula: '=A3+B3' });

      // Copy D3 to C2 (1 up, 1 left)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D3', 'C2');

      // C2 should reference A2 + A2 (both adjusted backwards)
      // Since we're copying from D3 to C2:
      // - Row offset: 2 - 3 = -1 (move up 1)
      // - Col offset: C(3) - D(4) = -1 (move left 1)
      // A3 (col 1) -> A2 (col 1-0=1, row 3-1=2)
      // B3 (col 2) -> A2 (col 2-1=1, row 3-1=2)
      assertCellFormula(wb, 'C2', '=A2+A2');
      computeAndAssert(wb, 'C2', 80); // 40 + 40
    });
  });

  // ==========================================================================
  // Mixed References - Column Absolute ($A1)
  // ==========================================================================

  describe('Mixed References - Column Absolute ($A1)', () => {
    it('should fix column but adjust row when copied down', () => {
      // D1 = $A1 + $B1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=$A1+$B1' });

      // Copy D1 to D2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');

      // D2 should reference $A2 + $B2 (row adjusted, column fixed)
      assertCellFormula(wb, 'D2', '=$A2+$B2');
      computeAndAssert(wb, 'D2', 90); // 40 + 50
    });

    it('should fix column but adjust row when copied right', () => {
      // D1 = $A1 + $B1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=$A1+$B1' });

      // Copy D1 to E1
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E1');

      // E1 should still reference $A1 + $B1 (column fixed, row same)
      assertCellFormula(wb, 'E1', '=$A1+$B1');
      computeAndAssert(wb, 'E1', 30); // 10 + 20
    });

    it('should fix column but adjust row when copied diagonally', () => {
      // D1 = $A1 * $B1 (10 * 20 = 200)
      setCell(wb, sheetId, 'D1', { formula: '=$A1*$B1' });

      // Copy D1 to E3 (2 down, 1 right)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E3');

      // E3 should reference $A3 * $B3 (row adjusted, column fixed)
      assertCellFormula(wb, 'E3', '=$A3*$B3');
      computeAndAssert(wb, 'E3', 5600); // 70 * 80
    });
  });

  // ==========================================================================
  // Mixed References - Row Absolute (A$1)
  // ==========================================================================

  describe('Mixed References - Row Absolute (A$1)', () => {
    it('should fix row but adjust column when copied down', () => {
      // D1 = A$1 + B$1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=A$1+B$1' });

      // Copy D1 to D2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');

      // D2 should still reference A$1 + B$1 (row fixed, column same)
      assertCellFormula(wb, 'D2', '=A$1+B$1');
      computeAndAssert(wb, 'D2', 30); // 10 + 20
    });

    it('should fix row but adjust column when copied right', () => {
      // D1 = A$1 + B$1 (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=A$1+B$1' });

      // Copy D1 to E1
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E1');

      // E1 should reference B$1 + C$1 (column adjusted, row fixed)
      assertCellFormula(wb, 'E1', '=B$1+C$1');
      computeAndAssert(wb, 'E1', 50); // 20 + 30
    });

    it('should fix row but adjust column when copied diagonally', () => {
      // D1 = A$1 * B$1 (10 * 20 = 200)
      setCell(wb, sheetId, 'D1', { formula: '=A$1*B$1' });

      // Copy D1 to E3 (2 down, 1 right)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E3');

      // E3 should reference B$1 * C$1 (column adjusted, row fixed)
      assertCellFormula(wb, 'E3', '=B$1*C$1');
      computeAndAssert(wb, 'E3', 600); // 20 * 30
    });
  });

  // ==========================================================================
  // Complex Formulas with Multiple References
  // ==========================================================================

  describe('Complex Formulas with Multiple Reference Types', () => {
    it('should correctly adjust mixed reference types in a single formula', () => {
      // D1 = $A$1 + A1 + $A1 + A$1
      // Absolute, Relative, Col-fixed, Row-fixed
      setCell(wb, sheetId, 'D1', { formula: '=$A$1+A1+$A1+A$1' });

      // Copy D1 to E2 (1 down, 1 right)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E2');

      // E2 should have:
      // - $A$1 stays as $A$1 (absolute)
      // - A1 becomes B2 (relative: +1 col, +1 row)
      // - $A1 becomes $A2 (col fixed, row +1)
      // - A$1 becomes B$1 (row fixed, col +1)
      assertCellFormula(wb, 'E2', '=$A$1+B2+$A2+B$1');
      // Actual: $A$1=10, B2=50, $A2=40, B$1=20 => 10+50+40+20=120
      computeAndAssert(wb, 'E2', 120);
    });

    it('should handle SUM with range references', () => {
      // D1 = SUM(A1:B1) (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=SUM(A1:B1)' });

      // Copy D1 to D2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');

      // D2 should reference SUM(A2:B2)
      assertCellFormula(wb, 'D2', '=SUM(A2:B2)');
      computeAndAssert(wb, 'D2', 90); // 40 + 50
    });

    it('should handle SUM with absolute range references', () => {
      // D1 = SUM($A$1:$B$1) (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=SUM($A$1:$B$1)' });

      // Copy D1 to E3
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E3');

      // E3 should still reference SUM($A$1:$B$1) (no adjustment)
      assertCellFormula(wb, 'E3', '=SUM($A$1:$B$1)');
      computeAndAssert(wb, 'E3', 30); // 10 + 20
    });

    it('should handle SUM with mixed range references', () => {
      // D1 = SUM($A1:B$1) (10 + 20 = 30)
      setCell(wb, sheetId, 'D1', { formula: '=SUM($A1:B$1)' });

      // Copy D1 to E2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E2');

      // E2 should reference SUM($A2:C$1)
      // - $A1 -> $A2 (col fixed, row +1)
      // - B$1 -> C$1 (row fixed, col +1)
      assertCellFormula(wb, 'E2', '=SUM($A2:C$1)');
      // SUM($A2:C$1) includes A1:C2 range = 10+20+30+40+50+60 = 210
      computeAndAssert(wb, 'E2', 210);
    });
  });

  // ==========================================================================
  // Real-World Scenarios
  // ==========================================================================

  describe('Real-World Copy-Paste Scenarios', () => {
    it('should handle sales commission formula with mixed references', () => {
      // Setup: Sales data and commission rates
      setCell(wb, sheetId, 'F1', { raw: 0.05 }); // Base commission rate: 5%
      setCell(wb, sheetId, 'F2', { raw: 0.08 }); // Bonus commission rate: 8%
      
      setCell(wb, sheetId, 'A5', { raw: 1000 }); // Sales amount for person 1
      setCell(wb, sheetId, 'A6', { raw: 2000 }); // Sales amount for person 2
      setCell(wb, sheetId, 'A7', { raw: 3000 }); // Sales amount for person 3

      // B5: Commission = Sales * Base Rate + Bonus Rate (from F1 and F2, fixed)
      // Formula uses absolute references to rates
      setCell(wb, sheetId, 'B5', { formula: '=A5*$F$1+$F$2' });

      // Copy B5 to B6 and B7
      copyCellWithReferenceAdjustment(wb, sheetId, 'B5', 'B6');
      copyCellWithReferenceAdjustment(wb, sheetId, 'B5', 'B7');

      // Verify formulas adjusted correctly
      assertCellFormula(wb, 'B5', '=A5*$F$1+$F$2');
      assertCellFormula(wb, 'B6', '=A6*$F$1+$F$2'); // A5 -> A6 (relative), rates stay fixed
      assertCellFormula(wb, 'B7', '=A7*$F$1+$F$2'); // A5 -> A7 (relative), rates stay fixed

      // Verify computed values: 1000 * 0.05 + 0.08 = 50 + 0.08 = 50.08
      computeAndAssert(wb, 'B5', 50.08);
      computeAndAssert(wb, 'B6', 100.08); // 2000 * 0.05 + 0.08 = 100.08
      computeAndAssert(wb, 'B7', 150.08); // 3000 * 0.05 + 0.08 = 150.08
    });

    it('should handle multi-column table formula fill-right', () => {
      // Setup: Product prices in row 1, quantities in column A
      setCell(wb, sheetId, 'B1', { raw: 10 }); // Product A price
      setCell(wb, sheetId, 'C1', { raw: 15 }); // Product B price
      setCell(wb, sheetId, 'D1', { raw: 20 }); // Product C price

      setCell(wb, sheetId, 'A2', { raw: 5 }); // Quantity for order 1
      setCell(wb, sheetId, 'A3', { raw: 8 }); // Quantity for order 2

      // B2: Total = Quantity (row-fixed) * Price (col-relative, row-fixed)
      setCell(wb, sheetId, 'B2', { formula: '=$A2*B$1' });

      // Copy B2 across to C2, D2 (fill-right)
      copyCellWithReferenceAdjustment(wb, sheetId, 'B2', 'C2');
      copyCellWithReferenceAdjustment(wb, sheetId, 'B2', 'D2');

      // Copy B2 down to B3
      copyCellWithReferenceAdjustment(wb, sheetId, 'B2', 'B3');

      // Verify formulas
      assertCellFormula(wb, 'B2', '=$A2*B$1');
      assertCellFormula(wb, 'C2', '=$A2*C$1'); // Column adjusted, $A and row $1 fixed
      assertCellFormula(wb, 'D2', '=$A2*D$1'); // Column adjusted further
      assertCellFormula(wb, 'B3', '=$A3*B$1'); // Row adjusted in $A2 -> $A3

      // Verify computed values
      computeAndAssert(wb, 'B2', 50);  // 5 * 10
      computeAndAssert(wb, 'C2', 75);  // 5 * 15
      computeAndAssert(wb, 'D2', 100); // 5 * 20
      computeAndAssert(wb, 'B3', 80);  // 8 * 10
    });

    it('should handle lookup table with absolute reference to header', () => {
      // Setup: Lookup table with header in row 1, data starts row 2
      setCell(wb, sheetId, 'F1', { raw: 'Tax Rate' });
      setCell(wb, sheetId, 'F2', { raw: 0.10 }); // 10% tax
      setCell(wb, sheetId, 'F3', { raw: 0.15 }); // 15% tax
      setCell(wb, sheetId, 'F4', { raw: 0.20 }); // 20% tax

      setCell(wb, sheetId, 'A10', { raw: 100 }); // Amount 1
      setCell(wb, sheetId, 'A11', { raw: 200 }); // Amount 2

      // B10: Tax = Amount * Tax Rate (absolute ref to F2, assuming we want first tax rate)
      // More realistically, would use INDEX/MATCH, but for demo:
      setCell(wb, sheetId, 'B10', { formula: '=A10*$F$2' });

      // Copy down
      copyCellWithReferenceAdjustment(wb, sheetId, 'B10', 'B11');

      // Verify formulas
      assertCellFormula(wb, 'B10', '=A10*$F$2');
      assertCellFormula(wb, 'B11', '=A11*$F$2'); // A10 -> A11 (relative), $F$2 stays

      // Verify computed values
      computeAndAssert(wb, 'B10', 10); // 100 * 0.10
      computeAndAssert(wb, 'B11', 20); // 200 * 0.10
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle copy to same location (no-op)', () => {
      setCell(wb, sheetId, 'D1', { formula: '=A1+B1' });

      // Copy D1 to D1 (same location)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D1');

      // Formula should remain unchanged
      assertCellFormula(wb, 'D1', '=A1+B1');
      computeAndAssert(wb, 'D1', 30); // 10 + 20
    });

    it('should handle formulas with no cell references', () => {
      // D1 = 2 + 2 (constant formula)
      setCell(wb, sheetId, 'D1', { formula: '=2+2' });

      // Copy D1 to E2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E2');

      // E2 should have same formula (no references to adjust)
      assertCellFormula(wb, 'E2', '=2+2');
      computeAndAssert(wb, 'E2', 4);
    });

    it('should handle formulas with function calls', () => {
      // D1 = ROUND(A1/B1, 2)
      setCell(wb, sheetId, 'D1', { formula: '=ROUND(A1/B1,2)' });

      // Copy D1 to D2
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');

      // D2 should have adjusted references
      assertCellFormula(wb, 'D2', '=ROUND(A2/B2,2)');
      computeAndAssert(wb, 'D2', 0.8); // ROUND(40/50, 2) = 0.8
    });

    it('should handle empty source cell', () => {
      // Copy empty cell
      copyCellWithReferenceAdjustment(wb, sheetId, 'Z1', 'Z2');

      // Target should remain empty
      const cell = getCell(wb, sheetId, 'Z2');
      expect(cell).toBeUndefined();
    });

    it('should copy raw values without formulas', () => {
      // A1 already has raw value 10
      copyCellWithReferenceAdjustment(wb, sheetId, 'A1', 'E5');

      const cell = getCell(wb, sheetId, 'E5');
      expect(cell?.raw).toBe(10);
      expect(cell?.formula).toBeUndefined();
    });
  });

  // ==========================================================================
  // Batch Copy Operations
  // ==========================================================================

  describe('Batch Copy Operations', () => {
    it('should handle fill-down of relative formula', () => {
      // D1 = A1 + B1
      setCell(wb, sheetId, 'D1', { formula: '=A1+B1' });

      // Copy D1 down to D2, D3
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D2');
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'D3');

      // Verify formulas adjusted correctly
      assertCellFormula(wb, 'D1', '=A1+B1');
      assertCellFormula(wb, 'D2', '=A2+B2');
      assertCellFormula(wb, 'D3', '=A3+B3');

      // Verify computed values
      computeAndAssert(wb, 'D1', 30);  // 10 + 20
      computeAndAssert(wb, 'D2', 90);  // 40 + 50
      computeAndAssert(wb, 'D3', 150); // 70 + 80
    });

    it('should handle fill-right of relative formula', () => {
      // D1 = A1 + A2
      setCell(wb, sheetId, 'D1', { formula: '=A1+A2' });

      // Copy D1 right to E1, F1
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'E1');
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'F1');

      // Verify formulas adjusted correctly
      assertCellFormula(wb, 'D1', '=A1+A2');
      assertCellFormula(wb, 'E1', '=B1+B2');
      assertCellFormula(wb, 'F1', '=C1+C2');

      // Verify computed values
      computeAndAssert(wb, 'D1', 50);  // 10 + 40
      computeAndAssert(wb, 'E1', 70);  // 20 + 50
      computeAndAssert(wb, 'F1', 90);  // 30 + 60
    });

    it('should handle copying a 2x2 range', () => {
      // Setup source range D1:E2 with formulas
      setCell(wb, sheetId, 'D1', { formula: '=A1' });
      setCell(wb, sheetId, 'E1', { formula: '=B1' });
      setCell(wb, sheetId, 'D2', { formula: '=A2' });
      setCell(wb, sheetId, 'E2', { formula: '=B2' });

      // Copy to target range F3:G4 (offset +2 rows, +2 cols)
      copyCellWithReferenceAdjustment(wb, sheetId, 'D1', 'F3');
      copyCellWithReferenceAdjustment(wb, sheetId, 'E1', 'G3');
      copyCellWithReferenceAdjustment(wb, sheetId, 'D2', 'F4');
      copyCellWithReferenceAdjustment(wb, sheetId, 'E2', 'G4');

      // Verify formulas adjusted correctly
      assertCellFormula(wb, 'F3', '=C3');
      assertCellFormula(wb, 'G3', '=D3'); // Note: D3 doesn't exist, will compute to 0 or error
      assertCellFormula(wb, 'F4', '=C4');
      assertCellFormula(wb, 'G4', '=D4');
    });
  });
});
