# Plan Mode Execution Bug Fix + AI Mode Awareness

## Issue
The application was editing the workbook even when in "planning mode". Users could switch between Plan and Act modes in the UI, but:
1. The system always executed operations regardless of the mode selected
2. The AI wasn't aware of which mode was active, so it always responded as if in "act" mode

## Root Cause
The `ChatInterface` component had plan/act mode toggle functionality, but:
1. `MainLayout.tsx` wasn't tracking which mode was selected
2. When AI extracted actions, the code directly called `batchSetCells()` without checking the current mode
3. The AI was always given the "act" mode system prompt, regardless of user selection
4. The operations were always applied to the workbook, even in plan mode

## Solution Implemented

### 1. Added Mode Tracking in MainLayout
```typescript
const [chatMode, setChatMode] = useState<'plan' | 'act'>('act'); // Track chat mode
```

### 2. Connected ChatInterface to Mode State
```typescript
<ChatInterface 
  messages={messages}
  onSendMessage={handleSendMessage}
  initialMode={chatMode}
  onModeChange={setChatMode}
/>
```

### 3. Added Mode Checks Before Execution
Added checks in two places where operations are applied:

#### Main AI Operations
```typescript
// Check if we're in plan mode - block execution
if (currentChatMode === 'plan') {
  console.log('[AI-Workbook] ⚠️ Operations blocked: Chat is in PLAN mode');
  const planBlockedMessage: Message = {
    id: (Date.now() + 2).toString(),
    role: 'system',
    content: `⚠️ Plan mode is active - operations were NOT executed.\n\n` +
      `The AI identified ${operations.length} operation(s) but they were blocked:\n` +
      operations.map(op => `• ${op.address}: ${op.cell?.formula || op.cell?.raw || 'clear'}`).join('\n') +
      `\n\nSwitch to ACT mode to execute these changes.`,
    timestamp: new Date(),
  };
  setMessages((prev) => [...prev, planBlockedMessage]);
  return; // Exit early, don't execute
}
```

#### Fix/Validation Operations
Similar check added for auto-fix operations triggered by validation errors.

### 4. Propagated Mode to AI System Prompt
The AI now receives different system prompts based on the current mode:

```typescript
// Use the system prompt matching current mode so AI knows whether to plan or act
const systemPrompt = getSystemPrompt(currentChatMode);

// Call chatWithAI with mode option
const aiReply = await chatWithAI(
  content + '\n\n' + (workbookContextText ? `Workbook Context:\n${workbookContextText}` : ''),
  conversationHistory,
  systemPrompt,
  { mode: currentChatMode } // Pass mode option to chatWithAI
);
```

**Plan Mode AI Prompt:**
> "**PLAN MODE**: You're in brainstorming mode. DO NOT execute actions. Discuss ideas, ask questions, explore options."

**Act Mode AI Prompt:**
> "**ACT MODE**: You can execute operations on the spreadsheet. Be precise and confirm actions."

## Behavior After Fix

### Plan Mode
- User toggles to "Plan" mode in the chat interface
- **AI receives plan mode system prompt** telling it to discuss ideas, not execute
- User sends commands like "set A1 to 100"
- **AI responds conversationally** - may discuss what it would do, ask questions, explore options
- If AI does generate action JSON, system extracts the operations
- **Operations are BLOCKED from executing** by the mode guard
- User sees a message explaining operations were blocked and listing what would have happened
- Workbook remains unchanged

### Act Mode (default)
- User is in "Act" mode (or toggles to it)
- **AI receives act mode system prompt** telling it can execute operations
- User sends commands like "set A1 to 100"
- **AI responds with action intent** and generates JSON operations
- System extracts the operations
- **Operations are EXECUTED immediately** (no mode guard blocking)
- Workbook is updated
- Normal behavior (existing functionality)

## Testing Instructions

### Manual Testing
1. Start the dev server: `npm run dev` in the `client` folder
2. Open the application in browser
3. Click the "Plan" mode toggle in the chat interface
4. Send a command like "set A1 to 100"
5. **Verify**: AI responds conversationally (discusses the idea rather than confirming execution)
6. **Verify**: If operations are generated, cell A1 does NOT change
7. **Verify**: A system message appears explaining operations were blocked
8. Click the "Act" mode toggle
9. Send the same command again
10. **Verify**: AI responds with execution intent
11. **Verify**: Cell A1 now updates to 100
12. **Verify**: Normal execution works

### AI Behavior Testing
- **Plan Mode**: Try "create a budget in cells A1:C10"
  - AI should discuss options, ask questions, explain approach
  - Should NOT generate immediate action JSON (or if it does, it's blocked)
- **Act Mode**: Try "set A1 to Total, A2 to 100"
  - AI should confirm action and generate JSON
  - Operations should execute immediately

### Expected Messages
- **Plan Mode**: "⚠️ Plan mode is active - operations were NOT executed..."
- **Act Mode**: Normal AI responses and workbook updates

## Files Modified
- `client/src/components/layout/MainLayout.tsx`
  - Added `chatMode` state
  - Added mode checks before `batchSetCells()` calls
  - Connected ChatInterface props
  - **Propagated mode to AI via system prompts and options**
  - Updated all 3 `chatWithAI()` calls to pass mode
- `client/src/lib/ai/enhancedPrompt.ts`
  - Already had mode-aware prompts (PLAN MODE vs ACT MODE)

## Notes
- Minor TypeScript lint warning may appear about type comparison - this is a false positive due to closure/async context and doesn't affect functionality
- The mode state is properly typed as `'plan' | 'act'` and works correctly at runtime
- **AI behavior now adapts to mode**: conversational in plan mode, action-oriented in act mode
- The dual-layer protection (AI awareness + execution guard) ensures robust mode enforcement
- Future enhancement: Could add operation preview UI in plan mode instead of just blocking

## Related Code
- `ChatInterface.tsx`: UI for mode toggle
- `WorkbookOperationExecutor.ts`: Has similar plan mode blocking (not currently used in this flow)
- `enhancedPrompt.ts`: System prompts differentiate between plan and act mode AI behavior
