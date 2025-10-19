/**
 * Unsupported Feature Detector
 * 
 * Detects requests for features we know don't work BEFORE calling AI API.
 * This saves tokens and provides instant, helpful responses.
 */

import {
  KNOWN_UNSUPPORTED_FORMULAS,
  OPERATIONS_CAPABILITIES,
  extractFormulaNames,
} from './capabilities';

export interface UnsupportedDetection {
  isUnsupported: boolean;
  feature?: string;
  type?: 'formula' | 'operation';
  response?: string;
  confidence: number;
}

/**
 * Detect if user request contains known unsupported features
 * Returns instant helpful response if detected
 */
export function detectUnsupportedRequest(userMessage: string): UnsupportedDetection {
  const lower = userMessage.toLowerCase().trim();
  
  // Check for unsupported formulas in the message
  const formulaDetection = detectUnsupportedFormula(userMessage);
  if (formulaDetection.isUnsupported) {
    return formulaDetection;
  }
  
  // Check for unsupported operations
  const operationDetection = detectUnsupportedOperation(lower);
  if (operationDetection.isUnsupported) {
    return operationDetection;
  }
  
  return { isUnsupported: false, confidence: 0 };
}

/**
 * Detect unsupported formulas in user message
 */
function detectUnsupportedFormula(message: string): UnsupportedDetection {
  // Extract potential formula names from message
  const formulaNames = extractFormulaNames(message);
  
  for (const formulaName of formulaNames) {
    const normalized = formulaName.toUpperCase();
    
    if (normalized in KNOWN_UNSUPPORTED_FORMULAS) {
      const info = KNOWN_UNSUPPORTED_FORMULAS[normalized as keyof typeof KNOWN_UNSUPPORTED_FORMULAS];
      
      return {
        isUnsupported: true,
        feature: normalized,
        type: 'formula',
        response: formatUnsupportedFormulaResponse(normalized, info),
        confidence: 0.95,
      };
    }
  }
  
  // Also check for formula names mentioned in natural language
  // e.g., "use SORT to sort my data"
  const unsupportedFormulas = Object.keys(KNOWN_UNSUPPORTED_FORMULAS);
  for (const formula of unsupportedFormulas) {
    const pattern = new RegExp(`\\b${formula}\\b`, 'i');
    if (pattern.test(message)) {
      const info = KNOWN_UNSUPPORTED_FORMULAS[formula as keyof typeof KNOWN_UNSUPPORTED_FORMULAS];
      
      return {
        isUnsupported: true,
        feature: formula,
        type: 'formula',
        response: formatUnsupportedFormulaResponse(formula, info),
        confidence: 0.85,
      };
    }
  }
  
  return { isUnsupported: false, confidence: 0 };
}

/**
 * Detect unsupported operations in user message
 */
function detectUnsupportedOperation(message: string): UnsupportedDetection {
  // Pivot table detection
  if (message.includes('pivot') || message.match(/pivot\s*table/i)) {
    const info = OPERATIONS_CAPABILITIES.unsupported.pivotTable;
    return {
      isUnsupported: true,
      feature: 'pivotTable',
      type: 'operation',
      response: `I can't create pivot tables yet, but I can help you achieve similar results:\n\n${info.alternatives.map(alt => `✅ ${alt}`).join('\n')}\n\nWhich approach would work best for you?`,
      confidence: 0.9,
    };
  }
  
  // Chart/graph detection
  if (message.match(/\b(chart|graph|plot|visuali[sz]e)\b/i)) {
    const info = OPERATIONS_CAPABILITIES.unsupported.chart;
    return {
      isUnsupported: true,
      feature: 'chart',
      type: 'operation',
      response: `I can't create charts directly, but I can help:\n\n${info.alternatives.map(alt => `✅ ${alt}`).join('\n')}\n\nWould you like help preparing the data?`,
      confidence: 0.85,
    };
  }
  
  // Conditional formatting detection
  if (message.match(/conditional\s*format/i) || message.match(/\bhighlight\b.*\bif\b/i)) {
    const info = OPERATIONS_CAPABILITIES.unsupported.conditionalFormatting;
    return {
      isUnsupported: true,
      feature: 'conditionalFormatting',
      type: 'operation',
      response: `I can't apply conditional formatting directly, but I can:\n\n${info.alternatives.map(alt => `✅ ${alt}`).join('\n')}\n\nWhich approach works for you?`,
      confidence: 0.9,
    };
  }
  
  // Import/export detection
  if (message.match(/\b(import|export|load|save)\b.*\b(csv|xlsx|file)\b/i)) {
    const info = OPERATIONS_CAPABILITIES.unsupported.importExport;
    return {
      isUnsupported: true,
      feature: 'importExport',
      type: 'operation',
      response: `I can't import or export files yet, but:\n\n${info.alternatives.map(alt => `✅ ${alt}`).join('\n')}\n\nHow can I help with your data?`,
      confidence: 0.85,
    };
  }
  
  // Macro detection
  if (message.match(/\b(macro|vba|script|automate)\b/i)) {
    const info = OPERATIONS_CAPABILITIES.unsupported.macro;
    return {
      isUnsupported: true,
      feature: 'macro',
      type: 'operation',
      response: `I don't support macros (for security), but I can help!\n\n${info.alternatives.map(alt => `✅ ${alt}`).join('\n')}`,
      confidence: 0.9,
    };
  }
  
  // Sorting detection (common request that uses SORT formula)
  if (message.match(/\bsort\b.*\b(data|rows|column|ascending|descending)\b/i)) {
    return {
      isUnsupported: true,
      feature: 'SORT',
      type: 'formula',
      response: `The SORT() function isn't supported yet. Here's what we can do:\n\n✅ I can add a helper column with row numbers for manual sorting\n✅ Pre-sort your data in Excel/Sheets, then paste it here\n✅ For finding max/min values, I can use MAX/MIN functions\n\nWhich approach works for your use case?`,
      confidence: 0.8,
    };
  }
  
  return { isUnsupported: false, confidence: 0 };
}

/**
 * Format a helpful response for unsupported formulas
 */
function formatUnsupportedFormulaResponse(
  formulaName: string,
  info: { readonly error: string; readonly impact: string; readonly alternatives: readonly string[]; readonly workaround: string }
): string {
  const alternatives = info.alternatives
    .map(alt => `✅ ${alt}`)
    .join('\n');
  
  return `❌ The \`${formulaName}\` function isn't supported in our formula engine (HyperFormula 3.1.0) yet.\n\n**Here's what we can do instead:**\n\n${alternatives}\n\n**Quick workaround:** ${info.workaround}\n\nWhich approach would work for you?`;
}

/**
 * Log unsupported requests for analytics (helps prioritize features)
 */
export function logUnsupportedRequest(feature: string, type: 'formula' | 'operation', userQuery: string) {
  try {
    const key = 'nexcell_unsupported_requests';
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    
    if (!existing[feature]) {
      existing[feature] = {
        type,
        count: 0,
        lastQuery: '',
        firstSeen: new Date().toISOString(),
      };
    }
    
    existing[feature].count += 1;
    existing[feature].lastQuery = userQuery;
    existing[feature].lastSeen = new Date().toISOString();
    
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (error) {
    // Silently fail - analytics not critical
    console.warn('Failed to log unsupported request:', error);
  }
}

/**
 * Get most requested unsupported features (for prioritization)
 */
export function getUnsupportedRequestStats(): Record<string, any> {
  try {
    const key = 'nexcell_unsupported_requests';
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}
