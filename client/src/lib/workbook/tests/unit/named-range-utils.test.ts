/**
 * Named Range Utilities Test Suite
 * 
 * Tests helper functions for creating and validating named ranges.
 */

import { describe, it, expect } from 'vitest';
import {
  toAbsoluteReference,
  validateNamedRangeName,
  createNamedRange,
  createSheetScopedNamedRange,
  createNamedRanges,
  isAbsoluteReference,
  extractNamedRangesFromFormula,
} from '../../named-ranges';

describe('Named Range Utilities', () => {
  describe('toAbsoluteReference', () => {
    it('should convert simple cell reference to absolute', () => {
      expect(toAbsoluteReference('A1')).toBe('$A$1');
      expect(toAbsoluteReference('Z99')).toBe('$Z$99');
      expect(toAbsoluteReference('AA100')).toBe('$AA$100');
    });

    it('should convert range reference to absolute', () => {
      expect(toAbsoluteReference('A1:B10')).toBe('$A$1:$B$10');
      expect(toAbsoluteReference('C5:Z100')).toBe('$C$5:$Z$100');
    });

    it('should handle sheet-qualified references', () => {
      expect(toAbsoluteReference('Sheet1!A1')).toBe('Sheet1!$A$1');
      expect(toAbsoluteReference('Sheet1!A1:B10')).toBe('Sheet1!$A$1:$B$10');
      expect(toAbsoluteReference('Data!C5:D20')).toBe('Data!$C$5:$D$20');
    });

    it('should not modify already absolute references', () => {
      expect(toAbsoluteReference('$A$1')).toBe('$A$1');
      expect(toAbsoluteReference('$A$1:$B$10')).toBe('$A$1:$B$10');
      expect(toAbsoluteReference('Sheet1!$A$1')).toBe('Sheet1!$A$1');
      expect(toAbsoluteReference('Sheet1!$A$1:$B$10')).toBe('Sheet1!$A$1:$B$10');
    });

    it('should handle mixed absolute/relative references', () => {
      expect(toAbsoluteReference('$A1')).toBe('$A1'); // Already has $, keep as-is
      expect(toAbsoluteReference('A$1')).toBe('A$1');
      expect(toAbsoluteReference('$A$1:B10')).toBe('$A$1:B10');
    });

    it('should handle multi-letter columns', () => {
      expect(toAbsoluteReference('AA1')).toBe('$AA$1');
      expect(toAbsoluteReference('ABC123')).toBe('$ABC$123');
      expect(toAbsoluteReference('XFD1048576')).toBe('$XFD$1048576'); // Max Excel cell
    });
  });

  describe('validateNamedRangeName', () => {
    it('should accept valid names', () => {
      expect(validateNamedRangeName('TotalRevenue').isValid).toBe(true);
      expect(validateNamedRangeName('Tax_Rate').isValid).toBe(true);
      expect(validateNamedRangeName('_private').isValid).toBe(true);
      expect(validateNamedRangeName('Data2024').isValid).toBe(true);
      expect(validateNamedRangeName('My.Range').isValid).toBe(true);
    });

    it('should reject empty names', () => {
      expect(validateNamedRangeName('').isValid).toBe(false);
      expect(validateNamedRangeName('   ').isValid).toBe(false);
    });

    it('should reject names starting with numbers', () => {
      const result = validateNamedRangeName('2024Data');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must start with');
    });

    it('should reject names that look like cell references', () => {
      expect(validateNamedRangeName('A1').isValid).toBe(false);
      expect(validateNamedRangeName('BC123').isValid).toBe(false);
      expect(validateNamedRangeName('XFD1048576').isValid).toBe(false);
      
      // But these should be OK (not pure cell refs)
      expect(validateNamedRangeName('Data2024').isValid).toBe(true);
      expect(validateNamedRangeName('Q1Sales').isValid).toBe(true);
      expect(validateNamedRangeName('DataRange1').isValid).toBe(true);
    });

    it('should reject reserved names', () => {
      expect(validateNamedRangeName('TRUE').isValid).toBe(false);
      expect(validateNamedRangeName('FALSE').isValid).toBe(false);
      expect(validateNamedRangeName('SUM').isValid).toBe(false);
      expect(validateNamedRangeName('IF').isValid).toBe(false);
    });

    it('should reject names with invalid characters', () => {
      expect(validateNamedRangeName('My Range').isValid).toBe(false); // Space
      expect(validateNamedRangeName('My-Range').isValid).toBe(false); // Hyphen
      expect(validateNamedRangeName('My@Range').isValid).toBe(false); // @
      expect(validateNamedRangeName('My+Range').isValid).toBe(false); // +
    });

    it('should reject names exceeding 255 characters', () => {
      const longName = 'A'.repeat(256);
      expect(validateNamedRangeName(longName).isValid).toBe(false);
    });

    it('should accept names at exactly 255 characters', () => {
      const longName = 'A'.repeat(255);
      expect(validateNamedRangeName(longName).isValid).toBe(true);
    });
  });

  describe('createNamedRange', () => {
    it('should create valid named range with absolute reference', () => {
      const range = createNamedRange('TotalSales', 'Sheet1!A1:A10');
      
      expect(range.name).toBe('TotalSales');
      expect(range.ref).toBe('Sheet1!$A$1:$A$10');
      expect(range.scope).toBe('workbook');
      expect(range.hidden).toBe(false);
    });

    it('should accept optional metadata', () => {
      const range = createNamedRange('TaxRate', 'Settings!B5', {
        comment: 'Annual tax rate',
        hidden: true,
      });
      
      expect(range.comment).toBe('Annual tax rate');
      expect(range.hidden).toBe(true);
    });

    it('should throw on invalid name', () => {
      expect(() => {
        createNamedRange('A1', 'Sheet1!B1');
      }).toThrow('Invalid named range name');
      
      expect(() => {
        createNamedRange('TRUE', 'Sheet1!B1');
      }).toThrow('reserved');
    });

    it('should automatically convert relative to absolute', () => {
      const range = createNamedRange('MyData', 'A1:B10');
      expect(range.ref).toBe('$A$1:$B$10');
    });
  });

  describe('createSheetScopedNamedRange', () => {
    it('should create sheet-scoped named range', () => {
      const range = createSheetScopedNamedRange(
        'LocalData',
        'A1:A10',
        'sheet-123'
      );
      
      expect(range.name).toBe('LocalData');
      expect(range.ref).toBe('$A$1:$A$10');
      expect(range.scope).toBe('sheet-123');
    });

    it('should validate name for sheet-scoped ranges', () => {
      expect(() => {
        createSheetScopedNamedRange('A1', 'B1:B10', 'sheet-123');
      }).toThrow('Invalid named range name');
    });
  });

  describe('createNamedRanges', () => {
    it('should create multiple named ranges', () => {
      const ranges = createNamedRanges([
        { name: 'Revenue', ref: 'Sheet1!A1:A10' },
        { name: 'Expenses', ref: 'Sheet1!B1:B10' },
        { name: 'Profit', ref: 'Sheet1!C1:C10', comment: 'Net profit' },
      ]);
      
      expect(ranges).toEqual({
        'Revenue': 'Sheet1!$A$1:$A$10',
        'Expenses': 'Sheet1!$B$1:$B$10',
        'Profit': 'Sheet1!$C$1:$C$10',
      });
    });

    it('should throw on first invalid name', () => {
      expect(() => {
        createNamedRanges([
          { name: 'ValidName', ref: 'A1:A10' },
          { name: 'A1', ref: 'B1:B10' }, // Invalid
          { name: 'AnotherValid', ref: 'C1:C10' },
        ]);
      }).toThrow('Invalid named range name');
    });
  });

  describe('isAbsoluteReference', () => {
    it('should detect absolute references', () => {
      expect(isAbsoluteReference('$A$1')).toBe(true);
      expect(isAbsoluteReference('$A$1:$B$10')).toBe(true);
      expect(isAbsoluteReference('Sheet1!$A$1')).toBe(true);
    });

    it('should detect partially absolute references', () => {
      expect(isAbsoluteReference('$A1')).toBe(true);
      expect(isAbsoluteReference('A$1')).toBe(true);
      expect(isAbsoluteReference('$A1:B10')).toBe(true);
    });

    it('should detect relative references', () => {
      expect(isAbsoluteReference('A1')).toBe(false);
      expect(isAbsoluteReference('A1:B10')).toBe(false);
      expect(isAbsoluteReference('Sheet1!A1')).toBe(false);
    });
  });

  describe('extractNamedRangesFromFormula', () => {
    it('should extract named ranges from formula', () => {
      const formula = 'SUM(Revenue) + SUM(Expenses)';
      const names = extractNamedRangesFromFormula(formula);
      
      expect(names).toContain('Revenue');
      expect(names).toContain('Expenses');
      expect(names.length).toBe(2);
    });

    it('should not extract function names', () => {
      const formula = 'SUM(A1:A10) + AVERAGE(B1:B10)';
      const names = extractNamedRangesFromFormula(formula);
      
      // SUM and AVERAGE are followed by (, so not named ranges
      expect(names).not.toContain('SUM');
      expect(names).not.toContain('AVERAGE');
    });

    it('should not extract cell references', () => {
      const formula = 'A1 + B2 + TotalRevenue';
      const names = extractNamedRangesFromFormula(formula);
      
      expect(names).not.toContain('A1');
      expect(names).not.toContain('B2');
      expect(names).toContain('TotalRevenue');
    });

    it('should handle complex formulas', () => {
      const formula = 'IF(TaxRate > 0, Revenue * TaxRate, 0) + Expenses';
      const names = extractNamedRangesFromFormula(formula);
      
      expect(names).toContain('TaxRate');
      expect(names).toContain('Revenue');
      expect(names).toContain('Expenses');
      expect(names).not.toContain('IF');
    });

    it('should deduplicate named ranges', () => {
      const formula = 'Revenue + Revenue * TaxRate';
      const names = extractNamedRangesFromFormula(formula);
      
      expect(names.filter(n => n === 'Revenue').length).toBe(1);
      expect(names).toContain('TaxRate');
    });

    it('should handle underscores and periods in names', () => {
      const formula = 'Total_Revenue + Tax.Rate + Q1_Sales';
      const names = extractNamedRangesFromFormula(formula);
      
      // Periods are part of valid name characters, so "Tax.Rate" is extracted as one name
      expect(names).toContain('Total_Revenue');
      expect(names).toContain('Tax.Rate'); // Extracted as single name (periods allowed)
      expect(names).toContain('Q1_Sales');
      
      // Underscores work well for multi-word names
      const formula2 = 'Total_Revenue + Tax_Rate + Q1_Sales';
      const names2 = extractNamedRangesFromFormula(formula2);
      expect(names2).toContain('Total_Revenue');
      expect(names2).toContain('Tax_Rate');
      expect(names2).toContain('Q1_Sales');
    });
  });

  describe('Integration: Using helpers with workbook', () => {
    it('should simplify named range creation', () => {
      // Without helpers - error-prone
      const manualRanges = {
        'Revenue': 'Sheet1!A1:A10', // ❌ Missing $ signs!
      };

      // With helpers - automatic conversion
      const helperRanges = createNamedRanges([
        { name: 'Revenue', ref: 'Sheet1!A1:A10' }, // ✅ Auto-converted
      ]);

      expect(helperRanges.Revenue).toBe('Sheet1!$A$1:$A$10');
    });

    it('should validate names before adding', () => {
      // Pure cell refs are invalid
      expect(() => {
        createNamedRange('A1', 'Sheet1!B1');
      }).toThrow('Invalid named range name');

      // But names with text + numbers are OK
      const range = createNamedRange('DataRange1', 'A1:A10');
      expect(range.ref).toBe('$A$1:$A$10');
    });
  });
});
