# AI Context Awareness & Error Detection System

This document describes the enhanced AI system in Nexcell that provides complete workbook context awareness and proactive error detection.

## Overview

The AI assistant has been upgraded to be a "master of the workbook context" with the ability to:

1. **Maintain complete awareness** of spreadsheet structure, formulas, dependencies, and data patterns
2. **Understand user intent** and convert it into precise spreadsheet operations
3. **Proactively detect and prevent** computational errors before they occur
4. **Notify users** about potential issues with clear explanations and suggestions

## Architecture

### Core Components

#### 1. Workbook Context Provider (`client/src/lib/ai/workbookContext.ts`)

Extracts comprehensive context from workbooks including:

- **Sheet Structure**: Number of sheets, cell counts, data ranges
- **Formula Intelligence**: All formulas with their dependencies and computed values
- **Named Ranges**: Workbook and sheet-level named ranges with validation
- **Error Detection**: Proactive detection of potential computational issues
- **Data Statistics**: Cell types, formula counts, error counts
- **Circular References**: Detection and severity assessment

**Key Functions:**

```typescript
// Extract full workbook context
extractWorkbookContext(workbook: WorkbookJSON, activeSheetId?: string): Promise<WorkbookContext>

// Format context for AI consumption
formatContextForAI(context: WorkbookContext): string

// Get concise summary
getContextSummary(context: WorkbookContext): string
```

#### 2. Enhanced System Prompt (`client/src/lib/ai/systemPrompt.ts`)

The AI system prompt has been enhanced with:

- **Context Mastery** instructions
- **Error Prevention** guidelines with severity levels
- **Notification Formats** for different error types
- **Best Practices** for formula construction

**Error Severity Levels:**

- **Critical** (Must Warn):
  - Circular references
  - Division by zero
  - Invalid cell references
  - Missing named ranges
  - Type mismatches

- **Warning** (Should Notify):
  - Volatile functions (NOW, TODAY, RAND, etc.)
  - Complex nested formulas (depth > 5)
  - Performance impacts
  - Potential data loss

#### 3. AI Service (`client/src/lib/ai/aiService.ts`)

Enhanced to:
- Include workbook context in AI requests
- Parse and validate user commands
- Detect potential errors before execution
- Format error notifications

## Error Detection Categories

### 1. Circular References

**Detection**: Analysis of formula dependency graphs
**Severity**: High/Medium/Low based on chain complexity
**Notification**: Full chain of circular dependencies

Example:
```
⚠️ **WARNING**: Circular Reference
- **Location**: Sheet1!A1
- **Issue**: Circular reference: A1 → B1 → C1 → A1
- **Impact**: Formulas will not compute correctly
- **Suggestion**: Break the circular dependency by restructuring formulas
```

### 2. Division by Zero

**Detection**: Pattern matching for division operations with zero denominators
**Severity**: High
**Notification**: Specific cell and suggested fixes

Example:
```
⚠️ **WARNING**: Potential Division by Zero
- **Location**: Cell B5
- **Issue**: Formula =A5/B1 will divide by zero because B1 is currently 0
- **Impact**: This will result in #DIV/0! error
- **Suggestion**: Use =IFERROR(A5/B1, 0) or ensure B1 is not zero
```

### 3. Invalid References

**Detection**: Validation of cell addresses and range references
**Severity**: High
**Notification**: Specific reference and correction suggestion

### 4. Missing Named Ranges

**Detection**: Cross-referencing named range usage with definitions
**Severity**: High
**Notification**: Missing range name and suggested fix

### 5. Volatile Functions

**Detection**: Pattern matching for volatile function usage
**Severity**: Low
**Notification**: Performance warning with alternatives

### 6. Complex Nested Formulas

**Detection**: Dependency depth analysis
**Severity**: Medium (when depth > 5)
**Notification**: Suggestion to break into intermediate cells

## Usage Examples

### Basic Context Extraction

```typescript
import { extractWorkbookContext, formatContextForAI } from '@/lib/ai/workbookContext';

// Extract context
const context = await extractWorkbookContext(workbook, activeSheetId);

// Get formatted context for AI
const contextText = formatContextForAI(context);

// Get concise summary
const summary = getContextSummary(context);
```

### Integrating with AI Service

```typescript
import { chatWithAI } from '@/lib/ai/aiService';
import { getSystemPrompt } from '@/lib/ai/systemPrompt';
import { extractWorkbookContext, formatContextForAI } from '@/lib/ai/workbookContext';

// Extract workbook context
const context = await extractWorkbookContext(workbook);
const contextText = formatContextForAI(context);

// Create system prompt with context
const systemPrompt = `${getSystemPrompt('act')}

## CURRENT WORKBOOK CONTEXT

${contextText}`;

// Chat with AI
const response = await chatWithAI(
  userMessage,
  conversationHistory,
  systemPrompt
);
```

## Workbook Context Structure

```typescript
interface WorkbookContext {
  // Structure
  sheets: SheetSummary[];
  activeSheet: string;
  totalSheets: number;
  
  // Formulas
  formulaCells: FormulaCellInfo[];
  totalFormulas: number;
  formulaDependencies: DependencyInfo[];
  
  // Data
  dataStatistics: DataStatistics;
  namedRanges: NamedRangeInfo[];
  
  // Errors
  potentialErrors: PotentialError[];
  circularReferences: CircularReferenceInfo[];
  validationWarnings: string[];
}
```

## Integration Points

### 1. Chat Interface

The chat interface should:
1. Extract workbook context before each user message
2. Include context in system prompt
3. Display error notifications with proper formatting
4. Allow user to confirm or cancel risky operations

### 2. Formula Bar

The formula bar should:
1. Check for potential errors on formula entry
2. Display warnings before committing changes
3. Suggest alternative formulas when issues detected

### 3. Cell Operations

All cell operations should:
1. Validate against workbook context
2. Check for circular reference creation
3. Warn about impacts on dependent cells
4. Provide undo option for risky operations

## Performance Considerations

### Context Extraction

- **Caching**: Workbook context is cached and invalidated on modifications
- **Incremental Updates**: Only affected portions are re-analyzed
- **Async Processing**: Context extraction is asynchronous to avoid blocking UI

### Error Detection

- **Pattern Matching**: Uses efficient regex patterns for quick detection
- **Dependency Analysis**: Leverages pre-computed dependency graphs
- **Lazy Evaluation**: Complex checks only performed when needed

## Future Enhancements

1. **Machine Learning**: Train models on common error patterns
2. **Auto-Fix**: Suggest and apply automatic fixes for common issues
3. **Performance Profiling**: Detect and warn about slow formulas
4. **Data Validation**: Enhanced type checking and constraint validation
5. **Smart Suggestions**: Context-aware formula completion and suggestions

## Testing

### Unit Tests

Located in `client/src/lib/ai/__tests__/`:
- `workbookContext.test.ts`: Context extraction tests
- `errorDetection.test.ts`: Error detection logic tests

### Integration Tests

Located in `client/src/lib/workbook/__tests__/`:
- Tests for circular reference detection
- Tests for formula dependency analysis
- Tests for validation workflows

## Debugging

Enable detailed logging:

```typescript
// In development, enable context logging
if (import.meta.env.DEV) {
  console.log('Workbook Context:', context);
  console.log('Potential Errors:', context.potentialErrors);
  console.log('Circular References:', context.circularReferences);
}
```

## Best Practices

1. **Always Extract Context**: Before any AI interaction, extract fresh context
2. **Handle Warnings Gracefully**: Allow users to proceed with caution or cancel
3. **Provide Clear Explanations**: Error messages should be actionable
4. **Test Edge Cases**: Verify behavior with complex workbooks
5. **Monitor Performance**: Track context extraction time in production

## Related Documentation

- [Circular Reference Guard](../client/src/lib/workbook/circular-reference-guard.ts)
- [HyperFormula Integration](../client/src/lib/workbook/hyperformula.ts)
- [Workbook Validator](../client/src/lib/workbook/validator.ts)
- [AI Service](../client/src/lib/ai/aiService.ts)
