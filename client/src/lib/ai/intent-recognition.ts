/**
 * Intent Recognition Types
 * 
 * Type definitions for parsing and categorizing user prompts into structured intent objects.
 * These types help the AI system understand what the user wants to accomplish.
 * 
 * Design Principles:
 * - Structured: Clear hierarchy of intent categories and types
 * - Extensible: Easy to add new intent types as capabilities grow
 * - Type-safe: Full TypeScript support for intent handling
 * - Domain-specific: Tailored to workbook/spreadsheet operations
 * 
 * Intent Flow:
 * 1. User prompt → ParsedIntent (this file)
 * 2. ParsedIntent → WorkbookOperation[] (operations/types.ts)
 * 3. WorkbookOperation[] → Execution → WorkbookJSON
 */

/**
 * Primary intent categories for workbook operations
 * 
 * These represent the high-level user goals that the AI system can handle.
 */
export type IntentCategory =
  | 'create'      // Create new workbook/sheet/cells
  | 'modify'      // Modify existing workbook/sheet/cells
  | 'analyze'     // Analyze data, generate insights
  | 'format'      // Apply formatting, styling
  | 'compute'     // Trigger calculations, formulas
  | 'import'      // Import data from external sources
  | 'export'      // Export workbook to file
  | 'query'       // Ask questions about workbook data
  | 'template'    // Use or create templates
  | 'unknown';    // Unable to determine intent

/**
 * Specific intent types within each category
 * 
 * These provide granular classification of user requests.
 */
export type IntentType =
  // Create intents
  | 'create_workbook'
  | 'create_sheet'
  | 'create_budget'
  | 'create_report'
  | 'create_tracker'
  | 'create_consolidation'
  | 'create_analysis'
  | 'create_dashboard'
  
  // Modify intents
  | 'add_data'
  | 'update_data'
  | 'delete_data'
  | 'add_formulas'
  | 'add_sheet'
  | 'remove_sheet'
  | 'rename_sheet'
  | 'modify_structure'
  
  // Analyze intents
  | 'calculate_sum'
  | 'calculate_average'
  | 'calculate_variance'
  | 'calculate_ytd'
  | 'find_outliers'
  | 'compare_values'
  | 'trend_analysis'
  | 'what_if_analysis'
  
  // Format intents
  | 'apply_style'
  | 'apply_conditional_format'
  | 'format_numbers'
  | 'format_dates'
  | 'merge_cells'
  | 'add_borders'
  
  // Compute intents
  | 'recompute_all'
  | 'recompute_sheet'
  
  // Import/Export intents
  | 'import_xlsx'
  | 'import_csv'
  | 'export_xlsx'
  | 'export_csv'
  
  // Query intents
  | 'query_value'
  | 'query_sum'
  | 'query_status'
  | 'query_comparison'
  
  // Template intents
  | 'use_template'
  | 'save_as_template'
  
  // Unknown
  | 'unknown';

/**
 * Entities extracted from user prompts
 * 
 * These are the key pieces of information needed to execute operations.
 */
export interface IntentEntities {
  /** Workbook name mentioned in prompt */
  workbookName?: string;
  
  /** Sheet names mentioned in prompt */
  sheetNames?: string[];
  
  /** Cell references mentioned (e.g., "A1", "B2:D10") */
  cellRefs?: string[];
  
  /** Named ranges mentioned (e.g., "SalesData", "TotalRevenue") */
  namedRanges?: string[];
  
  /** Time periods mentioned (e.g., "Q1", "January", "2024") */
  timePeriods?: string[];
  
  /** Departments/categories mentioned (e.g., "Sales", "Marketing") */
  departments?: string[];
  
  /** Numeric values mentioned */
  numbers?: number[];
  
  /** Date values mentioned */
  dates?: Date[];
  
  /** Formulas mentioned */
  formulas?: string[];
  
  /** Column headers mentioned */
  columnHeaders?: string[];
  
  /** Data types mentioned (e.g., "revenue", "expenses", "budget") */
  dataTypes?: string[];
  
  /** Comparison operators (e.g., "greater than", "less than") */
  comparisons?: string[];
  
  /** Aggregation types (e.g., "sum", "average", "count") */
  aggregations?: string[];
  
  /** Format types mentioned (e.g., "currency", "percentage", "date") */
  formatTypes?: string[];
}

/**
 * Confidence level for intent recognition
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';

/**
 * Parsed intent result
 * 
 * This is the primary output of the intent recognition system.
 */
export interface ParsedIntent {
  /** Primary intent category */
  category: IntentCategory;
  
  /** Specific intent type */
  type: IntentType;
  
  /** Original user prompt */
  originalPrompt: string;
  
  /** Entities extracted from prompt */
  entities: IntentEntities;
  
  /** Confidence level (0.0 to 1.0) */
  confidence: number;
  
  /** Confidence level as category */
  confidenceLevel: ConfidenceLevel;
  
  /** Whether this is a multi-step intent requiring multiple operations */
  isMultiStep: boolean;
  
  /** Ambiguities or clarifications needed */
  ambiguities?: string[];
  
  /** Suggested clarifying questions */
  clarifyingQuestions?: string[];
  
  /** Context from previous conversation (if available) */
  context?: IntentContext;
  
  /** Alternative interpretations of the prompt */
  alternatives?: Array<{
    category: IntentCategory;
    type: IntentType;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Context from previous conversation
 * 
 * Helps AI understand follow-up requests and maintain state.
 */
export interface IntentContext {
  /** Previous intents in this conversation */
  previousIntents?: ParsedIntent[];
  
  /** Current workbook state (if any) */
  currentWorkbook?: {
    name: string;
    sheets: string[];
    hasData: boolean;
  };
  
  /** References from previous prompts (e.g., "that sheet", "those cells") */
  references?: {
    sheets?: string[];
    cells?: string[];
    namedRanges?: string[];
  };
  
  /** Active sheet context */
  activeSheet?: string;
  
  /** User preferences learned from conversation */
  preferences?: {
    preferredFormats?: string[];
    typicalWorkflowPatterns?: string[];
  };
}

/**
 * Intent recognition result with alternatives
 * 
 * Used when the AI system is uncertain and wants to present options to the user.
 */
export interface IntentRecognitionResult {
  /** Primary parsed intent */
  primaryIntent: ParsedIntent;
  
  /** Alternative interpretations (if confidence is low) */
  alternativeIntents?: ParsedIntent[];
  
  /** Whether user confirmation is recommended */
  needsConfirmation: boolean;
  
  /** Suggested confirmation message */
  confirmationMessage?: string;
  
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ============================================================================
// Intent Pattern Definitions
// ============================================================================

/**
 * Intent pattern for matching user prompts
 * 
 * These patterns help classify prompts into intent types.
 */
export interface IntentPattern {
  /** Intent type this pattern matches */
  intentType: IntentType;
  
  /** Intent category */
  category: IntentCategory;
  
  /** Keywords that indicate this intent */
  keywords: string[];
  
  /** Phrases that indicate this intent */
  phrases: string[];
  
  /** Regular expressions for matching */
  patterns?: RegExp[];
  
  /** Required entities for this intent */
  requiredEntities?: (keyof IntentEntities)[];
  
  /** Optional entities for this intent */
  optionalEntities?: (keyof IntentEntities)[];
  
  /** Example prompts for this intent */
  examples: string[];
  
  /** Priority (higher = checked first) */
  priority?: number;
}

/**
 * Pre-defined intent patterns for common requests
 * 
 * These patterns are used by the intent recognition engine to classify prompts.
 */
export const INTENT_PATTERNS: IntentPattern[] = [
  // ============================================================================
  // CREATE INTENTS
  // ============================================================================
  {
    intentType: 'create_budget',
    category: 'create',
    keywords: ['budget', 'budgeting', 'financial plan', 'spending plan'],
    phrases: [
      'create a budget',
      'build a budget',
      'make a budget tracker',
      'set up budget',
      'budget for',
    ],
    patterns: [
      /create\s+(a\s+)?budget/i,
      /budget\s+(for|tracker)/i,
      /make.*budget/i,
    ],
    requiredEntities: ['timePeriods'],
    optionalEntities: ['departments', 'numbers', 'dataTypes'],
    examples: [
      'Create a Q1 budget',
      'Build a monthly budget tracker for Sales',
      'Make a budget for 2024 with departments',
    ],
    priority: 10,
  },
  {
    intentType: 'create_consolidation',
    category: 'create',
    keywords: ['consolidate', 'roll up', 'combine', 'merge', 'summary', 'total'],
    phrases: [
      'consolidate data',
      'roll up',
      'combine sheets',
      'create summary',
      'aggregate data',
    ],
    patterns: [
      /consolidat(e|ion)/i,
      /roll\s*up/i,
      /combin(e|ing).*sheet/i,
      /summar(y|ize).*sheet/i,
    ],
    requiredEntities: ['sheetNames'],
    optionalEntities: ['departments', 'aggregations'],
    examples: [
      'Consolidate Sales, Marketing, and Operations sheets',
      'Create a summary sheet rolling up all departments',
      'Combine data from multiple sheets',
    ],
    priority: 9,
  },
  {
    intentType: 'create_tracker',
    category: 'create',
    keywords: ['track', 'tracker', 'monitor', 'log', 'record'],
    phrases: [
      'create a tracker',
      'track progress',
      'monitor changes',
      'log data',
    ],
    patterns: [
      /track(er|ing)/i,
      /monitor/i,
      /log.*data/i,
    ],
    optionalEntities: ['timePeriods', 'dataTypes', 'columnHeaders'],
    examples: [
      'Create a sales tracker',
      'Track monthly expenses',
      'Monitor project progress',
    ],
    priority: 8,
  },
  {
    intentType: 'create_analysis',
    category: 'create',
    keywords: ['analyze', 'analysis', 'compare', 'comparison', 'variance'],
    phrases: [
      'analyze data',
      'create analysis',
      'compare values',
      'variance analysis',
    ],
    patterns: [
      /analy(ze|sis)/i,
      /compar(e|ison)/i,
      /variance/i,
    ],
    optionalEntities: ['dataTypes', 'comparisons', 'timePeriods'],
    examples: [
      'Analyze Q1 vs Q2 performance',
      'Create variance analysis',
      'Compare budget vs actual',
    ],
    priority: 8,
  },
  
  // ============================================================================
  // MODIFY INTENTS
  // ============================================================================
  {
    intentType: 'add_formulas',
    category: 'modify',
    keywords: ['formula', 'calculate', 'sum', 'average', 'compute'],
    phrases: [
      'add formula',
      'calculate total',
      'sum of',
      'average of',
    ],
    patterns: [
      /add.*formula/i,
      /calculat(e|ing)/i,
      /sum\s+of/i,
      /average\s+of/i,
    ],
    requiredEntities: ['cellRefs'],
    optionalEntities: ['formulas', 'aggregations'],
    examples: [
      'Add a SUM formula to D10',
      'Calculate total revenue',
      'Average the values in column B',
    ],
    priority: 9,
  },
  {
    intentType: 'add_data',
    category: 'modify',
    keywords: ['add', 'insert', 'enter', 'input', 'put'],
    phrases: [
      'add data',
      'insert values',
      'enter numbers',
      'put data in',
    ],
    patterns: [
      /add\s+(data|values?|rows?)/i,
      /insert\s+(data|values?)/i,
      /enter.*in/i,
    ],
    optionalEntities: ['numbers', 'cellRefs', 'dataTypes'],
    examples: [
      'Add data to column A',
      'Insert values in row 5',
      'Enter these numbers in cells B2:B10',
    ],
    priority: 7,
  },
  {
    intentType: 'add_sheet',
    category: 'modify',
    keywords: ['add sheet', 'new sheet', 'create sheet', 'insert sheet'],
    phrases: [
      'add a sheet',
      'create new sheet',
      'add another sheet',
    ],
    patterns: [
      /add.*sheet/i,
      /new.*sheet/i,
      /create.*sheet/i,
    ],
    requiredEntities: ['sheetNames'],
    examples: [
      'Add a sheet called Revenue',
      'Create a new sheet for expenses',
      'Add another sheet named Q2',
    ],
    priority: 9,
  },
  
  // ============================================================================
  // ANALYZE INTENTS
  // ============================================================================
  {
    intentType: 'calculate_variance',
    category: 'analyze',
    keywords: ['variance', 'difference', 'delta', 'change', 'vs', 'versus'],
    phrases: [
      'calculate variance',
      'difference between',
      'compare actual vs budget',
    ],
    patterns: [
      /variance/i,
      /difference\s+between/i,
      /(\w+)\s+vs\s+(\w+)/i,
      /actual.*budget/i,
    ],
    requiredEntities: ['dataTypes'],
    examples: [
      'Calculate variance between budget and actual',
      'Show difference between Q1 and Q2',
      'Compare revenue vs target',
    ],
    priority: 8,
  },
  {
    intentType: 'calculate_ytd',
    category: 'analyze',
    keywords: ['ytd', 'year to date', 'cumulative', 'running total'],
    phrases: [
      'year to date',
      'YTD total',
      'cumulative sum',
      'running total',
    ],
    patterns: [
      /ytd/i,
      /year\s+to\s+date/i,
      /cumulativ(e|ely)/i,
      /running\s+total/i,
    ],
    optionalEntities: ['timePeriods', 'dataTypes'],
    examples: [
      'Calculate YTD revenue',
      'Show year to date totals',
      'Add cumulative sum column',
    ],
    priority: 8,
  },
  
  // ============================================================================
  // FORMAT INTENTS
  // ============================================================================
  {
    intentType: 'format_numbers',
    category: 'format',
    keywords: ['format', 'currency', 'percentage', 'decimal', 'number format'],
    phrases: [
      'format as currency',
      'format as percentage',
      'format numbers',
    ],
    patterns: [
      /format.*currency/i,
      /format.*percentage/i,
      /format.*decimal/i,
    ],
    requiredEntities: ['cellRefs'],
    optionalEntities: ['formatTypes'],
    examples: [
      'Format column B as currency',
      'Format cells D2:D10 as percentage',
      'Format numbers with 2 decimals',
    ],
    priority: 7,
  },
  {
    intentType: 'apply_style',
    category: 'format',
    keywords: ['bold', 'highlight', 'color', 'background', 'font'],
    phrases: [
      'make bold',
      'highlight cells',
      'change color',
      'apply style',
    ],
    patterns: [
      /make.*bold/i,
      /highlight/i,
      /(change|set).*color/i,
    ],
    requiredEntities: ['cellRefs'],
    examples: [
      'Make row 1 bold',
      'Highlight cells in red',
      'Change background color of header',
    ],
    priority: 6,
  },
  
  // ============================================================================
  // QUERY INTENTS
  // ============================================================================
  {
    intentType: 'query_value',
    category: 'query',
    keywords: ['what is', 'show me', 'tell me', 'how much'],
    phrases: [
      'what is the value',
      'show me the total',
      'what\'s in',
    ],
    patterns: [
      /what\s+(is|are|was)/i,
      /show\s+me/i,
      /how\s+much/i,
    ],
    optionalEntities: ['cellRefs', 'dataTypes'],
    examples: [
      'What is the total revenue?',
      'Show me the Q1 budget',
      'How much is in cell B5?',
    ],
    priority: 7,
  },
  
  // ============================================================================
  // IMPORT/EXPORT INTENTS
  // ============================================================================
  {
    intentType: 'import_xlsx',
    category: 'import',
    keywords: ['import', 'load', 'upload', 'open', 'read'],
    phrases: [
      'import file',
      'load excel',
      'upload spreadsheet',
    ],
    patterns: [
      /import.*xlsx?/i,
      /load.*excel/i,
      /upload.*file/i,
    ],
    examples: [
      'Import the Excel file',
      'Load data from budget.xlsx',
      'Upload my spreadsheet',
    ],
    priority: 9,
  },
  {
    intentType: 'export_xlsx',
    category: 'export',
    keywords: ['export', 'download', 'save', 'generate'],
    phrases: [
      'export to excel',
      'download as xlsx',
      'save as file',
    ],
    patterns: [
      /export.*xlsx?/i,
      /download/i,
      /save\s+as/i,
    ],
    examples: [
      'Export to Excel',
      'Download as xlsx file',
      'Save this as a spreadsheet',
    ],
    priority: 8,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get intent pattern by type
 */
export function getIntentPattern(intentType: IntentType): IntentPattern | undefined {
  return INTENT_PATTERNS.find((p) => p.intentType === intentType);
}

/**
 * Get all patterns for a category
 */
export function getPatternsByCategory(category: IntentCategory): IntentPattern[] {
  return INTENT_PATTERNS.filter((p) => p.category === category);
}

/**
 * Calculate confidence level from numeric score
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  if (confidence >= 0.4) return 'low';
  return 'very_low';
}

/**
 * Check if intent needs confirmation (low confidence)
 */
export function needsConfirmation(confidence: number): boolean {
  return confidence < 0.6;
}

/**
 * Generate confirmation message for uncertain intent
 */
export function generateConfirmationMessage(intent: ParsedIntent): string {
  const { type, entities, confidence } = intent;
  
  if (confidence < 0.4) {
    return `I'm not quite sure what you want to do. Could you rephrase or provide more details?`;
  }
  
  // Generate intent-specific confirmation messages
  switch (type) {
    case 'create_budget':
      return `I'll create a budget${entities.timePeriods?.[0] ? ` for ${entities.timePeriods[0]}` : ''}. Is that correct?`;
    
    case 'create_consolidation':
      return `I'll consolidate data from ${entities.sheetNames?.join(', ') || 'multiple sheets'}. Does that sound right?`;
    
    case 'add_formulas':
      return `I'll add formulas to ${entities.cellRefs?.join(', ') || 'the specified cells'}. Confirm?`;
    
    case 'format_numbers':
      return `I'll format ${entities.cellRefs?.[0] || 'the cells'} as ${entities.formatTypes?.[0] || 'numbers'}. Is that what you want?`;
    
    default:
      return `I think you want to ${type.replace(/_/g, ' ')}. Is that correct?`;
  }
}

/**
 * Merge entities from context and current prompt
 */
export function mergeEntities(
  currentEntities: IntentEntities,
  contextEntities?: IntentEntities
): IntentEntities {
  if (!contextEntities) return currentEntities;
  
  return {
    workbookName: currentEntities.workbookName || contextEntities.workbookName,
    sheetNames: [...(contextEntities.sheetNames || []), ...(currentEntities.sheetNames || [])],
    cellRefs: [...(contextEntities.cellRefs || []), ...(currentEntities.cellRefs || [])],
    namedRanges: [...(contextEntities.namedRanges || []), ...(currentEntities.namedRanges || [])],
    timePeriods: currentEntities.timePeriods || contextEntities.timePeriods,
    departments: currentEntities.departments || contextEntities.departments,
    numbers: currentEntities.numbers || contextEntities.numbers,
    dates: currentEntities.dates || contextEntities.dates,
    formulas: currentEntities.formulas || contextEntities.formulas,
    columnHeaders: currentEntities.columnHeaders || contextEntities.columnHeaders,
    dataTypes: currentEntities.dataTypes || contextEntities.dataTypes,
    comparisons: currentEntities.comparisons || contextEntities.comparisons,
    aggregations: currentEntities.aggregations || contextEntities.aggregations,
    formatTypes: currentEntities.formatTypes || contextEntities.formatTypes,
  };
}

/**
 * Check if intent is actionable (has required entities)
 */
export function isIntentActionable(intent: ParsedIntent): boolean {
  const pattern = getIntentPattern(intent.type);
  if (!pattern || !pattern.requiredEntities) return true;
  
  // Check if all required entities are present
  return pattern.requiredEntities.every((entityKey) => {
    const entityValue = intent.entities[entityKey];
    return entityValue !== undefined && 
           (Array.isArray(entityValue) ? entityValue.length > 0 : true);
  });
}

/**
 * Get missing required entities for an intent
 */
export function getMissingEntities(intent: ParsedIntent): string[] {
  const pattern = getIntentPattern(intent.type);
  if (!pattern || !pattern.requiredEntities) return [];
  
  return pattern.requiredEntities.filter((entityKey) => {
    const entityValue = intent.entities[entityKey];
    return entityValue === undefined || 
           (Array.isArray(entityValue) && entityValue.length === 0);
  });
}
