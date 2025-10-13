# ⚙️ **Functional Requirements Document (FRD)**

### Product: AI Spreadsheet Assistant (Text-Only MVP)

### Version: v1.0

### Author: Jay & Engineering Team

### Status: ✅ Approved for Development

---

## **1. Purpose**

This document defines the **functional specifications and behavioral requirements** for the spreadsheet-AI MVP.
It translates the PRD's product goals into **concrete, testable, and implementable functions** for developers.

---

## **2. System Overview**

The system consists of **three main layers**:

```
┌─────────────────────────────────────────────┐
│ User Interface (Chat + Canvas)              │
│ React + Vite + TypeScript + Zustand         │
└─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│ AI Logic Layer                              │
│ Intent Detection + Validation + Action Flow │
│ (Claude/GPT via server-side functions)      │
└─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│ Core Engine Layer                           │
│ HyperFormula Worker + Prisma + Neon DB      │
└─────────────────────────────────────────────┘
```

---

## **3. Functional Modules**

### **3.1 Authentication**

**Requirements**

* Implemented using **Clerk**.
* User identity persisted in Neon database via **Prisma user sync**.
* Must support:
  * Email + password
  * Google OAuth
* Auth context shared across web and API layers.

**Functional Flow**

1. User signs in via Clerk.
2. Clerk JWT verified in Fastify middleware.
3. User record fetched/created in DB on first login.

---

### **3.2 Workbook Management**

**Entities:** `Workbook`, `Sheet`, `Cell`, `Action`.

**Functional Behavior**

* Create new workbook → blank canonical JSON:

  ```json
  {
    "sheets": [{ "name": "Sheet1", "cells": {}, "formats": {} }],
    "metadata": { "activeSheet": "Sheet1", "theme": "light" }
  }
  ```
* Save workbook to Postgres (JSONB).
* Retrieve workbook and hydrate canvas view.
* Auto-save every 30 seconds or on confirmed action.
* Each workbook version increments on every modification.

---

### **3.3 Canvas (Spreadsheet UI)**

**Core Responsibilities**

* Display virtualized grid using **TanStack Virtual**.
* Handle up to **10,000 visible cells** smoothly.
* Sync bidirectionally with HyperFormula Worker.
* Show:
  * Formula bar (one active cell)
  * Selected range highlight
  * Edit mode + validation errors

**Interactions**

| Event          | Behavior                                 |
| -------------- | ---------------------------------------- |
| Cell click     | Sets selection, updates formula bar      |
| Type input     | Edits cell, recalculates via HF worker   |
| Press Enter    | Commits edit, triggers recalculation     |
| Scroll         | Virtualized render updates visible range |
| Paste external | Value-only paste; formatting stripped    |

---

### **3.4 HyperFormula Worker**

**Purpose**

* Offload formula parsing, dependency resolution, and recalculation to a separate thread.

**Implementation**

* Runs as Web Worker.
* Exposes APIs:

  ```typescript
  init(data: WorkbookJSON)
  evaluate(cellRef: string)
  applyAction(action: WorkbookAction)
  getDiff(oldSnapshot, newSnapshot)
  dryRun(action)
  ```

**Functional Guarantees**

* Deterministic recalculation.
* Thread-safe communication with main thread.
* Errors serialized and sent back to UI.

---

### **3.5 Chat + AI Interaction**

**Functional Flow**

1. **User Message Input**
   → Sent to backend `/api/ai/chat`.
   → Includes `chatHistory`, `sheetSchema`, `selection`, and `recentActions`.

2. **Intent Classification**
   AI model returns structured JSON:

   ```json
   { "intent": "apply", "confidence": 0.92, "action": {...}, "message": "..." }
   ```

3. **Validation Pipeline**

   * Schema validation (AJV)
   * Intent whitelisting (`apply`, `suggest`, `analyze`, `explain`)
   * Confidence threshold per action type
   * Cell limit enforcement (≤200)
   * Version conflict check

4. **Action Handling**

   * **Auto-apply**: Executes directly if safe.
   * **Suggest/Confirm**: Shows modal preview.
   * **Analyze**: Returns textual insight only.
   * **Explain**: Describes past action impact.

5. **AI Streaming**

   * Backend sends partial responses via **Server-Sent Events (SSE)**.
   * Frontend updates chat progressively.

6. **Chat Context Strategy**

   ```typescript
   const CHAT_CONTEXT = {
     messagesWindow: 5,              // Last 5 messages for context
     summaryRefreshEvery: 10,        // Summarize after 10 new messages
     summarizerModel: 'gpt-4o-mini', // Cheap model for summaries
     maxContextSize: 8192            // Max tokens for context
   };
   ```

7. **Range Sampling Strategy**

   ```typescript
   const RANGE_SAMPLING = {
     fullSendThreshold: 200,         // Send full data if <200 cells
     sampleHead: 5,                  // First 5 rows
     sampleTail: 5,                  // Last 5 rows
     includeStats: true,             // Min, max, count, etc.
     schemaOnly: false               // Include column headers + types
   };
   ```

8. **Batch Apply Configuration**

   ```typescript
   const BATCH_CONFIG = {
     maxLocalBatchSize: 50,          // Max actions per batch
     applyAnimationMs: 400,          // Animation duration
     progressiveUpdate: true,        // Show intermediate states
     rollbackOnError: true           // Revert batch if any action fails
   };
   ```

---

### **3.6 Action Management**

**Actions Structure**

```typescript
{
  id: string
  type: "update_range" | "add_rows" | "delete_rows" | "format_range" | "insert_formula"
  range: string
  payload: Record<string, any>
  confidence: number
  baseVersion: number
  applied: boolean
  message: string
}
```

**Execution Rules**

* Each action applied via `hfWorker.applyAction()`.
* If preview mode:
  → Run `dryRun(action)` to compute diff for modal.
* On confirmation → commit, update DB, increment workbook version.
* Undo = revert to `oldSnapshot`.

---

### **3.7 Action Validation Logic**

**Core Validator**
```typescript
interface ValidationResult {
  isValid: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  affectedCells: number;
  requiresConfirmation: boolean;
}

const validateAction = (action: Action, context: WorkbookContext): ValidationResult => {
  // Schema validation
  if (!isValidActionSchema(action)) {
    return { isValid: false, confidence: 0, riskLevel: 'high', affectedCells: 0, requiresConfirmation: false };
  }
  
  // Calculate confidence and risk
  const confidence = calculateConfidence(action, context);
  const affectedCells = countAffectedCells(action);
  const riskLevel = determineRiskLevel(action.type, affectedCells);
  
  return {
    isValid: true,
    confidence,
    riskLevel,
    affectedCells,
    requiresConfirmation: shouldRequireConfirmation(confidence, riskLevel, affectedCells)
  };
};
```

**Confidence Threshold Table**

| Action Type | Threshold |
|-------------|-----------|
| add_rows | 0.85 |
| format_range | 0.90 |
| insert_formula | 0.95 |
| delete_rows | 0.99 |

### **3.8 Confirmation Modal**

**Functional Behavior**

Appears when:
- Confidence < threshold
- Cells > 200
- Schema ambiguous

Shows summary:
- Cells affected
- Description
- Optional preview on click (lazy HF dry-run)

Buttons: [Apply] [Cancel] [Show Preview]

### **3.9 Undo/Redo System**

**Functional Rules**

Each committed action stores:
- oldSnapshot (before change)
- newSnapshot (after change)

Undo restores oldSnapshot.
Redo re-applies newSnapshot.
Undo stack capped to 50 actions per workbook.

### **3.10 Credits System**

**Functional Details**

Each AI action consumes credits proportional to token usage.
MVP = Manual assignment via admin CLI.

Credits checked post-response:
```typescript
const cost = tokens / 1000 * MODEL_PRICE;
if (cost > user.credits) reject("Insufficient credits");
else deduct(cost);
```

Stripe integration in Sprint 3.

### **3.11 Telemetry**

**Collected Data**

| Metric | Source | Granularity |
|--------|--------|-------------|
| action_success_rate | backend | per user/session |
| ai_latency | API gateway | ms |
| time_to_preview | client | ms |
| fixer_rescue_rate | AI worker | per action type |
| credits_used | backend | per call |

**Implementation**

Lightweight telemetry.logEvent(type, payload) wrapper.
Batched writes every 10s to avoid DB overhead.

### **3.12 Error Handling**

**Error Types**

| Type | Example | Handling |
|------|---------|----------|
| SchemaError | Missing field | Return structured error to AI worker |
| ConflictError | Outdated base version | Ask user to retry |
| RangeError | Invalid A1 notation | Display inline error |
| HFError | Formula parse failed | Red underline, user retry |
| LLMError | Invalid JSON | Fallback to text response |

### **3.13 Performance Constraints**

| Metric | Target |
|--------|--------|
| Max workbook size | 500K cells (5000 rows × 100 cols) |
| Max workbooks per user | 10 workbooks |
| Max file size | 10MB (import/export) |
| Max formula length | 1000 characters |
| HF worker response | < 100ms for ≤1K cells |
| AI latency | ≤ 5s average |
| AI calls per minute | 10 per user |
| Chat context size | ≤ 8KB JSON per call |
| Virtualized scroll FPS | ≥ 55fps on mid device |
| Memory per workbook | ≤ 50MB |

### **3.14 Security**

| Concern | Mitigation |
|---------|------------|
| LLM injection (prompt override) | System prompt enforcement & output validation |
| Cross-user access | Clerk JWT + DB userId checks |
| Data integrity | Version stamping + atomic updates |
| Credential safety | .env secrets per workspace |

### **3.15 Stripe Integration (Phase 3)**

**Planned Behavior**

- Subscription plans: $9/month, $90/year.
- Stripe checkout flow triggered in account settings.
- Manual credit assignment on payment success (no webhooks for MVP).

---

## **4. Non-Functional Requirements**

| Category | Requirement |
|----------|-------------|
| Reliability | 99% uptime target, local-first sync fallback. |
| Scalability | Worker pool for HF + LLM parallelism. |
| Maintainability | Monorepo with typed packages. |
| Testability | Unit tests: 70% coverage on HF + AI logic. |
| Observability | Minimal logs + event traces for AI ops. |
| Extensibility | Support future collaborative mode + audio I/O. |

## **5. Sequence Flows**

### **Chat → Action Application Flow**

```
User types request
    ↓
Frontend sends /api/ai/chat → { context }
    ↓
LLM generates structured JSON
    ↓
AI Worker validates → intent, confidence, size
    ↓
Safe? → Apply directly
Unsafe? → Show preview modal
    ↓
Action applied → HF worker recalculates
    ↓
Canvas updates → Action logged in DB
    ↓
Chat updated with confirmation message
```

## **6. API Endpoints**

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/ai/chat | Main LLM handler |
| POST | /api/workbooks | Create workbook |
| GET | /api/workbooks/:id | Fetch workbook |
| POST | /api/actions/apply | Apply action |
| POST | /api/actions/undo | Undo last action |
| POST | /api/credits/adjust | Admin credit ops |
| POST | /api/telemetry | Log telemetry events |

## **7. Acceptance Criteria**

| ID | Feature | Acceptance Test |
|----|---------|-----------------|
| F1 | Workbook CRUD | User can create, open, edit, and auto-save workbook |
| F2 | AI apply | AI can modify ≤200 cells automatically |
| F3 | AI confirm | Preview modal appears for risky actions |
| F4 | Undo/Redo | Reverts or reapplies last action |
| F5 | Conflict Safety | Concurrent edits trigger retry prompt |
| F6 | Credits | Rejects actions if credits < required |
| F7 | Telemetry | Logs success/failure to DB |
| F8 | Auth | Only signed-in users access data |
| F9 | Canvas performance | Scroll remains ≥55fps on large sheets |
| F10 | Error feedback | All errors visible in UI with descriptive message |

## **8. Deployment & CI**

**CI/CD: GitHub Actions**

Lint + Type check + Prisma migrate + Build

**Deploy Targets:**
- Frontend: Render (Static Site)
- Backend + DB: Render + Neon

**Seed Data:** 6 workbook templates (budget, invoice, etc.)

**Environment Variables:**
DATABASE_URL, CLERK_SECRET, OPENAI_KEY, SENTRY_DSN

## **9. Open Questions**

| Topic | Decision Needed |
|-------|-----------------|
| Streaming retry policy | Abort after 15s or continue buffering? |
| AI temperature | Fixed (0.2) or adaptive per intent? |
| Formula autocomplete | Phase 2 (MVP uses simple input field) |

## **✅ Final Validation Summary**

| Quality | Status |
|---------|--------|
| Functional Completeness | ✅ 100% |
| Safety/Validation | ✅ Solid (multi-layer) |
| Performance | ✅ Feasible for MVP scale |
| Testability | ✅ Unit + Integration coverage planned |
| Extensibility | ✅ Modular, typed, monorepo-ready |

---

---

*This FRD serves as the definitive technical specification for implementing the AI Spreadsheet Assistant MVP. All code must conform to these functional requirements and pass the specified acceptance criteria.*