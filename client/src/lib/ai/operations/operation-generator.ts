/**
 * AI Operation Generator
 * 
 * Main AI integration point that generates WorkbookOperations from natural language prompts.
 * Uses OpenRouter API (Claude 3.5 Sonnet) to parse user intent and generate structured operations.
 * 
 * Design Principles:
 * - Robust JSON parsing with error recovery
 * - Type-safe operation validation
 * - Confidence scoring for user confirmation
 * - Context-aware generation (workbook state, conversation history)
 * 
 * Architecture:
 * 1. Build AI prompt (system prompt + workbook context + conversation history)
 * 2. Call OpenRouter API with Claude 3.5 Sonnet
 * 3. Parse JSON response and extract operations
 * 4. Validate operations against WorkbookOperation types
 * 5. Return operations + confidence + explanation
 * 
 * Usage:
 * ```typescript
 * const result = await generateWorkbookOperations(
 *   'Create a Q1 budget',
 *   workbookContext,
 *   conversationHistory
 * );
 * 
 * if (result.success) {
 *   const executor = new WorkbookOperationExecutor();
 *   await executor.execute(result.operations);
 * }
 * ```
 */

import type { WorkbookOperation } from './types';
import type { WorkbookContext } from '../workbookContext';
import type { Message } from '../../types';

/**
 * Result from AI operation generation
 */
export interface GenerationResult {
  /** Whether generation was successful */
  success: boolean;
  /** Generated workbook operations */
  operations: WorkbookOperation[];
  /** AI's explanation of what it's doing */
  explanation: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Any errors encountered during generation */
  errors: GenerationError[];
  /** Warnings about potential issues */
  warnings: string[];
  /** Raw AI response (for debugging) */
  rawResponse?: string;
}

/**
 * Generation error details
 */
export interface GenerationError {
  /** Error code */
  code: 'API_ERROR' | 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'INVALID_KEY';
  /** Human-readable message */
  message: string;
  /** Additional context */
  details?: any;
}

/**
 * Options for operation generation
 */
export interface GenerationOptions {
  /** API key for OpenRouter (defaults to env var) */
  apiKey?: string;
  /** Model to use (defaults to claude-3.5-sonnet) */
  model?: string;
  /** Temperature for generation (0-1, default 0.3) */
  temperature?: number;
  /** Maximum tokens to generate (default 4000) */
  maxTokens?: number;
  /** Timeout in milliseconds (default 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * System prompt for AI
 * 
 * Instructs Claude on how to generate WorkbookOperations from user prompts
 */
const SYSTEM_PROMPT = `You are an expert spreadsheet AI assistant. Your job is to convert natural language requests into structured WorkbookOperation JSON.

# Available Operations

## 1. createWorkbook
Create a new workbook with optional initial sheets.
{
  "type": "createWorkbook",
  "params": {
    "name": "Q1 Budget",
    "initialSheets": ["Sales", "Marketing", "Summary"]
  }
}

## 2. addSheet
Add a new sheet to the workbook.
{
  "type": "addSheet",
  "params": {
    "name": "Operations",
    "id": "operations" // optional
  }
}

## 3. removeSheet
Remove a sheet from the workbook.
{
  "type": "removeSheet",
  "params": {
    "sheetId": "sheet_to_remove"
  }
}

## 4. setCells (BULK OPERATION - Preferred)
Set multiple cells at once. ALWAYS specify dataType for each cell.
{
  "type": "setCells",
  "params": {
    "sheet": "Sheet1",
    "cells": {
      "A1": { "value": "Product", "dataType": "string", "style": { "bold": true } },
      "B1": { "value": "Price", "dataType": "string", "style": { "bold": true } },
      "A2": { "value": "Widget", "dataType": "string" },
      "B2": { "value": 99.99, "dataType": "number", "numFmt": "$#,##0.00" },
      "C2": { "formula": "=B2*1.2", "dataType": "formula" }
    }
  }
}

## 5. setFormula
Set a single formula cell.
{
  "type": "setFormula",
  "params": {
    "sheet": "Sheet1",
    "cell": "D2",
    "formula": "=C2-B2"
  }
}

## 6. compute
Trigger formula recalculation (use after setting formulas).
{
  "type": "compute",
  "params": {}
}

## 7. applyFormat
Apply formatting to cells.
{
  "type": "applyFormat",
  "params": {
    "sheet": "Sheet1",
    "range": "A1:D1",
    "format": {
      "bold": true,
      "bgColor": "#f0f0f0",
      "fontSize": 12
    }
  }
}

## 8. mergeCells
Merge a range of cells.
{
  "type": "mergeCells",
  "params": {
    "sheet": "Sheet1",
    "range": "A1:D1"
  }
}

## 9. defineNamedRange
Create a named range for formulas.
{
  "type": "defineNamedRange",
  "params": {
    "name": "SalesData",
    "range": "Sheet1!A2:A10"
  }
}

# Excel Functions Supported

Math: SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, POWER, SQRT
Logic: IF, AND, OR, NOT, IFS, SWITCH
Lookup: VLOOKUP, HLOOKUP, INDEX, MATCH, XLOOKUP
Conditional: SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, AVERAGEIFS
Text: LEFT, RIGHT, MID, CONCATENATE, TEXTJOIN, TRIM, UPPER, LOWER
Date: TODAY, NOW, DATE, YEAR, MONTH, DAY, EOMONTH, NETWORKDAYS

# Important Rules

1. **Always use setCells for bulk operations** - More efficient than multiple setFormula
2. **Always specify dataType** - Required: "string", "number", "boolean", "date", "formula"
3. **Formulas must start with =** - Example: "=SUM(A1:A10)"
4. **Use compute after setting formulas** - Ensures all formulas are calculated
5. **Sheet references** - Use sheet names or IDs (e.g., "Sheet1" or "sheet-id")
6. **Cell addresses** - Use Excel format (A1, B2, etc.)
7. **Number formats** - Use Excel codes: "$#,##0.00", "0.0%", "mm/dd/yyyy"

# Response Format

Respond with valid JSON:
{
  "operations": [/* array of WorkbookOperation objects */],
  "explanation": "I'll create a budget tracker with...",
  "confidence": 0.9
}

# Examples

User: "Create a simple budget tracker"
Response:
{
  "operations": [
    {
      "type": "createWorkbook",
      "params": { "name": "Budget Tracker" }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "Sheet1",
        "cells": {
          "A1": { "value": "Category", "dataType": "string", "style": { "bold": true } },
          "B1": { "value": "Budget", "dataType": "string", "style": { "bold": true } },
          "C1": { "value": "Actual", "dataType": "string", "style": { "bold": true } },
          "D1": { "value": "Variance", "dataType": "string", "style": { "bold": true } },
          "A2": { "value": "Rent", "dataType": "string" },
          "B2": { "value": 2000, "dataType": "number", "numFmt": "$#,##0.00" },
          "C2": { "value": 2000, "dataType": "number", "numFmt": "$#,##0.00" },
          "D2": { "formula": "=C2-B2", "dataType": "formula", "numFmt": "$#,##0.00" }
        }
      }
    },
    {
      "type": "compute",
      "params": {}
    }
  ],
  "explanation": "I created a budget tracker with Category, Budget, Actual, and Variance columns. The Variance column uses a formula to calculate the difference.",
  "confidence": 0.95
}

Now generate operations for the user's request. Respond ONLY with JSON, no additional text.`;

/**
 * Generate workbook operations from user prompt
 * 
 * @param prompt - User's natural language request
 * @param context - Current workbook context (optional)
 * @param conversationHistory - Previous messages (optional)
 * @param options - Generation options (optional)
 * @returns Generation result with operations and metadata
 */
export async function generateWorkbookOperations(
  prompt: string,
  context?: WorkbookContext,
  conversationHistory: Message[] = [],
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const {
    apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || localStorage.getItem('openrouter_api_key'),
    model = import.meta.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4',
    temperature = 0.3,
    maxTokens = 4000,
    timeout = 30000,
    debug = false,
  } = options;

  // Validate API key
  if (!apiKey) {
    return {
      success: false,
      operations: [],
      explanation: '',
      confidence: 0,
      errors: [{
        code: 'INVALID_KEY',
        message: 'OpenRouter API key not configured. Set VITE_OPENROUTER_API_KEY or add key to localStorage.',
      }],
      warnings: [],
    };
  }

  try {
    // Build messages array
    const messages = buildMessages(prompt, context, conversationHistory);

    if (debug) {
      console.log('[operation-generator] Sending request to OpenRouter');
      console.log('[operation-generator] Model:', model);
      console.log('[operation-generator] Messages:', messages);
    }

    // Call OpenRouter API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Nexcell',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 429) {
        return {
          success: false,
          operations: [],
          explanation: '',
          confidence: 0,
          errors: [{
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded. Please wait a moment and try again.',
            details: errorText,
          }],
          warnings: [],
        };
      }

      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: [{
          code: 'API_ERROR',
          message: `OpenRouter API error: ${response.status} ${response.statusText}`,
          details: errorText,
        }],
        warnings: [],
      };
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content;

    if (!rawResponse) {
      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: [{
          code: 'API_ERROR',
          message: 'No response from AI',
          details: data,
        }],
        warnings: [],
      };
    }

    if (debug) {
      console.log('[operation-generator] Raw AI response:', rawResponse);
    }

    // Parse AI response
    const parseResult = parseAIResponse(rawResponse, debug);

    if (!parseResult.success) {
      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: parseResult.errors,
        warnings: [],
        rawResponse,
      };
    }

    // Validate operations
    const validationResult = validateOperations(parseResult.operations);

    return {
      success: true,
      operations: parseResult.operations,
      explanation: parseResult.explanation,
      confidence: parseResult.confidence,
      errors: [],
      warnings: validationResult.warnings,
      rawResponse: debug ? rawResponse : undefined,
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: [{
          code: 'TIMEOUT',
          message: `Request timed out after ${timeout}ms`,
        }],
        warnings: [],
      };
    }

    return {
      success: false,
      operations: [],
      explanation: '',
      confidence: 0,
      errors: [{
        code: 'API_ERROR',
        message: error.message || 'Unknown error occurred',
        details: error,
      }],
      warnings: [],
    };
  }
}

/**
 * Build messages array for OpenRouter API
 */
function buildMessages(
  prompt: string,
  context?: WorkbookContext,
  conversationHistory: Message[] = []
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Add context if available
  if (context) {
    const contextSummary = formatWorkbookContext(context);
    messages.push({
      role: 'system',
      content: `Current workbook context:\n${contextSummary}`,
    });
  }

  // Add conversation history (last 5 messages to stay within token limits)
  const recentHistory = conversationHistory.slice(-5);
  for (const msg of recentHistory) {
    if (msg.role !== 'system') {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add current user prompt
  messages.push({
    role: 'user',
    content: prompt,
  });

  return messages;
}

/**
 * Format workbook context for AI consumption
 */
function formatWorkbookContext(context: WorkbookContext): string {
  const lines: string[] = [];

  lines.push(`Sheets: ${context.totalSheets}`);
  lines.push(`Active sheet: ${context.activeSheet}`);
  
  if (context.sheets.length > 0) {
    lines.push('\nSheet details:');
    for (const sheet of context.sheets) {
      lines.push(`  - ${sheet.name}: ${sheet.cellCount} cells, ${sheet.formulaCount} formulas`);
      if (sheet.dataRange) {
        lines.push(`    Data range: ${sheet.dataRange}`);
      }
    }
  }

  if (context.totalFormulas > 0) {
    lines.push(`\nTotal formulas: ${context.totalFormulas}`);
  }

  if (context.namedRanges.length > 0) {
    lines.push('\nNamed ranges:');
    for (const nr of context.namedRanges) {
      lines.push(`  - ${nr.name}: ${nr.reference}`);
    }
  }

  if (context.potentialErrors.length > 0) {
    lines.push('\nWarnings:');
    for (const err of context.potentialErrors.slice(0, 3)) {
      lines.push(`  - ${err.type} (${err.severity}): ${err.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse AI response and extract operations
 */
interface ParseResult {
  success: boolean;
  operations: WorkbookOperation[];
  explanation: string;
  confidence: number;
  errors: GenerationError[];
}

function parseAIResponse(response: string, debug: boolean = false): ParseResult {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonStr = response.trim();
    
    // Remove markdown code fences (multiple patterns)
    jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```$/,'');
    jsonStr = jsonStr.replace(/^```\s*/,'').replace(/\s*```$/,'');
    
    // Remove any leading text before JSON
    const jsonStartIdx = jsonStr.indexOf('{');
    if (jsonStartIdx > 0) {
      jsonStr = jsonStr.substring(jsonStartIdx);
    }
    
    // Try to find complete JSON object (handle nested braces)
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    // Handle trailing text after JSON
    let braceCount = 0;
    let endIdx = -1;
    for (let i = 0; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') braceCount++;
      if (jsonStr[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    if (endIdx > 0) {
      jsonStr = jsonStr.substring(0, endIdx);
    }

    if (debug) {
      console.log('[operation-generator] Extracted JSON:', jsonStr);
    }

    // Parse JSON
    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.operations) {
      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: [{
          code: 'PARSE_ERROR',
          message: 'AI response missing "operations" field',
          details: parsed,
        }],
      };
    }

    if (!Array.isArray(parsed.operations)) {
      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: [{
          code: 'PARSE_ERROR',
          message: 'AI response "operations" field is not an array',
          details: parsed,
        }],
      };
    }

    if (parsed.operations.length === 0) {
      return {
        success: false,
        operations: [],
        explanation: '',
        confidence: 0,
        errors: [{
          code: 'PARSE_ERROR',
          message: 'AI response "operations" array is empty',
          details: parsed,
        }],
      };
    }

    return {
      success: true,
      operations: parsed.operations,
      explanation: parsed.explanation || 'Generated operations',
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8,
      errors: [],
    };

  } catch (error: any) {
    return {
      success: false,
      operations: [],
      explanation: '',
      confidence: 0,
      errors: [{
        code: 'PARSE_ERROR',
        message: 'Failed to parse AI response as JSON',
        details: { error: error.message, response: response.substring(0, 200) },
      }],
    };
  }
}

/**
 * Validate operations against WorkbookOperation types
 */
interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

function validateOperations(operations: any[]): ValidationResult {
  const warnings: string[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    // Check basic structure
    if (!op.type) {
      warnings.push(`Operation ${i}: Missing 'type' field`);
      continue;
    }

    if (!op.params) {
      warnings.push(`Operation ${i}: Missing 'params' field`);
      continue;
    }

    // Type-specific validation
    switch (op.type) {
      case 'createWorkbook':
        if (!op.params.name) {
          warnings.push(`Operation ${i} (createWorkbook): Missing 'name' parameter`);
        }
        if (op.params.initialSheets && !Array.isArray(op.params.initialSheets)) {
          warnings.push(`Operation ${i} (createWorkbook): 'initialSheets' must be an array`);
        }
        break;

      case 'addSheet':
        if (!op.params.name) {
          warnings.push(`Operation ${i} (addSheet): Missing 'name' parameter`);
        }
        break;

      case 'removeSheet':
        if (!op.params.sheetId && !op.params.name) {
          warnings.push(`Operation ${i} (removeSheet): Missing 'sheetId' or 'name' parameter`);
        }
        break;

      case 'setCells':
        if (!op.params.sheet) {
          warnings.push(`Operation ${i} (setCells): Missing 'sheet' parameter`);
        }
        if (!op.params.cells || typeof op.params.cells !== 'object') {
          warnings.push(`Operation ${i} (setCells): Missing or invalid 'cells' parameter`);
        } else {
          // Check that cells have dataType
          for (const [addr, cell] of Object.entries(op.params.cells)) {
            if (!cell || typeof cell !== 'object') {
              warnings.push(`Operation ${i} (setCells): Cell ${addr} is not an object`);
              continue;
            }
            const cellObj = cell as any;
            if (!cellObj.dataType) {
              warnings.push(`Operation ${i} (setCells): Cell ${addr} missing 'dataType'`);
            }
            if (cellObj.dataType === 'formula' && !cellObj.formula) {
              warnings.push(`Operation ${i} (setCells): Cell ${addr} has dataType 'formula' but missing 'formula' field`);
            }
            if (cellObj.dataType !== 'formula' && cellObj.value === undefined) {
              warnings.push(`Operation ${i} (setCells): Cell ${addr} missing 'value' field`);
            }
          }
        }
        break;

      case 'setFormula':
        if (!op.params.sheet) {
          warnings.push(`Operation ${i} (setFormula): Missing 'sheet' parameter`);
        }
        if (!op.params.cell) {
          warnings.push(`Operation ${i} (setFormula): Missing 'cell' parameter`);
        }
        if (!op.params.formula) {
          warnings.push(`Operation ${i} (setFormula): Missing 'formula' parameter`);
        } else if (!op.params.formula.startsWith('=')) {
          warnings.push(`Operation ${i} (setFormula): Formula must start with '='`);
        }
        break;

      case 'applyFormat':
        if (!op.params.sheet) {
          warnings.push(`Operation ${i} (applyFormat): Missing 'sheet' parameter`);
        }
        if (!op.params.range && !op.params.cell) {
          warnings.push(`Operation ${i} (applyFormat): Missing 'range' or 'cell' parameter`);
        }
        if (!op.params.format) {
          warnings.push(`Operation ${i} (applyFormat): Missing 'format' parameter`);
        }
        break;

      case 'mergeCells':
        if (!op.params.sheet) {
          warnings.push(`Operation ${i} (mergeCells): Missing 'sheet' parameter`);
        }
        if (!op.params.range) {
          warnings.push(`Operation ${i} (mergeCells): Missing 'range' parameter`);
        }
        break;

      case 'defineNamedRange':
        if (!op.params.name) {
          warnings.push(`Operation ${i} (defineNamedRange): Missing 'name' parameter`);
        }
        if (!op.params.range) {
          warnings.push(`Operation ${i} (defineNamedRange): Missing 'range' parameter`);
        }
        break;

      case 'compute':
        // No required parameters for compute
        break;

      default:
        warnings.push(`Operation ${i}: Unknown operation type '${op.type}'`);
        break;
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
