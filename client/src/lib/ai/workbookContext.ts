/**
 * Workbook Context Provider for AI
 * 
 * This module extracts and formats workbook context to make the AI
 * fully aware of the spreadsheet state, including:
 * - Sheet structure and dimensions
 * - Cell values, formulas, and dependencies
 * - Named ranges and expressions
 * - Data patterns and statistics
 * - Potential errors and warnings
 */

import type { WorkbookJSON, SheetJSON } from '@/lib/workbook/types';
import { detectCircularReferences } from '@/lib/workbook/circular-reference-guard';
import { validateWorkbookObject } from '@/lib/workbook/validator';
import { getOrCreateHydration } from '@/lib/workbook/hyperformula';
import { addressToHf, hfToAddress } from '@/lib/workbook/utils';

/**
 * Comprehensive workbook context for AI reasoning
 */
export interface WorkbookContext {
  // Basic structure
  sheets: SheetSummary[];
  activeSheet: string;
  totalSheets: number;
  
  // Formula intelligence
  formulaCells: FormulaCellInfo[];
  totalFormulas: number;
  formulaDependencies: DependencyInfo[];
  
  // Data insights
  dataStatistics: DataStatistics;
  namedRanges: NamedRangeInfo[];
  
  // Error detection
  potentialErrors: PotentialError[];
  circularReferences: CircularReferenceInfo[];
  validationWarnings: string[];
  
  // Metadata
  lastModified?: string;
  workbookId?: string;
}

export interface SheetSummary {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  cellCount: number;
  formulaCount: number;
  hasData: boolean;
  dataRange?: string; // e.g., "A1:D100"
}

export interface FormulaCellInfo {
  sheet: string;
  address: string;
  formula: string;
  computedValue: any;
  hasError: boolean;
  errorType?: string;
  dependsOn: string[]; // Other cells this formula references
  usedBy: string[]; // Other cells that reference this formula
}

export interface DependencyInfo {
  cell: string; // Full address like "Sheet1!A1"
  dependsOn: string[];
  depth: number; // How many levels deep in dependency chain
}

export interface DataStatistics {
  totalCells: number;
  populatedCells: number;
  emptyCells: number;
  formulaCells: number;
  valueCells: number;
  errorCells: number;
  dataTypes: {
    numbers: number;
    strings: number;
    booleans: number;
    dates: number;
    errors: number;
  };
}

export interface NamedRangeInfo {
  name: string;
  reference: string;
  scope: 'workbook' | 'sheet';
  sheetName?: string;
  isValid: boolean;
}

export interface PotentialError {
  type: 'division_by_zero' | 'circular_ref' | 'invalid_ref' | 'type_mismatch' | 'overflow' | 'volatile_function' | 'complex_nested' | 'missing_named_range';
  severity: 'high' | 'medium' | 'low';
  location: string; // Cell or range address
  description: string;
  suggestion: string;
  affectedCells?: string[];
}

export interface CircularReferenceInfo {
  cells: string[];
  severity: 'high' | 'medium' | 'low';
  description: string;
}

/**
 * Extract comprehensive workbook context for AI
 */
export async function extractWorkbookContext(
  workbook: WorkbookJSON,
  activeSheetId?: string
): Promise<WorkbookContext> {
  const context: WorkbookContext = {
    sheets: [],
    activeSheet: activeSheetId || workbook.sheets[0]?.id || '',
    totalSheets: workbook.sheets.length,
    formulaCells: [],
    totalFormulas: 0,
    formulaDependencies: [],
    dataStatistics: {
      totalCells: 0,
      populatedCells: 0,
      emptyCells: 0,
      formulaCells: 0,
      valueCells: 0,
      errorCells: 0,
      dataTypes: {
        numbers: 0,
        strings: 0,
        booleans: 0,
        dates: 0,
        errors: 0,
      },
    },
    namedRanges: [],
    potentialErrors: [],
    circularReferences: [],
    validationWarnings: [],
    lastModified: workbook.meta?.modifiedAt,
    workbookId: workbook.workbookId,
  };

  // Extract sheet summaries
  for (const sheet of workbook.sheets) {
    const summary = extractSheetSummary(sheet);
    context.sheets.push(summary);
    
    // Update statistics
    context.dataStatistics.totalCells += summary.cellCount;
    context.dataStatistics.formulaCells += summary.formulaCount;
  }

  // Extract formula information and dependencies
  try {
    const hydration = getOrCreateHydration(workbook);
    extractFormulaInfo(workbook, hydration, context);
  } catch (error) {
    context.validationWarnings.push(`Failed to analyze formulas: ${error}`);
  }

  // Extract named ranges
  extractNamedRanges(workbook, context);

  // Detect potential errors
  await detectPotentialErrors(workbook, context);

  // Detect circular references
  detectCircularReferencesInContext(workbook, context);

  // Validate workbook structure
  await validateWorkbookStructure(workbook, context);

  return context;
}

/**
 * Extract sheet summary
 */
function extractSheetSummary(sheet: SheetJSON): SheetSummary {
  const cells = sheet.cells || {};
  const cellCount = Object.keys(cells).length;
  let formulaCount = 0;
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;

  for (const [address, cell] of Object.entries(cells)) {
    if (cell.formula) formulaCount++;
    
    try {
      const { row, col } = addressToHf(address);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    } catch (e) {
      // Skip invalid addresses
    }
  }

  const dataRange = cellCount > 0 && isFinite(minRow) && isFinite(maxRow)
    ? `${hfToAddress(minRow, minCol)}:${hfToAddress(maxRow, maxCol)}`
    : undefined;

  return {
    id: sheet.id,
    name: sheet.name,
    rowCount: sheet.grid?.rowCount || 1000,
    colCount: sheet.grid?.colCount || 50,
    cellCount,
    formulaCount,
    hasData: cellCount > 0,
    dataRange,
  };
}

/**
 * Extract formula information and dependencies
 */
function extractFormulaInfo(
  workbook: WorkbookJSON,
  hydration: any,
  context: WorkbookContext
): void {
  const { sheetMap } = hydration;
  const depGraph = workbook.computed?.dependencyGraph || {};

  for (const sheet of workbook.sheets) {
    const hfSheetId = sheetMap.get(sheet.id);
    if (hfSheetId === undefined) continue;

    for (const [address, cell] of Object.entries(sheet.cells || {})) {
      if (!cell.formula) continue;

      const fullAddress = `${sheet.name}!${address}`;
      const dependsOn = depGraph[fullAddress] || [];
      const usedBy: string[] = [];

      // Find cells that depend on this cell
      for (const [otherCell, otherDeps] of Object.entries(depGraph)) {
        if (otherDeps.includes(fullAddress)) {
          usedBy.push(otherCell);
        }
      }

      let computedValue: any = null;
      let hasError = false;
      let errorType: string | undefined;

      if (cell.computed) {
        computedValue = cell.computed.v;
        if (cell.computed.t === 'e') {
          hasError = true;
          errorType = String(computedValue);
        }
      }

      context.formulaCells.push({
        sheet: sheet.name,
        address,
        formula: cell.formula,
        computedValue,
        hasError,
        errorType,
        dependsOn,
        usedBy,
      });

      context.totalFormulas++;

      if (hasError) {
        context.dataStatistics.errorCells++;
      }

      // Build dependency info
      if (dependsOn.length > 0) {
        context.formulaDependencies.push({
          cell: fullAddress,
          dependsOn,
          depth: calculateDependencyDepth(fullAddress, depGraph),
        });
      }
    }
  }
}

/**
 * Calculate dependency depth (how many levels deep)
 */
function calculateDependencyDepth(
  cell: string,
  depGraph: Record<string, string[]>,
  visited = new Set<string>()
): number {
  if (visited.has(cell)) return 0; // Circular reference
  visited.add(cell);

  const deps = depGraph[cell] || [];
  if (deps.length === 0) return 0;

  let maxDepth = 0;
  for (const dep of deps) {
    const depth = calculateDependencyDepth(dep, depGraph, new Set(visited));
    maxDepth = Math.max(maxDepth, depth + 1);
  }

  return maxDepth;
}

/**
 * Extract named ranges
 */
function extractNamedRanges(workbook: WorkbookJSON, context: WorkbookContext): void {
  // Workbook-level named ranges
  if (workbook.namedRanges) {
    for (const [name, range] of Object.entries(workbook.namedRanges)) {
      const ref = typeof range === 'string' ? range : (range as any).ref;
      context.namedRanges.push({
        name,
        reference: ref,
        scope: 'workbook',
        isValid: validateNamedRangeReference(ref, workbook),
      });
    }
  }

  // Sheet-level named ranges
  for (const sheet of workbook.sheets) {
    if (sheet.namedRanges) {
      for (const [name, range] of Object.entries(sheet.namedRanges)) {
        const ref = typeof range === 'string' ? range : (range as any).ref;
        context.namedRanges.push({
          name,
          reference: ref,
          scope: 'sheet',
          sheetName: sheet.name,
          isValid: validateNamedRangeReference(ref, workbook, sheet.name),
        });
      }
    }
  }
}

/**
 * Validate named range reference
 */
function validateNamedRangeReference(
  ref: string,
  workbook: WorkbookJSON,
  sheetContext?: string
): boolean {
  if (!ref || typeof ref !== 'string') return false;

  // Check if reference includes sheet name
  if (ref.includes('!')) {
    const [sheetName] = ref.split('!');
    const cleanSheetName = sheetName.replace(/^'+|'+$/g, '');
    return workbook.sheets.some(s => s.name === cleanSheetName);
  }

  // For relative references, check if in valid sheet context
  return !!sheetContext;
}

/**
 * Detect potential computational errors
 */
async function detectPotentialErrors(
  _workbook: WorkbookJSON,
  context: WorkbookContext
): Promise<void> {
  // Check for division by zero potential
  for (const formulaCell of context.formulaCells) {
    if (formulaCell.formula.includes('/')) {
      // Simple heuristic: check if denominator could be zero
      const divisionPattern = /\/\s*([A-Z]+\d+|\d+)/gi;
      const matches = formulaCell.formula.matchAll(divisionPattern);
      
      for (const match of matches) {
        const denominator = match[1];
        if (denominator === '0') {
          context.potentialErrors.push({
            type: 'division_by_zero',
            severity: 'high',
            location: `${formulaCell.sheet}!${formulaCell.address}`,
            description: 'Formula divides by zero',
            suggestion: 'Use IFERROR() or check denominator before division',
          });
        }
      }
    }

    // Check for volatile functions (NOW, TODAY, RAND, RANDBETWEEN)
    const volatileFunctions = ['NOW(', 'TODAY(', 'RAND(', 'RANDBETWEEN('];
    for (const func of volatileFunctions) {
      if (formulaCell.formula.toUpperCase().includes(func)) {
        context.potentialErrors.push({
          type: 'volatile_function',
          severity: 'low',
          location: `${formulaCell.sheet}!${formulaCell.address}`,
          description: `Formula uses volatile function ${func.slice(0, -1)}`,
          suggestion: 'Volatile functions recalculate frequently and may impact performance',
        });
      }
    }

    // Check for complex nested formulas (high depth)
    const dependency = context.formulaDependencies.find(
      d => d.cell === `${formulaCell.sheet}!${formulaCell.address}`
    );
    if (dependency && dependency.depth > 5) {
      context.potentialErrors.push({
        type: 'complex_nested',
        severity: 'medium',
        location: `${formulaCell.sheet}!${formulaCell.address}`,
        description: `Formula has deep dependency chain (depth: ${dependency.depth})`,
        suggestion: 'Consider breaking complex formulas into intermediate cells for better maintainability',
      });
    }

    // Check for invalid references
    if (formulaCell.hasError && formulaCell.errorType?.includes('#REF!')) {
      context.potentialErrors.push({
        type: 'invalid_ref',
        severity: 'high',
        location: `${formulaCell.sheet}!${formulaCell.address}`,
        description: 'Formula contains invalid cell reference',
        suggestion: 'Update formula to reference valid cells',
      });
    }
  }

  // Check for missing named ranges
  for (const namedRange of context.namedRanges) {
    if (!namedRange.isValid) {
      context.potentialErrors.push({
        type: 'missing_named_range',
        severity: 'high',
        location: namedRange.sheetName || 'Workbook',
        description: `Named range "${namedRange.name}" references non-existent sheet`,
        suggestion: 'Update named range to reference valid sheet',
      });
    }
  }
}

/**
 * Detect circular references
 */
function detectCircularReferencesInContext(
  workbook: WorkbookJSON,
  context: WorkbookContext
): void {
  const result = detectCircularReferences(workbook);

  if (result.hasCircularReferences) {
    for (const chain of result.circularChains) {
      context.circularReferences.push({
        cells: chain.cells,
        severity: chain.severity,
        description: `Circular reference detected: ${chain.cells.join(' → ')}`,
      });

      // Add to potential errors
      context.potentialErrors.push({
        type: 'circular_ref',
        severity: chain.severity,
        location: chain.cells[0],
        description: `Circular reference: ${chain.cells.join(' → ')}`,
        suggestion: 'Break the circular dependency by using intermediate values or restructuring formulas',
        affectedCells: chain.cells,
      });
    }
  }
}

/**
 * Validate workbook structure
 */
async function validateWorkbookStructure(
  workbook: WorkbookJSON,
  context: WorkbookContext
): Promise<void> {
  try {
    const validation = await validateWorkbookObject(workbook);
    if (!validation.valid && validation.errors) {
      for (const error of validation.errors) {
        context.validationWarnings.push(`${error.path}: ${error.message}`);
      }
    }
  } catch (error) {
    context.validationWarnings.push(`Validation failed: ${error}`);
  }
}

/**
 * Format workbook context as natural language for AI
 */
export function formatContextForAI(context: WorkbookContext): string {
  const sections: string[] = [];

  // Overview
  sections.push(`# WORKBOOK OVERVIEW`);
  sections.push(`- Total sheets: ${context.totalSheets}`);
  sections.push(`- Active sheet: ${context.sheets.find(s => s.id === context.activeSheet)?.name || 'Unknown'}`);
  sections.push(`- Total formulas: ${context.totalFormulas}`);
  sections.push(`- Total errors: ${context.dataStatistics.errorCells}`);
  sections.push('');

  // Sheet details
  sections.push(`# SHEET DETAILS`);
  for (const sheet of context.sheets) {
    sections.push(`## ${sheet.name}`);
    sections.push(`- Cells: ${sheet.cellCount} (${sheet.formulaCount} formulas)`);
    if (sheet.dataRange) {
      sections.push(`- Data range: ${sheet.dataRange}`);
    }
    sections.push('');
  }

  // Named ranges
  if (context.namedRanges.length > 0) {
    sections.push(`# NAMED RANGES`);
    for (const nr of context.namedRanges) {
      const status = nr.isValid ? '✓' : '✗ INVALID';
      sections.push(`- ${nr.name}: ${nr.reference} ${status}`);
    }
    sections.push('');
  }

  // Formula errors
  const errorFormulas = context.formulaCells.filter(f => f.hasError);
  if (errorFormulas.length > 0) {
    sections.push(`# FORMULA ERRORS (${errorFormulas.length})`);
    for (const formula of errorFormulas.slice(0, 10)) { // Limit to first 10
      sections.push(`- ${formula.sheet}!${formula.address}: ${formula.errorType}`);
      sections.push(`  Formula: ${formula.formula}`);
    }
    if (errorFormulas.length > 10) {
      sections.push(`  ... and ${errorFormulas.length - 10} more errors`);
    }
    sections.push('');
  }

  // Potential errors
  if (context.potentialErrors.length > 0) {
    sections.push(`# POTENTIAL ISSUES (${context.potentialErrors.length})`);
    const highSeverity = context.potentialErrors.filter(e => e.severity === 'high');
    const mediumSeverity = context.potentialErrors.filter(e => e.severity === 'medium');
    
    if (highSeverity.length > 0) {
      sections.push(`## High Severity (${highSeverity.length})`);
      for (const error of highSeverity.slice(0, 5)) {
        sections.push(`- ${error.location}: ${error.description}`);
        sections.push(`  ⚠️ ${error.suggestion}`);
      }
    }
    
    if (mediumSeverity.length > 0) {
      sections.push(`## Medium Severity (${mediumSeverity.length})`);
      for (const error of mediumSeverity.slice(0, 3)) {
        sections.push(`- ${error.location}: ${error.description}`);
      }
    }
    sections.push('');
  }

  // Circular references
  if (context.circularReferences.length > 0) {
    sections.push(`# CIRCULAR REFERENCES (${context.circularReferences.length})`);
    for (const circ of context.circularReferences) {
      sections.push(`- ${circ.severity.toUpperCase()}: ${circ.description}`);
    }
    sections.push('');
  }

  // Validation warnings
  if (context.validationWarnings.length > 0) {
    sections.push(`# VALIDATION WARNINGS`);
    for (const warning of context.validationWarnings.slice(0, 5)) {
      sections.push(`- ${warning}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Get concise context summary for AI (shorter version)
 */
export function getContextSummary(context: WorkbookContext): string {
  const errors = context.potentialErrors.filter(e => e.severity === 'high').length;
  const warnings = context.potentialErrors.filter(e => e.severity === 'medium').length;
  
  return `Workbook: ${context.totalSheets} sheet(s), ${context.totalFormulas} formula(s), ${context.dataStatistics.errorCells} error(s). ` +
    `Potential issues: ${errors} critical, ${warnings} warnings. ` +
    (context.circularReferences.length > 0 ? `⚠️ ${context.circularReferences.length} circular reference(s) detected. ` : '') +
    `Active: ${context.sheets.find(s => s.id === context.activeSheet)?.name || 'Unknown'}`;
}
