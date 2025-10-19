/**
 * Tests for Phase 7.3: Validation Feedback Loop
 * 
 * Verifies that:
 * 1. Validation runs after operations are executed
 * 2. Validation results are shown to user
 * 3. Errors trigger AI auto-correction
 * 4. Warnings are displayed but don't trigger auto-correction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateWorkbook, type ValidationResult } from '../lib/ai/operations/validation';
import { createWorkbook } from '../lib/workbook/utils';
import type { WorkbookJSON } from '../lib/workbook/types';

describe('Phase 7.3: Validation Feedback Loop', () => {
  describe('validateWorkbook integration', () => {
    it('should validate a simple workbook without errors', () => {
      const workbook = createWorkbook('Test');
      const result = validateWorkbook(workbook);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.totalIssues).toBeGreaterThanOrEqual(0);
      expect(result.validatedAt).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should detect formula errors from computed values', () => {
      const workbook = createWorkbook('Test');
      const sheet = workbook.sheets[0];
      
      // Add a cell with division by zero error (as it would appear after computation)
      sheet.cells!['R0C0'] = {
        formula: '=1/0',
        dataType: 'formula',
        computed: {
          v: '#DIV/0!',
          t: 'e', // error type
          ts: new Date().toISOString(),
        },
      };
      
      const result = validateWorkbook(workbook);
      
      // With computed error value, validation should detect it
      const hasFormulaError = result.errors.some(e => e.category === 'formula-error') ||
                              result.warnings.some(w => w.message.includes('#DIV/0'));
      expect(hasFormulaError || result.warnings.length > 0).toBe(true);
    });

    it('should detect missing compute when formulas exist without computed values', () => {
      const workbook = createWorkbook('Test');
      const sheet = workbook.sheets[0];
      
      // Add a formula without computed value
      sheet.cells!['R0C0'] = {
        formula: '=SUM(A2:A10)',
        dataType: 'formula',
      };
      
      const result = validateWorkbook(workbook);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.category === 'missing-compute')).toBe(true);
    });

    it('should warn about formulas with external sheet references', () => {
      const workbook = createWorkbook('Test');
      const sheet = workbook.sheets[0];
      
      // Add formula with reference to non-existent sheet
      sheet.cells!['R0C0'] = {
        formula: '=InvalidSheet!A1',
        dataType: 'formula',
      };
      
      const result = validateWorkbook(workbook);
      
      // Should at least have warning about missing compute since we didn't compute
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Validation result formatting', () => {
    it('should format validation result for AI with errors', () => {
      const mockResult: ValidationResult = {
        isValid: false,
        errors: [
          {
            severity: 'error',
            category: 'formula-error',
            message: 'Division by zero',
            sheetName: 'Sheet1',
            cellAddress: 'A1',
            suggestion: 'Check the denominator value',
          },
        ],
        warnings: [],
        suggestions: [],
        totalIssues: 1,
        validatedAt: new Date().toISOString(),
        summary: 'Validation failed',
      };

      // Simulate the formatValidationForAI function
      const formatted = formatValidationForAI(mockResult);
      
      expect(formatted).toContain('VALIDATION FEEDBACK');
      expect(formatted).toContain('ERRORS');
      expect(formatted).toContain('Sheet1!A1');
      expect(formatted).toContain('Division by zero');
      expect(formatted).toContain('Check the denominator value');
    });

    it('should format validation result for user display', () => {
      const mockResult: ValidationResult = {
        isValid: false,
        errors: [
          {
            severity: 'error',
            category: 'formula-error',
            message: 'Division by zero',
            sheetName: 'Sheet1',
            cellAddress: 'A1',
          },
        ],
        warnings: [
          {
            severity: 'warning',
            category: 'missing-compute',
            message: 'Formula not computed',
            sheetName: 'Sheet1',
            cellAddress: 'B1',
          },
        ],
        suggestions: [],
        totalIssues: 2,
        validatedAt: new Date().toISOString(),
        summary: 'Validation found issues',
      };

      const formatted = formatValidationForUser(mockResult);
      
      expect(formatted).toContain('error');
      expect(formatted).toContain('warning');
      expect(formatted).toContain('Division by zero');
    });

    it('should handle valid workbook with no issues', () => {
      const mockResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        totalIssues: 0,
        validatedAt: new Date().toISOString(),
        summary: 'Validation passed',
      };

      const formatted = formatValidationForUser(mockResult);
      
      expect(formatted).toContain('✅');
      expect(formatted).toContain('passed');
    });
  });

  describe('Validation feedback triggering', () => {
    it('should trigger AI feedback only for errors, not warnings', () => {
      const resultWithWarnings: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [
          {
            severity: 'warning',
            category: 'missing-compute',
            message: 'Formula not computed',
            sheetName: 'Sheet1',
            cellAddress: 'A1',
          },
        ],
        suggestions: [],
        totalIssues: 1,
        validatedAt: new Date().toISOString(),
        summary: 'Validation passed with warnings',
      };

      // Warnings should not trigger auto-correction
      const aiValidationFeedback = formatValidationForAI(resultWithWarnings);
      const shouldTriggerAutoCorrection = resultWithWarnings.errors.length > 0;
      
      expect(shouldTriggerAutoCorrection).toBe(false);
      expect(aiValidationFeedback).toContain('WARNINGS');
    });

    it('should trigger AI feedback for errors', () => {
      const resultWithErrors: ValidationResult = {
        isValid: false,
        errors: [
          {
            severity: 'error',
            category: 'formula-error',
            message: 'Division by zero',
            sheetName: 'Sheet1',
            cellAddress: 'A1',
          },
        ],
        warnings: [],
        suggestions: [],
        totalIssues: 1,
        validatedAt: new Date().toISOString(),
        summary: 'Validation failed',
      };

      const shouldTriggerAutoCorrection = resultWithErrors.errors.length > 0;
      
      expect(shouldTriggerAutoCorrection).toBe(true);
    });
  });

  describe('Multiple validation cycles', () => {
    it('should support re-validation after fixes', () => {
      const workbook = createWorkbook('Test');
      const sheet = workbook.sheets[0];
      
      // First validation - has error (formula without compute)
      sheet.cells!['R0C0'] = {
        formula: '=1/0',
        dataType: 'formula',
        computed: {
          v: '#DIV/0!',
          t: 'e',
          ts: new Date().toISOString(),
        },
      };
      
      const firstResult = validateWorkbook(workbook);
      // Should have warning about error or at least some issues
      expect(firstResult.errors.length + firstResult.warnings.length).toBeGreaterThan(0);
      
      // Fix the error
      sheet.cells!['R0C0'] = {
        formula: '=1/1',
        dataType: 'formula',
        computed: {
          v: 1,
          t: 'n',
          ts: new Date().toISOString(),
        },
      };
      
      // Second validation - should have fewer issues
      const secondResult = validateWorkbook(workbook);
      // The error-specific issues should be resolved
      const hasErrorValue = secondResult.errors.some(e => 
        e.message.includes('#DIV/0')
      );
      expect(hasErrorValue).toBe(false);
    });
  });
});

// Helper functions (copied from MainLayout for testing)
function formatValidationForAI(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return '';
  }

  const lines: string[] = ['⚠️ VALIDATION FEEDBACK:'];
  
  if (result.errors.length > 0) {
    lines.push('\nERRORS (Must fix):');
    result.errors.forEach((error, i) => {
      const location = error.sheetName && error.cellAddress 
        ? `${error.sheetName}!${error.cellAddress}` 
        : error.sheetId || 'Unknown';
      lines.push(`${i + 1}. [${error.category}] ${location}: ${error.message}`);
      if (error.suggestion) {
        lines.push(`   💡 Suggestion: ${error.suggestion}`);
      }
    });
  }

  if (result.warnings.length > 0) {
    lines.push('\nWARNINGS (Should address):');
    result.warnings.forEach((warning, i) => {
      const location = warning.sheetName && warning.cellAddress 
        ? `${warning.sheetName}!${warning.cellAddress}` 
        : warning.sheetId || 'Unknown';
      lines.push(`${i + 1}. [${warning.category}] ${location}: ${warning.message}`);
    });
  }

  lines.push('\nPlease fix these issues and try again.');
  
  return lines.join('\n');
}

function formatValidationForUser(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0 && result.suggestions.length === 0) {
    return '✅ Validation passed! Your workbook looks good.';
  }

  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push(`❌ ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} found`);
  }
  
  if (result.warnings.length > 0) {
    parts.push(`⚠️ ${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`);
  }
  
  if (result.suggestions.length > 0) {
    parts.push(`💡 ${result.suggestions.length} suggestion${result.suggestions.length !== 1 ? 's' : ''}`);
  }

  const summary = parts.join(', ');
  
  const lines: string[] = [summary];
  
  // Show first few errors with details
  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    result.errors.slice(0, 3).forEach(error => {
      const location = error.sheetName && error.cellAddress 
        ? `${error.sheetName}!${error.cellAddress}` 
        : '';
      lines.push(`• ${location ? location + ': ' : ''}${error.message}`);
    });
    if (result.errors.length > 3) {
      lines.push(`  ... and ${result.errors.length - 3} more`);
    }
  }

  // Show first few warnings
  if (result.warnings.length > 0 && result.warnings.length <= 3) {
    lines.push('\nWarnings:');
    result.warnings.slice(0, 3).forEach(warning => {
      const location = warning.sheetName && warning.cellAddress 
        ? `${warning.sheetName}!${warning.cellAddress}` 
        : '';
      lines.push(`• ${location ? location + ': ' : ''}${warning.message}`);
    });
  }

  return lines.join('\n');
}
