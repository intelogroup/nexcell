import { config } from '../config/index.js'
import { Operation, OperationsSchema } from '../types/operations.js'
import { z } from 'zod'

// WorkbookData type (matching what's stored in DB)
export interface WorkbookData {
  sheets: Array<{
    name: string
    cells: Record<string, { value: any; formula?: string }>
    formats?: Record<string, any>
  }>
  metadata?: {
    activeSheet?: string
    theme?: string
  }
}

// Build a compact representation of workbook for AI context
function buildWorkbookContext(data: WorkbookData): string {
  const context: string[] = []
  
  context.push('=== WORKBOOK STRUCTURE ===')
  context.push(`Sheets: ${data.sheets.map(s => s.name).join(', ')}`)
  context.push('')
  
  for (const sheet of data.sheets) {
    context.push(`--- Sheet: ${sheet.name} ---`)
    
    const cellEntries = Object.entries(sheet.cells)
    
    if (cellEntries.length === 0) {
      context.push('(empty sheet)')
      context.push('')
      continue
    }
    
    // Show first 50 cells as sample
    const sampleSize = Math.min(50, cellEntries.length)
    const sample = cellEntries.slice(0, sampleSize)
    
    for (const [cellRef, cellData] of sample) {
      const displayValue = cellData.formula 
        ? `=${cellData.formula} (evaluates to: ${cellData.value})` 
        : cellData.value
      context.push(`  ${cellRef}: ${displayValue}`)
    }
    
    if (cellEntries.length > sampleSize) {
      context.push(`  ... and ${cellEntries.length - sampleSize} more cells`)
    }
    
    context.push('')
  }
  
  return context.join('\n')
}

// Build the system prompt for OpenRouter
function buildSystemPrompt(): string {
  return `You are a spreadsheet operations expert. Your job is to generate precise spreadsheet operations based on user instructions.

AVAILABLE OPERATIONS:
1. set_cell - Set a single cell value or formula
   Examples (CORRECT):
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A1", "value": "Hello" }
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A2", "value": 42 }
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A3", "value": true }
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A4", "value": null }
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A5", "formula": "=SUM(A1:A10)" }
   
   WRONG - DO NOT DO THIS:
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A1", "value": ["item1", "item2"] }  ❌ ARRAYS NOT ALLOWED
   { "kind": "set_cell", "sheet": "Sheet1", "cell": "A1", "value": {"nested": "object"} }  ❌ OBJECTS NOT ALLOWED
   
   CRITICAL: The "value" field MUST be one of: string, number, boolean, or null. NEVER an array or object!
   If you need to set multiple cells, use MULTIPLE set_cell operations, one for each cell.

2. fill_range - Fill a range with a value, formula, or pattern
   Examples (CORRECT):
   { "kind": "fill_range", "sheet": "Sheet1", "range": "A1:B10", "value": 0 }
   { "kind": "fill_range", "sheet": "Sheet1", "range": "C1:C10", "formula": "=A{row}*2" }
   
   WRONG - DO NOT DO THIS:
   { "kind": "fill_range", "sheet": "Sheet1", "range": "A1:A5", "value": [1, 2, 3, 4, 5] }  ❌ ARRAYS NOT ALLOWED
   
   CRITICAL: The "value" field MUST be one of: string, number, boolean, or null. NEVER an array or object!
   Fill range applies the SAME value/formula to ALL cells in the range.
   
3. insert_rows - Insert rows before a position
   { kind: "insert_rows", sheet: "Sheet1", before: 5, count: 3 }

4. insert_cols - Insert columns before a position (A=1, B=2, etc)
   { kind: "insert_cols", sheet: "Sheet1", before: 2, count: 2 }

5. delete_rows - Delete rows starting at a position
   { kind: "delete_rows", sheet: "Sheet1", start: 5, count: 2 }

6. delete_cols - Delete columns starting at a position
   { kind: "delete_cols", sheet: "Sheet1", start: 3, count: 1 }

7. add_sheet - Add a new sheet
   { kind: "add_sheet", name: "NewSheet" }

8. rename_sheet - Rename a sheet
   { kind: "rename_sheet", oldName: "Sheet1", newName: "Data" }

9. delete_sheet - Delete a sheet
   { kind: "delete_sheet", name: "Sheet2" }

10. format_range - Apply formatting to a range
    { kind: "format_range", sheet: "Sheet1", range: "A1:B10", format: { bold: true, color: "#FF0000" } }

CELL REFERENCES:
- Use A1 notation (e.g., "A1", "B5", "AA100")
- Ranges are expressed as "A1:B10"
- Formulas can reference cells like "SUM(A1:A10)" or "A1*2"

IMPORTANT RULES:
1. Generate operations in logical order (e.g., add sheet before adding data to it)
2. Use existing sheet names from the workbook context
3. Be precise with cell references and ranges
4. For fill_range with formulas, use {row} and {col} placeholders if needed
5. Always respond with valid JSON containing an array of operations
6. Include a "reasoning" field explaining your approach
7. Include a "warnings" array for any potential issues
8. **CRITICAL**: Cell values must be SCALAR types only (string, number, boolean, null) - NEVER arrays or objects
9. Formulas must start with "=" (e.g., "=SUM(A1:A10)", not "SUM(A1:A10)")
10. If you need to set multiple values, use multiple set_cell operations or fill_range, NOT arrays

EXAMPLES OF SETTING MULTIPLE VALUES:
If user asks to "add items: Apple, Banana, Orange to column A":
✅ CORRECT:
[
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A1", "value": "Apple" },
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A2", "value": "Banana" },
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A3", "value": "Orange" }
]

❌ WRONG (will cause validation error):
[
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A1", "value": ["Apple", "Banana", "Orange"] }
]

RESPONSE FORMAT:
{
  "operations": [...array of operations...],
  "reasoning": "explanation of the plan",
  "warnings": ["any warnings or caveats"]
}

Be concise but thorough. Focus on accuracy.`
}

// Conversation message interface
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
}

// Build the user prompt with optional conversation history
function buildUserPrompt(workbookContext: string, instructions: string, conversationHistory?: ConversationMessage[]): string {
  let prompt = `CURRENT WORKBOOK STATE:
${workbookContext}

`

  // Add conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `CONVERSATION HISTORY:\n`
    for (const msg of conversationHistory) {
      prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`
    }
    prompt += '\n'
  }

  prompt += `USER INSTRUCTIONS:
${instructions}

Please generate the operations needed to fulfill these instructions. Respond with JSON only.`

  return prompt
}

// OpenRouter API response type
interface OpenRouterResponse {
  id: string
  model: string
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// AI Plan result
export interface AiPlanResult {
  operations: Operation[]
  reasoning: string
  warnings: string[]
  estimatedChanges: number
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// Call OpenRouter API
async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!config.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nexcell.app', // Required by OpenRouter
      'X-Title': 'Nexcell AI Spreadsheet Assistant', // Optional
    },
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: config.OPENROUTER_MAX_TOKENS,
      temperature: 0.2, // Low temperature for more consistent output
      response_format: { type: 'json_object' }, // Request JSON response
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as OpenRouterResponse

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenRouter')
  }

  const content = data.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from OpenRouter')
  }

  return content
}

// Parse and validate AI response
function parseAiResponse(responseText: string): AiPlanResult {
  // Try to parse JSON
  let parsed: any
  try {
    parsed = JSON.parse(responseText)
  } catch (error) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch && jsonMatch[1]) {
      parsed = JSON.parse(jsonMatch[1])
    } else {
      throw new Error('Failed to parse AI response as JSON')
    }
  }

  // Validate structure
  if (!parsed.operations || !Array.isArray(parsed.operations)) {
    throw new Error('AI response missing operations array')
  }

  // Pre-validation check: Look for common issues before Zod validation
  for (let i = 0; i < parsed.operations.length; i++) {
    const op = parsed.operations[i]
    
    // Check if value field contains array or object
    if ('value' in op && op.value != null) {
      if (Array.isArray(op.value)) {
        throw new Error(
          `Operation ${i} (${op.kind}): Invalid value - arrays are not allowed. ` +
          `Found array: ${JSON.stringify(op.value)}. ` +
          `Use multiple operations instead, one for each cell.`
        )
      }
      if (typeof op.value === 'object') {
        throw new Error(
          `Operation ${i} (${op.kind}): Invalid value - objects are not allowed. ` +
          `Found object: ${JSON.stringify(op.value)}. ` +
          `Only scalar values (string, number, boolean, null) are allowed.`
        )
      }
    }
  }

  // Validate each operation with Zod
  const operations = OperationsSchema.parse(parsed.operations)

  return {
    operations,
    reasoning: parsed.reasoning || 'No reasoning provided',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    estimatedChanges: operations.length,
  }
}

// Main function to generate AI plan
export async function generateAiPlan(
  workbookData: WorkbookData,
  instructions: string,
  options: {
    maxRetries?: number
    conversationHistory?: ConversationMessage[]
  } = {}
): Promise<AiPlanResult> {
  const { maxRetries = 2, conversationHistory } = options

  // Build context and prompts
  const workbookContext = buildWorkbookContext(workbookData)
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(workbookContext, instructions, conversationHistory)

  let lastError: Error | null = null

  // Retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Call OpenRouter
      const responseText = await callOpenRouter(systemPrompt, userPrompt)

      // Parse and validate
      const result = parseAiResponse(responseText)

      return result
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on configuration errors
      if (error instanceof Error && error.message.includes('not configured')) {
        throw error
      }

      // Don't retry on validation errors (AI gave us bad format)
      if (error instanceof z.ZodError) {
        // Format error message for better user experience
        const errorDetails = error.errors.map(err => {
          const path = err.path.join('.')
          return `Operation ${path}: ${err.message}`
        }).join('; ')
        
        throw new Error(
          `AI generated invalid operations. ` +
          `Common issue: The AI tried to use arrays or objects in cell values, ` +
          `but only scalar values (string, number, boolean, null) are allowed. ` +
          `Details: ${errorDetails}`
        )
      }

      // Log and retry
      console.error(`AI generation attempt ${attempt + 1} failed:`, error)

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }

  throw new Error(`Failed to generate AI plan after ${maxRetries + 1} attempts: ${lastError?.message}`)
}

// Export service object
export const aiService = {
  generateAiPlan,
}
