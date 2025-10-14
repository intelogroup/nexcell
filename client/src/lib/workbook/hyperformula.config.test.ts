/**
 * HyperFormula Configuration Tests
 * 
 * These tests ensure that HyperFormula config values are valid
 * and prevent regressions like ConfigValueTooBigError.
 */

import { describe, it, expect } from 'vitest';
import HyperFormulaNamespace from 'hyperformula';
import { DEFAULT_HF_CONFIG } from './hyperformula';

const { HyperFormula } = HyperFormulaNamespace;

describe('HyperFormula Configuration', () => {
  describe('DEFAULT_HF_CONFIG', () => {
    it('should have a valid nullYear value (≤ 100)', () => {
      expect(DEFAULT_HF_CONFIG.nullYear).toBeDefined();
      expect(DEFAULT_HF_CONFIG.nullYear).toBeLessThanOrEqual(100);
      expect(DEFAULT_HF_CONFIG.nullYear).toBeGreaterThanOrEqual(0);
    });

    it('should initialize HyperFormula without throwing', () => {
      expect(() => {
        const hf = HyperFormula.buildEmpty(DEFAULT_HF_CONFIG);
        hf.destroy();
      }).not.toThrow();
    });

    it('should use nullYear=30 for Excel-like behavior', () => {
      // nullYear=30 means years 00-30 map to 2000-2030 (Excel default)
      expect(DEFAULT_HF_CONFIG.nullYear).toBe(30);
    });
  });

  describe('Invalid nullYear values', () => {
    it('should reject nullYear > 100 (4-digit years)', () => {
      const invalidConfig = {
        ...DEFAULT_HF_CONFIG,
        nullYear: 1900, // ❌ Invalid - should be 2-digit pivot
      };

      expect(() => {
        HyperFormula.buildEmpty(invalidConfig);
      }).toThrow(/ConfigValueTooBigError|should be at most 100/i);
    });

    it('should reject nullYear=2030', () => {
      const invalidConfig = {
        ...DEFAULT_HF_CONFIG,
        nullYear: 2030,
      };

      expect(() => {
        HyperFormula.buildEmpty(invalidConfig);
      }).toThrow(/ConfigValueTooBigError|should be at most 100/i);
    });

    it('should accept nullYear=0 (edge case)', () => {
      const validConfig = {
        ...DEFAULT_HF_CONFIG,
        nullYear: 0,
      };

      expect(() => {
        const hf = HyperFormula.buildEmpty(validConfig);
        hf.destroy();
      }).not.toThrow();
    });

    it('should accept nullYear=100 (max valid)', () => {
      const validConfig = {
        ...DEFAULT_HF_CONFIG,
        nullYear: 100,
      };

      expect(() => {
        const hf = HyperFormula.buildEmpty(validConfig);
        hf.destroy();
      }).not.toThrow();
    });
  });

  describe('Config completeness', () => {
    it('should have GPL v3 license key', () => {
      expect(DEFAULT_HF_CONFIG.licenseKey).toBe('gpl-v3');
    });

    it('should enable array arithmetic', () => {
      expect(DEFAULT_HF_CONFIG.useArrayArithmetic).toBe(true);
    });

    it('should use A1 notation (not column index)', () => {
      expect(DEFAULT_HF_CONFIG.useColumnIndex).toBe(false);
    });

    it('should have Excel-compatible separators', () => {
      expect(DEFAULT_HF_CONFIG.functionArgSeparator).toBe(',');
      expect(DEFAULT_HF_CONFIG.decimalSeparator).toBe('.');
      // thousandSeparator must be empty to avoid conflict with functionArgSeparator
      expect(DEFAULT_HF_CONFIG.thousandSeparator).toBe('');
    });

    it('should enable Excel leap year bug compatibility', () => {
      expect(DEFAULT_HF_CONFIG.leapYear1900).toBe(true);
    });
  });
});
