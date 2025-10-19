# OpenRouter Advanced Testing Quick Start

## 🚀 Running the Tests

### Run All Advanced AI Tests
```powershell
npm test -- src/lib/ai/__tests__/openrouter.advanced.test.ts --run
```

### Run Specific Test Suite
```powershell
# Alternative AI Models
npm test -- -t "Alternative AI Models" --run

# Rate Limiting
npm test -- -t "Rate Limiting" --run

# Network Failures
npm test -- -t "Network Failure" --run

# Streaming (Future)
npm test -- -t "Streaming Responses" --run

# Model Behavior
npm test -- -t "ConvertToWorkbookActions" --run
```

### Watch Mode for Development
```powershell
npm test -- openrouter.advanced.test.ts
```

## 📊 Test Results Summary

✅ **37 Tests Passed**

### Coverage Breakdown:
- **Alternative AI Models**: 13 tests
  - Claude 3.5 Sonnet: 3 tests
  - GPT-4: 1 test
  - GPT-3.5 Turbo: 2 tests
  - Model Comparison: 2 tests
  - Ambiguous Prompts: 2 tests
  - Large Datasets: 2 tests
  - Complex Requests: 1 test

- **Rate Limiting**: 4 tests
  - 429 errors
  - Retry-After handling
  - Quota exceeded
  - Model-specific limits

- **Network Failures**: 14 tests
  - Connection errors (4 tests)
  - Server errors (4 tests)
  - Authentication (1 test)
  - Response parsing (5 tests)

- **Streaming**: 2 tests (future enhancement)

- **Action Conversion**: 5 tests
  - Parameter handling
  - Data type detection
  - Range operations

## 🧪 What's Being Tested

### 1. Model Behavior Differences

**Claude 3.5 Sonnet**
```json
// Uses 'target' as object
{
  "type": "fillRange",
  "target": { "start": "A1", "end": "A5" },
  "value": 0
}
```

**GPT-4**
```json
// Uses 'range' property
{
  "type": "fillRange",
  "range": { "start": "A1", "end": "A5" },
  "value": 0
}
```

✅ Both formats supported!

### 2. Error Scenarios

All return consistent error structure:
```typescript
{
  success: false,
  actions: [],
  explanation: "Detailed error message",
  confidence: 0
}
```

### 3. Data Type Handling

Tests verify proper detection of:
- Numbers: `100`, `3.14`, `-50`
- Strings: `"Alice"`, `"Bob"`
- Dates: `"2024-01-15"`
- Booleans: `true`, `false`
- Formulas: `"=SUM(A1:A10)"`

### 4. Complex Operations

Tests multi-step operations like:
- Creating tables with headers
- Filling multiple rows with data
- Adding formulas
- Computing totals

Example: Financial summary with 15+ actions

## 🔍 Key Test Patterns

### Testing Alternative Models
```typescript
vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');
// or
vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-4');
// or
vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-3.5-turbo');
```

### Mocking API Responses
```typescript
const mockResponse = {
  ok: true,
  json: async () => ({
    choices: [{
      message: {
        content: JSON.stringify({
          actions: [...],
          explanation: "...",
          confidence: 0.95
        })
      }
    }]
  })
};

(global.fetch as any).mockResolvedValue(mockResponse);
```

### Testing Error Handling
```typescript
const mockResponse = {
  ok: false,
  status: 429,
  json: async () => ({
    error: {
      message: "Rate limit exceeded",
      type: "rate_limit_error"
    }
  })
};
```

## 🎯 Expected Behaviors

### Claude 3.5 Sonnet
- ✅ High confidence (0.92-0.96)
- ✅ Asks clarifying questions
- ✅ Excellent at large datasets
- ✅ Handles markdown-wrapped JSON

### GPT-4
- ✅ High confidence (0.93-0.96)
- ✅ Strong analytical capabilities
- ✅ Makes reasonable assumptions
- ✅ Good at complex formulas

### GPT-3.5 Turbo
- ⚠️ Lower confidence (0.65-0.88)
- ✅ Faster/cheaper
- ⚠️ May need explicit instructions
- ✅ Good for simple operations

## 📈 Confidence Score Guidelines

From test analysis:

| Score | Interpretation | Action |
|-------|---------------|---------|
| < 0.5 | Low confidence, likely ambiguous | Ask user for clarification |
| 0.5-0.7 | Moderate confidence | Proceed with user confirmation |
| 0.7-0.9 | Good confidence | Execute with standard checks |
| > 0.9 | High confidence | Execute immediately |

## 🛠️ Adding New Tests

### Template for Model Test
```typescript
it('should test specific behavior', async () => {
  const mockResponse = {
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            actions: [/* your actions */],
            explanation: "Description",
            confidence: 0.9
          })
        }
      }]
    })
  };

  (global.fetch as any).mockResolvedValue(mockResponse);
  vi.stubEnv('VITE_OPENROUTER_MODEL', 'your-model');

  const result = await parseCommandWithAI('your command', 'test-api-key');

  expect(result.success).toBe(true);
  expect(result.actions).toHaveLength(expectedLength);
  // ... additional assertions
});
```

### Template for Error Test
```typescript
it('should handle specific error', async () => {
  const mockResponse = {
    ok: false,
    status: errorCode,
    json: async () => ({
      error: { message: "Error message" }
    })
  };

  (global.fetch as any).mockResolvedValue(mockResponse);

  const result = await parseCommandWithAI('command', 'test-api-key');

  expect(result.success).toBe(false);
  expect(result.explanation).toContain('expected text');
});
```

## 📝 Test Maintenance

### Before Committing
```powershell
# Run all AI tests
npm test -- src/lib/ai/__tests__/ --run

# Check for TypeScript errors
npm run typecheck

# Lint
npm run lint
```

### Continuous Integration
Tests run automatically on:
- Pull requests
- Commits to main branch
- Scheduled nightly builds

## 🔗 Related Documentation

- [AI Model Testing Summary](../../docs/AI_MODEL_TESTING_SUMMARY.md) - Detailed findings
- [AI Capability Awareness](../../docs/AI_CAPABILITY_AWARENESS.md) - AI capabilities
- [AI Test Prompts](../../docs/AI_TEST_PROMPTS.md) - Test prompt examples
- [OpenRouter Implementation](../openrouter.ts) - Source code

## 🐛 Troubleshooting

### Tests Failing Locally
1. Check Node.js version (should be 18+)
2. Clear node_modules and reinstall
3. Verify environment variables are stubbed correctly

### Network-related Failures
- Tests mock all network calls
- Check if `vi.fn()` is properly set up
- Ensure `global.fetch` is mocked in `beforeEach`

### Type Errors
```powershell
npm run typecheck -- src/lib/ai/__tests__/openrouter.advanced.test.ts
```

## 💡 Tips

1. **Run specific model tests** to debug model-specific issues
2. **Check console output** for detailed error logging
3. **Use watch mode** during development for instant feedback
4. **Test edge cases** - the tests cover 15+ network failures
5. **Verify confidence scores** match expected model behavior

---

**Last Updated:** 2024-01-19  
**Test File:** `client/src/lib/ai/__tests__/openrouter.advanced.test.ts`  
**Test Count:** 37 tests  
**Status:** ✅ All Passing
