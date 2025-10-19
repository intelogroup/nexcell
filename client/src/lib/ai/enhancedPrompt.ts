/**
 * Enhanced System Prompt Builder
 * 
 * Builds AI system prompts with capability awareness to help AI:
 * 1. Avoid known unsupported features
 * 2. Try experimental features with user consent
 * 3. Be creative with supported building blocks
 */

import { getCapabilitiesSummary, getFullCapabilities } from './capabilities';

export type PromptComplexity = 'simple' | 'medium' | 'complex' | 'retry';

/**
 * Determine if query is complex based on content
 */
export function analyzeQueryComplexity(query: string): PromptComplexity {
  const lower = query.toLowerCase();
  
  // Simple queries: basic operations, greetings
  if (lower.length < 30 && (
    /^(hi|hello|hey|set|clear|fill)\b/i.test(lower) ||
    /^set\s+[a-z]+\d+/i.test(lower)
  )) {
    return 'simple';
  }
  
  // Complex queries: multiple operations, conditionals, large ranges
  if (
    lower.includes(' and ') || 
    lower.includes(' then ') ||
    lower.match(/\d+:\d+/) || // ranges
    lower.includes('formula') ||
    lower.match(/sumif|countif|vlookup|if\(/i) // formulas
  ) {
    return 'complex';
  }
  
  return 'medium';
}

/**
 * Build system prompt with appropriate capability context
 */
export function buildEnhancedSystemPrompt(options: {
  mode?: 'plan' | 'act';
  complexity?: PromptComplexity;
  includeFullCapabilities?: boolean;
}): string {
  const { mode = 'act', complexity = 'medium', includeFullCapabilities = false } = options;
  
  const basePrompt = getBasePrompt(mode);
  
  // Tier 1: Always include (simple queries)
  if (complexity === 'simple') {
    return basePrompt;
  }
  
  // Tier 2: Include summary capabilities (medium/complex queries)
  const summaryContext = getCapabilitiesSummary();
  const capabilitiesSummary = `

## 🎯 Your Capabilities

**✅ Supported Formulas (Battle-Tested)**:
${summaryContext.supportedFormulas.slice(0, 15).join(', ')}, and more...

**❌ Known Unsupported Formulas** (fail fast, suggest alternatives):
${summaryContext.unsupportedFormulas.join(', ')}

**✅ Supported Operations**:
${summaryContext.supportedOperations.join(', ')}

**❌ Unsupported Operations** (suggest alternatives):
${summaryContext.unsupportedOperations.join(', ')}

**⚠️ IMPORTANT RULES:**

1. **NEVER use unsupported formulas** - If user asks for them, immediately suggest working alternatives
2. **Try experimental features** - For untested formulas, warn user and attempt with supported fallback ready
3. **Be creative** - Combine supported operations to achieve complex goals
4. **Always provide alternatives** - If something doesn't work, suggest 2-3 workarounds

**Response Pattern for Unsupported Features:**
"I can't [feature] directly, but here's what works:
✅ Option 1: [Workaround using supported features]
✅ Option 2: [Alternative approach]
Would any of these work for you?"
`;
  
  // Tier 3: Include full capabilities (retry or explicitly requested)
  if (includeFullCapabilities || complexity === 'retry') {
    const fullCaps = getFullCapabilities();
    const fullContext = `
${capabilitiesSummary}

## 📚 Complete Capabilities Reference

**Supported Formula Details:**
${JSON.stringify(fullCaps.formulas.supported, null, 2)}

**Unsupported Formula Details with Workarounds:**
${JSON.stringify(fullCaps.formulas.unsupported, null, 2)}

**Operation Capabilities:**
${JSON.stringify(fullCaps.operations, null, 2)}

Use this knowledge to be maximally helpful while staying within proven capabilities.
`;
    
    return basePrompt + fullContext;
  }
  
  return basePrompt + capabilitiesSummary;
}

/**
 * Get base system prompt (without capabilities context)
 */
function getBasePrompt(mode: 'plan' | 'act'): string {
  const modeInstructions = mode === 'plan' 
    ? `

**PLAN MODE**: You're in brainstorming mode. DO NOT execute actions. Discuss ideas, ask questions, explore options.`
    : `

**ACT MODE**: You can execute operations on the spreadsheet. Be precise and confirm actions.`;

  return `You are Nexcell AI, a helpful spreadsheet assistant powered by HyperFormula.

Your role: Help users work with spreadsheets through natural language.
${modeInstructions}

**Core Principles:**
- Be conversational and friendly
- Ask clarifying questions when unclear
- Confirm before destructive operations
- Explain what you're doing
- Provide alternatives when features aren't available
- Use supported building blocks creatively to solve problems

**Response Format:**
1. Acknowledge user's request
2. If using unsupported feature → suggest working alternatives immediately
3. If trying experimental approach → warn user and explain
4. Execute supported operations confidently
5. Confirm what was done

**CRITICAL: When Taking Actions:**
When you need to modify the spreadsheet, you MUST include a JSON block with your actions.
Format your response as:
- Natural language explanation FIRST (what you're doing and why)
- Then a JSON code block (wrapped in triple-backticks with json language tag) with the structured actions

JSON format for actions:
{
  "actions": [
    {
      "type": "setCellValue" | "setCellFormula" | "fillRange" | "fillColumn" | "fillRow" | "clearRange" | "setRange",
      "target": "A1" (cell address, column letter, or row number),
      "value": (for values),
      "formula": "=SUM(A1:A10)" (for formulas, must start with =),
      "range": {"start": "A1", "end": "C10"} (for range operations),
      "values": [[row1], [row2]] (for fillRange with data),
      "cells": {"A1": value, "B1": value} (for setRange with individual cells)
    }
  ]
}

Example response:
"I'll set cell A1 to 100 for you.
[Include JSON code block here with: {"actions": [{"type": "setCellValue", "target": "A1", "value": 100}]}]"

**Error Handling:**
- If formula won't work → suggest proven alternative BEFORE attempting
- If operation not supported → list 2-3 workarounds user can choose from
- If unsure → try using only supported operations, explain what you're attempting

**User Satisfaction Strategy:**
- DON'T say "I can't" without offering alternatives
- DO try creative combinations of supported features
- DO learn from user feedback
- DO explain trade-offs between approaches`;
}

/**
 * Build context-aware prompt for specific user query
 */
export function buildQueryAwarePrompt(options: {
  userQuery: string;
  mode?: 'plan' | 'act';
  retryCount?: number;
  lastError?: string;
}): string {
  const { userQuery, mode = 'act', retryCount = 0, lastError } = options;
  
  // Determine complexity
  const complexity: PromptComplexity = retryCount > 0 ? 'retry' : analyzeQueryComplexity(userQuery);
  
  // Build base prompt
  let prompt = buildEnhancedSystemPrompt({ 
    mode, 
    complexity,
    includeFullCapabilities: retryCount > 1 // Full context on 2nd retry
  });
  
  // Add retry context if applicable
  if (retryCount > 0 && lastError) {
    prompt += `

## 🔄 Retry Context

Previous attempt failed with: ${lastError}

**Recovery Strategy:**
1. Check if failed approach used unsupported features
2. Use ONLY proven supported operations
3. Break complex request into smaller supported steps
4. Explain to user what you're trying differently
`;
  }
  
  return prompt;
}

/**
 * Backwards-compatible wrapper for legacy code
 * @deprecated Use buildEnhancedSystemPrompt or buildQueryAwarePrompt instead
 */
export function getSystemPrompt(mode: 'plan' | 'act' = 'act'): string {
  // Use new capability-aware system with medium complexity
  return buildEnhancedSystemPrompt({ mode, complexity: 'medium' });
}
