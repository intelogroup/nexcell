/**
 * Named Range Utilities
 * 
 * Helper functions for creating and managing named ranges with HyperFormula.
 * HyperFormula requires absolute references ($A$1) in named expressions.
 */

import type { NamedRange } from './types';

/**
 * Convert a cell reference to absolute format required by HyperFormula.
 * 
 * Examples:
 * - "A1" -> "$A$1"
 * - "A1:B10" -> "$A$1:$B$10"
 * - "Sheet1!A1:B10" -> "Sheet1!$A$1:$B$10"
 * - "$A$1" -> "$A$1" (already absolute, no change)
 * 
 * @param ref - Cell reference (with or without sheet name)
 * @returns Absolute cell reference with $ signs
 */
export function toAbsoluteReference(ref: string): string {
  // Already has $ signs? Return as-is
  if (ref.includes('$')) {
    return ref;
  }

  // Split sheet name from reference if present
  const parts = ref.split('!');
  const sheetPart = parts.length > 1 ? parts[0] + '!' : '';
  const refPart = parts.length > 1 ? parts[1] : parts[0];

  // Handle range (A1:B10) vs single cell (A1)
  if (refPart.includes(':')) {
    const [start, end] = refPart.split(':');
    return `${sheetPart}${makeAbsolute(start)}:${makeAbsolute(end)}`;
  }

  return `${sheetPart}${makeAbsolute(refPart)}`;
}

/**
 * Make a single cell reference absolute (add $ signs).
 * Handles column letters and row numbers separately.
 * 
 * @param cellRef - Cell reference like "A1" or "BC123"
 * @returns Absolute reference like "$A$1" or "$BC$123"
 */
function makeAbsolute(cellRef: string): string {
  // Match pattern: letters (column) followed by digits (row)
  const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
  
  if (!match) {
    // Not a valid cell reference, return as-is
    return cellRef;
  }

  const [, col, row] = match;
  return `$${col.toUpperCase()}$${row}`;
}

/**
 * Validate a named range name according to HyperFormula rules.
 * 
 * Rules:
 * - Must start with a letter or underscore
 * - Can contain letters, numbers, underscores, periods
 * - Cannot look like a cell reference (e.g., "A1", "BC123")
 * - Cannot be a reserved name (e.g., "TRUE", "FALSE")
 * - Max length 255 characters
 * 
 * @param name - Proposed named range name
 * @returns Object with isValid flag and error message if invalid
 */
export function validateNamedRangeName(name: string): { 
  isValid: boolean; 
  error?: string;
} {
  // Empty name
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Name cannot be empty' };
  }

  // Length check
  if (name.length > 255) {
    return { isValid: false, error: 'Name cannot exceed 255 characters' };
  }

  // Must start with letter or underscore
  if (!/^[a-zA-Z_]/.test(name)) {
    return { 
      isValid: false, 
      error: 'Name must start with a letter or underscore' 
    };
  }

  // Valid characters: letters, numbers, underscores, periods
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    return { 
      isValid: false, 
      error: 'Name can only contain letters, numbers, underscores, and periods' 
    };
  }

  // Cannot look like a cell reference (e.g., "A1", "BC123")
  // But "Data2024" or "Q1Sales" should be OK (letter+number combos that aren't pure cell refs)
  // Pure cell refs: [A-Z]{1,3}\d+ (1-3 letters followed by only digits)
  if (/^[A-Z]{1,3}\d+$/i.test(name)) {
    return { 
      isValid: false, 
      error: 'Name cannot look like a cell reference (e.g., A1, BC123)' 
    };
  }

  // Reserved names
  const reserved = [
    'TRUE', 'FALSE', 'NULL', 'AND', 'OR', 'NOT', 'IF',
    'SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', // Common function names
    'R', 'C', 'RC', 'R1C1' // Reference styles
  ];
  
  if (reserved.includes(name.toUpperCase())) {
    return { 
      isValid: false, 
      error: `Name '${name}' is reserved and cannot be used` 
    };
  }

  return { isValid: true };
}

/**
 * Create a workbook-scoped named range with automatic absolute reference conversion.
 * 
 * @param name - Name for the range (will be validated)
 * @param ref - Cell reference (will be converted to absolute)
 * @param options - Optional metadata
 * @returns NamedRange object ready to add to workbook.namedRanges
 * @throws Error if name is invalid
 */
export function createNamedRange(
  name: string,
  ref: string,
  options?: {
    comment?: string;
    hidden?: boolean;
  }
): NamedRange {
  // Validate name
  const validation = validateNamedRangeName(name);
  if (!validation.isValid) {
    throw new Error(`Invalid named range name '${name}': ${validation.error}`);
  }

  // Convert to absolute reference
  const absoluteRef = toAbsoluteReference(ref);

  return {
    name,
    scope: 'workbook',
    ref: absoluteRef,
    comment: options?.comment,
    hidden: options?.hidden || false,
  };
}

/**
 * Create a sheet-scoped named range with automatic absolute reference conversion.
 * 
 * @param name - Name for the range (will be validated)
 * @param ref - Cell reference (will be converted to absolute)
 * @param sheetId - Sheet ID for scope
 * @param options - Optional metadata
 * @returns NamedRange object ready to add to sheet.namedRanges
 * @throws Error if name is invalid
 */
export function createSheetScopedNamedRange(
  name: string,
  ref: string,
  sheetId: string,
  options?: {
    comment?: string;
    hidden?: boolean;
  }
): NamedRange {
  // Validate name
  const validation = validateNamedRangeName(name);
  if (!validation.isValid) {
    throw new Error(`Invalid named range name '${name}': ${validation.error}`);
  }

  // Convert to absolute reference
  const absoluteRef = toAbsoluteReference(ref);

  return {
    name,
    scope: sheetId,
    ref: absoluteRef,
    comment: options?.comment,
    hidden: options?.hidden || false,
  };
}

/**
 * Batch create multiple named ranges with validation.
 * 
 * @param ranges - Array of name/ref pairs
 * @returns Record ready to assign to workbook.namedRanges
 * @throws Error if any name is invalid
 */
export function createNamedRanges(
  ranges: Array<{ name: string; ref: string; comment?: string }>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const { name, ref, comment } of ranges) {
    const namedRange = createNamedRange(name, ref, { comment });
    result[name] = namedRange.ref;
  }

  return result;
}

/**
 * Check if a reference string contains absolute references.
 * 
 * @param ref - Cell reference to check
 * @returns true if reference contains any $ signs (partial or full absolute)
 */
export function isAbsoluteReference(ref: string): boolean {
  return ref.includes('$');
}

/**
 * Extract all named range names from a formula.
 * Useful for dependency tracking.
 * 
 * @param formula - Formula string (without leading =)
 * @returns Array of potential named range names found in formula
 */
export function extractNamedRangesFromFormula(formula: string): string[] {
  const names: string[] = [];
  
  // Match words that could be named ranges (not cell refs, not functions)
  // Simple heuristic: word not followed by ( and not matching cell pattern
  const pattern = /\b([A-Z_][A-Z0-9_.]*)\b(?!\s*\()/gi;
  
  let match;
  while ((match = pattern.exec(formula)) !== null) {
    const name = match[1];
    
    // Skip if looks like cell reference
    if (!/^[A-Z]+\d+$/i.test(name)) {
      names.push(name);
    }
  }
  
  return [...new Set(names)]; // Remove duplicates
}
