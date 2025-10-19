# AI Capability Awareness System

**Status**: ✅ Implemented  
**Date**: 2025-10-19  
**Version**: 1.0.0

---

## Overview

The AI Capability Awareness System ensures Nexcell AI:
1. **Fails fast** on known unsupported features (no wasted API calls)
2. **Tries creatively** with supported building blocks
3. **Warns before experimenting** with untested features
4. **Always provides alternatives** when features aren't available

## Key Principle

> "Use working ingredients to create new solutions. Avoid known failures. Try unknowns with user consent."

---

## Architecture

### 1. Capabilities Registry (`capabilities.ts`)

Defines three categories of features:

#### ✅ Supported & Battle-Tested
- Formulas: SUM, AVERAGE, VLOOKUP, IF, SUMIFS, etc. (50+ functions)
- Operations: setCellValue, setCellFormula, fillRange, clearRange
- **Source**: Test suites, production usage

#### ❌ Known Unsupported (Fail Fast)
- Formulas: SORT, UNIQUE, SEQUENCE, AVERAGEIFS, IRR, PERCENTILE
- Operations: pivotTable, chart, conditionalFormatting, macros
- **Source**: `HYPERFORMULA_UNSUPPORTED_FUNCTIONS.md`

#### ⚠️ Experimental (Try with Consent)
- Formulas: XLOOKUP, NPER, RATE (might work, not tested)
- Operations: setStyle, insertRow, insertColumn (partial support)

### 2. Unsupported Detector (`unsupportedDetector.ts`)

**Pre-filters** user requests BEFORE API calls:

```typescript
// Example: User asks "create a pivot table"
const detection = detectUnsupportedRequest("create a pivot table");
// Returns instant response with alternatives, NO API CALL
```

**Benefits**:
- 🚀 Instant responses for known limitations
- 💰 Saves API tokens
- 📊 Tracks what users want (feature prioritization)

### 3. Enhanced Prompt Builder (`enhancedPrompt.ts`)

**Tiered context injection** based on query complexity:

| Complexity | Context Sent | Token Cost | Use Case |
|------------|--------------|------------|----------|
| Simple | Base prompt only | ~200 | "set A1 to 100" |
| Medium | + Capabilities summary | ~500 | "use VLOOKUP formula" |
| Complex | + Full capabilities | ~1000 | Complex multi-step requests |
| Retry | + Error context + Full caps | ~1200 | After failure, retry with full knowledge |

### 4. Enhanced AI Service (`aiService.ts`)

**Workflow**:

```
User Message
    ↓
1. Pre-check unsupported features (instant, no API)
    ↓ (if supported or unknown)
2. Build capability-aware prompt
    ↓
3. Call AI with context
    ↓
4. AI uses knowledge to avoid failures & suggest alternatives
```

---

## User Experience Examples

### Example 1: Known Unsupported Formula

**User**: "use SORT function to sort my data"

**AI Response** (instant, no API call):
```
❌ The SORT function isn't supported yet. Here's what works:

✅ I can add a helper column with row numbers for manual sorting
✅ Pre-sort your data in Excel/Sheets, then paste it here
✅ For finding max/min values, I can use MAX/MIN functions

Which approach works for your use case?
```

**Token Cost**: 0 ✅

---

### Example 2: Experimental Formula

**User**: "use XLOOKUP to find values"

**AI Response** (with capability context):
```
⚠️ XLOOKUP isn't tested yet in our formula engine. I can:

Option 1: Try XLOOKUP (experimental - might return #NAME?)
Option 2: Use proven VLOOKUP instead (100% reliable)
Option 3: Use INDEX/MATCH combination (also proven)

Which would you prefer? VLOOKUP is safest for most cases.
```

**Token Cost**: ~500 (worth it for smart guidance)

---

### Example 3: Creative Workaround

**User**: "calculate average of sales where region is North and amount > 100"

**AI knows**: AVERAGEIFS not supported  
**AI does**: Uses working formulas creatively

**AI Response**:
```
I'll set that up using SUMIFS and COUNTIFS (since AVERAGEIFS isn't supported):

Formula: =SUMIFS(Sales, Region, "North", Amount, ">100") / COUNTIFS(Region, "North", Amount, ">100")

This gives the same result! Shall I add it to cell D1?
```

**Result**: User gets what they need using supported building blocks ✅

---

## Analytics & Learning

### Feature Request Tracking

Unsupported requests are logged locally:

```typescript
// localStorage: nexcell_unsupported_requests
{
  "SORT": {
    "type": "formula",
    "count": 15,
    "lastQuery": "sort my data by column A",
    "lastSeen": "2025-10-19T..."
  },
  "pivotTable": {
    "type": "operation",
    "count": 8,
    "lastQuery": "create a pivot table",
    "lastSeen": "2025-10-19T..."
  }
}
```

**Use**: Prioritize what features to build next based on real demand

---

## Benefits

### 1. Higher Success Rate
- ✅ AI avoids known failures
- ✅ Suggests working alternatives immediately
- ✅ Tries creative combinations of proven features

### 2. Better Token Efficiency
- ✅ Instant responses for known limitations (0 tokens)
- ✅ Tiered context (only send what's needed)
- ✅ No wasted API calls on impossible requests

### 3. User Satisfaction
- ✅ Always get helpful response (not just "I can't")
- ✅ Learn about workarounds
- ✅ Understand what's possible
- ✅ Fast responses

### 4. Continuous Learning
- ✅ Track what users actually want
- ✅ Prioritize feature development
- ✅ Improve AI over time

---

## Maintenance

### Updating Capabilities

When HyperFormula updates or you test new features:

1. **Add to supported**: Update `SUPPORTED_FORMULAS` in `capabilities.ts`
2. **Remove from unsupported**: Remove from `KNOWN_UNSUPPORTED_FORMULAS`
3. **Update docs**: Sync with `HYPERFORMULA_UNSUPPORTED_FUNCTIONS.md`
4. **Re-run tests**: Verify formula works as expected

### Monitoring

Check unsupported request stats:

```typescript
import { getUnsupportedRequestStats } from '@/lib/ai/unsupportedDetector';

const stats = getUnsupportedRequestStats();
console.log('Most requested unsupported features:', stats);
```

---

## Future Enhancements

1. **Auto-sync**: Parse `HYPERFORMULA_UNSUPPORTED_FUNCTIONS.md` automatically
2. **Version detection**: Check HyperFormula version, adapt capabilities
3. **A/B testing**: Test experimental features with subset of users
4. **Feedback loop**: Let users report when suggestions work/don't work
5. **Smart caching**: Remember successful workarounds per user

---

## Testing

See `src/lib/ai/__tests__/capabilities.test.ts` for:
- Detection accuracy tests
- Prompt building tests  
- Integration tests with AI service

---

## References

- **Unsupported Functions**: `HYPERFORMULA_UNSUPPORTED_FUNCTIONS.md`
- **HyperFormula Docs**: https://hyperformula.handsontable.com/
- **Test Suites**: `client/src/lib/workbook/__tests__/`
