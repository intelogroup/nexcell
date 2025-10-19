/**
 * AI Service for processing chat instructions and generating workbook actions
 */

import type { WorkbookAction } from '@/lib/types';
import { parseCellReference } from '@/lib/db/jsonWorkbook';
import { detectUnsupportedRequest, logUnsupportedRequest } from './unsupportedDetector';
import { buildQueryAwarePrompt } from './enhancedPrompt';

export interface AICommand {
  intent: string;
  parameters: Record<string, any>;
  actions: WorkbookAction[];
}

/**
 * Parses user chat message and generates workbook actions
 */
export function parseAICommand(message: string, sheetId: string = 'sheet-1'): AICommand {
  const msg = message.trim();
  const lowerMsg = msg.toLowerCase();
  
  // Pattern: Set cell A1 to [value]
  const setCellMatch = msg.match(/set (?:cell )?([a-zA-Z]+\d+) (?:to|=) (.+)/i);
  if (setCellMatch) {
    const cellRef = setCellMatch[1].toUpperCase();
    let value = setCellMatch[2].trim();
    const pos = parseCellReference(cellRef);
    
    if (pos) {
      // Check if it's a formula (starts with =)
      if (value.startsWith('=')) {
        // Normalize cell references inside the formula to uppercase (e.g., a1 -> A1)
        value = value.replace(/[A-Za-z]+(?=\d+)/g, s => s.toUpperCase());
        return {
          intent: 'setCellFormula',
          parameters: { cell: cellRef, formula: value },
          actions: [{
            type: 'setCellFormula',
            sheetId,
            row: pos.row,
            col: pos.col,
            formula: value,
          }],
        };
      } else {
        // Try to parse as number
        const numValue = parseFloat(value);
        const finalValue = !isNaN(numValue) ? numValue : value;
        
        return {
          intent: 'setCellValue',
          parameters: { cell: cellRef, value: finalValue },
          actions: [{
            type: 'setCellValue',
            sheetId,
            row: pos.row,
            col: pos.col,
            value: finalValue,
          }],
        };
      }
    }
  }
  
  // Pattern: Add formula [formula] to [cell]
  const addFormulaMatch = msg.match(/add formula (.+) (?:to|in) (?:cell )?([a-zA-Z]+\d+)/i);
  if (addFormulaMatch) {
    let formula = addFormulaMatch[1].trim();
    const cellRef = addFormulaMatch[2].toUpperCase();
    const pos = parseCellReference(cellRef);
    
    if (pos) {
      // Ensure formula starts with =
      if (!formula.startsWith('=')) {
        formula = '=' + formula;
      }
      // Normalize cell refs inside formula
      formula = formula.replace(/[A-Za-z]+(?=\d+)/g, s => s.toUpperCase());
      
      return {
        intent: 'setCellFormula',
        parameters: { cell: cellRef, formula },
        actions: [{
          type: 'setCellFormula',
          sheetId,
          row: pos.row,
          col: pos.col,
          formula,
        }],
      };
    }
  }
  
  // Pattern: Clear cell [cell] or Clear [cell]
  const clearCellMatch = lowerMsg.match(/clear (?:cell )?([a-z]+\d+)/i);
  if (clearCellMatch) {
    const cellRef = clearCellMatch[1].toUpperCase();
    const pos = parseCellReference(cellRef);
    
    if (pos) {
      return {
        intent: 'clearCell',
        parameters: { cell: cellRef },
        actions: [{
          type: 'clearRange',
          sheetId,
          startRow: pos.row,
          startCol: pos.col,
          endRow: pos.row,
          endCol: pos.col,
        }],
      };
    }
  }
  
  // Pattern: Clear range [start]:[end] or Clear [start] to [end]
  const clearRangeMatch = lowerMsg.match(/clear (?:range )?([a-z]+\d+)(?::| to )([a-z]+\d+)/i);
  if (clearRangeMatch) {
    const startRef = clearRangeMatch[1].toUpperCase();
    const endRef = clearRangeMatch[2].toUpperCase();
    const startPos = parseCellReference(startRef);
    const endPos = parseCellReference(endRef);
    
    if (startPos && endPos) {
      return {
        intent: 'clearRange',
        parameters: { start: startRef, end: endRef },
        actions: [{
          type: 'clearRange',
          sheetId,
          startRow: Math.min(startPos.row, endPos.row),
          startCol: Math.min(startPos.col, endPos.col),
          endRow: Math.max(startPos.row, endPos.row),
          endCol: Math.max(startPos.col, endPos.col),
        }],
      };
    }
  }
  
  // Pattern: Create sum formula in [cell] for [range]
  const sumMatch = lowerMsg.match(/(?:create |add )?sum (?:formula )?(?:in |to )?(?:cell )?([a-z]+\d+) (?:for|of) (?:range )?([a-z]+\d+):([a-z]+\d+)/i);
  if (sumMatch) {
    const targetRef = sumMatch[1].toUpperCase();
    const startRef = sumMatch[2].toUpperCase();
    const endRef = sumMatch[3].toUpperCase();
    const pos = parseCellReference(targetRef);
    
    if (pos) {
      const formula = `=SUM(${startRef}:${endRef})`;
      return {
        intent: 'createSumFormula',
        parameters: { cell: targetRef, range: `${startRef}:${endRef}` },
        actions: [{
          type: 'setCellFormula',
          sheetId,
          row: pos.row,
          col: pos.col,
          formula,
        }],
      };
    }
  }
  
  // Pattern: Fill [range] with [value]
  const fillMatch = lowerMsg.match(/fill (?:range )?([a-z]+\d+):([a-z]+\d+) with (.+)/i);
  if (fillMatch) {
    const startRef = fillMatch[1].toUpperCase();
    const endRef = fillMatch[2].toUpperCase();
    const value = fillMatch[3].trim();
    const startPos = parseCellReference(startRef);
    const endPos = parseCellReference(endRef);
    
    if (startPos && endPos) {
      const numValue = parseFloat(value);
      const finalValue = !isNaN(numValue) ? numValue : value;
      
      const actions: WorkbookAction[] = [];
      for (let row = Math.min(startPos.row, endPos.row); row <= Math.max(startPos.row, endPos.row); row++) {
        for (let col = Math.min(startPos.col, endPos.col); col <= Math.max(startPos.col, endPos.col); col++) {
          actions.push({
            type: 'setCellValue',
            sheetId,
            row,
            col,
            value: finalValue,
          });
        }
      }
      
      return {
        intent: 'fillRange',
        parameters: { start: startRef, end: endRef, value: finalValue },
        actions,
      };
    }
  }
  
  // No recognized pattern
  return {
    intent: 'unknown',
    parameters: {},
    actions: [],
  };
}

/**
 * Generates a human-readable description of the action
 */
export function describeAction(action: WorkbookAction): string {
  switch (action.type) {
    case 'setCellValue':
      return `Set ${formatCell(action.row, action.col)} to ${action.value}`;
    case 'setCellFormula':
      return `Add formula ${action.formula} to ${formatCell(action.row, action.col)}`;
    case 'clearRange':
      if (action.startRow === action.endRow && action.startCol === action.endCol) {
        return `Clear ${formatCell(action.startRow, action.startCol)}`;
      }
      return `Clear range ${formatCell(action.startRow, action.startCol)}:${formatCell(action.endRow, action.endCol)}`;
    case 'setRange':
      return `Set range ${formatCell(action.startRow, action.startCol)}:${formatCell(action.endRow, action.endCol)}`;
    case 'setFormulaRange':
      return `Add formulas to range ${formatCell(action.startRow, action.startCol)}:${formatCell(action.endRow, action.endCol)}`;
    default:
      return 'Unknown action';
  }
}

function formatCell(row: number, col: number): string {
  let colStr = '';
  let c = col + 1;
  while (c > 0) {
    const mod = (c - 1) % 26;
    colStr = String.fromCharCode(65 + mod) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return `${colStr}${row + 1}`;
}

/**
 * Example commands for user reference
 */
export const EXAMPLE_COMMANDS = [
  'Set A1 to 100',
  'Set cell B2 = Hello World',
  'Add formula =A1*2 to C1',
  'Create sum in D10 for range A1:A9',
  'Fill A1:A10 with 0',
  'Clear cell B5',
  'Clear range C1:E5',
];

/**
 * Chat with AI using OpenRouter (with capability awareness)
 * @param userMessage - The user's message
 * @param conversationHistory - Previous conversation context
 * @param systemPrompt - System instructions for the AI (optional, will use enhanced prompt if not provided)
 * @param options - Additional options (mode, retryCount, etc.)
 * @returns AI response text
 */
export async function chatWithAI(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  systemPrompt?: string,
  options?: {
    mode?: 'plan' | 'act';
    retryCount?: number;
    lastError?: string;
  }
): Promise<string> {
  // 🚀 STEP 1: Pre-check for known unsupported features (instant response, no API call)
  const detection = detectUnsupportedRequest(userMessage);
  
  if (detection.isUnsupported && detection.response && detection.confidence > 0.8) {
    // Log for analytics
    if (detection.feature && detection.type) {
      logUnsupportedRequest(detection.feature, detection.type, userMessage);
    }
    
    // Return instant helpful response
    return detection.response;
  }
  
  // Get API key from environment or localStorage
  const envKey = import.meta.env?.VITE_OPENROUTER_API_KEY;
  const storedKey = localStorage.getItem('openrouter_api_key');

  // Compute API key: prefer localStorage override, fall back to environment variable.
  const apiKey = (storedKey && storedKey !== 'undefined') ? storedKey : ((envKey && envKey !== 'undefined') ? envKey : '');

  // Fail early and clearly if no API key available from either source
  if (!apiKey || apiKey.trim() === '') {
    // For tests and runtime we want a clear error message the tests assert on
    throw new Error('API key not configured');
  }

  try {
    // If this is a simple greeting or casual chit-chat, avoid sending the
    // full production system prompt (which references workbook context) so the
    // model does not accidentally expose or fabricate workbook data.
    // Use a minimal, privacy-safe system prompt for short greetings.
    const isCasualGreeting = (msg: string) => {
      if (!msg) return false;
      const trimmed = msg.trim().toLowerCase();
      // Match plain greetings or very short conversational messages
      return /^(hi|hello|hey|hiya|yo|how are you|good morning|good afternoon|good evening)[\.!?\s]*$/i.test(trimmed)
        || trimmed.length <= 4 && /^(hi|hey|yo)$/i.test(trimmed);
    };

    let systemMessage = systemPrompt;
    
    if (isCasualGreeting(userMessage)) {
      // Simple greeting - minimal prompt
      systemMessage = `You are a friendly, conversational assistant. Keep replies short and casual. Do NOT access or invent any workbook or user-specific data. If the user asks about spreadsheet functionality, ask a clarifying question instead.`;
    } else if (!systemPrompt) {
      // 🎯 STEP 2: Use capability-aware prompt if no custom prompt provided
      systemMessage = buildQueryAwarePrompt({
        userQuery: userMessage,
        mode: options?.mode || 'act',
        retryCount: options?.retryCount || 0,
        lastError: options?.lastError,
      });
    }

    const messages = [
      ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Nexcell',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: 0.7,
        max_tokens: parseInt(import.meta.env.VITE_OPENROUTER_MAX_TOKENS || '2000'),
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `OpenRouter API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    return aiResponse;
  } catch (error) {
    console.error('AI chat error:', error);
    throw error;
  }
}
