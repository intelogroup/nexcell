# Nexcell v.20 - UI Implementation

A modern, minimalistic AI-powered spreadsheet editor with a Vercel-inspired design.

## 🚀 Quick Start

```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # Base UI components (Button, Input, Card)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── index.ts
│   ├── layout/          # Layout components
│   │   ├── Header.tsx
│   │   ├── MainLayout.tsx
│   │   └── index.ts
│   ├── chat/            # Chat interface
│   │   ├── ChatInterface.tsx
│   │   └── index.ts
│   └── canvas/          # Spreadsheet canvas
│       ├── CanvasRenderer.tsx
│       ├── FormulaBar.tsx
│       └── index.ts
├── lib/
│   ├── utils.ts         # Utility functions
│   └── types.ts         # TypeScript types
├── App.tsx              # Main app component
├── main.tsx             # App entry point
└── index.css            # Global styles
```

## 🎨 Design System

Following the Vercel-inspired design principles:

- **Typography**: Inter font family
- **Colors**: Grayscale-focused with blue accent
- **Spacing**: 4px base scale
- **Shadows**: Subtle elevation
- **Components**: Built with Tailwind CSS

See `DESIGN_SYSTEM.md` for complete design specifications.

## 🧩 Key Features (Phase 1)

✅ **Layout**
- Clean header with editable workbook name
- Split-view layout (Chat + Spreadsheet)
- Responsive design

✅ **Chat Interface**
- Message display (user, assistant, system)
- Auto-resizing textarea
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)

✅ **Spreadsheet Canvas**
- Virtualized grid (TanStack Virtual)
- Formula bar
- Cell selection and editing
- Keyboard navigation (arrow keys)
- Column/row headers

✅ **Styling**
- Tailwind CSS
- Custom design tokens
- Inter font
- Clean, minimal aesthetic

## 🎯 Current State

This is the **Phase 1: Foundation** implementation:

- Basic layout structure ✅
- Header with workbook name ✅
- Chat interface (display only) ✅
- Simple grid display ✅
- Basic styling with Tailwind ✅
- Cell editing ✅
- Formula bar ✅
- Keyboard navigation ✅

## 📋 Next Steps (Phase 2+)

Coming soon:
- [ ] Backend integration for chat
- [ ] AI action previews
- [ ] Apply/cancel flow
- [ ] Undo/redo
- [ ] Command palette
- [ ] Context menus
- [ ] Advanced keyboard shortcuts
- [ ] Cell formatting
- [ ] Formula evaluation

## 🔧 Technologies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **TanStack Virtual** - Grid virtualization
- **Lucide React** - Icons
- **Vite** - Build tool

## 📚 Documentation

- `UI.md` - UI specifications and component reference
- `DESIGN_SYSTEM.md` - Design system documentation
- Component props documented inline with TypeScript

## 🎨 Customization

Design tokens are defined in `src/index.css`:

```css
@theme {
  --color-accent-500: #3b82f6;
  /* ... more tokens */
}
```

Modify these to customize the look and feel.

## 🐛 Known Issues

- Cell editing blur behavior needs refinement
- Formula evaluation not yet implemented (displays raw input)
- No data persistence yet
- Chat is mock only (no backend connection)

## 📄 License

MIT License
