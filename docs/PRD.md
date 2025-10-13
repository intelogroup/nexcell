# 🧠 **Product Requirements Document (PRD)**

### Product: **AI Spreadsheet Assistant (MVP)**

### Version: v1.0 — "Text-Only Alpha"

### Author: Jay & Core Engineering Team

### Status: ✅ Approved for Implementation

---

## 1. 🎯 **Core Objective**

Build an **AI-powered spreadsheet app** that enables users to:

* Edit and analyze spreadsheets via **natural language chat**
* See real-time changes in a **canvas view**
* Safely preview, confirm, or undo AI-generated actions
* Guarantee every operation runs in a **stable, reproducible environment** (no "moving sand")

---

## 2. 🧩 **MVP Scope**

### **Included**

| Feature                           | Description                                                                 |
| --------------------------------- | --------------------------------------------------------------------------- |
| **Chat + AI Context Loop**        | Natural language chat driving actions (apply, suggest, analyze, explain).   |
| **Canvas (Spreadsheet Renderer)** | Virtualized grid synced with HyperFormula engine.                           |
| **Workbook Management**           | CRUD for workbooks; persistent canonical JSON (values, formulas, metadata). |
| **Action Log + Undo System**      | Each change logged as reversible action with snapshot.                      |
| **AI Intent Engine**              | Classifies chat messages → generates structured actions.                    |
| **Credits System**                | Local counter for LLM calls (manual credit assignment for alpha).           |
| **Preview & Confirmation Modal**  | Users confirm high-impact actions before applying.                          |
| **Telemetry**                     | Minimal: action success/fail, latency, Fixer results via Sentry.            |
| **Authentication**                | Clerk-based auth, user sync with Prisma.                                    |
| **Backend Infrastructure**        | React + Vite + Fastify + Neon (Postgres) + Prisma ORM + pnpm monorepo.     |

---

## 3. 🚫 **Out of Scope (For MVP)**

| Out of Scope                       | Notes                                                      |
| ---------------------------------- | ---------------------------------------------------------- |
| Multi-user collaboration           | MVP is **single-user**; later add view-only share.         |
| Mobile touch grid                  | Desktop/web only.                                          |
| Full Excel feature parity          | No pivot tables, charts, or advanced formatting yet.       |
| Stripe paywall                     | Post-MVP (manual credit assignment in MVP).                |
| Device preview tools               | Not needed for web MVP.                                     |

### **MVP System Limits**

| Constraint | Limit | Rationale |
|------------|-------|-----------|
| Max rows per workbook | 5,000 | Performance optimization |
| Max columns per workbook | 100 | Memory management |
| Max cells per workbook | 500,000 | 5000 × 100 limit |
| Max workbooks per user | 10 | Resource allocation |
| Max file size (import/export) | 10MB | Upload/download efficiency |
| Max formula length | 1,000 chars | Parsing performance |
| AI calls per minute | 10 | Cost control |
| Memory per workbook | 50MB | Browser performance |
| Concurrent users per workbook | 1 | MVP single-user only |

---

## 4. 🧱 **Architecture Overview**

### **Frontend**

* **Framework:** React + Vite + TypeScript + Tailwind + shadcn/ui
* **Design:** Chat on left, spreadsheet canvas on right
* **Virtualization:** TanStack Virtual for large grid performance
* **Formula Engine:** HyperFormula (Web Worker instance)
* **State:** Zustand + React Query
* **Type safety:** Zod + shared types across client/server
* **File import/export:** SheetJS
* **Voice Input:** Web Speech API

### **Backend**

* **Runtime:** Node (Render)
* **Framework:** Fastify
* **Auth:** Clerk
* **ORM:** Prisma
* **DB:** Neon (PostgreSQL)
* **AI Gateway:** Serverless function → Claude or GPT (tuned for spreadsheet context)
* **Queue:** Lightweight in-memory for AI task debouncing
* **Telemetry:** Sentry for error tracking

### **Workers**

* **HyperFormula Worker** → Handles formula parsing, recalculation, preview diffing
* **AI Worker** → Executes chat→intent→action pipeline, manages confidence logic
* **Future Alternative:** For scale, can move to dedicated Render background workers

---

## 5. ⚙️ **Core Data Models (Prisma)**

```prisma
model User {
  id            String  @id @default(cuid())
  email         String  @unique
  credits       Float   @default(10.0)
  workbooks     Workbook[]
  createdAt     DateTime @default(now())
}

model Workbook {
  id            String   @id @default(cuid())
  userId        String
  name          String
  data          Json     // Canonical workbook JSON
  metadata      Json     // Formats, styles, etc.
  actionLog     Action[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id])
}

model Action {
  id            String   @id @default(cuid())
  workbookId    String
  type          String
  payload       Json
  message       String
  confidence    Float
  applied       Boolean  @default(false)
  baseVersion   Int
  oldSnapshot   Json?
  newSnapshot   Json?
  createdAt     DateTime @default(now())
  workbook      Workbook @relation(fields: [workbookId], references: [id])
}

model WorkbookTemplate {
  id        String @id @default(cuid())
  name      String
  data      Json
}
```

---

## 6. 💬 **AI Interaction Model**

### **Intent Types**

| Intent | Description |
| ------ | ----------- |
| **apply** | Safe auto-apply action (<200 cells, high confidence) |
| **suggest** | Proposes action → user must confirm |
| **analyze** | Reads workbook, produces insights or summaries |
| **explain** | Describes what happened after actions |

### **AI Context Schema**

```json
{
  "chatHistory": [...],
  "selectedRange": "A1:C10",
  "sheetSchema": {
    "columns": ["Date", "Amount", "Category"],
    "sampleRows": [["2025-10-10", 25, "Groceries"], ...]
  },
  "recentActions": [...],
  "userIntent": "analyze this table"
}
```

### **AI Response Schema**

```json
{
  "intent": "apply",
  "confidence": 0.91,
  "action": {
    "type": "update_range",
    "range": "B2:B51",
    "payload": { "values": [100, 200, 300] }
  },
  "message": "Filled 50 cells with values 100–300.",
  "costEstimate": { "llm": 0.03 }
}
```

---

## 7. 🔁 **Action Lifecycle**

1. **User sends message** in chat.
2. **LLM classifies intent**, validates schema.
3. **AI Worker validates:**
   - Intent ∈ VALID_INTENTS
   - Confidence thresholds
   - Range < 200 cells
4. **If auto-apply** → run HF worker.
5. **Else** → show confirmation modal with preview.
6. **Update Canvas** and log action in DB.
7. **User can undo** → rollback snapshot.

---

## 8. ⚖️ **Safety & Validation**

| Layer | Rule |
| ----- | ---- |
| **Intent Whitelist** | Only 4 intents allowed. |
| **Confidence Thresholds** | 0.85–0.99 depending on risk. |
| **Cell Limit** | 200 cells per auto-action. |
| **Conflict Detection** | Base version vs current workbook version check. |
| **Cost Validation** | Token usage checked post-response. |
| **Schema Validation** | AJV validation on every response. |

---

## 9. ⚡ **UX Flow**

### **Left Panel – Chat**
- Streaming responses (SSE)
- AI message shows action + loading spinner
- "Apply" / "Cancel" buttons appear for confirmable actions
- Partial messages update live

### **Right Panel – Canvas**
- Virtualized sheet view (TanStack Virtual)
- Formula bar at top
- Real-time update after confirmed actions
- Lazy preview on user demand

---

## 10. 💰 **Credits & Stripe**

| Stage | Plan |
| ----- | ---- |
| **Sprint 0–2** | Manual credits (admin CLI adjustment) |
| **Sprint 3** | Stripe integration ($9/month plan) |
| **Post-MVP** | Stripe webhooks for usage-based credits |

---

## 11. 🧠 **Telemetry**

| Metric | Description |
| ------ | ----------- |
| **action_success_rate** | % of AI actions applied successfully |
| **fixer_rescue_rate** | % of errors auto-corrected by Fixer |
| **time_to_preview** | ms between user message → preview ready |
| **credits_used** | total credits per session |
| **ai_latency** | LLM response time |

---

## 12. 🚀 **Sprint Breakdown**

| Sprint | Deliverables |
| ------ | ------------ |
| **Sprint 0 (Infra)** | Monorepo (pnpm + Turbo), Prisma schema, GitHub Actions, seed templates |
| **Sprint 1 (Core)** | Canvas + HyperFormula + AI Worker (mock LLM) |
| **Sprint 2 (LLM)** | Claude/GPT integration + Action pipeline + Preview modal |
| **Sprint 3 (Refinement)** | Stripe integration + cost tracking + telemetry |
| **Sprint 4 (Closed Beta)** | Invite 50–200 testers, monitor metrics |

---

## 13. ✅ **Success Metrics**

- **≥80%** AI-run rate (first attempt success)
- **≤5 min** preview latency (end-to-end)
- **100%** fallback reliability
- **≥40%** Fixer recovery rate
- **≤$ cost cap** within Neon + LLM budget

---

## 14. 📦 **Future Enhancements (Post-MVP)**

- Voice commands (speech2text / text2speech)
- Live co-editing & sharing
- Template marketplace
- Formula autocomplete & hover explainers
- BrowserStack device preview
- AI code export (generate Excel/Google Sheet scripts)

---

## 15. 📚 **References**

- [HyperFormula Docs](https://hyperformula.handsontable.com/)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [Prisma ORM](https://www.prisma.io/)
- [Clerk Auth](https://clerk.com/)
- [Neon Postgres](https://neon.tech/)
- [Appetize.io](https://appetize.io/) (for later preview)

---

## 16. 🔄 **Core User Flows**

### **Primary Flow: Chat → Action → Apply**

1. **User Input:** Types natural language request in chat
2. **AI Processing:** Intent engine classifies message and generates structured action
3. **Preview:** System shows preview of changes in confirmation modal
4. **User Decision:** User confirms, modifies, or rejects the action
5. **Apply:** If confirmed, action is applied to workbook and logged
6. **Feedback:** Canvas updates in real-time, action appears in history

### **Secondary Flows**

* **Undo/Redo:** Users can revert actions from action log
* **File Import:** Upload Excel/CSV files, convert to canonical JSON format
* **File Export:** Download workbook as Excel/CSV
* **Workbook Management:** Create, rename, delete, duplicate workbooks

---

## 17. 🎨 **UI/UX Specifications**

### **Layout**

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo | Workbook Name | Credits | User Menu          │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│ Chat Panel      │ Spreadsheet Canvas                        │
│ (30% width)     │ (70% width)                               │
│                 │                                           │
│ - Message List  │ - Virtualized Grid                        │
│ - Input Field   │ - Formula Bar                             │
│ - Action Log    │ - Column/Row Headers                      │
│                 │ - Context Menus                           │
│                 │                                           │
└─────────────────┴───────────────────────────────────────────┘
```

### **Design System**

* **Colors:** Clean, professional palette with accent colors for AI actions
* **Typography:** Inter font family for readability
* **Components:** shadcn/ui components with custom spreadsheet-specific elements
* **Responsive:** Desktop-first, mobile-friendly chat panel

### **Key Interactions**

* **Chat Input:** Auto-resize textarea with send button and keyboard shortcuts
* **Cell Editing:** Click to edit, Enter to confirm, Escape to cancel
* **Action Preview:** Modal overlay with before/after comparison
* **Confirmation:** Clear accept/reject buttons with action description

---

## 18. 🤖 **AI Integration Specifications**

### **Intent Classification**

The AI system classifies user messages into action types:

* **EDIT_CELLS** - Modify cell values or formulas
* **INSERT_ROWS_COLS** - Add rows or columns
* **DELETE_ROWS_COLS** - Remove rows or columns
* **FORMAT_CELLS** - Apply formatting (bold, color, etc.)
* **ANALYZE_DATA** - Generate insights or summaries
* **CREATE_FORMULA** - Build complex formulas
* **IMPORT_DATA** - Process external data
* **EXPLAIN** - Provide explanations without changes

### **Confidence Scoring**

* **High (0.8-1.0):** Auto-apply simple, low-risk actions
* **Medium (0.5-0.8):** Show preview, require confirmation
* **Low (0.0-0.5):** Ask for clarification or suggest alternatives

### **Context Management**

* Maintain conversation history for context
* Track workbook state and recent changes
* Preserve user preferences and patterns

---

## 19. 🔒 **Security & Privacy**

### **Data Protection**

* All workbook data encrypted at rest
* User authentication via Clerk (OAuth providers)
* No sensitive data in logs or telemetry
* GDPR-compliant data handling

### **AI Safety**

* Sandbox AI operations to prevent harmful actions
* Rate limiting on AI requests
* Input validation and sanitization
* Audit trail for all AI-generated changes

---

## 20. 📊 **Performance Requirements**

### **Frontend Performance**

* **Grid Rendering:** Handle 10,000+ cells with smooth scrolling
* **Formula Calculation:** Sub-100ms for typical formulas
* **Chat Response:** <2 seconds for AI responses
* **File Import:** Support files up to 10MB

### **Backend Performance**

* **API Response Time:** <500ms for CRUD operations
* **Database Queries:** Optimized with proper indexing
* **Concurrent Users:** Support 100+ simultaneous users
* **Uptime:** 99.9% availability target

---

## 21. 🧪 **Testing Strategy**

### **Unit Testing**

* Formula engine accuracy
* AI intent classification
* Data model validation
* Component functionality

### **Integration Testing**

* End-to-end user flows
* AI → Database → UI pipeline
* File import/export accuracy
* Authentication flows

### **Performance Testing**

* Large dataset handling
* Concurrent user simulation
* Memory usage optimization
* Load testing on key endpoints

---

## 22. 📈 **Success Metrics**

### **User Engagement**

* Daily/Monthly Active Users
* Session duration
* Actions per session
* Chat messages per user

### **Product Performance**

* AI action success rate
* User confirmation rate for AI suggestions
* Time to complete common tasks
* Error rates and recovery

### **Business Metrics**

* User retention (Day 1, 7, 30)
* Credit consumption patterns
* Feature adoption rates
* User feedback scores

---

## 23. 🚀 **Implementation Phases**

### **Phase 1: Core Foundation (Weeks 1-4)**

* Project setup and architecture
* Basic authentication and user management
* Simple spreadsheet canvas with cell editing
* Basic chat interface (no AI yet)

### **Phase 2: AI Integration (Weeks 5-8)**

* AI intent engine implementation
* Action system with preview/confirmation
* Formula engine integration
* Undo/redo functionality

### **Phase 3: Polish & Launch (Weeks 9-12)**

* File import/export
* Performance optimization
* UI/UX refinements
* Testing and bug fixes
* Alpha launch preparation

---

## 24. 🔧 **Technical Debt & Future Considerations**

### **Known Technical Debt**

* In-memory queue will need Redis for scale
* Manual credit system needs Stripe integration
* Single-user limitation needs collaboration architecture
* Basic telemetry needs comprehensive analytics

### **Scalability Considerations**

* Database sharding strategy for large user base
* CDN for static assets and file storage
* Microservices architecture for AI processing
* Real-time collaboration infrastructure

---

## 25. 📋 **Acceptance Criteria**

### **MVP Launch Criteria**

- [ ] User can create, edit, and delete workbooks
- [ ] Chat interface processes natural language requests
- [ ] AI generates accurate actions with confidence scores
- [ ] Users can preview and confirm AI-suggested changes
- [ ] Undo/redo system works reliably
- [ ] File import/export functions correctly
- [ ] Authentication and user management operational
- [ ] Performance meets specified benchmarks
- [ ] Security measures implemented and tested
- [ ] Basic telemetry and error tracking active

### **Quality Gates**

- [ ] 90%+ test coverage on critical paths
- [ ] No critical security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Accessibility standards compliance
- [ ] Cross-browser compatibility verified
- [ ] Documentation complete and accurate

---

*This PRD serves as the definitive specification for the AI Spreadsheet Assistant MVP. All implementation decisions should align with these requirements, and any changes must be documented and approved through the change management process.*