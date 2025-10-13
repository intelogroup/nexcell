# 🚀 Quick Start Guide - Developer Onboarding

## TL;DR - Get Running in 5 Minutes

```bash
# 1. Clone and install
git clone <repo> && cd nexcell
pnpm install

# 2. Set up environment (backend)
cd apps/backend
cp .env.example .env
# Edit .env: Add DATABASE_URL and CLERK_SECRET_KEY

# 3. Set up environment (frontend)
cd ../frontend
cp .env.example .env
# Edit .env: Add VITE_CLERK_PUBLISHABLE_KEY

# 4. Database setup
cd ../backend
pnpm db:push
pnpm db:seed

# 5. Start everything
cd ../..
pnpm dev
```

**Frontend**: http://localhost:5173  
**Backend**: http://localhost:3001  
**API Docs**: http://localhost:3001/docs

---

## 🔑 Required Environment Variables

### Backend (`apps/backend/.env`)
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/nexcell"
CLERK_SECRET_KEY="sk_test_..." # Get from dashboard.clerk.com
CLERK_PUBLISHABLE_KEY="pk_test_..."
PORT=3001
NODE_ENV="development"
```

### Frontend (`apps/frontend/.env`)
```bash
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..." # Same as backend
VITE_API_URL="http://localhost:3001"
```

---

## 📁 Project Structure

```
nexcell/
├── apps/
│   ├── backend/          # Fastify API
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/ # Auth, credits
│   │   │   └── index.ts  # Entry point
│   │   └── prisma/
│   │       ├── schema.prisma # Database schema
│   │       └── seed.ts       # Test data
│   │
│   └── frontend/         # React + Vite
│       ├── src/
│       │   ├── components/ # UI components
│       │   │   ├── grid/   # Spreadsheet grid
│       │   │   └── auth/   # Auth buttons
│       │   ├── pages/      # Route pages
│       │   ├── services/   # API clients
│       │   ├── stores/     # Zustand state
│       │   └── lib/        # Utils, formula engine
│       └── public/
│
├── docs/                 # Documentation
│   ├── EXPERT_REVIEW_REPORT.md # Detailed review
│   └── PHASE1_IMPLEMENTATION.md # Phase 1 summary
│
└── packages/            # Shared code (empty for now)
```

---

## 🔧 Key Files to Know

### Backend
- `apps/backend/src/index.ts` - Server setup, plugin registration
- `apps/backend/src/routes/workbooks.ts` - CRUD operations
- `apps/backend/src/middleware/auth.ts` - Clerk authentication
- `apps/backend/prisma/schema.prisma` - Database models

### Frontend
- `apps/frontend/src/App.tsx` - Routes, auth setup
- `apps/frontend/src/stores/workbook.store.ts` - Zustand state
- `apps/frontend/src/components/grid/Grid.tsx` - Main spreadsheet
- `apps/frontend/src/services/workbook.service.ts` - API hooks

---

## 🧪 Common Development Tasks

### Add a New API Endpoint
1. Create route in `apps/backend/src/routes/[name].ts`
2. Register in `apps/backend/src/index.ts`
3. Add schema for Swagger docs
4. Create service hook in `apps/frontend/src/services/[name].service.ts`

### Modify Database Schema
```bash
cd apps/backend
# 1. Edit prisma/schema.prisma
# 2. Generate migration
pnpm prisma migrate dev --name your_change_name
# 3. Update TypeScript types
pnpm db:generate
```

### Add a New React Component
```bash
cd apps/frontend/src/components
mkdir my-component
touch my-component/MyComponent.tsx
# Follow existing component patterns (Grid, Cell, etc.)
```

### Debug Issues
```bash
# Backend logs
cd apps/backend
pnpm dev # Watch console output

# Frontend errors
# Open browser DevTools (F12)
# Check Console and Network tabs

# Database inspection
cd apps/backend
pnpm db:studio # Opens Prisma Studio
```

---

## 🐛 Known Issues & Workarounds

### Issue: "User not found" after sign-in
**Fix**: User sync happens automatically on first load. Wait 2 seconds and refresh.

### Issue: TypeScript errors in IDE
**Fix**: Restart TypeScript server (VS Code: Cmd/Ctrl+Shift+P → "Restart TS Server")

### Issue: Formula bar not updating
**Fix**: Check browser console for errors. Formula engine state might be stale.

### Issue: Backend won't start - "Port in use"
**Fix**: Kill existing process: `npx kill-port 3001`

---

## 📊 Database Schema Quick Reference

### User
```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  credits   Float    @default(10.0)
  workbooks Workbook[]
}
```

### Workbook
```prisma
model Workbook {
  id          String   @id @default(cuid())
  name        String
  data        Json     // Sheets, cells, formats
  version     Int      @default(1)
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
}
```

### WorkbookTemplate
```prisma
model WorkbookTemplate {
  id          String   @id @default(cuid())
  name        String
  category    String?
  data        Json
  isPublic    Boolean  @default(false)
  isOfficial  Boolean  @default(false)
}
```

---

## 🎨 UI Component Patterns

### Using Zustand Store
```typescript
import { useWorkbookStore } from '@/stores/workbook.store'

function MyComponent() {
  const workbookData = useWorkbookStore(state => state.workbookData)
  const updateCell = useWorkbookStore(state => state.updateCell)
  
  // Use workbookData and updateCell
}
```

### Using React Query Hooks
```typescript
import { useWorkbooks, useCreateWorkbook } from '@/services/workbook.service'

function MyComponent() {
  const { data: workbooks, isLoading } = useWorkbooks()
  const createWorkbook = useCreateWorkbook()
  
  const handleCreate = async () => {
    await createWorkbook.mutateAsync({ name: 'New Workbook' })
  }
}
```

### API Error Handling
```typescript
try {
  await mutation.mutateAsync(data)
} catch (error) {
  console.error('Failed:', error)
  // TODO: Show toast notification
}
```

---

## 🧰 Useful Commands

```bash
# Frontend
cd apps/frontend
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm exec tsc --noEmit # Type check

# Backend
cd apps/backend
pnpm dev          # Start with hot reload
pnpm build        # Compile TypeScript
pnpm start        # Run compiled code
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Seed database with templates

# Root (runs all workspaces)
pnpm dev          # Start frontend + backend
pnpm build        # Build everything
pnpm clean        # Remove node_modules
```

---

## 📚 Further Reading

- [PRD.md](./docs/PRD.md) - Product requirements
- [SDS.md](./docs/SDS.md) - System design
- [TRD.md](./docs/TRD.md) - Technical requirements
- [EXPERT_REVIEW_REPORT.md](./docs/EXPERT_REVIEW_REPORT.md) - Code review
- [PHASE1_IMPLEMENTATION.md](./docs/PHASE1_IMPLEMENTATION.md) - Implementation log

---

## 🆘 Need Help?

1. Check [EXPERT_REVIEW_REPORT.md](./docs/EXPERT_REVIEW_REPORT.md) for known issues
2. Search existing issues on GitHub
3. Review Clerk docs: https://clerk.com/docs
4. Review Prisma docs: https://www.prisma.io/docs
5. Review HyperFormula docs: https://handsontable.github.io/hyperformula/

---

**Last Updated**: October 12, 2025  
**Current Phase**: Phase 1 Complete ✅  
**Next Sprint**: Error Handling + Testing (Phase 2)
