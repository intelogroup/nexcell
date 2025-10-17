# UI.md — Nexcell v.20

> A concise reference for designers and engineers that specifies layout, components, interactions, and behavior for the AI spreadsheet editor.

---

## 1. Purpose

Keep the UI deterministic, fast, and predictable. Chat-driven actions on the left, spreadsheet canvas on the right, minimal distractions. This doc is the single source for UI behavior and component responsibilities.

---

## 2. Principles

* Desktop-first (web), responsive where reasonable (chat panel collapses on narrow screens)
* Keep 60fps scroll/render target for the canvas
* Use Tailwind + custom components as primitives
* Clean, Vercel-inspired aesthetic with subtle colors and ample whitespace
* Progressive enhancement: start simple, add features incrementally

---

## 3. High-level Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Workbook name | User menu                    │
├─────────────────┬───────────────────────────────────────────┤
│ Chat Panel      │ Spreadsheet Canvas                        │
│ (left — 30%)    │ (right — 70%)                             │
│ - Message list  │ - Virtualized grid                        │
│ - Input area    │ - Formula bar                             │
│                 │ - Column/row headers                      │
└─────────────────┴───────────────────────────────────────────┘
```

---

## 4. Component Inventory (MVP)

### 4.1 App Shell / Header
* Displays workbook name (editable inline)
* User menu (profile, settings, sign out)
* Clean, minimal design with proper spacing

### 4.2 ChatInterface (left)
* Message list (scrollable, with user/assistant distinction)
* Composer: auto-resize textarea
* Clean message bubbles with Inter typography
* Support for system messages and action confirmations

### 4.3 CanvasRenderer (right)
* Virtualized grid using TanStack Virtual
* FormulaBar: shows active cell value/formula
* Column/Row headers: click to select
* Cell states: normal, selected, editing
* Context menu support (future enhancement)

### 4.4 StatusBar (bottom)
* Last saved indicator
* Connection status
* Error notifications

---

## 5. Visual & Design Tokens

Following our existing DESIGN_SYSTEM.md:

* **Typography**: Inter font family
  - Base: 14px
  - Small: 12px
  - Large: 16-18px for headers

* **Colors** (grayscale-focused):
  - Surface: `gray-50` to `gray-100`
  - Text: `gray-900` (primary), `gray-500` (secondary)
  - Accent: `accent-500` (blue)
  - Borders: `gray-200`

* **Spacing**: 4px base scale (4, 8, 12, 16, 24, 32, 48)

* **Shadows**: Subtle Vercel-style shadows for elevation

---

## 6. Interaction Patterns (Phase 1)

### 6.1 Chat → Display flow
1. User types request in chat
2. Message displays in conversation
3. (Future: AI actions and previews)

### 6.2 Cell editing
* Click cell → selection
* Enter → edit mode
* Escape → discard
* Commit (Enter) → apply change

### 6.3 Navigation
* Arrow keys: navigate cells
* Click: select cell
* Drag: extend selection (future)

---

## 7. Keyboard Shortcuts (Phase 1)

* `Enter`: commit cell edit / send chat message
* `Esc`: cancel cell edit / close modal
* `Arrow keys`: navigate cells
* Additional shortcuts to be added incrementally

---

## 8. Component Props (simplified)

```typescript
// FormulaBar
interface FormulaBarProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

// CanvasRenderer
interface CanvasRendererProps {
  data: CellData[][];
  viewport: Viewport;
  onCellEdit: (row: number, col: number, value: string) => void;
}

// ChatInterface
interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}
```

---

## 9. Accessibility

* Keyboard-operable interactive elements
* Proper ARIA roles and labels
* 4.5:1 contrast for text
* Focus indicators on all interactive elements

---

## 10. Performance Requirements

* Virtualization: TanStack Virtual with overscan 3
* Target <16ms per frame for visible updates
* Lazy-load heavy components after initial render
* Optimize re-renders with proper React memoization

---

## 11. Files Structure

```
src/
├── components/
│   ├── ui/              # Base UI components (Button, Input, Card)
│   ├── layout/          # Layout components (Header, MainLayout)
│   ├── chat/            # Chat-related components
│   ├── canvas/          # Spreadsheet canvas components
│   └── common/          # Shared utilities
├── lib/
│   ├── utils.ts         # Utility functions (cn, etc.)
│   └── types.ts         # TypeScript types
├── hooks/               # Custom React hooks
├── stores/              # Zustand state stores
└── App.tsx              # Main app entry
```

---

## 12. Implementation Phases

### Phase 1: Foundation (Current)
- [ ] Basic layout structure
- [ ] Header with workbook name
- [ ] Chat interface (display only)
- [ ] Simple grid display
- [ ] Basic styling with Tailwind

### Phase 2: Interactivity
- [ ] Cell editing
- [ ] Formula bar
- [ ] Message sending
- [ ] Navigation

### Phase 3: AI Integration
- [ ] Chat with backend
- [ ] Action previews
- [ ] Apply/cancel flow
- [ ] Undo/redo

### Phase 4: Polish
- [ ] Command palette
- [ ] Advanced keyboard shortcuts
- [ ] Context menus
- [ ] Performance optimizations

---

## 13. Development Guidelines

* Start with static layouts and mock data
* Build components in isolation
* Test keyboard navigation early
* Keep components small and focused
* Use TypeScript strictly
* Follow the existing DESIGN_SYSTEM.md

---

## 14. Notes

* This is a living document - update as features are implemented
* Prioritize working software over perfect documentation
* Keep the design simple and clean
* Reference DESIGN_SYSTEM.md for visual specifications
