# ActionCard Component - Feature Guide

## Overview

The `ActionCard` component displays AI-proposed actions that require user approval before being applied to the workbook. It provides a clear preview of changes with Apply/Cancel buttons and supports keyboard shortcuts for power users.

## Features

### ✨ Core Features

1. **Action Preview**
   - Expandable/collapsible preview section
   - Before/After state comparison
   - Color-coded diff visualization (red for before, green for after)
   - JSON formatted display with proper indentation

2. **Confidence Indicators**
   - Visual confidence score display
   - Color-coded confidence levels:
     - 🟢 **High** (90-100%): Green badge
     - 🟡 **Medium** (70-89%): Yellow badge
     - 🟠 **Low** (0-69%): Orange badge
   - Percentage display with label

3. **Action Metadata**
   - Affected cell range (e.g., "A1:C10")
   - Estimated number of cells to be modified
   - Token usage information
   - Confidence score

4. **Interactive Controls**
   - **Apply Button**: Execute the proposed action
   - **Full Preview Button**: Open detailed preview modal (optional)
   - **Cancel Button**: Dismiss the action
   - Loading states during execution
   - Disabled states when processing

5. **Keyboard Shortcuts**
   - `Ctrl+Enter`: Apply changes
   - `Esc`: Cancel action
   - Visual hint displayed at bottom of card

6. **Smooth Animations**
   - Fade-in animation on mount
   - Hover shadow effects
   - Spinner animation during processing
   - Smooth expand/collapse transitions

7. **Accessibility**
   - Keyboard navigation support
   - Button titles for screen readers
   - Focus indicators
   - Disabled state management

## Usage Examples

### Basic Usage

```tsx
import { ActionCard } from '@/components/chat'
import { useApplyAction, useCancelAction } from '@/hooks/useChat'

function PendingActions() {
  const pendingActions = usePendingActions()
  const applyAction = useApplyAction()
  const cancelAction = useCancelAction()
  
  return (
    <div className="space-y-3">
      {pendingActions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          onApply={() => applyAction(action)}
          onCancel={() => cancelAction(action)}
        />
      ))}
    </div>
  )
}
```

### Simple Action (No Preview)

```tsx
const simpleAction: ChatAction = {
  id: '1',
  description: 'Format selected cells as currency (USD)',
  affectedRange: 'B2:B10',
  status: 'pending',
  timestamp: new Date(),
  metadata: {
    confidence: 0.95,
    estimatedCells: 9,
  },
}

<ActionCard
  action={simpleAction}
  onApply={async () => {
    // Apply formatting logic
    await formatAsCurrency('B2:B10')
  }}
  onCancel={() => console.log('Cancelled')}
/>
```

**Result**: Action card showing:
- High confidence (95%) green badge
- Description of action
- Range badge: "B2:B10"
- Cell count badge: "9 cells"
- Apply and Cancel buttons

### Action with Preview

```tsx
const actionWithPreview: ChatAction = {
  id: '2',
  description: 'Create budget table with 5 columns',
  affectedRange: 'A1:E1',
  status: 'pending',
  timestamp: new Date(),
  preview: {
    before: {
      A1: null,
      B1: null,
      C1: null,
      D1: null,
      E1: null,
    },
    after: {
      A1: 'Category',
      B1: 'Amount',
      C1: 'Date',
      D1: 'Notes',
      E1: 'Status',
    },
  },
  metadata: {
    confidence: 0.88,
    estimatedCells: 5,
  },
}

<ActionCard
  action={actionWithPreview}
  onApply={async () => {
    await createTableHeaders(['Category', 'Amount', 'Date', 'Notes', 'Status'])
  }}
  onCancel={() => console.log('Cancelled')}
/>
```

**Result**: Action card with:
- Medium confidence (88%) yellow badge
- Expandable preview section
- Before state (empty cells) in red
- After state (headers) in green
- Show/Hide preview toggle button

### Action with Full Preview Modal

```tsx
const [previewModalOpen, setPreviewModalOpen] = useState(false)

<ActionCard
  action={action}
  onApply={() => applyAction(action)}
  onCancel={() => cancelAction(action)}
  onPreview={() => setPreviewModalOpen(true)}
/>

{previewModalOpen && (
  <PreviewModal
    action={action}
    onClose={() => setPreviewModalOpen(false)}
    onApply={() => {
      applyAction(action)
      setPreviewModalOpen(false)
    }}
  />
)}
```

**Result**: Action card with "Full Preview" button that opens detailed modal.

### Async Apply with Loading State

```tsx
const [isApplying, setIsApplying] = useState(false)

<ActionCard
  action={action}
  isApplying={isApplying}
  onApply={async () => {
    setIsApplying(true)
    try {
      await api.applyAction(action.id)
      toast.success('Applied successfully!')
    } catch (error) {
      toast.error('Failed to apply action')
    } finally {
      setIsApplying(false)
    }
  }}
  onCancel={() => cancelAction(action)}
/>
```

**Result**: Button shows spinner and "Applying..." text during execution.

## Styling Guide

### Color Scheme

- **Card Background**: `bg-amber-50` (light) / `dark:bg-amber-900/20` (dark)
- **Border**: `border-amber-200` (accent color)
- **Icon Background**: `bg-amber-500` (primary amber)
- **Apply Button**: `bg-amber-500 hover:bg-amber-600`
- **Confidence Badges**:
  - High: `bg-green-100 text-green-600`
  - Medium: `bg-yellow-100 text-yellow-600`
  - Low: `bg-orange-100 text-orange-600`

### Hover Effects

- Card shadow increases: `hover:shadow-md`
- Buttons get darker background
- Smooth transitions on all interactive elements

### Layout

- Icon: 8x8 size with rounded corners
- Content: Flexible width with minimum 0
- Buttons: Flex wrap for mobile responsiveness
- Preview: Full width expandable section

## Props Interface

```typescript
interface ActionCardProps {
  action: ChatAction
  onApply: () => void | Promise<void>
  onCancel: () => void
  onPreview?: () => void  // Optional full preview handler
  isApplying?: boolean    // External loading state
}

interface ChatAction {
  id: string
  description: string
  affectedRange: string
  status: 'pending' | 'applied' | 'cancelled'
  timestamp: Date
  preview?: {
    before: Record<string, any>
    after: Record<string, any>
  }
  metadata?: {
    tokensUsed?: number
    confidence?: number
    estimatedCells?: number
  }
}
```

## Advanced Features

### Custom Confidence Display

```tsx
// Modify getConfidenceData function for custom thresholds
const getConfidenceData = (confidence?: number) => {
  if (!confidence) return { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Unknown' }
  if (confidence >= 0.95) return { color: 'text-green-600', bg: 'bg-green-100', label: 'Very High' }
  if (confidence >= 0.85) return { color: 'text-green-600', bg: 'bg-green-100', label: 'High' }
  if (confidence >= 0.70) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Medium' }
  if (confidence >= 0.50) return { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Low' }
  return { color: 'text-red-600', bg: 'bg-red-100', label: 'Very Low' }
}
```

### Custom Preview Rendering

For cell-specific formatting:

```tsx
{preview && (
  <div className="grid gap-2">
    {Object.entries(preview.after).map(([cell, value]) => (
      <div key={cell} className="flex items-center gap-2">
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
          {cell}
        </span>
        <span className="text-xs text-gray-600">
          {preview.before[cell] || '(empty)'}
        </span>
        <span className="text-amber-500">→</span>
        <span className="text-xs font-medium text-green-600">
          {value}
        </span>
      </div>
    ))}
  </div>
)}
```

### Error Handling

```tsx
<ActionCard
  action={action}
  onApply={async () => {
    try {
      await applyAction(action)
    } catch (error) {
      if (error.code === 'INVALID_RANGE') {
        toast.error('Invalid cell range')
      } else if (error.code === 'PERMISSION_DENIED') {
        toast.error('You do not have permission to modify this range')
      } else {
        toast.error('Failed to apply action')
      }
      throw error // Re-throw to keep action pending
    }
  }}
  onCancel={() => cancelAction(action)}
/>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Apply changes |
| `Esc` | Cancel action |
| `Tab` | Navigate between buttons |
| `Space` or `Enter` | Activate focused button |

## Accessibility Features

- ✅ **ARIA Labels**: All buttons have descriptive titles
- ✅ **Keyboard Navigation**: Full keyboard support
- ✅ **Focus Management**: Proper focus indicators
- ✅ **Loading States**: Disabled buttons during processing
- ✅ **Screen Reader**: Semantic HTML structure
- ✅ **Color Contrast**: WCAG AA compliant

## Performance Notes

- Preview rendering is lazy (only shown when expanded)
- JSON.stringify is used for simple preview - consider custom renderer for large objects
- Event listeners are cleaned up on unmount
- Async operations properly handle loading states

## Browser Support

- ✅ Chrome/Edge (Chromium) - Full support
- ✅ Firefox - Full support
- ✅ Safari - Full support
- ⚠️ IE11 - Not supported (uses modern JavaScript)

## Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActionCard } from './ActionCard'

test('applies action on button click', async () => {
  const mockApply = jest.fn()
  const action = {
    id: '1',
    description: 'Test action',
    affectedRange: 'A1:B2',
    status: 'pending',
    timestamp: new Date(),
    metadata: { confidence: 0.9 },
  }
  
  render(
    <ActionCard
      action={action}
      onApply={mockApply}
      onCancel={jest.fn()}
    />
  )
  
  fireEvent.click(screen.getByText('Apply Changes'))
  await waitFor(() => expect(mockApply).toHaveBeenCalled())
})

test('expands preview when clicked', () => {
  const action = {
    id: '1',
    description: 'Test',
    affectedRange: 'A1',
    status: 'pending',
    timestamp: new Date(),
    preview: {
      before: { A1: null },
      after: { A1: 'value' },
    },
  }
  
  render(
    <ActionCard
      action={action}
      onApply={jest.fn()}
      onCancel={jest.fn()}
    />
  )
  
  expect(screen.queryByText('Before')).not.toBeInTheDocument()
  
  fireEvent.click(screen.getByText('Show Preview'))
  
  expect(screen.getByText('Before')).toBeInTheDocument()
  expect(screen.getByText('After')).toBeInTheDocument()
})

test('applies action with Ctrl+Enter', async () => {
  const mockApply = jest.fn()
  const action = { /* ... */ }
  
  render(
    <ActionCard
      action={action}
      onApply={mockApply}
      onCancel={jest.fn()}
    />
  )
  
  fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
  
  await waitFor(() => expect(mockApply).toHaveBeenCalled())
})
```

## Future Enhancements (Sprint 2+)

- [ ] Undo action capability
- [ ] Action history/timeline integration
- [ ] Drag-to-reorder multiple actions
- [ ] Batch apply multiple actions
- [ ] Custom preview renderers per action type
- [ ] Animated diff view
- [ ] Side-by-side cell comparison
- [ ] Export action log
- [ ] Action templates/favorites
- [ ] Confidence score explanation

## Related Components

- [`ChatPanel`](./ChatPanel.tsx) - Parent container that displays action cards
- [`MessageBubble`](./MessageBubble.tsx) - For AI messages that create actions
- [`PreviewModal`](./PreviewModal.tsx) - Full-screen preview (Sprint 2)
- [`ActionTimeline`](./ActionTimeline.tsx) - History of applied actions (Sprint 2)

## Changelog

### v1.0.0 (Current)
- ✅ Apply/Cancel/Preview buttons
- ✅ Expandable before/after preview
- ✅ Confidence level indicators
- ✅ Metadata badges (range, cell count)
- ✅ Keyboard shortcuts (Ctrl+Enter, Esc)
- ✅ Loading states and animations
- ✅ Dark mode support
- ✅ Accessibility features
