# Code Consolidation Report

**Date**: 2025-10-19  
**Issue**: Duplicate/overlapping system prompt files

---

## 🔍 Findings

### Duplicate Files Found

| File | Size | Status | Used By |
|------|------|--------|---------|
| `systemPrompt.ts` | 352 lines | ✅ **ACTIVE** | `MainLayout.tsx`, `ChatSidebarWrapper.tsx`, tests |
| `system-prompts.ts` | 882 lines | ❌ **UNUSED** | None - orphaned file |
| `enhancedPrompt.ts` | 200 lines | ✅ **NEW** | `aiService.ts` (capability-aware) |

---

## 📊 Analysis

### `systemPrompt.ts` (ACTIVE - Legacy)
- **Purpose**: Basic system prompt without capability awareness
- **Function**: `getSystemPrompt(mode: 'plan' | 'act')`
- **Content**: General AI instructions, no knowledge of supported/unsupported features
- **Used by**: 
  - `MainLayout.tsx` (line 18)
  - `ChatSidebarWrapper.tsx` (line 4)
  - `aiService.test.ts` (line 8)

### `system-prompts.ts` (UNUSED - Orphaned)
- **Purpose**: Appears to be an earlier comprehensive prompt system
- **Function**: `getSystemPrompt(options)`, `WORKBOOK_SYSTEM_PROMPT`
- **Content**: 882 lines of detailed workbook capabilities
- **Used by**: **NOBODY** ❌
- **Status**: Dead code, should be deleted

### `enhancedPrompt.ts` (NEW - Capability-Aware)
- **Purpose**: Smart prompt builder with tiered context
- **Function**: `buildQueryAwarePrompt()`, `buildEnhancedSystemPrompt()`
- **Content**: Capability-aware, uses `capabilities.ts` registry
- **Used by**:
  - `aiService.ts` (line 8) - NEW integration
  - `capabilities.test.ts` (line 21) - tests
- **Status**: Currently used ONLY in `aiService.chatWithAI()` when no custom prompt provided

---

## ⚠️ Conflict Risk

### Current State
```typescript
// MainLayout.tsx & ChatSidebarWrapper.tsx
import { getSystemPrompt } from '@/lib/ai/systemPrompt';  // OLD
const prompt = getSystemPrompt('act');
await chatWithAI(message, history, prompt);

// aiService.ts (internally)
if (!systemPrompt) {
  // Uses NEW enhancedPrompt
  systemMessage = buildQueryAwarePrompt({...});
}
```

**Problem**: Components pass OLD prompt, so NEW capability system is bypassed!

---

## ✅ Recommended Consolidation

### Step 1: Delete Orphaned File
```powershell
Remove-Item client/src/lib/ai/system-prompts.ts
```
**Impact**: None - file is not imported anywhere

### Step 2: Merge systemPrompt.ts into enhancedPrompt.ts

**Rationale**:
- `enhancedPrompt.ts` already has `getBasePrompt()` which does same thing
- No need for two separate files
- Consolidate all prompt logic in one place

**Migration**:
1. Copy good content from `systemPrompt.ts` into `enhancedPrompt.ts`
2. Export `getSystemPrompt()` from `enhancedPrompt.ts` for backwards compatibility
3. Update imports in `MainLayout.tsx`, `ChatSidebarWrapper.tsx`, tests
4. Delete `systemPrompt.ts`

### Step 3: Update Component Usage

**Option A: Keep Backwards Compatible** (Recommended)
```typescript
// enhancedPrompt.ts
export function getSystemPrompt(mode: 'plan' | 'act' = 'act'): string {
  // Wrapper that uses new system with capability awareness
  return buildEnhancedSystemPrompt({ mode, complexity: 'medium' });
}
```

**Option B: Direct Migration**
```typescript
// Components change to:
import { buildQueryAwarePrompt } from '@/lib/ai/enhancedPrompt';
const prompt = buildQueryAwarePrompt({ userQuery: message, mode: 'act' });
```

---

## 📋 Consolidation Steps

### Phase 1: Cleanup Orphaned Code (Safe)
- [x] Identify `system-prompts.ts` is unused
- [ ] Delete `client/src/lib/ai/system-prompts.ts`
- [ ] Verify no breakage with: `npm run build`

### Phase 2: Consolidate systemPrompt.ts (Moderate)
- [ ] Add `getSystemPrompt()` export to `enhancedPrompt.ts`
- [ ] Update imports in:
  - [ ] `MainLayout.tsx`
  - [ ] `ChatSidebarWrapper.tsx`
  - [ ] `aiService.test.ts`
- [ ] Run tests: `npm test`
- [ ] Delete `systemPrompt.ts`

### Phase 3: Optimize Component Usage (Future)
- [ ] Update components to use `buildQueryAwarePrompt()` directly
- [ ] Remove backwards-compatible wrapper
- [ ] Full capability awareness in all components

---

## 🎯 Expected Benefits

1. **Less Confusion**: One source of truth for prompts
2. **Smaller Bundle**: ~900 lines of dead code removed
3. **Better AI**: All components use capability-aware prompts
4. **Easier Maintenance**: Update prompts in one place
5. **Consistent Behavior**: Same prompt system everywhere

---

## ⚡ Quick Action Plan

**Immediate (5 minutes)**:
```powershell
# Delete orphaned file
Remove-Item client/src/lib/ai/system-prompts.ts
```

**Short-term (30 minutes)**:
- Consolidate `systemPrompt.ts` → `enhancedPrompt.ts`
- Update 3 import statements
- Run tests

**Long-term (future)**:
- Deprecate `getSystemPrompt()` wrapper
- Use `buildQueryAwarePrompt()` everywhere
- Document single source of truth

---

## 🚨 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking imports | Low | High | Update all 3 usages, run tests |
| Prompt behavior change | Medium | Low | Keep backwards-compatible wrapper |
| Test failures | Low | Medium | Run full test suite before commit |
| Component confusion | Low | Low | Clear migration docs |

---

## ✅ Validation Checklist

After consolidation:
- [ ] `npm run build` succeeds
- [ ] `npm test` all pass
- [ ] No TypeScript errors
- [ ] No orphaned imports
- [ ] Components work identically
- [ ] AI responses unchanged (for now)

---

## 📝 Implementation Ready

Would you like me to proceed with the consolidation?
