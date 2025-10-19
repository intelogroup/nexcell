/**
 * Workbook Validation Module
 * 
 * Post-execution validation for AI-generated workbook operations.
 * Checks for errors, warnings, and provides suggestions for improvement.
 * 
 * Design Principles:
 * - Non-destructive: Validation never modifies the workbook
 * - Comprehensive: Catches all common formula/data issues
 * - Actionable: Provides clear suggestions for fixes
 * - Extensible: Easy to add new validation rules
 * 
 * Architecture:
 * 1. validateWorkbook() - Main entry point
 * 2. Rule-based validation system
 * 3. Returns structured ValidationResult
 * 
 * Usage:
 * ```typescript
 * const result = validateWorkbook(workbook);
 * if (result.errors.length > 0) {
 *   console.error('Workbook has errors:', result.errors);
 * }
 * ```
 */

import type { WorkbookJSON, SheetJSON, Cell } from '../../workbook/types';

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'suggestion';

/**
 * Validation issue categories
 */
export type ValidationCategory = 
  | 'formula-error'      // Formula contains errors (#DIV/0!, #REF!, etc.)
  | 'circular-reference' // Circular dependency detected
  | 'missing-compute'    // Formulas exist but not computed
  | 'stale-compute'      // Computed values are stale (HF version mismatch)
  | 'invalid-reference'  // Reference to non-existent sheet/cell
  | 'data-type-mismatch' // Data type inconsistency
  | 'missing-data'       // Empty cells in important ranges
  | 'performance'        // Performance concerns (too many formulas, etc.)
  | 'best-practice'      // Suggestions for improvement
  | 'named-range'        // Named range issues
  | 'formatting';        // Formatting inconsistencies

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Severity level */
  severity: ValidationSeverity;
  /** Issue category */
  category: ValidationCategory;
  /** Human-readable message */
  message: string;
  /** Sheet ID where issue was found (if applicable) */
  sheetId?: string;
  /** Sheet name for display */
  sheetName?: string;
  /** Cell address(es) affected (A1, B2:C5, etc.) */
  cellAddress?: string;
  /** Suggested fix or action */
  suggestion?: string;
  /** Additional context */
  metadata?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Overall validation status */
  isValid: boolean;
  /** Critical errors that must be fixed */
  errors: ValidationIssue[];
  /** Warnings that should be addressed */
  warnings: ValidationIssue[];
  /** Suggestions for improvement */
  suggestions: ValidationIssue[];
  /** Total issue count */
  totalIssues: number;
  /** Validation timestamp */
  validatedAt: string;
  /** Summary message */
  summary: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Check for formula errors (default: true) */
  checkFormulaErrors?: boolean;
  /** Check for circular references (default: true) */
  checkCircularReferences?: boolean;
  /** Check for missing computations (default: true) */
  checkMissingCompute?: boolean;
  /** Check for stale computations (default: true) */
  checkStaleCompute?: boolean;
  /** Check for invalid references (default: true) */
  checkInvalidReferences?: boolean;
  /** Check for data type mismatches (default: false - performance intensive) */
  checkDataTypeMismatch?: boolean;
  /** Check for performance issues (default: true) */
  checkPerformance?: boolean;
  /** Provide best practice suggestions (default: true) */
  provideSuggestions?: boolean;
  /** Maximum issues to report per category (default: 10) */
  maxIssuesPerCategory?: number;
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  checkFormulaErrors: true,
  checkCircularReferences: true,
  checkMissingCompute: true,
  checkStaleCompute: true,
  checkInvalidReferences: true,
  checkDataTypeMismatch: false, // expensive
  checkPerformance: true,
  provideSuggestions: true,
  maxIssuesPerCategory: 10,
};

/**
 * Excel error codes that indicate formula errors
 */
const EXCEL_ERROR_CODES = [
  '#DIV/0!',   // Division by zero
  '#N/A',      // Value not available
  '#NAME?',    // Unrecognized name
  '#NULL!',    // Null intersection
  '#NUM!',     // Invalid numeric value
  '#REF!',     // Invalid cell reference
  '#VALUE!',   // Wrong type of argument
  '#CYCLE!',   // Circular reference
  '#GETTING_DATA', // Data loading
  '#SPILL!',   // Spill range blocked
];

/**
 * Main validation function
 * 
 * Validates a workbook and returns a structured result with errors, warnings, and suggestions.
 * 
 * @param workbook - WorkbookJSON to validate
 * @param options - Validation options (optional)
 * @returns ValidationResult with all issues found
 */
export function validateWorkbook(
  workbook: WorkbookJSON | null | undefined,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const suggestions: ValidationIssue[] = [];

  // Guard: null/undefined workbook
  if (!workbook) {
    errors.push({
      severity: 'error',
      category: 'missing-data',
      message: 'Workbook is null or undefined',
      suggestion: 'Create a workbook first using createWorkbook operation',
    });

    return buildResult(errors, warnings, suggestions);
  }

  // Guard: no sheets
  if (!workbook.sheets || workbook.sheets.length === 0) {
    errors.push({
      severity: 'error',
      category: 'missing-data',
      message: 'Workbook has no sheets',
      suggestion: 'Add at least one sheet to the workbook',
    });

    return buildResult(errors, warnings, suggestions);
  }

  // Run validation rules
  for (const sheet of workbook.sheets) {
    if (opts.checkFormulaErrors) {
      checkFormulaErrors(sheet, errors, warnings, opts.maxIssuesPerCategory);
    }

    if (opts.checkMissingCompute) {
      checkMissingCompute(sheet, warnings, opts.maxIssuesPerCategory);
    }

    if (opts.checkStaleCompute) {
      checkStaleCompute(sheet, warnings, opts.maxIssuesPerCategory);
    }

    if (opts.checkInvalidReferences) {
      checkInvalidReferences(sheet, workbook, errors, opts.maxIssuesPerCategory);
    }

    if (opts.checkPerformance) {
      checkPerformanceIssues(sheet, warnings, suggestions, opts.maxIssuesPerCategory);
    }
  }

  // Workbook-level validations
  if (opts.checkCircularReferences) {
    checkCircularReferences(workbook, errors, opts.maxIssuesPerCategory);
  }

  if (opts.provideSuggestions) {
    provideBestPractices(workbook, suggestions, opts.maxIssuesPerCategory);
  }

  return buildResult(errors, warnings, suggestions);
}

/**
 * Check for formula errors in computed values
 */
function checkFormulaErrors(
  sheet: SheetJSON,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  maxIssues: number
): void {
  if (!sheet.cells) return;

  let errorCount = 0;

  for (const [address, cell] of Object.entries(sheet.cells)) {
    if (errorCount >= maxIssues) break;

    // Check if cell has a formula
    if (!cell.formula) continue;

    // Check computed value for errors
    if (cell.computed) {
      const computedValue = String(cell.computed.v);
      
      if (EXCEL_ERROR_CODES.includes(computedValue)) {
        const issue: ValidationIssue = {
          severity: 'error',
          category: 'formula-error',
          message: `Formula error: ${computedValue}`,
          sheetId: sheet.id,
          sheetName: sheet.name,
          cellAddress: address,
          suggestion: getErrorSuggestion(computedValue, cell.formula),
          metadata: {
            formula: cell.formula,
            errorValue: computedValue,
          },
        };

        // #CYCLE! is critical, others are warnings
        if (computedValue === '#CYCLE!') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }

        errorCount++;
      }

      // Check for error in computed metadata
      if (cell.computed.error) {
        warnings.push({
          severity: 'warning',
          category: 'formula-error',
          message: `Computation error: ${cell.computed.error}`,
          sheetId: sheet.id,
          sheetName: sheet.name,
          cellAddress: address,
          metadata: {
            formula: cell.formula,
            error: cell.computed.error,
          },
        });
        errorCount++;
      }
    }
  }
}

/**
 * Check for formulas that haven't been computed
 */
function checkMissingCompute(
  sheet: SheetJSON,
  warnings: ValidationIssue[],
  maxIssues: number
): void {
  if (!sheet.cells) return;

  let missingCount = 0;
  const missingCells: string[] = [];

  for (const [address, cell] of Object.entries(sheet.cells)) {
    if (missingCount >= maxIssues) break;

    // Has formula but no computed value
    if (cell.formula && !cell.computed) {
      missingCells.push(address);
      missingCount++;
    }
  }

  if (missingCells.length > 0) {
    warnings.push({
      severity: 'warning',
      category: 'missing-compute',
      message: `${missingCells.length} formula(s) not computed in sheet "${sheet.name}"`,
      sheetId: sheet.id,
      sheetName: sheet.name,
      cellAddress: missingCells.slice(0, 5).join(', ') + (missingCells.length > 5 ? '...' : ''),
      suggestion: 'Run compute operation to evaluate all formulas',
      metadata: {
        missingCells: missingCells.slice(0, 10),
        totalMissing: missingCells.length,
      },
    });
  }
}

/**
 * Check for stale computed values (HF version mismatch)
 */
function checkStaleCompute(
  sheet: SheetJSON,
  warnings: ValidationIssue[],
  maxIssues: number
): void {
  if (!sheet.cells) return;

  let staleCount = 0;
  const staleCells: string[] = [];

  for (const [address, cell] of Object.entries(sheet.cells)) {
    if (staleCount >= maxIssues) break;

    // Check for stale flag or missing hfVersion
    if (cell.computed && (cell.computed.stale || !cell.computed.hfVersion)) {
      staleCells.push(address);
      staleCount++;
    }
  }

  if (staleCells.length > 0) {
    warnings.push({
      severity: 'warning',
      category: 'stale-compute',
      message: `${staleCells.length} computed value(s) may be stale in sheet "${sheet.name}"`,
      sheetId: sheet.id,
      sheetName: sheet.name,
      cellAddress: staleCells.slice(0, 5).join(', ') + (staleCells.length > 5 ? '...' : ''),
      suggestion: 'Re-run compute operation to refresh all computed values',
      metadata: {
        staleCells: staleCells.slice(0, 10),
        totalStale: staleCells.length,
      },
    });
  }
}

/**
 * Check for invalid sheet references in formulas
 */
function checkInvalidReferences(
  sheet: SheetJSON,
  workbook: WorkbookJSON,
  errors: ValidationIssue[],
  maxIssues: number
): void {
  if (!sheet.cells) return;

  const sheetNames = new Set(workbook.sheets.map(s => s.name));
  let errorCount = 0;

  for (const [address, cell] of Object.entries(sheet.cells)) {
    if (errorCount >= maxIssues) break;

    if (!cell.formula) continue;

    // Check for cross-sheet references (Sheet!A1)
    const crossSheetPattern = /([A-Za-z0-9_]+)!/g;
    const matches = cell.formula.matchAll(crossSheetPattern);

    for (const match of matches) {
      const referencedSheet = match[1];
      
      // Skip if it's the current sheet or a valid sheet
      if (referencedSheet === sheet.name || sheetNames.has(referencedSheet)) {
        continue;
      }

      errors.push({
        severity: 'error',
        category: 'invalid-reference',
        message: `Invalid sheet reference: ${referencedSheet}`,
        sheetId: sheet.id,
        sheetName: sheet.name,
        cellAddress: address,
        suggestion: `Verify sheet name "${referencedSheet}" exists in the workbook`,
        metadata: {
          formula: cell.formula,
          referencedSheet,
          availableSheets: Array.from(sheetNames),
        },
      });

      errorCount++;
      break; // One error per cell is enough
    }
  }
}

/**
 * Check for circular references in formulas
 */
function checkCircularReferences(
  workbook: WorkbookJSON,
  errors: ValidationIssue[],
  maxIssues: number
): void {
  // Look for #CYCLE! errors which indicate circular references
  let cycleCount = 0;

  for (const sheet of workbook.sheets) {
    if (!sheet.cells) continue;
    if (cycleCount >= maxIssues) break;

    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (cycleCount >= maxIssues) break;

      if (cell.computed && String(cell.computed.v) === '#CYCLE!') {
        errors.push({
          severity: 'error',
          category: 'circular-reference',
          message: `Circular reference detected at ${sheet.name}!${address}`,
          sheetId: sheet.id,
          sheetName: sheet.name,
          cellAddress: address,
          suggestion: 'Review formula dependencies to break the circular reference',
          metadata: {
            formula: cell.formula,
          },
        });
        cycleCount++;
      }
    }
  }
}

/**
 * Check for performance issues
 */
function checkPerformanceIssues(
  sheet: SheetJSON,
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[],
  maxIssues: number
): void {
  if (!sheet.cells) return;

  // Count formulas
  let formulaCount = 0;
  let volatileFunctionCount = 0;
  const volatileFunctions = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'INDIRECT', 'OFFSET'];

  for (const cell of Object.values(sheet.cells)) {
    if (cell.formula) {
      formulaCount++;

      // Check for volatile functions
      const upperFormula = cell.formula.toUpperCase();
      for (const fn of volatileFunctions) {
        if (upperFormula.includes(fn)) {
          volatileFunctionCount++;
          break;
        }
      }
    }
  }

  // Warning: Too many formulas
  if (formulaCount > 1000 && warnings.length < maxIssues) {
    warnings.push({
      severity: 'warning',
      category: 'performance',
      message: `Sheet "${sheet.name}" has ${formulaCount} formulas (consider optimization)`,
      sheetId: sheet.id,
      sheetName: sheet.name,
      suggestion: 'Consider using named ranges, reducing redundant formulas, or pre-computing values',
      metadata: {
        formulaCount,
      },
    });
  }

  // Warning: Volatile functions
  if (volatileFunctionCount > 50 && warnings.length < maxIssues) {
    warnings.push({
      severity: 'warning',
      category: 'performance',
      message: `Sheet "${sheet.name}" uses ${volatileFunctionCount} volatile functions`,
      sheetId: sheet.id,
      sheetName: sheet.name,
      suggestion: 'Volatile functions (NOW, RAND, etc.) recalculate on every change. Consider alternatives.',
      metadata: {
        volatileFunctionCount,
      },
    });
  }
}

/**
 * Provide best practice suggestions
 */
function provideBestPractices(
  workbook: WorkbookJSON,
  suggestions: ValidationIssue[],
  maxIssues: number
): void {
  if (suggestions.length >= maxIssues) return;

  // Suggestion: Use named ranges for repeated references
  let totalFormulas = 0;
  const rangePatterns: Record<string, number> = {};

  for (const sheet of workbook.sheets) {
    if (!sheet.cells) continue;

    for (const cell of Object.values(sheet.cells)) {
      if (cell.formula) {
        totalFormulas++;

        // Extract range patterns like A1:A10
        const rangePattern = /[A-Z]+[0-9]+:[A-Z]+[0-9]+/g;
        const matches = cell.formula.match(rangePattern);
        
        if (matches) {
          for (const range of matches) {
            rangePatterns[range] = (rangePatterns[range] || 0) + 1;
          }
        }
      }
    }
  }

  // Find ranges used multiple times
  const frequentRanges = Object.entries(rangePatterns)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (frequentRanges.length > 0 && suggestions.length < maxIssues) {
    suggestions.push({
      severity: 'suggestion',
      category: 'best-practice',
      message: `Consider using named ranges for frequently referenced ranges`,
      suggestion: `Ranges like ${frequentRanges.map(([r]) => r).join(', ')} are used multiple times`,
      metadata: {
        frequentRanges: Object.fromEntries(frequentRanges),
      },
    });
  }

  // Suggestion: Add compute operation if formulas exist but no computed values
  const sheetsWithUncomputedFormulas = workbook.sheets.filter(sheet => {
    if (!sheet.cells) return false;
    
    for (const cell of Object.values(sheet.cells)) {
      if (cell.formula && !cell.computed) {
        return true;
      }
    }
    return false;
  });

  if (sheetsWithUncomputedFormulas.length > 0 && suggestions.length < maxIssues) {
    suggestions.push({
      severity: 'suggestion',
      category: 'best-practice',
      message: 'Workbook contains uncomputed formulas',
      suggestion: 'Add a compute operation to evaluate all formulas and cache results',
      metadata: {
        sheetsAffected: sheetsWithUncomputedFormulas.map(s => s.name),
      },
    });
  }
}

/**
 * Get suggestion for specific error code
 */
function getErrorSuggestion(errorCode: string, formula: string): string {
  switch (errorCode) {
    case '#DIV/0!':
      return 'Check for division by zero. Use IF or IFERROR to handle zero divisors.';
    case '#N/A':
      return 'Value not available. Check lookup functions (VLOOKUP, MATCH, etc.) for valid references.';
    case '#NAME?':
      return 'Function or name not recognized. Verify formula syntax and function names.';
    case '#NULL!':
      return 'Incorrect range operator. Check for missing colons in range references.';
    case '#NUM!':
      return 'Invalid numeric value. Check for negative numbers in SQRT, invalid dates, etc.';
    case '#REF!':
      return 'Invalid cell reference. Referenced cell may have been deleted.';
    case '#VALUE!':
      return 'Wrong type of argument. Check that text/numbers are used correctly.';
    case '#CYCLE!':
      return 'Circular reference detected. Remove formulas that reference themselves directly or indirectly.';
    case '#SPILL!':
      return 'Array formula spill range is blocked. Clear cells in the spill range.';
    default:
      return 'Review formula syntax and referenced cells.';
  }
}

/**
 * Build final validation result
 */
function buildResult(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): ValidationResult {
  const totalIssues = errors.length + warnings.length + suggestions.length;
  const isValid = errors.length === 0;

  let summary = '';
  if (isValid && totalIssues === 0) {
    summary = 'Workbook validation passed with no issues.';
  } else if (isValid) {
    summary = `Workbook is valid but has ${warnings.length} warning(s) and ${suggestions.length} suggestion(s).`;
  } else {
    summary = `Workbook validation failed with ${errors.length} error(s), ${warnings.length} warning(s), and ${suggestions.length} suggestion(s).`;
  }

  return {
    isValid,
    errors,
    warnings,
    suggestions,
    totalIssues,
    validatedAt: new Date().toISOString(),
    summary,
  };
}

/**
 * Helper: Format validation result as human-readable text
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push('WORKBOOK VALIDATION REPORT');
  lines.push('='.repeat(60));
  lines.push(`Status: ${result.isValid ? '✅ VALID' : '❌ INVALID'}`);
  lines.push(`Validated: ${result.validatedAt}`);
  lines.push(`Total Issues: ${result.totalIssues}`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('ERRORS (❌):');
    lines.push('-'.repeat(60));
    for (const error of result.errors) {
      lines.push(formatIssue(error));
      lines.push('');
    }
  }

  if (result.warnings.length > 0) {
    lines.push('WARNINGS (⚠️):');
    lines.push('-'.repeat(60));
    for (const warning of result.warnings) {
      lines.push(formatIssue(warning));
      lines.push('');
    }
  }

  if (result.suggestions.length > 0) {
    lines.push('SUGGESTIONS (💡):');
    lines.push('-'.repeat(60));
    for (const suggestion of result.suggestions) {
      lines.push(formatIssue(suggestion));
      lines.push('');
    }
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Helper: Format single issue
 */
function formatIssue(issue: ValidationIssue): string {
  const location = issue.sheetName && issue.cellAddress
    ? `${issue.sheetName}!${issue.cellAddress}`
    : issue.sheetName || 'Workbook';

  const lines = [
    `[${issue.category.toUpperCase()}] ${issue.message}`,
    `  Location: ${location}`,
  ];

  if (issue.suggestion) {
    lines.push(`  Suggestion: ${issue.suggestion}`);
  }

  return lines.join('\n');
}
