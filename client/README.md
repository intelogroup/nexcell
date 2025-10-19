# Nexcell Client

> React + TypeScript + Vite frontend for Nexcell spreadsheet application

## 🚀 Quick Start

```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📁 Project Structure

```
client/
├── src/
│   ├── components/          # React components
│   │   ├── canvas/         # Canvas-based grid renderer
│   │   ├── chat/           # AI chat interface  
│   │   ├── layout/         # App layout components
│   │   ├── test/           # Test utilities
│   │   └── ui/             # Reusable UI components
│   ├── lib/                # Core libraries
│   │   ├── workbook/       # Workbook JSON engine (128 tests)
│   │   └── ai/             # AI operations system (235 tests)
│   │       └── operations/ # Operation executor & validation
│   ├── pages/              # Application pages
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
│   └── sqlite/             # SQLite WASM files
├── test-results/           # Test output
└── vitest.config.ts        # Test configuration
```

## 🧪 Testing

### Test Coverage
- **235 tests** total with 100% pass rate
- **Workbook Core**: 128 tests
- **AI Operations**: 235 tests (types, executor, validation)

### Run Tests
```powershell
# All tests
npm test

# Specific test file
npm test -- src/lib/ai/operations/__tests__/executor.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## 🔧 Tech Stack

### Core
- **React 18.3** - UI framework
- **TypeScript 5.5** - Type safety
- **Vite 6.0** - Build tool with HMR
- **TailwindCSS** - Utility-first styling

### Libraries
- **HyperFormula 3.1** - Formula computation engine
- **SheetJS (xlsx)** - Excel import/export
- **ExcelJS** - Advanced Excel operations
- **Vitest** - Testing framework

### Plugins
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) alternative using [SWC](https://swc.rs/) for Fast Refresh

## 🛠️ Available Scripts

```powershell
npm run dev          # Start dev server on http://localhost:5173
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build
npm run lint         # Lint code with ESLint
npm test             # Run tests with Vitest
npx tsc --noEmit     # Type check without emitting files
```

## 🌐 Environment Variables

Create a `.env.local` file:

```env
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

## 📚 Key Modules

### Workbook Engine (`src/lib/workbook/`)
Core spreadsheet functionality with Excel compatibility.

```typescript
import { createWorkbook, setCell, computeFormulas } from '@/lib/workbook';

const wb = createWorkbook('My Workbook');
setCell(wb, wb.sheets[0].id, 'A1', { raw: 'Hello', dataType: 'string' });
await computeFormulas(wb);
```

### AI Operations (`src/lib/ai/operations/`)
Structured system for AI-driven workbook manipulation.

```typescript
import { WorkbookOperationExecutor } from '@/lib/ai/operations/executor';

const executor = new WorkbookOperationExecutor();
const result = await executor.execute(operations);
```

### Canvas Renderer (`src/components/canvas/`)
High-performance spreadsheet grid rendering.

```typescript
import { CanvasRenderer } from '@/components/canvas/CanvasRenderer';

<CanvasRenderer 
  workbook={workbook} 
  activeSheetId={sheetId}
  onCellClick={handleClick}
/>
```

## React Compiler

The React Compiler is not enabled due to performance impact. To add it, see [React Compiler documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
