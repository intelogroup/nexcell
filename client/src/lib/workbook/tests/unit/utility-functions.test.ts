/**
 * Tests for utility functions (normalizeFormula, getErrorMessage)
 */

import { describe, test, expect } from 'vitest';
import { normalizeFormula, getErrorMessage } from '../../utils';

describe('normalizeFormula', () => {
  test('should add leading = to formula without it', () => {
    expect(normalizeFormula('SUM(A1:A5)')).toBe('=SUM(A1:A5)');
    expect(normalizeFormula('A1*2')).toBe('=A1*2');
    expect(normalizeFormula('10+20')).toBe('=10+20');
  });

  test('should preserve leading = if already present', () => {
    expect(normalizeFormula('=SUM(A1:A5)')).toBe('=SUM(A1:A5)');
    expect(normalizeFormula('=A1*2')).toBe('=A1*2');
    expect(normalizeFormula('=10+20')).toBe('=10+20');
  });

  test('should trim whitespace', () => {
    expect(normalizeFormula('  SUM(A1:A5)  ')).toBe('=SUM(A1:A5)');
    expect(normalizeFormula('  =A1*2  ')).toBe('=A1*2');
    expect(normalizeFormula('\t=10+20\n')).toBe('=10+20');
  });

  test('should handle complex formulas', () => {
    expect(normalizeFormula('IF(A1>10,SUM(B1:B5),0)')).toBe('=IF(A1>10,SUM(B1:B5),0)');
    expect(normalizeFormula('=IF(A1>10,SUM(B1:B5),0)')).toBe('=IF(A1>10,SUM(B1:B5),0)');
  });

  test('should throw on empty formula', () => {
    expect(() => normalizeFormula('')).toThrow('Formula cannot be empty');
    expect(() => normalizeFormula('   ')).toThrow('Formula cannot be empty');
    expect(() => normalizeFormula('\t\n')).toThrow('Formula cannot be empty');
  });
});

describe('getErrorMessage', () => {
  test('should extract message from Error object', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('Something went wrong');
  });

  test('should handle TypeError', () => {
    const error = new TypeError('Type mismatch');
    expect(getErrorMessage(error)).toBe('Type mismatch');
  });

  test('should convert string to string', () => {
    expect(getErrorMessage('Simple string error')).toBe('Simple string error');
  });

  test('should convert number to string', () => {
    expect(getErrorMessage(42)).toBe('42');
  });

  test('should convert object to string', () => {
    expect(getErrorMessage({ code: 'ERR_001' })).toBe('[object Object]');
  });

  test('should convert null to string', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  test('should convert undefined to string', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  test('should handle custom error objects', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    
    const error = new CustomError('Custom error occurred');
    expect(getErrorMessage(error)).toBe('Custom error occurred');
  });
});
