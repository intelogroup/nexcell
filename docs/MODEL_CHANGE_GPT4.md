# Model Change: Claude 3.5 Sonnet → GPT-4

## Change Summary
Changed the OpenRouter model from Anthropic Claude 3.5 Sonnet to OpenAI GPT-4.

## Files Modified

### Environment Files
- ✅ `client/.env` - Changed `VITE_OPENROUTER_MODEL` to `openai/gpt-4`
- ✅ `.env` - Changed `OPENROUTER_MODEL` to `openai/gpt-4`
- ✅ `.env.example` - Updated default to `openai/gpt-4`

### Code Files (Default Fallbacks)
- ✅ `client/src/lib/ai/aiService.ts` - Updated fallback model
- ✅ `client/src/lib/ai/openrouter.ts` - Updated fallback model
- ✅ `client/src/lib/ai/operations/operation-generator.ts` - Updated fallback model

## Model Details

### Previous Model
- **Name**: `anthropic/claude-3.5-sonnet`
- **Provider**: Anthropic
- **Context**: 200k tokens
- **Known for**: Excellent reasoning, code generation

### New Model
- **Name**: `openai/gpt-4`
- **Provider**: OpenAI
- **Context**: 8k tokens (standard)
- **Known for**: Strong general capabilities, reliable performance

## Configuration

```env
VITE_OPENROUTER_MODEL=openai/gpt-4
VITE_OPENROUTER_MAX_TOKENS=4096
```

## Alternative GPT-4 Variants Available on OpenRouter

If you need more context or different capabilities:

- `openai/gpt-4-turbo` - 128k context, faster
- `openai/gpt-4-32k` - 32k context
- `openai/gpt-4o` - Optimized version (cheaper, faster)
- `openai/gpt-4o-mini` - Lightweight, cost-effective

To change, update the `VITE_OPENROUTER_MODEL` in `.env` files.

## Testing

Dev server restarted and running with GPT-4:
- URL: http://localhost:5174/
- Model: `openai/gpt-4`
- Max tokens: 4096

## Expected Differences

### Pros
- More consistent structured output
- Potentially better at following JSON format instructions
- Faster response times (depending on load)

### Cons  
- Smaller context window (8k vs 200k)
- May be less creative in problem-solving
- Different "personality" in responses

## Rollback

To switch back to Claude:
```bash
# In client/.env
VITE_OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

Then restart dev server.

## Notes
- All three callsites (`aiService.ts`, `openrouter.ts`, `operation-generator.ts`) now use GPT-4 as fallback
- Environment variables take precedence over code fallbacks
- The plan/act mode awareness works the same with GPT-4
- System prompts are model-agnostic and should work well with both models

## Date
October 19, 2025
