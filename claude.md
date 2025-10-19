# Nexcell - AI Context & Implementation Guide

**Last Updated**: October 19, 2025  
**Status**: Phase 4 Complete (24/33 tasks) - Ready for Phase 5  
**Purpose**: Essential context for AI agents (Claude, GitHub Copilot, etc.)

---

## 🎯 Project Overview

**Nexcell** is a modern, AI-powered spreadsheet editor built with React, TypeScript, and Vite. It aims to provide Excel-like functionality with intelligent AI assistance for workbook operations.

### Key Features
- 🧠 **AI-Powered Operations** - Natural language to spreadsheet transformations
- 📊 **Full Excel Compatibility** - Import/export XLSX with formula preservation
- ⚡ **High Performance** - Handle 1000+ cells with HyperFormula compute engine
- 🎨 **Modern UI** - Canvas-based rendering with Vercel-inspired design
- 🔄 **Real-time Computation** - Automatic formula recalculation
- 📝 **Chat Interface** - Conversational spreadsheet editing

---

## 🏗️ Architecture

```
nexcell/
├── client/                    # React frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── canvas/      # Canvas-based grid renderer
│   │   │   ├── chat/        # AI chat interface
│   │   │   └── layout/      # Layout components
│   │   ├── lib/             # Core libraries
│   │   │   ├── workbook/    # Workbook JSON engine ✅ (128 tests)
│   │   │   └── ai/          # AI operations system 🚧 (Phase 4 complete)
│   │   │       └── operations/
│   │   │           ├── types.ts          ✅ (54 tests)
│   │   │           ├── executor.ts       ✅ (143 tests)
│   │   │           ├── validation.ts     ✅ (38 tests)
│   │   │           └── operation-generator.ts 🚧 (Phase 5)
│   │   └── pages/           # Page components
│   └── public/              # Static assets (SQLite WASM, etc.)
├── apps/                     # Backend services
│   ├── backend/             # Node.js API server
│   └── frontend/            # Additional frontend services
├── docs/                     # Comprehensive documentation
│   ├── AI_WORKBOOK_OPERATIONS_PLAN.md   # Master plan
│   ├── AI_PROMPT_EXAMPLES.md            # 22 example prompts
│   ├── INTEGRATION_TESTS_SUMMARY.md     # Test coverage
│   └── *.md                              # Feature-specific docs
└── scripts/                  # Build & migration scripts
```

---

## 📚 Core Systems

### 1. Workbook JSON Engine (`client/src/lib/workbook/`)

**Status**: ✅ Production-ready (128 tests passing)

The foundation of Nexcell - a JSON-based workbook format compatible with Excel.

#### Key Files
- `types.ts` - WorkbookJSON, SheetJSON, Cell interfaces
- `utils.ts` - Core utilities (createWorkbook, setCell, getCell)
- `operations.ts` - Atomic operations with undo/redo
- `hyperformula.ts` - Formula computation engine integration
- `adapters/` - SheetJS & ExcelJS import/export

#### Capabilities
```typescript
// Create workbook
const wb = createWorkbook('Q1 Budget');

// Add sheets
const sheet = addSheet(wb, 'Sales');

// Set cells
setCell(wb, sheet.id, 'A1', { raw: 'Revenue', dataType: 'string' });
setCell(wb, sheet.id, 'A2', { formula: '=SUM(B2:B10)', dataType: 'formula' });

// Compute formulas
await computeFormulas(wb);

// Export to Excel
const buffer = await exportWorkbook(wb, 'xlsx');
```

---

### 2. AI Operations System (`client/src/lib/ai/operations/`)

**Status**: 🚧 Phase 4 Complete - Ready for Phase 5

Structured system for AI to generate and execute workbook operations.

#### Phase Progress
- ✅ **Phase 1**: Types & System Prompts (4/4 tasks)
- ✅ **Phase 2**: Intent Recognition (3/3 tasks)
- ✅ **Phase 3**: Operation Executor (12/12 tasks)
- ✅ **Phase 4**: Validation System (4/4 tasks)
- 🚧 **Phase 5**: AI Generation (0/5 tasks) ← **NEXT**
- ⏳ **Phase 6**: Canvas Renderer (0/2 tasks)
- ⏳ **Phase 7**: Chat Integration (0/3 tasks)

#### Implemented Operations

**types.ts** - Type-safe operation definitions:
```typescript
type WorkbookOperation =
  | CreateWorkbookOperation
  | AddSheetOperation
  | RemoveSheetOperation
  | SetCellsOperation
  | SetFormulaOperation
  | ComputeOperation
  | ApplyFormatOperation
  | MergeCellsOperation
  | DefineNamedRangeOperation;
```

**executor.ts** - Execute operations on workbooks:
```typescript
const executor = new WorkbookOperationExecutor();
const result = await executor.execute([
  { type: 'createWorkbook', params: { name: 'Budget' } },
  { type: 'setCells', params: { 
    sheet: 'Sheet1',
    cells: {
      A1: { value: 'Revenue', dataType: 'string' },
      A2: { value: 5000, dataType: 'number' }
    }
  }},
  { type: 'compute', params: {} }
]);
```

**validation.ts** - Post-execution validation:
```typescript
const result = validateWorkbook(workbook);
// Returns: errors, warnings, suggestions
// Checks: formula errors, circular refs, stale compute, performance
```

#### Test Coverage
- **235 tests total** across all operation modules
- **54 tests** - types.test.ts (operation type validation)
- **143 tests** - executor.test.ts (all operations + integration)
- **38 tests** - validation.test.ts (comprehensive validation)
- **100% pass rate** with 0 TypeScript errors

---

### 3. Canvas Renderer (`client/src/components/canvas/`)

**Status**: 🚧 Partial implementation

High-performance canvas-based spreadsheet grid.

#### Current Features
- Cell rendering with borders
- Scroll handling (horizontal & vertical)
- Column headers (A, B, C...)
- Row headers (1, 2, 3...)
- Formula bar display

#### TODO (Phase 6)
- [ ] Style rendering (bold, colors, alignment)
- [ ] Number format display
- [ ] Merged cells support
- [ ] Highlighted cells (AI modifications)
- [ ] Cell selection visualization

---

### 4. Chat Interface (`client/src/components/chat/`)

**Status**: 🚧 UI complete, AI integration pending

Conversational interface for workbook operations.

#### Current Features
- Message history with user/assistant roles
- Markdown rendering with syntax highlighting
- Streaming responses
- Plan vs Act mode toggle
- Example prompts

#### TODO (Phase 7)
- [ ] Parse AI responses for WorkbookOperations
- [ ] Execute operations via WorkbookOperationExecutor
- [ ] Show workbook preview in chat
- [ ] Validation feedback loop
- [ ] Undo/redo for AI changes

---

## 🧪 Testing Philosophy

### Test Coverage Goals
- ✅ Core workbook operations: **128 tests**
- ✅ AI operation types: **54 tests**
- ✅ Operation executor: **143 tests**
- ✅ Validation system: **38 tests**
- 🚧 AI generation: **0 tests** (Phase 5)
- ⏳ Canvas renderer: **0 tests** (Phase 6)
- ⏳ E2E integration: **0 tests** (Phase 7)

### Running Tests
```powershell
# All tests
cd client && npm test

# Specific module
npm test -- src/lib/ai/operations/__tests__/executor.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

## 🔄 Current Implementation Status

### ✅ Completed (24 tasks)

#### Phase 1: Types & Context
- [x] workbook-capabilities.ts
- [x] system-prompts.ts
- [x] operations/types.ts
- [x] Unit tests for types

#### Phase 2: Intent Recognition
- [x] intent-recognition.ts types
- [x] Intent taxonomy (10 common intents)
- [x] AI_PROMPT_EXAMPLES.md (22 examples)

#### Phase 3: Operation Executor
- [x] WorkbookOperationExecutor class
- [x] createWorkbook operation
- [x] addSheet/removeSheet operations
- [x] setCells operation (bulk)
- [x] setFormula operation
- [x] compute operation (HyperFormula)
- [x] applyFormat operation
- [x] mergeCells operation
- [x] defineNamedRange operation
- [x] Unit tests (143 tests)
- [x] Plan mode enforcement
- [x] Integration tests (8 workflows)

#### Phase 4: Validation
- [x] validation.ts implementation
- [x] Error detection (all Excel error codes)
- [x] Warning detection (uncomputed/stale)
- [x] Unit tests (38 tests)

### 🚧 In Progress (0 tasks)

Currently ready to start **Phase 5: AI Operation Generation**

### ⏳ Pending (9 tasks)

#### Phase 5: AI Generation (Next Priority)
- [ ] operation-generator.ts implementation
- [ ] AI response parsing (JSON extraction)
- [ ] Confidence scoring
- [ ] Integration tests (10 example prompts)
- [ ] OpenRouter API setup ✅ (already configured)

#### Phase 6: Canvas Renderer
- [ ] WorkbookRenderer component
- [ ] Grid rendering with styles

#### Phase 7: Chat Integration
- [ ] Wire up generateWorkbookOperations
- [ ] Workbook state management
- [ ] Validation feedback loop

---

## 🎯 Next Steps (Phase 5)

### Priority 1: operation-generator.ts

Create AI integration point that generates WorkbookOperations from user prompts.

**File**: `client/src/lib/ai/operations/operation-generator.ts`

```typescript
/**
 * Generate workbook operations from user prompt
 * 
 * @param prompt - User's natural language request
 * @param context - Current workbook context
 * @param conversationHistory - Previous messages
 * @returns Array of WorkbookOperations
 */
export async function generateWorkbookOperations(
  prompt: string,
  context: WorkbookContext,
  conversationHistory: Message[]
): Promise<GenerationResult> {
  // 1. Build AI prompt with system prompt + context + history
  // 2. Call OpenRouter API (Claude 3.5 Sonnet)
  // 3. Parse JSON response to extract operations
  // 4. Validate operations match WorkbookOperation types
  // 5. Return operations + confidence + explanation
}
```

### Priority 2: Response Parsing

Robust JSON extraction from AI responses with error recovery.

```typescript
/**
 * Parse AI response and extract WorkbookOperation[]
 * Handles malformed JSON, validates structure
 */
export function parseAIResponse(
  response: string
): ParseResult {
  // Extract JSON from markdown code blocks
  // Validate against WorkbookOperation schema
  // Handle partial responses
  // Return parsed operations + errors
}
```

### Priority 3: Integration Tests

Test with real AI prompts from AI_PROMPT_EXAMPLES.md:

```typescript
it('should handle "Create Q1 budget" prompt', async () => {
  const result = await generateWorkbookOperations(
    'Create a Q1 budget for sales and marketing departments',
    context,
    []
  );
  
  expect(result.operations).toContainEqual(
    expect.objectContaining({ type: 'createWorkbook' })
  );
  expect(result.operations).toContainEqual(
    expect.objectContaining({ type: 'addSheet', params: { name: 'Sales' } })
  );
});
```

---

## 📖 Key Documentation

### Planning & Architecture
- **AI_WORKBOOK_OPERATIONS_PLAN.md** - Master implementation plan
- **AI_PROMPT_EXAMPLES.md** - 22 example prompts with expected operations
- **AI_INTENT_TAXONOMY.md** - Common user intents
- **AI_CONTEXT_AWARENESS.md** - Context extraction system

### Implementation Guides
- **INTEGRATION_TESTS_SUMMARY.md** - Phase 3.12 test coverage
- **TEST_IMPLEMENTATION_SUMMARY.md** - Test patterns & best practices
- **EAGER_COMPUTE_ASSESSMENT.md** - HyperFormula integration strategy

### Feature Documentation
- **NAMED_RANGE_IMPROVEMENTS.md** - Named range support
- **CONDITIONAL_FORMATTING_TEST_SUMMARY.md** - Formatting system
- **MULTI_SHEET_SYNC_TEST_SUMMARY.md** - Cross-sheet references

---

## 🔧 Development Setup

### Prerequisites
```powershell
node --version  # v18.x or higher
npm --version   # v9.x or higher
```

### Installation
```powershell
# Clone repository
git clone https://github.com/intelogroup/nexcell.git
cd nexcell

# Install dependencies
cd client
npm install

# Start dev server
npm run dev
```

### Environment Variables
```bash
# .env.local
VITE_OPENROUTER_API_KEY=your_key_here
VITE_OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Build & Test
```powershell
# Development
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Test
npm test

# Build production
npm run build
```

---

## 🤖 AI Agent Guidelines

### For Claude/Copilot Working on This Project

#### 1. Always Check Test Coverage
Before making changes, run:
```powershell
npm test -- src/lib/ai/operations/__tests__/
```

#### 2. Follow Type-Safety Patterns
All operations MUST match the `WorkbookOperation` union type:
```typescript
// ✅ Good - Fully typed
const op: SetCellsOperation = {
  type: 'setCells',
  params: {
    sheet: 'Sheet1',
    cells: {
      A1: { value: 'Test', dataType: 'string' }
    }
  }
};

// ❌ Bad - Missing dataType
const op = {
  type: 'setCells',
  params: {
    sheet: 'Sheet1',
    cells: {
      A1: { value: 'Test' }  // Error: dataType required
    }
  }
};
```

#### 3. Use Existing Test Patterns
Reference `executor.test.ts` for testing patterns:
```typescript
it('should handle operation', async () => {
  const executor = new WorkbookOperationExecutor();
  const operations = [/* ... */];
  
  const result = await executor.execute(operations);
  
  expect(result.success).toBe(true);
  expect(result.workbook).toBeDefined();
  // ... validate specific behavior
});
```

#### 4. Document with JSDoc
All public functions need comprehensive JSDoc:
```typescript
/**
 * Generate workbook operations from user prompt
 * 
 * @param prompt - User's natural language request
 * @param context - Current workbook context
 * @param conversationHistory - Previous messages
 * @returns Generation result with operations and confidence
 * 
 * @example
 * const result = await generateWorkbookOperations(
 *   'Create a budget',
 *   context,
 *   []
 * );
 */
```

#### 5. Update This File (claude.md)
When completing tasks, update:
- Implementation status checkboxes
- Test counts
- "Last Updated" timestamp
- Next steps if priorities change

---

## 📞 Contact & Resources

- **Repository**: https://github.com/intelogroup/nexcell
- **Author**: jayve (jimaklinov@gmail.com)
- **Organization**: intelogroup
- **Branch**: ghcopilot/accounting-fixture

### Useful Commands
```powershell
# Check git status
git status

# Run specific test file
npm test -- path/to/test.ts --run

# Check for TypeScript errors
npx tsc --noEmit

# Search codebase
grep -r "pattern" client/src/

# View test coverage
npm test -- --coverage
```

---

## 🎓 Learning Resources

### HyperFormula
- Docs: https://hyperformula.handsontable.com/
- GitHub: https://github.com/handsontable/hyperformula
- Supported functions: 400+ Excel-compatible

### SheetJS (xlsx)
- Docs: https://docs.sheetjs.com/
- Used for Excel import/export
- Cell format: `{ v: value, t: type, w: formatted }`

### ExcelJS
- Docs: https://github.com/exceljs/exceljs
- Alternative Excel adapter
- Richer formatting support

---

## ⚠️ Important Notes

### Do NOT
- ❌ Modify workbook/types.ts without updating adapters
- ❌ Add operations without updating executor.ts
- ❌ Change Cell interface without migration plan
- ❌ Skip tests for new features
- ❌ Use `any` type in operation definitions

### DO
- ✅ Run tests before committing
- ✅ Update documentation when adding features
- ✅ Use TypeScript strict mode
- ✅ Follow existing patterns
- ✅ Ask before major refactors

### Performance Considerations
- HyperFormula hydration is expensive - batch operations
- Canvas rendering is optimized for viewport
- Use `setCells` (bulk) instead of multiple `setCell` calls
- Workbook cloning is deep - use sparingly

---

**End of AI Context Document**

*This document is continuously updated as the project evolves. Last major update: October 19, 2025*
