# MessageBubble Component - Feature Guide

## Overview

The `MessageBubble` component is a fully-featured chat message display component with Cursor-style design, supporting user messages, AI responses, and system notifications.

## Features

### ✨ Core Features

1. **Three Message Types**
   - **User Messages**: Right-aligned, blue background with message icon
   - **AI Messages**: Left-aligned, gray background with gradient avatar
   - **System Messages**: Centered, compact pills with optional error styling

2. **Interactive Copy Button**
   - Hover over any message to reveal copy button
   - One-click clipboard copy
   - Visual feedback with checkmark on success
   - Auto-hides after 2 seconds

3. **Markdown-Style Formatting**
   - **Bold**: `**text**` or `__text__`
   - **Italic**: `*text*` or `_text_`
   - **Inline Code**: `` `code` ``
   - Auto-formatted in AI responses

4. **Link Detection**
   - Automatically detects URLs in messages
   - Converts to clickable links
   - Opens in new tab with security attributes

5. **Metadata Badges**
   - **Confidence Score**: Shows AI confidence (0-100%)
   - **Affected Range**: Displays cell range being modified
   - **Token Count**: Shows tokens used in response
   - **Model Name**: Displays AI model used

6. **Smooth Animations**
   - Fade-in animation on message appear
   - Hover effects with shadow transitions
   - Copy button fade in/out
   - Smooth badge transitions

7. **Error Handling**
   - Special styling for system errors
   - Red alert icon and background
   - Clear visual distinction from normal messages

## Usage Examples

### Basic Usage

```tsx
import { MessageBubble } from '@/components/chat'

function ChatHistory() {
  const messages = useChatMessages()
  
  return (
    <div>
      {messages.map((message) => (
        <MessageBubble 
          key={message.id} 
          message={message}
          onCopy={(content) => console.log('Copied:', content)}
        />
      ))}
    </div>
  )
}
```

### User Message

```tsx
const userMessage: ChatMessage = {
  id: '1',
  role: 'user',
  content: 'Create a budget table with 5 columns',
  timestamp: new Date(),
}

<MessageBubble message={userMessage} />
```

**Result**: Right-aligned blue bubble with message icon and timestamp.

### AI Message with Metadata

```tsx
const aiMessage: ChatMessage = {
  id: '2',
  role: 'assistant',
  content: 'I created a budget table with columns for **Category**, **Amount**, **Date**, **Notes**, and **Status**.',
  timestamp: new Date(),
  metadata: {
    confidence: 0.95,
    affectedRange: 'A1:E1',
    tokensUsed: 150,
    model: 'gpt-4',
  },
}

<MessageBubble message={aiMessage} />
```

**Result**: Left-aligned gray bubble with:
- Nexcel avatar (purple-pink gradient)
- Formatted text (bold for column names)
- Confidence badge: "95% ⚡"
- Range badge: "📍 A1:E1"
- Token badge: "🔤 150 tokens"
- Model badge: "🤖 gpt-4"

### System Message (Success)

```tsx
const systemMessage: ChatMessage = {
  id: '3',
  role: 'system',
  content: 'Applied changes successfully',
  timestamp: new Date(),
}

<MessageBubble message={systemMessage} />
```

**Result**: Centered gray pill with success text.

### System Message (Error)

```tsx
const errorMessage: ChatMessage = {
  id: '4',
  role: 'system',
  content: 'Failed to apply changes: Invalid range',
  timestamp: new Date(),
  metadata: {
    error: 'Invalid range',
  },
}

<MessageBubble message={errorMessage} />
```

**Result**: Centered red pill with alert icon.

### Message with Links

```tsx
const messageWithLink: ChatMessage = {
  id: '5',
  role: 'assistant',
  content: 'Check the documentation at https://nexcel.docs for more info.',
  timestamp: new Date(),
}

<MessageBubble message={messageWithLink} />
```

**Result**: AI message with clickable blue link.

### Message with Inline Code

```tsx
const codeMessage: ChatMessage = {
  id: '6',
  role: 'assistant',
  content: 'Use the formula `=SUM(A1:A10)` to calculate the total.',
  timestamp: new Date(),
}

<MessageBubble message={codeMessage} />
```

**Result**: AI message with code formatted in monospace font with gray background.

## Styling Guide

### Color Scheme

- **User Messages**: `bg-blue-500` (primary blue)
- **AI Messages**: `bg-gray-100` (light gray) / `dark:bg-gray-800`
- **AI Avatar**: `from-purple-500 to-pink-500` (gradient)
- **System Messages**: `bg-gray-100` (normal) / `bg-red-100` (error)
- **Metadata Badges**: White background with border

### Hover Effects

- Shadow increases on hover: `hover:shadow-md`
- Copy button fades in: `opacity-0 group-hover:opacity-100`
- Interactive buttons get background: `hover:bg-gray-100`

### Animations

- **Fade In**: 0.3s ease-out animation on mount
- **Copy Feedback**: 2s duration before reset
- **Shadow Transition**: 0.2s smooth transition

## Accessibility

- ✅ **Keyboard Accessible**: Copy button can be focused and activated
- ✅ **Screen Reader Friendly**: Semantic HTML with proper labels
- ✅ **Color Contrast**: WCAG AA compliant color combinations
- ✅ **Link Safety**: External links use `rel="noopener noreferrer"`
- ✅ **Tooltips**: Descriptive titles on interactive elements

## Props Interface

```typescript
interface MessageBubbleProps {
  message: ChatMessage
  onCopy?: (content: string) => void
}

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
    model?: string
    error?: string
  }
}
```

## Advanced Customization

### Custom Copy Handler

```tsx
<MessageBubble
  message={message}
  onCopy={(content) => {
    // Custom logic after copy
    toast.success('Message copied!')
    analytics.track('message_copied', { content })
  }}
/>
```

### Extending Metadata Display

To add more metadata badges, modify the metadata rendering section:

```tsx
{metadata?.customField && (
  <span className="text-xs bg-white px-2 py-1 rounded-full border">
    🔧 {metadata.customField}
  </span>
)}
```

## Performance Notes

- Uses `dangerouslySetInnerHTML` for formatted text (sanitized input)
- Memo-ize if rendering large chat histories (100+ messages)
- Lazy load images/avatars if adding custom avatars
- Consider virtualization for 500+ messages

## Browser Support

- ✅ Chrome/Edge (Chromium) - Full support
- ✅ Firefox - Full support
- ✅ Safari - Full support
- ⚠️ IE11 - Not supported (uses modern CSS features)

## Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'

test('renders user message', () => {
  const message = {
    id: '1',
    role: 'user',
    content: 'Hello',
    timestamp: new Date(),
  }
  
  render(<MessageBubble message={message} />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
})

test('copies message on button click', async () => {
  const mockCopy = jest.fn()
  const message = {
    id: '1',
    role: 'assistant',
    content: 'Test message',
    timestamp: new Date(),
  }
  
  render(<MessageBubble message={message} onCopy={mockCopy} />)
  
  const copyButton = screen.getByTitle('Copy message')
  fireEvent.click(copyButton)
  
  expect(mockCopy).toHaveBeenCalledWith('Test message')
})
```

## Future Enhancements (Sprint 2+)

- [ ] Rich text editor for user input
- [ ] Voice message support
- [ ] Reaction emojis
- [ ] Message threading/replies
- [ ] Image/file attachments preview
- [ ] LaTeX math formula rendering
- [ ] Syntax highlighting for code blocks
- [ ] Message editing capability
- [ ] Read receipts
- [ ] Typing indicators

## Related Components

- [`ChatPanel`](./ChatPanel.tsx) - Parent container for messages
- [`ActionCard`](./ActionCard.tsx) - For AI action proposals
- [`ContextIndicator`](./ContextIndicator.tsx) - Shows AI context awareness

## Changelog

### v1.0.0 (Current)
- ✅ User, AI, and system message types
- ✅ Copy to clipboard functionality
- ✅ Markdown-style text formatting
- ✅ Link detection and formatting
- ✅ Metadata badges display
- ✅ Smooth animations
- ✅ Error message styling
- ✅ Dark mode support
