/**
 * Nexcell Capabilities Registry
 * 
 * This defines what operations and formulas are:
 * - ✅ Supported & Battle-tested
 * - ⚠️ Experimental (might work, not fully tested)
 * - ❌ Known to NOT work (fail fast, suggest alternatives)
 * 
 * Updated from: HYPERFORMULA_UNSUPPORTED_FUNCTIONS.md
 * Last sync: 2025-10-19
 */

// ============================================================================
// Known Unsupported Formulas (from HyperFormula 3.1.0)
// ============================================================================

export const KNOWN_UNSUPPORTED_FORMULAS = {
  // Array Functions (Dynamic Arrays)
  SORT: {
    error: '#NAME?',
    impact: 'high',
    alternatives: [
      'Pre-sort your data before pasting it into Nexcell',
      'I can add a helper column with row numbers for manual sorting',
      'Use manual UI sorting after I set up your data'
    ],
    workaround: 'Manual sorting or pre-processed data'
  },
  
  UNIQUE: {
    error: '#NAME?',
    impact: 'high',
    alternatives: [
      'Use COUNTIFS to identify duplicates, then filter manually',
      'Pre-process data to remove duplicates before import',
      'I can help set up formulas to flag duplicates'
    ],
    workaround: 'COUNTIFS-based duplicate detection'
  },
  
  SEQUENCE: {
    error: '#NAME?',
    impact: 'medium',
    alternatives: [
      'I can fill cells with sequential values directly',
      'Use ROW() or COLUMN() functions for simple sequences',
      'Tell me the range and I\'ll populate it with numbers'
    ],
    workaround: 'Manual population or ROW()/COLUMN() functions'
  },
  
  // Statistical Functions
  AVERAGEIFS: {
    error: '#NAME?',
    impact: 'high',
    alternatives: [
      'Use =SUMIFS(...)/COUNTIFS(...) for the same result',
      'Example: =SUMIFS(B:B,A:A,"North")/COUNTIFS(A:A,"North")',
      'AVERAGEIF works for single criterion'
    ],
    workaround: 'SUMIFS(...) / COUNTIFS(...)'
  },
  
  PERCENTILE: {
    error: '#NAME?',
    impact: 'medium',
    alternatives: [
      'Use MEDIAN for 50th percentile (P0.5)',
      'Use MIN for 0th percentile (P0)',
      'Use MAX for 100th percentile (P1)'
    ],
    workaround: 'MEDIAN, MIN, MAX for specific percentiles'
  },
  
  'PERCENTILE.INC': {
    error: '#NAME?',
    impact: 'medium',
    alternatives: ['Same as PERCENTILE - use MEDIAN, MIN, MAX'],
    workaround: 'MEDIAN, MIN, MAX'
  },
  
  'PERCENTILE.EXC': {
    error: '#NAME?',
    impact: 'medium',
    alternatives: ['Same as PERCENTILE - use MEDIAN, MIN, MAX'],
    workaround: 'MEDIAN, MIN, MAX'
  },
  
  FORECAST: {
    error: '#NAME?',
    impact: 'medium',
    alternatives: [
      'Manual formula: =SLOPE(known_y,known_x)*x + INTERCEPT(known_y,known_x)',
      'I can set up the SLOPE and INTERCEPT formulas for you'
    ],
    workaround: 'SLOPE() × x + INTERCEPT()'
  },
  
  'FORECAST.LINEAR': {
    error: '#NAME?',
    impact: 'medium',
    alternatives: ['Same as FORECAST - use SLOPE and INTERCEPT'],
    workaround: 'SLOPE() × x + INTERCEPT()'
  },
  
  RANK: {
    error: '#NAME?',
    impact: 'medium',
    alternatives: [
      'Use COUNTIFS to count how many values are greater',
      'I can create a ranking formula using comparisons'
    ],
    workaround: 'COUNTIFS-based ranking'
  },
  
  'RANK.EQ': {
    error: '#NAME?',
    impact: 'medium',
    alternatives: ['Same as RANK - use COUNTIFS'],
    workaround: 'COUNTIFS-based ranking'
  },
  
  'RANK.AVG': {
    error: '#NAME?',
    impact: 'medium',
    alternatives: ['Same as RANK - use COUNTIFS'],
    workaround: 'COUNTIFS-based ranking'
  },
  
  // Financial Functions
  IRR: {
    error: '#NAME?',
    impact: 'high',
    alternatives: [
      'Pre-calculate IRR in Excel and paste the result',
      'Use external financial calculators',
      'For simple cases, I can help set up NPV formulas for iteration'
    ],
    workaround: 'Pre-calculate in Excel or external tools'
  },
  
  XIRR: {
    error: '#NAME?',
    impact: 'high',
    alternatives: ['Same as IRR - pre-calculate externally'],
    workaround: 'Pre-calculate in Excel or external tools'
  },
} as const;

// ============================================================================
// Supported & Battle-Tested Formulas
// ============================================================================

export const SUPPORTED_FORMULAS = {
  // Array Functions
  FILTER: { tested: true, version: '3.1.0', notes: 'Fully supported' },
  
  // Math & Trig
  SUM: { tested: true, version: '3.1.0' },
  SUMIF: { tested: true, version: '3.1.0' },
  SUMIFS: { tested: true, version: '3.1.0', notes: 'Supports wildcards, cross-sheet, multiple criteria' },
  AVERAGE: { tested: true, version: '3.1.0' },
  AVERAGEIF: { tested: true, version: '3.1.0' },
  COUNT: { tested: true, version: '3.1.0' },
  COUNTIF: { tested: true, version: '3.1.0' },
  COUNTIFS: { tested: true, version: '3.1.0', notes: 'Supports comparison operators' },
  COUNTA: { tested: true, version: '3.1.0' },
  COUNTBLANK: { tested: true, version: '3.1.0' },
  MIN: { tested: true, version: '3.1.0' },
  MAX: { tested: true, version: '3.1.0' },
  MEDIAN: { tested: true, version: '3.1.0' },
  ROUND: { tested: true, version: '3.1.0' },
  ROUNDUP: { tested: true, version: '3.1.0' },
  ROUNDDOWN: { tested: true, version: '3.1.0' },
  ABS: { tested: true, version: '3.1.0' },
  SQRT: { tested: true, version: '3.1.0' },
  POWER: { tested: true, version: '3.1.0' },
  MOD: { tested: true, version: '3.1.0' },
  PI: { tested: true, version: '3.1.0' },
  
  // Logical
  IF: { tested: true, version: '3.1.0' },
  AND: { tested: true, version: '3.1.0' },
  OR: { tested: true, version: '3.1.0' },
  NOT: { tested: true, version: '3.1.0' },
  
  // Lookup & Reference
  VLOOKUP: { tested: true, version: '3.1.0' },
  HLOOKUP: { tested: true, version: '3.1.0' },
  INDEX: { tested: true, version: '3.1.0' },
  MATCH: { tested: true, version: '3.1.0' },
  
  // Text
  CONCATENATE: { tested: true, version: '3.1.0' },
  CONCAT: { tested: true, version: '3.1.0' },
  LEFT: { tested: true, version: '3.1.0' },
  RIGHT: { tested: true, version: '3.1.0' },
  MID: { tested: true, version: '3.1.0' },
  LEN: { tested: true, version: '3.1.0' },
  TRIM: { tested: true, version: '3.1.0' },
  UPPER: { tested: true, version: '3.1.0' },
  LOWER: { tested: true, version: '3.1.0' },
  
  // Date & Time
  DATE: { tested: true, version: '3.1.0' },
  YEAR: { tested: true, version: '3.1.0' },
  MONTH: { tested: true, version: '3.1.0' },
  DAY: { tested: true, version: '3.1.0' },
  
  // Statistical
  STDEV: { tested: true, version: '3.1.0' },
  'STDEV.S': { tested: true, version: '3.1.0' },
  STDEVP: { tested: true, version: '3.1.0' },
  'STDEV.P': { tested: true, version: '3.1.0' },
  CORREL: { tested: true, version: '3.1.0' },
  SLOPE: { tested: true, version: '3.1.0' },
  INTERCEPT: { tested: true, version: '3.1.0' },
  
  // Financial
  PMT: { tested: true, version: '3.1.0', notes: 'Fully supported with all parameters' },
  FV: { tested: true, version: '3.1.0' },
  PV: { tested: true, version: '3.1.0' },
  NPV: { tested: true, version: '3.1.0' },
} as const;

// ============================================================================
// Experimental Features (might work, not fully tested)
// ============================================================================

export const EXPERIMENTAL_FORMULAS = {
  XLOOKUP: { 
    reason: 'Newer than VLOOKUP, might not be in HyperFormula 3.1.0',
    fallback: 'VLOOKUP or INDEX/MATCH',
    tryIt: true 
  },
  NPER: { 
    reason: 'Not tested yet, but likely supported (similar to PMT)',
    fallback: 'Pre-calculate or manual formula',
    tryIt: true 
  },
  RATE: { 
    reason: 'Not tested yet, but likely supported (similar to PMT)',
    fallback: 'Pre-calculate or manual formula',
    tryIt: true 
  },
} as const;

// ============================================================================
// Operations Capabilities
// ============================================================================

export const OPERATIONS_CAPABILITIES = {
  supported: {
    setCellValue: { 
      tested: true, 
      fast: true,
      description: 'Set a single cell to a value (number, text, boolean)'
    },
    setCellFormula: { 
      tested: true, 
      fast: true,
      description: 'Set a cell to a formula (must start with =)',
      dependencies: ['HyperFormula']
    },
    fillRange: { 
      tested: true, 
      fast: true,
      description: 'Fill a range with a single value',
      maxSize: 10000,
      warning: 'Ranges >1000 cells may take a moment'
    },
    fillColumn: { 
      tested: true, 
      fast: true,
      description: 'Fill an entire column with value/formula'
    },
    fillRow: { 
      tested: true, 
      fast: true,
      description: 'Fill an entire row with values (can use array for varied data)'
    },
    clearRange: { 
      tested: true, 
      fast: true,
      description: 'Clear cells in a range'
    },
    setRange: { 
      tested: true, 
      fast: true,
      description: 'Set multiple cells with different values'
    },
  },
  
  experimental: {
    setStyle: {
      tested: false,
      description: 'Apply formatting to cells (borders, colors, fonts)',
      warning: 'Formatting support is limited and experimental'
    },
    insertRow: {
      tested: false,
      description: 'Insert new row at position',
      warning: 'May affect formulas and references'
    },
    insertColumn: {
      tested: false,
      description: 'Insert new column at position',
      warning: 'May affect formulas and references'
    },
  },
  
  unsupported: {
    pivotTable: {
      reason: 'Not implemented yet',
      alternatives: [
        'I can create summary formulas (SUM, AVERAGE, COUNTIF by category)',
        'Set up a manual summary table with formulas',
        'Organize your data for easier analysis'
      ]
    },
    chart: {
      reason: 'Not implemented yet',
      alternatives: [
        'Prepare your data in chart-friendly format',
        'Add summary calculations for visualization',
        'I can suggest which chart type would work best with your data'
      ]
    },
    conditionalFormatting: {
      reason: 'Not implemented yet',
      alternatives: [
        'I can create formulas that identify conditions (e.g., =IF(A1>100,"High","Low"))',
        'Set up helper columns with conditional logic',
        'You can manually highlight cells after I set up the logic'
      ]
    },
    importExport: {
      reason: 'Not implemented yet',
      alternatives: [
        'Copy and paste data manually',
        'I can help format your data for export'
      ]
    },
    macro: {
      reason: 'Security - not supported',
      alternatives: ['Describe what you want to do and I\'ll create formulas or operations']
    },
  },
  
  limitations: [
    'Large ranges (>10,000 cells) may be slow',
    'UI formatting is limited (basic styles only)',
    'No data import/export features (yet)',
    'Formulas are evaluated by HyperFormula (some Excel functions not supported)',
  ],
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a formula is known to be unsupported
 */
export function isUnsupportedFormula(formulaName: string): boolean {
  const normalized = formulaName.toUpperCase().trim();
  return normalized in KNOWN_UNSUPPORTED_FORMULAS;
}

/**
 * Get alternatives for an unsupported formula
 */
export function getFormulaAlternatives(formulaName: string): readonly string[] {
  const normalized = formulaName.toUpperCase().trim();
  const info = KNOWN_UNSUPPORTED_FORMULAS[normalized as keyof typeof KNOWN_UNSUPPORTED_FORMULAS];
  return info?.alternatives || [];
}

/**
 * Check if a formula is supported
 */
export function isSupportedFormula(formulaName: string): boolean {
  const normalized = formulaName.toUpperCase().trim();
  return normalized in SUPPORTED_FORMULAS;
}

/**
 * Check if a formula is experimental (might work, not tested)
 */
export function isExperimentalFormula(formulaName: string): boolean {
  const normalized = formulaName.toUpperCase().trim();
  return normalized in EXPERIMENTAL_FORMULAS;
}

/**
 * Extract formula names from a formula string
 * Example: "=SUM(A1:A10) + AVERAGE(B1:B10)" -> ["SUM", "AVERAGE"]
 */
export function extractFormulaNames(formula: string): string[] {
  // Remove = prefix and match function names (uppercase letters followed by ()
  const withoutEquals = formula.replace(/^=/, '');
  const matches = withoutEquals.match(/[A-Z][A-Z0-9._]+(?=\s*\()/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Check if operation is supported
 */
export function isOperationSupported(operationType: string): boolean {
  return operationType in OPERATIONS_CAPABILITIES.supported;
}

/**
 * Check if operation is experimental
 */
export function isOperationExperimental(operationType: string): boolean {
  return operationType in OPERATIONS_CAPABILITIES.experimental;
}

/**
 * Get capabilities summary for AI context
 */
export function getCapabilitiesSummary() {
  return {
    supportedFormulas: Object.keys(SUPPORTED_FORMULAS).slice(0, 20), // First 20 for brevity
    unsupportedFormulas: Object.keys(KNOWN_UNSUPPORTED_FORMULAS),
    supportedOperations: Object.keys(OPERATIONS_CAPABILITIES.supported),
    unsupportedOperations: Object.keys(OPERATIONS_CAPABILITIES.unsupported),
  };
}

/**
 * Get full capabilities manifest for AI (use sparingly - costs tokens)
 */
export function getFullCapabilities() {
  return {
    formulas: {
      supported: SUPPORTED_FORMULAS,
      unsupported: KNOWN_UNSUPPORTED_FORMULAS,
      experimental: EXPERIMENTAL_FORMULAS,
    },
    operations: OPERATIONS_CAPABILITIES,
  };
}
