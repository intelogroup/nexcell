# 🧩 **Nexcel Technical Requirements Document (TRD)**

## 1. Overview

**App Name:** Nexcel  
**Goal:** A local-first AI-driven spreadsheet that runs HyperFormula locally for instant evaluation, integrates with LLMs for smart actions, and syncs with Google Sheets.  
**Platform:** Web (React + Vite)  
**MVP Phase:** Text-only interaction with Web Speech API for voice input

---

## 2. Architecture Summary

### 2.1 High-Level Architecture

```
┌────────────────────────────┐
│      Client (React + Vite) │
│ - Chat UI (LLM interface)  │
│ - Canvas workbook editor   │
│ - Credits meter            │
│ - Apply/Confirm panel      │
│ - Voice input (Web Speech) │
└──────────────┬─────────────┘
               │ (HTTP/SSE)
┌──────────────┴───────────────┐
│      API Layer (Fastify)     │
│ /api/ai/chat   → LLM worker  │
│ /api/workbook  → CRUD + sync │
│ /api/credits   → balance     │
└──────────────┬───────────────┘
               │ (queue events)
┌──────────────┴───────────────┐
│       Workers Layer (HF)     │
│ - HyperFormula parsing        │
│ - Apply/fix/recalc actions    │
│ - Dry run + preview generator │
│ - Google Sheets export        │
└──────────────┬───────────────┘
               │
┌──────────────┴───────────────┐
│     Database (Neon + Prisma) │
│ - Users                      │
│ - Workbooks (JSONB)          │
│ - Actions (log)              │
│ - Credits (meter)            │
│ - Templates (seeded)         │
└───────────────────────────────┘
```

---

## 3. Core Components

### 3.1 Frontend (React + Vite + TanStack Virtual)

**Responsibilities:**

* Chat-driven interface for workbook manipulation.
* Custom virtualized grid built with TanStack Virtual.
* Contextual action panel for confirmations.
* Credit balance display.
* Streamed AI responses with real-time text output.
* Voice input via Web Speech API.
* Lazy preview generation for "confirm" actions.

**Technical Notes:**

* TypeScript + Zustand for state.
* TanStack Virtual for grid virtualization.
* SSE (Server-Sent Events) for AI streaming.
* Secure storage via Clerk session.
* Sheets export button → triggers `/api/sync/sheets`.

---

### 3.2 Backend (Fastify)

**Responsibilities:**

* Handle workbook CRUD, AI actions, credit checks, and export queue dispatch.
* Rate limiting via in-memory store (MVP).
* Manual credit assignment (no Stripe in MVP).

**Key Routes:**

| Route                     | Function                       |
| ------------------------- | ------------------------------ |
| `POST /api/ai/chat`       | LLM + HF worker orchestration  |
| `POST /api/workbook`      | Create or update workbook      |
| `POST /api/actions/apply` | Apply confirmed action         |
| `GET /api/credits`        | Retrieve credits + usage       |
| `POST /api/export/sheets` | Export workbook to Google Sheets |
| `POST /api/actions/undo`  | Restore previous snapshot      |

**Middleware:**

* Clerk Auth.
* Credit validation.
* JSON schema validation (Ajv).
* Rate limiter (in-memory).

---

### 3.3 Workers Layer

#### 3.3.1 HyperFormula Worker (HF Worker)

**Purpose:** Handle all local computation and validation.

**Responsibilities:**

* Parse workbook JSON (AST + formulas + values).
* Compute formula dependencies.
* Simulate dry runs for previews.
* Apply and recalc confirmed actions.
* Return delta patch to client.

**Interfaces:**

```typescript
type HFWorkerRequest = 
  | { type: 'analyze', payload: Workbook }
  | { type: 'dryRun', action: WorkbookAction }
  | { type: 'apply', action: WorkbookAction }
  | { type: 'validate', action: WorkbookAction }
```

**Runs In:** Node worker threads (via `workerpool`).

---

#### 3.3.2 Sheets Export Worker

**Purpose:** Export workbook to Google Sheets (one-way).

**Responsibilities:**

* Convert workbook to Sheets format.
* Create new sheet or update existing.
* Handle export errors gracefully.
* No bidirectional sync or webhooks.

**Storage:** Uses in-memory queue for MVP.

---

#### 3.3.3 Fixer Worker (LLM Assist)

**Purpose:** Auto-repair failed actions (parse, type, range errors).

**Responsibilities:**

* Runs when HF throws parse or range exception.
* Re-prompts LLM with error context.
* Applies suggested fix if within safe limits.
* Fallback to scaffold template if unrecoverable.

---

### 3.4 Database (Neon + Prisma ORM)

**Tables:**

| Table        | Purpose                           |
| ------------ | --------------------------------- |
| `users`      | Clerk user info, credits, plan    |
| `workbooks`  | Canonical JSON workbook, metadata |
| `actions`    | Full history of AI + user actions |
| `templates`  | Seeded starter workbooks          |

**Schema Highlights:**

```typescript
workbooks: {
  id: uuid,
  ownerId: uuid,
  data: jsonb,         // canonical workbook
  version: int,
  createdAt, updatedAt
}

actions: {
  id: uuid,
  workbookId: uuid,
  type: string,
  payload: jsonb,
  confidence: float,
  autoApplied: boolean,
  oldSnapshot: jsonb,
  createdAt: timestamp
}
```

**Indexes:**

* `idx_workbooks_owner`
* `idx_actions_workbook`
* `idx_actions_createdAt`

---

### 3.5 LLM Orchestration

**LLM Engine:** GPT-4 (OpenAI API)

**System Prompt:**

```typescript
const SYSTEM_PROMPT = `
You are Nexcel's action generator. Return ONLY valid JSON matching this schema:
${JSON.stringify(actionSchema)}

Rules:
- NEVER return markdown
- NEVER explain actions
- ALWAYS validate ranges (A1:Z100 format)
- Use HyperFormula syntax for formulas
`;
```

**Validation:**

* Ajv schema validation
* Range format check
* Intent whitelisting (`apply`, `suggest`, `analyze`, `explain`)
* Confidence gating

**Fallback Chain:**

* Invalid JSON → retry with compact schema
* Invalid intent → force to "suggest"
* Conflict with workbook version → request user retry

### 3.6 Credit System & Hard Limits

**System Limits:**

```typescript
const LIMITS = {
  // Workbook constraints
  maxRows: 5000,
  maxCols: 100,
  maxCells: 500000,        // maxRows * maxCols
  maxFormulas: 1000,
  maxWorkbooks: 10,        // Per user
  
  // Performance limits
  llmCallsPerMin: 10,
  maxQueueDepth: 50,
  dailySpendCap: 500,
  
  // File size limits
  maxFileSize: '10MB',     // Import/export
  maxFormulaLength: 1000,  // Characters
  
  // Memory constraints
  maxMemoryPerWorkbook: '50MB',
  maxConcurrentUsers: 1    // MVP: single user only
};
```

**Flow:**

* Each API call estimates cost post-response using `response.usage.total_tokens`
* Multiply by model cost rate (USD / 1K tokens)
* Deduct from `user.credits`
* Reject if insufficient

**Credit Pricing:**

| Plan | Daily Limit | Credits / day |
|------|-------------|---------------|
| Free | 1 build + 1 preview | 10 |
| Paid ($9/mo) | 5 builds/day | 50 |

---

## 4. Integrations

| Service | Purpose | When |
|---------|---------|------|
| Clerk | Authentication | Sprint 0 |
| Neon | Database | Sprint 0 |
| Prisma ORM | Schema & migration | Sprint 0 |
| HyperFormula | Parsing & calc engine | Sprint 1 |
| Web Speech API | Voice input | Sprint 1 |
| Google Sheets API | Export (one-way) | Sprint 2 |
| Sentry | Error tracking | Sprint 2 |

---

## 5. DevOps / Infrastructure

**Hosting:** Render (frontend + backend + workers)  
**DB:** Neon (Postgres, free tier)  
**Workers:** Render Background Workers  
**Cache:** In-memory (MVP)  
**CI/CD:** GitHub Actions  

### GitHub Actions Flow:

* Run ESLint + TypeCheck + Tests
* Run Prisma migrations
* Deploy on merge to main
* Trigger Neon migration sync

### Environments:

* **dev:** local Neon branch, test LLM key
* **staging:** shared Neon branch, test API keys
* **prod:** main branch, paid API keys

---

## 6. Security

* Clerk auth tokens verified on all API routes
* Row-level access control for workbooks
* LLM output schema validated via Ajv
* Rate limit: 100 requests / minute / user
* Error logs redact formulas and values
* HTTPS-only API routes

---

## 7. Performance Targets

| Metric | Target |
|--------|--------|
| Workbook load time | < 1s (local cache) |
| LLM response latency | < 6s (avg) |
| Preview generation | < 3s |
| Sync delay | < 15s |
| HF worker recalculation | < 200ms for 10K cells |
| Crash rate | < 1% of user sessions |

---

## 8. MVP Exclusions

❌ No advanced speech features (TTS, voice commands)  
❌ No large plugin catalog  
❌ No Sentry / telemetry beyond basic  
❌ No BrowserStack real-device previews  
❌ No real-time multi-user editing (solo only)  

---

## 9. Sprint 0 Deliverables

✅ Prisma schema + migrations  
✅ GitHub Actions CI/CD  
✅ Clerk + Neon integration  
✅ Seed templates migration  
✅ HF worker setup  
✅ Basic chat → action loop prototype  
✅ Credit deduction and blocking  

---

## 10. Future Extensions

| Phase | Feature |
|-------|---------|
| Post-MVP | BrowserStack deep device testing |
| Post-MVP | Sentry + logs dashboard |
| Post-MVP | Real-time multi-user sessions |
| Post-MVP | Local-first offline persistence |
| Post-MVP | Advanced speech features (TTS, voice commands) |

---

## 11. Data Models & Schemas

### 4.1 Canonical Workbook JSON

```typescript
interface Workbook {
  id: string
  name: string
  sheets: Sheet[]
  metadata: {
    version: number
    lastModified: string
    owner: string
    collaborators?: string[]
  }
}

interface Sheet {
  id: string
  name: string
  cells: Record<string, Cell>
  dimensions: {
    rows: number
    cols: number
  }
  namedRanges?: NamedRange[]
}

interface Cell {
  value?: string | number | boolean
  formula?: string
  format?: CellFormat
  type: 'text' | 'number' | 'boolean' | 'formula' | 'date'
}

interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  backgroundColor?: string
  numberFormat?: string
  alignment?: 'left' | 'center' | 'right'
}
```

### 4.2 Action Schema

```typescript
interface WorkbookAction {
  id: string
  type: ActionType
  range: string // A1 notation
  payload: ActionPayload
  description: string
  confidence: number
  metadata: {
    timestamp: string
    userId: string
    source: 'ai' | 'user' | 'fixer'
  }
}

type ActionType = 
  | 'update_cells'
  | 'insert_rows'
  | 'delete_rows'
  | 'insert_columns'
  | 'delete_columns'
  | 'format_range'
  | 'insert_formula'
  | 'sort_range'
  | 'filter_range'
  | 'create_chart'
  | 'merge_cells'
  | 'unmerge_cells'

interface ActionPayload {
  values?: (string | number | boolean)[][]
  formulas?: string[][]
  formats?: CellFormat[][]
  options?: Record<string, any>
}
```

### 4.3 AI Response Schema

```typescript
interface AIResponse {
  intent: 'apply' | 'suggest' | 'analyze' | 'explain'
  confidence: number
  message: string
  action?: WorkbookAction
  suggestions?: string[]
  analysis?: {
    summary: string
    insights: string[]
    recommendations: string[]
  }
  costEstimate: {
    tokens: number
    credits: number
  }
}
```

---

## 5. Technical Specifications

### 5.1 Frontend Architecture

**Framework:** React 18 + Vite  
**Styling:** Tailwind CSS  
**State Management:** Zustand  
**UI Components:** Headless UI + Custom components  
**Grid Component:** Custom virtualized grid with TanStack Virtual  

**Key Features:**
* Fast development with Vite HMR
* Client-side rendering with optimized bundling
* Real-time streaming via Server-Sent Events
* Voice input via Web Speech API
* Optimistic updates for better UX
* Simple formula bar (input field)

**File Structure:**
```
src/
├── pages/
│   ├── auth/
│   ├── dashboard/
│   └── workbook/[id]/
├── components/
│   ├── ui/
│   ├── workbook/
│   └── chat/
├── lib/
│   ├── stores/
│   ├── utils/
│   └── types/
└── workers/
    └── hyperformula.worker.ts
```

### 5.2 Backend Architecture

**Runtime:** Node.js 18+  
**Framework:** Fastify  
**Database:** Neon PostgreSQL with Prisma ORM  
**Authentication:** Clerk  
**Caching:** In-memory (MVP)  
**Error Tracking:** Sentry  

**API Design Patterns:**
* RESTful endpoints with consistent error handling
* Streaming responses for AI interactions
* Manual credit assignment (no webhooks)
* Rate limiting and request validation
* Comprehensive logging and monitoring

### 5.3 Worker Architecture

**HyperFormula Worker:**
```typescript
// Worker pool configuration
const workerPool = workerpool.pool('./hyperformula.worker.js', {
  minWorkers: 2,
  maxWorkers: 8,
  workerType: 'thread'
})

// Worker interface
interface HFWorker {
  analyze(workbook: Workbook): Promise<AnalysisResult>
  dryRun(action: WorkbookAction): Promise<PreviewResult>
  apply(action: WorkbookAction): Promise<ApplyResult>
  validate(action: WorkbookAction): Promise<ValidationResult>
}
```

**Export Worker:**
```typescript
// Simple in-memory queue for MVP
const exportQueue = new Map<string, ExportJob>();

interface ExportJob {
  id: string;
  workbookId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
})
```

---

## 6. Security & Performance

### 6.1 Security Requirements

**Authentication & Authorization:**
* Clerk JWT validation on all protected routes
* User-scoped data access (workbooks, actions)
* Rate limiting per user and IP address
* Input sanitization and validation

**Data Protection:**
* Encrypted data at rest (Neon encryption)
* HTTPS for all communications
* Secure session management
* No sensitive data in client-side code

**AI Safety:**
* System prompt injection prevention
* Output validation and sanitization
* Confidence-based action gating
* Audit logging for all AI actions

### 6.2 Performance Requirements

**Response Times:**
* Cell edits: < 50ms
* AI response start: < 1s
* AI response complete: < 5s
* Workbook save: < 300ms
* Grid rendering: 60fps

**Scalability:**
* Support 1000+ concurrent users
* Handle workbooks up to 100K cells
* Process 100+ AI requests per minute
* Maintain < 2s page load times

**Optimization Strategies:**
* Virtualized grid rendering
* Incremental workbook updates
* Worker thread isolation
* Redis caching for frequent queries
* CDN for static assets

---

## 7. Integration Specifications

### 7.1 Google Sheets Integration

**Authentication:** OAuth 2.0 with Google Sheets API  
**Sync Strategy:** Export-only (no bidirectional sync)  
**Rate Limits:** 100 requests per 100 seconds per user  

**Export Process:**
1. User initiates export from Nexcel
2. Convert Nexcel data to Google Sheets format
3. Create new sheet or overwrite existing
4. Apply formatting and formulas using batchUpdate API
5. Provide success confirmation with sheet link

**Token Refresh Strategy:**
```typescript
const TOKEN_REFRESH = {
  proactiveRefreshThreshold: 300000,  // Refresh if expires in <5min
  maxRefreshAttempts: 3,
  refreshBackoffMs: 1000,
  
  // On failure handling
  dlqStrategy: 'notify_user',         // Move to DLQ + notify user
  retryAfterReauth: true,             // Allow retry after re-auth
  
  // User notification flow
  notificationTypes: {
    tokenExpired: 'Please reconnect your Google account',
    refreshFailed: 'Export failed - please try again',
    dlqMoved: 'Export queued - will retry after reconnection'
  }
};
```

### 7.2 Stripe Integration (Future)

**Payment Processing:** Stripe Checkout  
**Subscription Management:** Stripe Customer Portal  
**Webhook Handling:** Manual credit assignment (no webhooks for MVP)  

**Credit System:**
* Free tier: 100 credits/month
* Pro tier: 1000 credits/month ($9)
* Enterprise: Unlimited ($99)

### 7.3 AI Provider Integration

**Primary:** OpenAI GPT-4  
**Fallback:** Anthropic Claude  
**Rate Limiting:** Token bucket algorithm  
**Cost Tracking:** Per-request token counting  

---

## 8. Deployment & Infrastructure

### 8.1 Deployment Architecture

**Frontend:** Render (Static Site)  
**Backend:** Render (Web Service)  
**Database:** Neon PostgreSQL (Serverless)  
**Cache:** In-memory (Node.js Map)  
**Monitoring:** Sentry  
**CI/CD:** GitHub Actions  

### 8.2 Environment Configuration

```bash
# Production Environment Variables
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_...
OPENAI_API_KEY=sk-...
UPSTASH_REDIS_URL=redis://...
GOOGLE_SHEETS_CLIENT_ID=...
GOOGLE_SHEETS_CLIENT_SECRET=...
STRIPE_SECRET_KEY=sk_...
SENTRY_DSN=https://...
```

### 8.3 Monitoring & Observability

**Application Metrics:**
* Request latency and throughput
* Error rates by endpoint
* AI response times and success rates
* Database query performance
* Worker pool utilization

**Business Metrics:**
* User engagement and retention
* Credit consumption patterns
* Feature usage analytics
* Conversion funnel metrics

**Alerting:**
* API error rate > 5%
* Database connection pool > 80%
* AI service downtime
* Credit system failures

---

## 9. Testing Strategy

### 9.1 Unit Testing

**Coverage Target:** 90%  
**Framework:** Jest + Testing Library  
**Focus Areas:**
* Core business logic
* Data transformations
* Validation functions
* Worker interfaces

### 9.2 Integration Testing

**Framework:** Playwright  
**Test Scenarios:**
* End-to-end user workflows
* AI interaction flows
* Sync operations
* Error handling

### 9.3 Performance Testing

**Tools:** Artillery + Lighthouse  
**Test Cases:**
* Load testing with 1000 concurrent users
* Stress testing large workbooks
* Memory leak detection
* Mobile performance validation

---

## 10. Development Workflow

### 10.1 Development Environment

**Requirements:**
* Node.js 18+
* PostgreSQL (local or Docker)
* Redis (local or Docker)
* Git

**Setup Commands:**
```bash
npm install
npm run db:setup
npm run dev
```

### 10.2 Code Quality

**Linting:** ESLint + Prettier  
**Type Checking:** TypeScript strict mode  
**Pre-commit Hooks:** Husky + lint-staged  
**Code Review:** Required for all PRs  

### 10.3 Release Process

**Branching:** GitFlow with feature branches  
**Versioning:** Semantic versioning  
**Deployment:** Automated via GitHub Actions  
**Rollback:** Blue-green deployment strategy  

---

## 11. Success Metrics

### 11.1 Technical Metrics

* 99.9% uptime
* < 2s average page load time
* < 1% error rate
* 95th percentile response time < 5s

### 11.2 User Experience Metrics

* Time to first interaction < 3s
* AI response satisfaction > 80%
* Feature adoption rate > 60%
* User retention (7-day) > 40%

### 11.3 Business Metrics

* Monthly active users growth
* Credit consumption efficiency
* Conversion to paid plans
* Customer support ticket volume

---

*This TRD serves as the definitive technical specification for implementing the Nexcel AI Spreadsheet Assistant. All development work must conform to these technical requirements and architectural decisions.*