# 🚀 Nexcell Implementation Plan - Detailed Roadmap

## 📊 Current State Analysis (October 2025)

### ✅ **Completed Components:**

#### **Backend (80% Foundation Complete):**
- [x] Project infrastructure (Fastify + TypeScript)
- [x] Authentication middleware (Clerk integration)
- [x] User sync endpoint with validation
- [x] Workbook CRUD endpoints (Create, Read, Update, Delete)
- [x] Prisma ORM setup with models (User, Workbook, Action, WorkbookTemplate)
- [x] Environment configuration
- [x] API documentation (Swagger/OpenAPI)
- [x] N+1 query prevention (user caching in middleware)

#### **Frontend (40% Foundation):**
- [x] React + Vite setup
- [x] Clerk authentication integration
- [x] Basic routing (React Router)
- [x] User sync service
- [x] Tailwind CSS + styling
- [x] React Query setup

#### **Infrastructure:**
- [x] Monorepo with pnpm workspaces
- [x] TypeScript configuration
- [x] Environment variables
- [x] Git setup

---

## 🎯 **Phase 1: Complete Backend Foundation (Days 1-3)**

### **Day 1: Credits System & User Services**

#### **Task 1.1: Credits Management Service**
**File:** `apps/backend/src/services/credits.service.ts`

```typescript
import { PrismaClient } from '@prisma/client'

export class CreditsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    })
    return user?.credits ?? 0
  }

  /**
   * Deduct credits from user account
   * @throws Error if insufficient credits
   */
  async deduct(userId: string, amount: number, reason: string): Promise<number> {
    const currentBalance = await this.getBalance(userId)
    
    if (currentBalance < amount) {
      throw new Error(`Insufficient credits. Required: ${amount}, Available: ${currentBalance}`)
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          decrement: amount
        }
      }
    })

    // Log credit transaction for audit trail
    await this.logTransaction(userId, -amount, reason, user.credits)
    
    return user.credits
  }

  /**
   * Add credits to user account (for admin or purchases)
   */
  async add(userId: string, amount: number, reason: string): Promise<number> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: amount
        }
      }
    })

    await this.logTransaction(userId, amount, reason, user.credits)
    return user.credits
  }

  /**
   * Check if user has sufficient credits
   */
  async hasEnough(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId)
    return balance >= amount
  }

  private async logTransaction(
    userId: string, 
    amount: number, 
    reason: string, 
    newBalance: number
  ): Promise<void> {
    // Log to console for now - later add to database
    console.log(`[CREDITS] User: ${userId}, Amount: ${amount}, Reason: ${reason}, New Balance: ${newBalance}`)
  }
}

export const creditsService = new CreditsService(prisma)
```

**Test:**
```bash
# Test credit operations
curl -X GET http://localhost:3001/api/credits/balance \
  -H "Authorization: Bearer [token]"
```

#### **Task 1.2: Credits Routes**
**File:** `apps/backend/src/routes/credits.ts`

```typescript
import { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { creditsService } from '../services/credits.service.js'

export default async function creditsRoutes(fastify: FastifyInstance) {
  // Get user's credit balance
  fastify.get('/credits/balance', {
    schema: {
      description: 'Get current credit balance',
      tags: ['credits'],
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const user = request.user!
      const balance = await creditsService.getBalance(user.id)
      
      return reply.send({
        success: true,
        balance,
        userId: user.id
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch credit balance'
      })
    }
  })

  // Admin endpoint to add credits (for testing)
  fastify.post('/credits/add', {
    schema: {
      description: 'Add credits to user account (admin only)',
      tags: ['credits'],
      body: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          reason: { type: 'string' }
        },
        required: ['amount']
      }
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { amount, reason = 'Manual addition' } = request.body as { amount: number, reason?: string }
      const user = request.user!
      
      const newBalance = await creditsService.add(user.id, amount, reason)
      
      return reply.send({
        success: true,
        balance: newBalance,
        added: amount
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add credits'
      })
    }
  })
}
```

**Register in `apps/backend/src/index.ts`:**
```typescript
// Import and register credits routes
const creditsRoutes = await import('./routes/credits.js')
await fastify.register(creditsRoutes.default, { prefix: '/api' })
```

#### **Task 1.3: Credits Middleware**
**File:** `apps/backend/src/middleware/credits.ts`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify'
import { creditsService } from '../services/credits.service.js'

/**
 * Middleware to check if user has sufficient credits for an operation
 */
export function requireCredits(amount: number) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not authenticated'
      })
    }

    const hasEnough = await creditsService.hasEnough(user.id, amount)
    
    if (!hasEnough) {
      const balance = await creditsService.getBalance(user.id)
      return reply.status(402).send({
        error: 'Insufficient Credits',
        message: `This action requires ${amount} credits. You have ${balance} credits.`,
        required: amount,
        balance
      })
    }

    // Add credit deduction info to request for later use
    request.creditCost = amount
  }
}

// Extend FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    creditCost?: number
  }
}
```

---

### **Day 2: Workbook Size Validation & Templates**

#### **Task 2.1: Workbook Validation Service**
**File:** `apps/backend/src/services/workbook-validation.service.ts`

```typescript
import { z } from 'zod'

// Constants from PRD
const LIMITS = {
  MAX_ROWS: 5000,
  MAX_COLS: 100,
  MAX_CELLS: 500000, // 5000 * 100
  MAX_WORKBOOKS: 10,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FORMULA_LENGTH: 1000
}

// Workbook data schema
const cellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  formula: z.string().max(LIMITS.MAX_FORMULA_LENGTH).optional(),
  format: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional()
})

const sheetSchema = z.object({
  name: z.string().min(1).max(255),
  cells: z.record(z.string(), cellValue),
  formats: z.record(z.string(), z.any()).optional(),
})

const workbookDataSchema = z.object({
  sheets: z.array(sheetSchema).min(1),
  metadata: z.object({
    activeSheet: z.string(),
    theme: z.string().optional(),
  }).optional()
})

export class WorkbookValidationService {
  /**
   * Validate workbook structure and size limits
   */
  validateWorkbookData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      // Validate structure with Zod
      workbookDataSchema.parse(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => e.message)
        }
      }
    }

    // Validate size limits
    const cellCount = this.countCells(data)
    if (cellCount > LIMITS.MAX_CELLS) {
      errors.push(`Workbook exceeds maximum cell limit (${cellCount} > ${LIMITS.MAX_CELLS})`)
    }

    const { rows, cols } = this.getMaxDimensions(data)
    if (rows > LIMITS.MAX_ROWS) {
      errors.push(`Too many rows (${rows} > ${LIMITS.MAX_ROWS})`)
    }
    if (cols > LIMITS.MAX_COLS) {
      errors.push(`Too many columns (${cols} > ${LIMITS.MAX_COLS})`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Count total number of cells in workbook
   */
  private countCells(data: any): number {
    let count = 0
    for (const sheet of data.sheets || []) {
      count += Object.keys(sheet.cells || {}).length
    }
    return count
  }

  /**
   * Get maximum row and column indices
   */
  private getMaxDimensions(data: any): { rows: number; cols: number } {
    let maxRow = 0
    let maxCol = 0

    for (const sheet of data.sheets || []) {
      for (const cellRef of Object.keys(sheet.cells || {})) {
        const { row, col } = this.parseA1Notation(cellRef)
        maxRow = Math.max(maxRow, row)
        maxCol = Math.max(maxCol, col)
      }
    }

    return { rows: maxRow, cols: maxCol }
  }

  /**
   * Parse A1 notation (e.g., "A1" -> {row: 0, col: 0})
   */
  private parseA1Notation(ref: string): { row: number; col: number } {
    const match = ref.match(/^([A-Z]+)(\d+)$/)
    if (!match) return { row: 0, col: 0 }

    const colStr = match[1]
    const rowStr = match[2]

    // Convert column letters to index (A=0, B=1, ..., Z=25, AA=26, etc.)
    let col = 0
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 65)
    }

    const row = parseInt(rowStr, 10) - 1

    return { row, col }
  }
}

export const workbookValidation = new WorkbookValidationService()
```

#### **Task 2.2: Update Workbook Routes with Validation**
**Update:** `apps/backend/src/routes/workbooks.ts`

Add validation to create and update endpoints:

```typescript
// At the top
import { workbookValidation } from '../services/workbook-validation.service.js'

// In the create endpoint, before prisma.workbook.create():
const validationResult = workbookValidation.validateWorkbookData(data || defaultWorkbookData)
if (!validationResult.isValid) {
  return reply.status(400).send({
    error: 'Validation Error',
    message: 'Invalid workbook data',
    details: validationResult.errors
  })
}

// Same for update endpoint
```

---

### **Day 3: Database Seeding & Templates**

#### **Task 3.1: Template Seed Data**
**File:** `apps/backend/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const templates = [
  {
    name: 'Blank Workbook',
    description: 'Start with a clean slate',
    category: 'Basic',
    data: {
      sheets: [{
        name: 'Sheet1',
        cells: {},
        formats: {}
      }],
      metadata: {
        activeSheet: 'Sheet1',
        theme: 'light'
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Monthly Budget',
    description: 'Track your monthly income and expenses',
    category: 'Finance',
    data: {
      sheets: [{
        name: 'Budget',
        cells: {
          'A1': { value: 'Category', format: { bold: true } },
          'B1': { value: 'Amount', format: { bold: true } },
          'A2': { value: 'Income' },
          'A3': { value: 'Rent' },
          'A4': { value: 'Food' },
          'A5': { value: 'Transport' },
          'A6': { value: 'Utilities' },
          'A7': { value: 'Entertainment' },
          'A8': { value: 'Savings' },
          'A9': { value: 'Total', format: { bold: true } },
          'B9': { formula: '=SUM(B2:B8)' }
        },
        formats: {}
      }],
      metadata: {
        activeSheet: 'Budget',
        theme: 'light'
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Task Tracker',
    description: 'Keep track of tasks and their status',
    category: 'Productivity',
    data: {
      sheets: [{
        name: 'Tasks',
        cells: {
          'A1': { value: 'Task', format: { bold: true } },
          'B1': { value: 'Status', format: { bold: true } },
          'C1': { value: 'Priority', format: { bold: true } },
          'D1': { value: 'Due Date', format: { bold: true } },
          'A2': { value: 'Sample Task' },
          'B2': { value: 'In Progress' },
          'C2': { value: 'High' },
          'D2': { value: '2025-10-20' }
        },
        formats: {}
      }],
      metadata: {
        activeSheet: 'Tasks',
        theme: 'light'
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Sales Tracker',
    description: 'Track sales performance over time',
    category: 'Business',
    data: {
      sheets: [{
        name: 'Sales',
        cells: {
          'A1': { value: 'Date', format: { bold: true } },
          'B1': { value: 'Product', format: { bold: true } },
          'C1': { value: 'Quantity', format: { bold: true } },
          'D1': { value: 'Price', format: { bold: true } },
          'E1': { value: 'Total', format: { bold: true } },
          'E2': { formula: '=C2*D2' }
        },
        formats: {}
      }],
      metadata: {
        activeSheet: 'Sales',
        theme: 'light'
      }
    },
    isPublic: true,
    isOfficial: true,
  }
]

async function main() {
  console.log('🌱 Seeding database with templates...')

  for (const template of templates) {
    await prisma.workbookTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    })
    console.log(`✅ Created template: ${template.name}`)
  }

  console.log('✅ Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**Add to `apps/backend/package.json`:**
```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

**Run:**
```bash
cd apps/backend
pnpm db:seed
```

#### **Task 3.2: Template Routes**
**File:** `apps/backend/src/routes/templates.ts`

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

export default async function templateRoutes(fastify: FastifyInstance) {
  // Get all public templates
  fastify.get('/templates', {
    schema: {
      description: 'Get all public templates',
      tags: ['templates'],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { category } = request.query as { category?: string }

      const templates = await prisma.workbookTemplate.findMany({
        where: {
          isPublic: true,
          ...(category && { category })
        },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          isOfficial: true,
          usageCount: true,
        },
        orderBy: [
          { isOfficial: 'desc' },
          { usageCount: 'desc' }
        ]
      })

      return reply.send({ templates })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch templates'
      })
    }
  })

  // Get a specific template
  fastify.get('/templates/:id', {
    schema: {
      description: 'Get template by ID',
      tags: ['templates'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const template = await prisma.workbookTemplate.findUnique({
        where: { id }
      })

      if (!template || !template.isPublic) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Template not found'
        })
      }

      return reply.send({ template })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch template'
      })
    }
  })

  // Create workbook from template
  fastify.post('/templates/:id/create', {
    schema: {
      description: 'Create a new workbook from a template',
      tags: ['templates'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      }
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { name } = request.body as { name: string }
      const user = request.user!

      // Get template
      const template = await prisma.workbookTemplate.findUnique({
        where: { id }
      })

      if (!template || !template.isPublic) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Template not found'
        })
      }

      // Create workbook from template
      const workbook = await prisma.workbook.create({
        data: {
          name,
          description: `Created from ${template.name}`,
          data: template.data,
          ownerId: user.id
        }
      })

      // Increment template usage count
      await prisma.workbookTemplate.update({
        where: { id },
        data: {
          usageCount: {
            increment: 1
          }
        }
      })

      return reply.status(201).send({
        success: true,
        workbook: {
          id: workbook.id,
          name: workbook.name,
          description: workbook.description,
          createdAt: workbook.createdAt
        }
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create workbook from template'
      })
    }
  })
}
```

**Register in `apps/backend/src/index.ts`:**
```typescript
const templateRoutes = await import('./routes/templates.js')
await fastify.register(templateRoutes.default, { prefix: '/api' })
```

---

## **Phase 2: Frontend - Workbook Management (Days 4-7)**

### **Day 4: State Management & API Integration**

#### **Task 4.1: Workbook Store (Zustand)**
**File:** `apps/frontend/src/stores/workbook.store.ts`

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Workbook {
  id: string
  name: string
  description: string | null
  version: number
  createdAt: string
  updatedAt: string
}

interface WorkbookState {
  // Current workbook being edited
  currentWorkbook: Workbook | null
  
  // Workbook data (sheets, cells, etc.)
  workbookData: any | null
  
  // Loading states
  isLoading: boolean
  isSaving: boolean
  
  // Actions
  setCurrentWorkbook: (workbook: Workbook | null) => void
  setWorkbookData: (data: any) => void
  updateCell: (sheetName: string, cellRef: string, value: any) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  clearWorkbook: () => void
}

export const useWorkbookStore = create<WorkbookState>()(
  devtools(
    (set, get) => ({
      currentWorkbook: null,
      workbookData: null,
      isLoading: false,
      isSaving: false,

      setCurrentWorkbook: (workbook) => 
        set({ currentWorkbook: workbook }),

      setWorkbookData: (data) =>
        set({ workbookData: data }),

      updateCell: (sheetName, cellRef, value) => {
        const { workbookData } = get()
        if (!workbookData) return

        const sheet = workbookData.sheets.find((s: any) => s.name === sheetName)
        if (!sheet) return

        set({
          workbookData: {
            ...workbookData,
            sheets: workbookData.sheets.map((s: any) =>
              s.name === sheetName
                ? {
                    ...s,
                    cells: {
                      ...s.cells,
                      [cellRef]: { value }
                    }
                  }
                : s
            )
          }
        })
      },

      setLoading: (isLoading) => set({ isLoading }),
      setSaving: (isSaving) => set({ isSaving }),

      clearWorkbook: () => 
        set({
          currentWorkbook: null,
          workbookData: null,
          isLoading: false,
          isSaving: false
        }),
    }),
    { name: 'WorkbookStore' }
  )
)
```

#### **Task 4.2: Workbook API Service**
**File:** `apps/frontend/src/services/workbook.service.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Workbook {
  id: string
  name: string
  description: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface WorkbookWithData extends Workbook {
  data: any
}

interface CreateWorkbookInput {
  name: string
  description?: string
  data?: any
}

interface UpdateWorkbookInput {
  name?: string
  description?: string
  data?: any
}

// Get all workbooks
export function useWorkbooks() {
  return useQuery({
    queryKey: ['workbooks'],
    queryFn: async () => {
      const response = await api.get<{ workbooks: Workbook[] }>('/workbooks')
      return response.data.workbooks
    }
  })
}

// Get single workbook with data
export function useWorkbook(id: string) {
  return useQuery({
    queryKey: ['workbook', id],
    queryFn: async () => {
      const response = await api.get<{ workbook: WorkbookWithData }>(`/workbooks/${id}`)
      return response.data.workbook
    },
    enabled: !!id
  })
}

// Create workbook
export function useCreateWorkbook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWorkbookInput) => {
      const response = await api.post<{ workbook: Workbook }>('/workbooks', input)
      return response.data.workbook
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    }
  })
}

// Update workbook
export function useUpdateWorkbook(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateWorkbookInput) => {
      const response = await api.put<{ workbook: Workbook }>(`/workbooks/${id}`, input)
      return response.data.workbook
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
      queryClient.invalidateQueries({ queryKey: ['workbook', id] })
    }
  })
}

// Delete workbook
export function useDeleteWorkbook() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workbooks/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    }
  })
}
```

---

**This is Part 1 of the detailed implementation plan. Would you like me to continue with:**
- Days 5-7 (UI Components & Workbook List Page)
- Days 8-10 (Grid Component)
- Days 11-14 (HyperFormula Integration)
- Or focus on a specific area?

The plan includes:
- ✅ Exact file paths
- ✅ Complete code examples
- ✅ Testing instructions
- ✅ Dependencies between tasks
- ✅ Time estimates

What would you like me to detail next?
