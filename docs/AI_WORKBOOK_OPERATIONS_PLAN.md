# AI-Powered Workbook Operations Plan
**Date**: October 18, 2025  
**Status**: Planning Phase  
**Goal**: Enable AI to intelligently operate workbooks using tested capabilities

---

## 🎯 Executive Summary

We have 128 passing tests validating core workbook operations, but our AI system lacks:
1. **Awareness** of available workbook capabilities
2. **System prompts** to guide intelligent workbook operations
3. **Operation mappings** from user intents to workbook actions
4. **UI rendering** to show live workbook state
5. **Feedback loops** to validate AI-generated changes

This plan transforms our tested foundation into an AI-powered spreadsheet assistant.

---

## 📊 Current State Assessment

### ✅ What We Have (Tested & Working)
| Capability | Tests | Status | Notes |
|------------|-------|--------|-------|
| **Formula Engine** | 28 | ✅ | Reference adjustment, all formula types |
| **Multi-Sheet** | 15 | ✅ | Cross-sheet refs, sheet management |
| **Error Handling** | 22 | ✅ | #DIV/0!, #VALUE!, #NAME?, #CYCLE! |
| **Formatting** | 22 | ✅ | Styles, numFmt, borders, alignment |
| **Performance** | 19 | ✅ | 1000+ cells, complex formulas <2s |
| **Import/Export** | 14 | ✅ | XLSX round-trip with SheetJS/ExcelJS |
| **Real-World** | 8 | ✅ | Budget tracker with cross-sheet rollup |
| **Total** | **128** | **100%** | Ready for AI integration |

### ❌ What We're Missing

1. **AI Context**: System doesn't know about workbook operations
2. **Intent Mapping**: No translation from user prompts → workbook actions
3. **Operation Framework**: No structured way to execute workbook operations
4. **Live UI**: No real-time rendering of workbook state
5. **Validation**: No feedback loop to verify AI actions
6. **Error Recovery**: No rollback/undo for failed AI operations

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER PROMPT                             │
│   "Create a Q1 budget for sales and marketing departments"     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI INTENT ANALYZER                           │
│  - Parse natural language                                       │
│  - Extract: entities, operations, relationships                 │
│  - Map to workbook operations                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 OPERATION PLANNER (AI)                          │
│  - Generate step-by-step workbook operations                    │
│  - Consider dependencies and order                              │
│  - Validate against capabilities                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              WORKBOOK OPERATION EXECUTOR                        │
│  - createWorkbook()                                             │
│  - addSheet()                                                   │
│  - setCellValue()                                               │
│  - setFormula()                                                 │
│  - applyFormatting()                                            │
│  - hydrateHF() + recompute()                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  HYPERFORMULA WORKER                            │
│  - Formula computation in Web Worker                            │
│  - Dependency graph management                                  │
│  - Incremental recalculation                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     UI RENDERER                                 │
│  - Canvas-based spreadsheet grid (read-only for now)           │
│  - Real-time updates from workbook state                        │
│  - Highlight AI-modified cells                                  │
│  - Show formula bar, cell formatting                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VALIDATION & FEEDBACK                         │
│  - Verify operations succeeded                                  │
│  - Check formula errors                                          │
│  - Report to AI for correction                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Phase 1: AI Context & System Prompts

### 1.1 Workbook Capabilities Context

**File**: `client/src/lib/ai/workbook-capabilities.ts`

```typescript
export const WORKBOOK_CAPABILITIES = {
  core: {
    create: "Create new workbook with sheets",
    sheets: "Add/remove/rename sheets",
    cells: "Set values, formulas, formats",
    formulas: "All Excel formulas (SUM, IF, VLOOKUP, etc.)",
    references: "Relative, absolute, mixed, cross-sheet",
    computation: "Auto-recalculation with HyperFormula",
  },
  
  advanced: {
    multiSheet: "Cross-sheet references and rollups",
    namedRanges: "Define and use named ranges",
    conditionalFormulas: "IF, SUMIF, COUNTIFS, etc.",
    errorHandling: "#DIV/0!, #VALUE!, #NAME? detection",
    formatting: "Styles, number formats, borders",
    merging: "Merge cells, preserve formatting",
  },
  
  performance: {
    largeSets: "Handle 1000+ cells efficiently",
    complexFormulas: "Nested formulas, array operations",
    incremental: "Selective recomputation",
  },
  
  importExport: {
    xlsx: "Import/export Excel files (SheetJS, ExcelJS)",
    fidelity: "Preserve formulas, formats, structures",
  },
  
  realWorld: {
    budgeting: "Budget vs actual, variance analysis",
    consolidation: "Multi-department rollups",
    ytd: "Year-to-date calculations",
    alerts: "Conditional status flags",
  },
};
```

### 1.2 System Prompt for AI

**File**: `client/src/lib/ai/system-prompts.ts`

```typescript
export const WORKBOOK_SYSTEM_PROMPT = `
You are an AI spreadsheet assistant with access to a powerful workbook engine.

## Your Capabilities

You can perform these operations on workbooks:

### 1. CREATE & STRUCTURE
- Create new workbooks with multiple sheets
- Add/remove/rename sheets
- Set up headers and data structure

### 2. DATA & FORMULAS
- Set cell values (numbers, text, dates, booleans)
- Write formulas using Excel syntax (=SUM(A1:A10), =IF(B2>100,"High","Low"))
- Use cross-sheet references (=Sheet2!A1, =SUM(Data!B:B))
- Create named ranges for easier formula writing

### 3. FORMATTING
- Apply number formats ($#,##0.00, 0.0%, mm/dd/yyyy)
- Set cell styles (bold, italic, colors, borders)
- Merge cells for headers

### 4. COMPUTATION
- All formulas auto-compute with HyperFormula
- Supports 400+ Excel functions
- Handles errors gracefully (#DIV/0!, #VALUE!, etc.)

### 5. REAL-WORLD SCENARIOS
- Budget tracking (budget vs actual, variance %)
- Financial consolidation (multi-department rollups)
- Year-to-date calculations
- Conditional alerts and status flags

## Available Excel Functions

**Math**: SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, POWER
**Logic**: IF, AND, OR, NOT, IFS, SWITCH
**Lookup**: VLOOKUP, HLOOKUP, INDEX, MATCH, XLOOKUP
**Conditional**: SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF
**Text**: LEFT, RIGHT, MID, CONCATENATE, TEXTJOIN, TRIM
**Date**: TODAY, NOW, DATE, YEAR, MONTH, DAY, NETWORKDAYS
**Financial**: PMT, FV, PV, NPV, IRR
**Statistical**: STDEV, VAR, PERCENTILE, RANK, CORREL

## Response Format

When user asks you to create/modify a workbook, respond with:

\`\`\`json
{
  "intent": "create_budget_tracker",
  "operations": [
    {
      "type": "createWorkbook",
      "params": { "name": "Q1 Budget" }
    },
    {
      "type": "addSheet",
      "params": { "name": "Sales", "id": "sales" }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "sales",
        "cells": {
          "A1": { "value": "Month", "style": { "bold": true } },
          "B1": { "value": "Budget", "style": { "bold": true } },
          "C1": { "value": "Actual", "style": { "bold": true } }
        }
      }
    },
    {
      "type": "setFormula",
      "params": {
        "sheet": "sales",
        "cell": "D2",
        "formula": "=C2-B2"
      }
    },
    {
      "type": "compute",
      "params": {}
    }
  ],
  "explanation": "Created Q1 Budget workbook with Sales sheet, headers, and variance formula"
}
\`\`\`

## Guidelines

1. **Always compute**: After setting formulas, include a "compute" operation
2. **Validate references**: Ensure cell references exist before writing formulas
3. **Use absolute refs**: Use $A$1 for fixed references in formulas
4. **Error handling**: Check for division by zero with IF(B2=0,0,A2/B2)
5. **Number formats**: Apply appropriate formats ($#,##0 for currency, 0.0% for percentages)
6. **Cross-sheet**: Use SheetName!CellRef for references across sheets
7. **Named ranges**: Define them for complex formulas (e.g., "SalesData" for A2:D100)

## Examples

### Simple Budget
User: "Create a simple budget with income and expenses"
You: Generate operations to create workbook, add sheet, set headers (Category, Amount), add sample data, SUM formulas

### Multi-Department Rollup
User: "Track Q1 budget for Sales, Marketing, and Operations with a summary"
You: Create 4 sheets (3 departments + Summary), set up monthly tracking in each, use cross-sheet formulas in Summary (=Sales!B10, =SUM(Sales!B10,Marketing!B10,Operations!B10))

### Variance Analysis
User: "Show budget vs actual with red/green highlighting"
You: Create budget/actual columns, add variance formula (=C2-B2), variance % formula (=D2/B2), apply conditional formatting logic

Remember: You're creating structured JSON operations, not writing code. Focus on declarative workbook operations.
`;
```

---

## 🔄 Phase 2: Intent Recognition & Operation Mapping

### 2.1 User Intent Taxonomy

**File**: `client/src/lib/ai/intent-recognition.ts`

Common user intents mapped to workbook operations:

| User Intent | Example Prompts | Workbook Operations |
|-------------|----------------|---------------------|
| **Create Budget** | "Make a budget", "Track expenses", "Budget vs actual" | createWorkbook, addSheet, setCells (headers), setFormula (totals, variance) |
| **Financial Report** | "P&L statement", "Income statement", "Revenue breakdown" | Multi-sheet setup, cross-sheet SUM, formatting |
| **Consolidation** | "Combine departments", "Roll up regions", "Multi-entity totals" | Multiple sheets, cross-sheet formulas, summary sheet |
| **Analysis** | "What if analysis", "Sensitivity", "Variance analysis" | Formula chains, conditional formulas, named ranges |
| **Import Data** | "Load this CSV", "Import from Excel", "Parse this data" | importXLSX, setCells (bulk), compute |
| **Export** | "Download as Excel", "Export to XLSX", "Save workbook" | exportXLSX operation |
| **Lookup** | "Find matching records", "VLOOKUP setup", "Search table" | VLOOKUP/INDEX-MATCH formulas |
| **Calculation** | "Calculate totals", "Sum by category", "Average by month" | SUM, SUMIF, AVERAGE formulas |
| **YTD Tracking** | "Year to date", "Running total", "Cumulative sum" | Cumulative formulas (=D2+B3 pattern) |
| **Alerts** | "Flag if over budget", "Highlight errors", "Show warnings" | IF formulas for status, conditional logic |

### 2.2 Intent Parser

```typescript
interface ParsedIntent {
  category: 'budget' | 'report' | 'analysis' | 'consolidation' | 'import' | 'export';
  entities: {
    departments?: string[];
    timePeriods?: string[];
    metrics?: string[];
    comparisonType?: 'vs_budget' | 'vs_prior' | 'variance';
  };
  operations: WorkbookOperation[];
  context: {
    needsMultiSheet: boolean;
    needsCrossSheetFormulas: boolean;
    needsConditionalLogic: boolean;
    needsFormatting: boolean;
  };
}

function parseIntent(userPrompt: string, conversationHistory: Message[]): ParsedIntent {
  // Use OpenRouter AI to parse intent
  // Extract entities (departments, time periods, metrics)
  // Map to operation sequence
  // Return structured intent
}
```

---

## 🛠️ Phase 3: Workbook Operation Framework

### 3.1 Operation Types

**File**: `client/src/lib/ai/operations/types.ts`

```typescript
export type WorkbookOperation =
  | CreateWorkbookOp
  | AddSheetOp
  | RemoveSheetOp
  | RenameSheetOp
  | SetCellOp
  | SetCellsOp
  | SetFormulaOp
  | ApplyFormatOp
  | MergeCellsOp
  | DefineNamedRangeOp
  | ImportXLSXOp
  | ExportXLSXOp
  | ComputeOp
  | UndoOp
  | RedoOp;

interface CreateWorkbookOp {
  type: 'createWorkbook';
  params: {
    name: string;
    initialSheets?: string[];
  };
}

interface SetCellsOp {
  type: 'setCells';
  params: {
    sheet: string;
    cells: Record<string, {
      value?: string | number | boolean;
      formula?: string;
      dataType?: CellDataType;
      numFmt?: string;
      style?: CellStyle;
    }>;
  };
}

interface SetFormulaOp {
  type: 'setFormula';
  params: {
    sheet: string;
    cell: string;
    formula: string;
  };
}

interface ComputeOp {
  type: 'compute';
  params: {
    force?: boolean; // Force full recompute
  };
}

// ... more operation types
```

### 3.2 Operation Executor

**File**: `client/src/lib/ai/operations/executor.ts`

```typescript
import { createWorkbook } from '@/lib/workbook/utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '@/lib/workbook/hyperformula';
import type { WorkbookJSON } from '@/lib/workbook/types';
import type { WorkbookOperation } from './types';

export class WorkbookOperationExecutor {
  private workbook: WorkbookJSON | null = null;
  private hfInstance: any = null;
  private operationHistory: WorkbookOperation[] = [];
  
  async execute(operations: WorkbookOperation[]): Promise<{
    success: boolean;
    workbook: WorkbookJSON;
    errors: Array<{ operation: number; error: string }>;
  }> {
    const errors: Array<{ operation: number; error: string }> = [];
    
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      
      try {
        await this.executeOne(op);
        this.operationHistory.push(op);
      } catch (error) {
        errors.push({
          operation: i,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Stop on error or continue based on strategy
        break;
      }
    }
    
    return {
      success: errors.length === 0,
      workbook: this.workbook!,
      errors,
    };
  }
  
  private async executeOne(op: WorkbookOperation): Promise<void> {
    switch (op.type) {
      case 'createWorkbook':
        this.workbook = createWorkbook(op.params.name);
        if (op.params.initialSheets) {
          // Add additional sheets beyond the default first sheet
          for (const sheetName of op.params.initialSheets.slice(1)) {
            this.workbook.sheets.push({
              name: sheetName,
              id: sheetName.toLowerCase().replace(/\s+/g, '_'),
              cells: {},
            });
          }
        }
        break;
        
      case 'addSheet':
        if (!this.workbook) throw new Error('No workbook exists');
        this.workbook.sheets.push({
          name: op.params.name,
          id: op.params.id || op.params.name.toLowerCase().replace(/\s+/g, '_'),
          cells: {},
        });
        break;
        
      case 'setCells':
        if (!this.workbook) throw new Error('No workbook exists');
        const sheet = this.workbook.sheets.find(s => s.name === op.params.sheet || s.id === op.params.sheet);
        if (!sheet) throw new Error(`Sheet not found: ${op.params.sheet}`);
        
        if (!sheet.cells) sheet.cells = {};
        
        for (const [cellRef, cellData] of Object.entries(op.params.cells)) {
          sheet.cells[cellRef] = {
            raw: cellData.value,
            dataType: cellData.dataType || (cellData.formula ? 'formula' : typeof cellData.value === 'number' ? 'number' : 'string'),
            formula: cellData.formula,
            numFmt: cellData.numFmt,
            style: cellData.style,
          } as any;
        }
        break;
        
      case 'setFormula':
        if (!this.workbook) throw new Error('No workbook exists');
        const formulaSheet = this.workbook.sheets.find(s => s.name === op.params.sheet || s.id === op.params.sheet);
        if (!formulaSheet) throw new Error(`Sheet not found: ${op.params.sheet}`);
        
        if (!formulaSheet.cells) formulaSheet.cells = {};
        formulaSheet.cells[op.params.cell] = {
          formula: op.params.formula,
          dataType: 'formula',
        } as any;
        break;
        
      case 'compute':
        if (!this.workbook) throw new Error('No workbook exists');
        
        // Destroy previous HF instance if exists
        if (this.hfInstance) {
          this.hfInstance.destroy();
        }
        
        // Hydrate and compute
        this.hfInstance = hydrateHFFromWorkbook(this.workbook);
        recomputeAndPatchCache(this.workbook, this.hfInstance);
        break;
        
      case 'exportXLSX':
        // Handled separately as it returns a buffer
        break;
        
      default:
        throw new Error(`Unknown operation type: ${(op as any).type}`);
    }
  }
  
  getWorkbook(): WorkbookJSON | null {
    return this.workbook;
  }
  
  cleanup(): void {
    if (this.hfInstance) {
      this.hfInstance.destroy();
      this.hfInstance = null;
    }
  }
}
```

---

## 🎨 Phase 4: UI Rendering (Read-Only)

### 4.1 Canvas-Based Grid Renderer

**File**: `client/src/components/workbook/WorkbookRenderer.tsx`

```typescript
import React, { useEffect, useRef } from 'react';
import type { WorkbookJSON } from '@/lib/workbook/types';

interface WorkbookRendererProps {
  workbook: WorkbookJSON;
  activeSheet?: number;
  highlightedCells?: string[]; // Cells modified by AI
}

export function WorkbookRenderer({ workbook, activeSheet = 0, highlightedCells = [] }: WorkbookRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = window.innerWidth - 300; // Account for chat sidebar
    canvas.height = window.innerHeight - 200; // Account for header
    
    // Render grid
    renderGrid(ctx, workbook.sheets[activeSheet], highlightedCells);
  }, [workbook, activeSheet, highlightedCells]);
  
  return (
    <div className="workbook-renderer">
      <canvas ref={canvasRef} className="spreadsheet-canvas" />
    </div>
  );
}

function renderGrid(
  ctx: CanvasRenderingContext2D,
  sheet: WorkbookJSON['sheets'][0],
  highlightedCells: string[]
): void {
  const cellWidth = 100;
  const cellHeight = 30;
  const headerHeight = 30;
  const rowHeaderWidth = 50;
  
  // Clear canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  // Draw column headers (A, B, C, ...)
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(rowHeaderWidth, 0, ctx.canvas.width, headerHeight);
  
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (let col = 0; col < 20; col++) {
    const colLetter = String.fromCharCode(65 + col);
    ctx.fillText(colLetter, rowHeaderWidth + col * cellWidth + cellWidth / 2, headerHeight / 2);
  }
  
  // Draw row headers (1, 2, 3, ...)
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, headerHeight, rowHeaderWidth, ctx.canvas.height);
  
  ctx.fillStyle = '#000';
  for (let row = 0; row < 30; row++) {
    ctx.fillText(String(row + 1), rowHeaderWidth / 2, headerHeight + row * cellHeight + cellHeight / 2);
  }
  
  // Draw grid lines
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  
  // Vertical lines
  for (let col = 0; col <= 20; col++) {
    ctx.beginPath();
    ctx.moveTo(rowHeaderWidth + col * cellWidth, headerHeight);
    ctx.lineTo(rowHeaderWidth + col * cellWidth, ctx.canvas.height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let row = 0; row <= 30; row++) {
    ctx.beginPath();
    ctx.moveTo(rowHeaderWidth, headerHeight + row * cellHeight);
    ctx.lineTo(ctx.canvas.width, headerHeight + row * cellHeight);
    ctx.stroke();
  }
  
  // Render cells
  if (!sheet.cells) return;
  
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  for (const [cellRef, cellData] of Object.entries(sheet.cells)) {
    const { col, row } = parseCellRef(cellRef);
    
    const x = rowHeaderWidth + col * cellWidth;
    const y = headerHeight + row * cellHeight;
    
    // Highlight AI-modified cells
    if (highlightedCells.includes(cellRef)) {
      ctx.fillStyle = '#fef3c7'; // Yellow highlight
      ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
    }
    
    // Apply cell formatting
    ctx.fillStyle = cellData.style?.color || '#000';
    ctx.font = `${cellData.style?.bold ? 'bold' : 'normal'} 12px ${cellData.style?.fontFamily || 'Arial'}`;
    
    // Get display value
    const displayValue = cellData.computed?.v ?? cellData.raw ?? '';
    const formattedValue = formatCellValue(displayValue, cellData.numFmt);
    
    // Draw cell value
    ctx.fillText(formattedValue, x + 5, y + cellHeight / 2, cellWidth - 10);
    
    // Show formula in tooltip (implement separately)
    if (cellData.formula) {
      // Store formula for hover tooltip
    }
  }
}

function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: 0, row: 0 };
  
  const colLetter = match[1];
  const rowNumber = parseInt(match[2], 10);
  
  let col = 0;
  for (let i = 0; i < colLetter.length; i++) {
    col = col * 26 + (colLetter.charCodeAt(i) - 64);
  }
  
  return { col: col - 1, row: rowNumber - 1 };
}

function formatCellValue(value: any, numFmt?: string): string {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'number') {
    if (numFmt?.includes('$')) {
      return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    if (numFmt?.includes('%')) {
      return (value * 100).toFixed(1) + '%';
    }
    if (numFmt?.includes('#,##0')) {
      return value.toLocaleString('en-US');
    }
  }
  
  return String(value);
}
```

### 4.2 Formula Bar & Cell Info

**File**: `client/src/components/workbook/FormulaBar.tsx`

```typescript
export function FormulaBar({ selectedCell, workbook }: FormulaBarProps) {
  const cellData = workbook.sheets[activeSheet]?.cells?.[selectedCell];
  
  return (
    <div className="formula-bar">
      <div className="cell-ref">{selectedCell}</div>
      <div className="formula-input">
        {cellData?.formula ? `=${cellData.formula}` : cellData?.raw ?? ''}
      </div>
      <div className="computed-value">
        {cellData?.computed?.v !== undefined ? `= ${cellData.computed.v}` : ''}
      </div>
      {cellData?.computed?.error && (
        <div className="error-indicator">{cellData.computed.error}</div>
      )}
    </div>
  );
}
```

---

## 🤖 Phase 5: AI Integration with OpenRouter

### 5.1 AI Operation Generator

**File**: `client/src/lib/ai/operation-generator.ts`

```typescript
export async function generateWorkbookOperations(
  userPrompt: string,
  conversationHistory: Message[],
  currentWorkbook?: WorkbookJSON
): Promise<{
  operations: WorkbookOperation[];
  explanation: string;
  confidence: number;
}> {
  const systemPrompt = WORKBOOK_SYSTEM_PROMPT;
  
  const response = await fetch('/api/ai/generate-operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  
  const aiResponse = await response.json();
  
  // Parse JSON response
  const parsed = JSON.parse(aiResponse.choices[0].message.content);
  
  return {
    operations: parsed.operations,
    explanation: parsed.explanation,
    confidence: parsed.confidence ?? 0.8,
  };
}
```

### 5.2 Feedback Loop & Validation

**File**: `client/src/lib/ai/validation.ts`

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export function validateWorkbook(workbook: WorkbookJSON): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  for (const sheet of workbook.sheets) {
    if (!sheet.cells) continue;
    
    for (const [cellRef, cellData] of Object.entries(sheet.cells)) {
      // Check for errors in computed values
      if (cellData.computed?.error) {
        errors.push(`${sheet.name}!${cellRef}: ${cellData.computed.error}`);
      }
      
      // Check for circular references
      if (cellData.computed?.v && typeof cellData.computed.v === 'object' && cellData.computed.v.type === 'CYCLE') {
        errors.push(`${sheet.name}!${cellRef}: Circular reference detected`);
      }
      
      // Warning for missing formulas that might be expected
      if (cellData.formula && !cellData.computed) {
        warnings.push(`${sheet.name}!${cellRef}: Formula not computed`);
      }
      
      // Suggestion for potential improvements
      if (cellData.formula?.includes('/') && !cellData.formula.includes('IF')) {
        suggestions.push(`${sheet.name}!${cellRef}: Consider using IF to handle division by zero`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}
```

---

## 🔄 Phase 6: Prompt Engineering & Examples

### 6.1 Real-Life User Prompts

**File**: `docs/AI_PROMPT_EXAMPLES.md`

| User Prompt | Expected AI Operations | Complexity |
|-------------|----------------------|------------|
| "Create a simple budget" | Create workbook, add sheet, headers (Category, Amount), sample data, SUM total | Low |
| "Track Q1 sales by month" | Create workbook, monthly columns (Jan, Feb, Mar, Q1 Total), row headers (Product), SUM formulas | Low |
| "Budget vs actual for 3 departments" | 3 sheets (Sales, Marketing, Ops), Budget/Actual columns, variance formulas (=C2-B2), Summary sheet with rollup | Medium |
| "Financial consolidation for 5 regions" | 5 regional sheets + Consolidated sheet, cross-sheet SUM formulas, formatting | Medium |
| "YTD revenue tracker with running totals" | Monthly columns, cumulative formulas (=D2+B3 pattern), chart-ready structure | Medium |
| "Commission calculator with tiers" | Tiered commission table, VLOOKUP or nested IF formulas, sample sales data, calculations | High |
| "Expense report with category breakdown" | Multiple expense categories, SUMIF by category, date-based filtering, totals by month/category | High |
| "Variance analysis with thresholds" | Budget/Actual/Variance columns, IF formulas for RED/YELLOW/GREEN status based on % variance | Medium |
| "Import this CSV and analyze it" | Parse CSV, create sheet, detect headers, auto-generate pivot-like summaries with SUMIFS | High |
| "Create P&L statement" | Standard P&L structure (Revenue, COGS, Gross Profit, Expenses, Net Income), subtotals, formulas | High |

### 6.2 Example Prompt → Operation Mapping

**Example: "Create a Q1 budget for Sales and Marketing"**

```json
{
  "intent": "multi_department_budget",
  "operations": [
    {
      "type": "createWorkbook",
      "params": { "name": "Q1 Budget" }
    },
    {
      "type": "addSheet",
      "params": { "name": "Sales", "id": "sales" }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "sales",
        "cells": {
          "A1": { "value": "Month", "style": { "bold": true } },
          "B1": { "value": "Budget", "style": { "bold": true } },
          "C1": { "value": "Actual", "style": { "bold": true } },
          "D1": { "value": "Variance", "style": { "bold": true } },
          "A2": { "value": "January" },
          "B2": { "value": 50000, "numFmt": "$#,##0" },
          "C2": { "value": 0, "numFmt": "$#,##0" },
          "A3": { "value": "February" },
          "B3": { "value": 50000, "numFmt": "$#,##0" },
          "C3": { "value": 0, "numFmt": "$#,##0" },
          "A4": { "value": "March" },
          "B4": { "value": 50000, "numFmt": "$#,##0" },
          "C4": { "value": 0, "numFmt": "$#,##0" },
          "A5": { "value": "Q1 Total", "style": { "bold": true } }
        }
      }
    },
    {
      "type": "setFormula",
      "params": { "sheet": "sales", "cell": "D2", "formula": "=C2-B2" }
    },
    {
      "type": "setFormula",
      "params": { "sheet": "sales", "cell": "D3", "formula": "=C3-B3" }
    },
    {
      "type": "setFormula",
      "params": { "sheet": "sales", "cell": "D4", "formula": "=C4-B4" }
    },
    {
      "type": "setFormula",
      "params": { "sheet": "sales", "cell": "B5", "formula": "=SUM(B2:B4)" }
    },
    {
      "type": "setFormula",
      "params": { "sheet": "sales", "cell": "C5", "formula": "=SUM(C2:C4)" }
    },
    {
      "type": "setFormula",
      "params": { "sheet": "sales", "cell": "D5", "formula": "=C5-B5" }
    },
    {
      "type": "addSheet",
      "params": { "name": "Marketing", "id": "marketing" }
    },
    {
      "type": "setCells",
      "params": {
        "sheet": "marketing",
        "cells": {
          "A1": { "value": "Month", "style": { "bold": true } },
          "B1": { "value": "Budget", "style": { "bold": true } },
          "C1": { "value": "Actual", "style": { "bold": true } },
          "D1": { "value": "Variance", "style": { "bold": true } },
          "A2": { "value": "January" },
          "B2": { "value": 20000, "numFmt": "$#,##0" },
          "C2": { "value": 0, "numFmt": "$#,##0" }
        }
      }
    },
    {
      "type": "compute",
      "params": {}
    }
  ],
  "explanation": "Created Q1 Budget workbook with separate sheets for Sales ($150k budget) and Marketing ($20k budget). Each sheet tracks monthly Budget vs Actual with variance calculations."
}
```

---

## 📊 Phase 7: Implementation Roadmap

### Sprint 1: Foundation (Week 1-2)
- [ ] Create `workbook-capabilities.ts` with full capability mapping
- [ ] Write comprehensive system prompt for AI
- [ ] Define all `WorkbookOperation` types
- [ ] Implement `WorkbookOperationExecutor` class
- [ ] Unit tests for operation execution

### Sprint 2: AI Integration (Week 3-4)
- [ ] Set up OpenRouter API integration
- [ ] Implement `generateWorkbookOperations()` function
- [ ] Create intent parser with entity extraction
- [ ] Build operation validator
- [ ] Test with 20 real-world prompts

### Sprint 3: UI Rendering (Week 5-6)
- [ ] Implement canvas-based grid renderer
- [ ] Add formula bar component
- [ ] Cell highlighting for AI modifications
- [ ] Sheet tabs for multi-sheet navigation
- [ ] Responsive canvas sizing

### Sprint 4: Feedback & Iteration (Week 7-8)
- [ ] Implement validation feedback loop
- [ ] Add error recovery and rollback
- [ ] Create AI correction mechanism
- [ ] User testing with 50+ prompts
- [ ] Performance optimization

### Sprint 5: Advanced Features (Week 9-10)
- [ ] HyperFormula Web Worker integration
- [ ] Streaming AI responses
- [ ] Progressive workbook building
- [ ] Export to Excel functionality
- [ ] Comprehensive documentation

---

## 🧪 Testing Strategy

### Unit Tests
- ✅ Operation executor (each operation type)
- ✅ Intent parser accuracy
- ✅ Validation rules
- ✅ Canvas rendering functions

### Integration Tests
- ✅ AI → Operations → Workbook flow
- ✅ Multi-step operation sequences
- ✅ Error handling and recovery
- ✅ Cross-sheet formula resolution

### E2E Tests
- ✅ 20 real-world user prompts
- ✅ Budget tracker creation
- ✅ Financial consolidation
- ✅ Import/export round-trip
- ✅ Performance (1000+ cells)

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Intent Recognition Accuracy** | >90% | Manual review of 100 prompts |
| **Operation Success Rate** | >95% | Automated test suite |
| **Formula Correctness** | 100% | HyperFormula validation |
| **AI Response Time** | <3s | Performance monitoring |
| **Workbook Render Time** | <500ms | Canvas render profiling |
| **User Satisfaction** | >4.5/5 | User testing surveys |

---

## 🚀 Next Steps

1. **Review & Approve** this plan with stakeholders
2. **Set up project board** with Sprint 1 tasks
3. **Create branch**: `feature/ai-workbook-operations`
4. **Implement** `workbook-capabilities.ts` and system prompts
5. **Build** operation executor with tests
6. **Integrate** with OpenRouter API
7. **Test** with real user prompts
8. **Iterate** based on feedback

---

## 💡 Future Enhancements

- **Natural Language Queries**: "What's the total revenue?" → AI reads workbook and answers
- **Chart Generation**: "Show me a bar chart of monthly sales" → AI creates chart config
- **Data Analysis**: "Find outliers in expenses" → AI analyzes and highlights anomalies
- **Template Library**: Pre-built templates for common scenarios (budgets, P&L, timesheets)
- **Collaborative Editing**: Multi-user workbook editing with conflict resolution
- **Advanced Formatting**: Conditional formatting rules, data validation, protected ranges
- **Macro Recording**: Record user actions and convert to reusable operations
- **Version Control**: Git-like history for workbook changes

---

**Status**: Ready for implementation  
**Estimated Timeline**: 10 weeks  
**Team Required**: 2-3 developers + 1 AI/ML engineer  
**Dependencies**: OpenRouter API access, HyperFormula 3.1.0, Canvas API

Let's build an AI-powered spreadsheet assistant that actually works! 🚀
