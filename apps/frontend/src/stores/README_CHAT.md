# Chat State Management

This directory contains the state management for the workbook-contextual AI chat feature.

## Overview

The chat state management is built using **Zustand** and provides per-workbook chat context, ensuring each workbook has its own isolated conversation history, actions, and AI context.

## Architecture

### Files

- **`chat.store.ts`** - Main Zustand store for chat state
- **`../types/chat.types.ts`** - TypeScript type definitions
- **`../hooks/useChat.ts`** - Custom React hooks for chat operations

## Core Concepts

### 1. Per-Workbook Chat Context

Each workbook maintains its own chat history:

```typescript
interface WorkbookChat {
  workbookId: string
  messages: ChatMessage[]
  actions: ChatAction[]
  summary?: string
  lastActivity: Date
  hasUnreadMessages?: boolean
}
```

### 2. Chat Messages

Messages follow a standard structure:

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  actionId?: string
  metadata?: {
    tokensUsed?: number
    confidence?: number
    affectedRange?: string
  }
}
```

### 3. Actions

AI-proposed changes are tracked as actions:

```typescript
interface ChatAction {
  id: string
  description: string
  affectedRange: string
  status: 'pending' | 'applied' | 'cancelled'
  timestamp: Date
  preview?: { before: any; after: any }
}
```

### 4. Context Awareness

The chat store maintains context about:
- Current workbook ID
- Selected cell range
- Recent messages
- UI state (collapsed, split view, etc.)

## Usage

### Basic Setup

Sync chat with workbook in your main layout:

```tsx
import { useSyncChatWithWorkbook, useSyncSelectedRange } from '@/hooks/useChat'

function WorkbookLayout() {
  // Auto-sync chat context with active workbook
  useSyncChatWithWorkbook()
  useSyncSelectedRange()
  
  return <>{/* Your layout */}</>
}
```

### Sending Messages

```tsx
import { useSendMessage } from '@/hooks/useChat'

function ChatInput() {
  const sendMessage = useSendMessage()
  
  const handleSend = (message: string) => {
    sendMessage(message)
  }
}
```

### Displaying Messages

```tsx
import { useChatMessages } from '@/stores/chat.store'

function ChatHistory() {
  const messages = useChatMessages()
  
  return (
    <div>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
```

### Managing Actions

```tsx
import { useApplyAction, useCancelAction } from '@/hooks/useChat'
import { usePendingActions } from '@/stores/chat.store'

function ActionCard({ action }) {
  const applyAction = useApplyAction()
  const cancelAction = useCancelAction()
  
  return (
    <div>
      <p>{action.description}</p>
      <button onClick={() => applyAction(action)}>Apply</button>
      <button onClick={() => cancelAction(action)}>Cancel</button>
    </div>
  )
}
```

### UI State Management

```tsx
import { useChatStore } from '@/stores/chat.store'

function ChatPanel() {
  const uiState = useChatStore((state) => state.uiState)
  const toggleChatCollapsed = useChatStore((state) => state.toggleChatCollapsed)
  
  return (
    <div className={uiState.isCollapsed ? 'collapsed' : 'expanded'}>
      <button onClick={toggleChatCollapsed}>Toggle</button>
    </div>
  )
}
```

## Persistence

The chat store uses Zustand's `persist` middleware to save chat history to localStorage:

```typescript
persist(
  (set, get) => ({ /* store */ }),
  {
    name: 'chat-store',
    partialize: (state) => ({
      chatsByWorkbook: state.chatsByWorkbook, // Only persist chat data
    }),
  }
)
```

## API Integration (TODO)

The chat hooks include placeholders for API integration:

```typescript
// In useSendMessage hook
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: content, context }),
})
```

### Backend Endpoints Needed

- `POST /api/workbooks/:id/chat` - Send message, get AI response
- `GET /api/workbooks/:id/chat/history` - Load chat history
- `POST /api/workbooks/:id/chat/actions` - Apply action
- `GET /api/workbooks/:id/chat/actions` - Get action history

## Features

### ✅ Implemented
- Per-workbook chat history
- Message management (add, clear)
- Action management (add, update status)
- Context tracking (selected range, current workbook)
- UI state management
- Persistence to localStorage
- Unread message indicators
- Export chat as JSON

### 🚧 Pending
- API integration for AI responses
- Action application logic
- PDF export
- Chat summarization for long histories
- Advanced context gathering (visible cells, formulas)

## Best Practices

1. **Always sync chat context** - Use `useSyncChatWithWorkbook()` in your main layout
2. **Check for current workbook** - Most chat operations require a current workbook ID
3. **Handle loading states** - Use `useIsProcessing()` to show loading indicators
4. **Provide feedback** - Add system messages for action results
5. **Confirm destructive actions** - Use confirm dialogs for clearing history

## Example: Complete Chat Component

```tsx
import { useSyncChatWithWorkbook, useSendMessage } from '@/hooks/useChat'
import { useChatMessages, useIsProcessing } from '@/stores/chat.store'

export function ChatPanel() {
  // Sync context
  useSyncChatWithWorkbook()
  
  // Get state
  const messages = useChatMessages()
  const isProcessing = useIsProcessing()
  const sendMessage = useSendMessage()
  
  const [input, setInput] = useState('')
  
  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input)
      setInput('')
    }
  }
  
  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isProcessing && <LoadingIndicator />}
      </div>
      
      <div className="input">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} disabled={isProcessing}>
          Send
        </button>
      </div>
    </div>
  )
}
```

## Testing

Test utilities are provided for mock data:

```typescript
// Test setup
import { useChatStore } from '@/stores/chat.store'

const { addMessage, addAction } = useChatStore.getState()

// Add test messages
addMessage('workbook-1', {
  role: 'user',
  content: 'Create a budget table',
})

addMessage('workbook-1', {
  role: 'assistant',
  content: 'Created a budget table with 5 columns.',
})
```

## Performance Considerations

- Messages are stored per-workbook (not global)
- Only recent messages (last 10) are sent to AI for context
- Old messages can be summarized to reduce context window
- localStorage is used for fast access (consider IndexedDB for larger histories)

## Next Steps

1. Integrate with AI API endpoint
2. Implement action application logic
3. Add chat summarization for long histories
4. Create backend API endpoints
5. Add tests for hooks and store
