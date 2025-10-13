# AI Validation Error Fix

## Problem
The AI assistant was generating invalid operations where the `value` field contained arrays instead of scalar values (string, number, boolean, or null). This caused Zod validation errors:

```
Expected string, received array at path [0, "value"]
```

## Root Cause
The AI (OpenRouter) was interpreting instructions to set multiple cell values as a single operation with an array value, when it should have generated multiple separate `set_cell` operations.

Example of WRONG output:
```json
{
  "kind": "set_cell",
  "sheet": "Sheet1",
  "cell": "A1",
  "value": ["Apple", "Banana", "Orange"]  // ❌ Array not allowed
}
```

Example of CORRECT output:
```json
[
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A1", "value": "Apple" },
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A2", "value": "Banana" },
  { "kind": "set_cell", "sheet": "Sheet1", "cell": "A3", "value": "Orange" }
]
```

## Solution

### 1. Enhanced System Prompt (ai.service.ts)
- Added explicit examples showing CORRECT vs WRONG usage
- Added visual indicators (✅ ❌) to emphasize dos and don'ts
- Included a dedicated section showing how to handle multiple values
- Made the scalar-only requirement more prominent with multiple warnings

### 2. Pre-validation Error Detection
Added early detection before Zod validation to catch:
- Array values in operation.value fields
- Object values in operation.value fields

This provides clearer error messages:
```typescript
// Pre-validation check: Look for common issues before Zod validation
for (let i = 0; i < parsed.operations.length; i++) {
  const op = parsed.operations[i]
  
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
```

### 3. Improved Zod Error Formatting
Enhanced error messages when Zod validation fails:
```typescript
if (error instanceof z.ZodError) {
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
```

## Testing
To test the fix:

1. Restart the backend server:
   ```bash
   cd apps/backend
   pnpm dev
   ```

2. Try AI commands that previously failed, such as:
   - "Add the following items to column A: Apple, Banana, Orange"
   - "Create a list of numbers 1-10 in column B"
   - "Fill row 1 with: Name, Age, Email, Phone"

3. The AI should now generate multiple `set_cell` operations instead of a single operation with an array value.

## Benefits
- **Clearer error messages**: Users see exactly what went wrong and why
- **Better AI guidance**: Enhanced system prompt reduces the chance of errors
- **Early detection**: Catches common mistakes before Zod validation
- **User-friendly**: Error messages explain the issue in plain language

## Files Modified
- `apps/backend/src/services/ai.service.ts`
  - Enhanced system prompt with examples
  - Added pre-validation checks
  - Improved error formatting
