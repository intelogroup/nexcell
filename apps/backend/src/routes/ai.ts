import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { requireCredits, deductCredits } from '../middleware/credits.js'
import { aiService, WorkbookData } from '../services/ai.service.js'

// Request schemas
const planRequestSchema = z.object({
  workbookId: z.string().min(1),
  instructions: z.string().min(1).max(2000),
})

const applyRequestSchema = z.object({
  workbookId: z.string().min(1),
  planId: z.string().min(1).optional(),
  operations: z.array(z.any()).optional(),
}).refine(
  (data) => data.planId || data.operations,
  { message: 'Either planId or operations must be provided' }
)

export default async function aiRoutes(fastify: FastifyInstance) {
  // POST /ai/plan - Generate AI plan from natural language instructions
  fastify.post('/ai/plan', {
    schema: {
      description: 'Generate an AI plan from natural language instructions',
      tags: ['ai'],
      body: {
        type: 'object',
        required: ['workbookId', 'instructions'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
          instructions: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
    },
    preHandler: [requireAuth, requireCredits(5)], // 5 credits per plan generation
  }, async (request, reply) => {
    try {
      const { workbookId, instructions } = planRequestSchema.parse(request.body)
      const user = request.user!

      // Verify workbook ownership
      const workbook = await prisma.workbook.findFirst({
        where: {
          id: workbookId,
          ownerId: user.id,
        },
      })

      if (!workbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      // Fetch recent conversation history (last 10 messages for context)
      const conversationHistory = await prisma.conversationMessage.findMany({
        where: { workbookId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          role: true,
          content: true,
          metadata: true,
        },
      })

      // Reverse to get chronological order
      conversationHistory.reverse()

      // Save user message to conversation history
      await prisma.conversationMessage.create({
        data: {
          workbookId,
          userId: user.id,
          role: 'user',
          content: instructions,
        },
      })

      // Generate AI plan using OpenRouter
      let aiPlanResult
      try {
        aiPlanResult = await aiService.generateAiPlan(
          workbook.data as unknown as WorkbookData,
          instructions,
          {
            conversationHistory: conversationHistory.map((msg) => ({
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
              metadata: msg.metadata,
            })),
          }
        )
      } catch (error) {
        fastify.log.error({ error }, 'AI generation error')
        return reply.status(500).send({
          error: 'AI Generation Failed',
          message: error instanceof Error ? error.message : 'Failed to generate AI plan',
        })
      }

      const aiPlan = {
        id: crypto.randomUUID(),
        workbookId,
        instructions,
        operations: aiPlanResult.operations,
        reasoning: aiPlanResult.reasoning,
        estimatedChanges: aiPlanResult.estimatedChanges,
        warnings: aiPlanResult.warnings,
        usage: aiPlanResult.usage,
        createdAt: new Date().toISOString(),
      }

      // Store the plan in database for later reference
      const action = await prisma.action.create({
        data: {
          type: 'ai_plan',
          workbookId,
          userId: user.id,
          applied: false,
          message: `AI Plan: ${instructions}`,
          data: aiPlan as any,
        },
      })

      // Save assistant message to conversation history
      await prisma.conversationMessage.create({
        data: {
          workbookId,
          userId: user.id,
          role: 'assistant',
          content: aiPlan.reasoning || 'Generated operations plan',
          metadata: {
            operations: aiPlan.operations,
            warnings: aiPlan.warnings,
            usage: aiPlan.usage,
            planId: action.id,
          },
        },
      })

      // Deduct credits after successful plan generation
      await deductCredits(request, 'AI plan generation')

      return reply.send({
        success: true,
        plan: {
          ...aiPlan,
          id: action.id, // Use action ID as plan ID
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors,
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate AI plan',
      })
    }
  })

  // POST /ai/apply - Apply AI-generated operations or a saved plan
  fastify.post('/ai/apply', {
    schema: {
      description: 'Apply AI-generated operations or a saved plan to a workbook',
      tags: ['ai'],
      body: {
        type: 'object',
        required: ['workbookId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
          planId: { type: 'string', minLength: 1 },
          operations: { type: 'array' },
        },
      },
    },
    preHandler: [requireAuth, requireCredits(10)], // 10 credits per apply
  }, async (request, reply) => {
    try {
      const { workbookId, planId, operations } = applyRequestSchema.parse(request.body)
      const user = request.user!

      // Verify workbook ownership
      const workbook = await prisma.workbook.findFirst({
        where: {
          id: workbookId,
          ownerId: user.id,
        },
      })

      if (!workbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      // Get operations either from planId or directly from request
      let opsToApply = operations

      if (planId) {
        // Fetch the saved plan
        const plan = await prisma.action.findFirst({
          where: {
            id: planId,
            workbookId,
            userId: user.id,
            type: 'ai_plan',
          },
        })

        if (!plan) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'AI plan not found or you do not have access.',
          })
        }

        // Extract operations from the plan
        const planData = plan.data as any
        opsToApply = planData.operations || []
      }

      if (!opsToApply || opsToApply.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No operations to apply',
        })
      }

      // Forward to the workbook ops endpoint internally
      // This ensures we use the same logic for applying operations
      const opsResponse = await fastify.inject({
        method: 'POST',
        url: `/workbooks/${workbookId}/ops`,
        headers: {
          authorization: request.headers.authorization || '',
        },
        payload: {
          operations: opsToApply,
          description: planId
            ? `Applied AI plan ${planId}`
            : 'Applied AI-generated operations',
        },
      })

      if (opsResponse.statusCode !== 200) {
        return reply.status(opsResponse.statusCode).send(opsResponse.json())
      }

      const result = opsResponse.json()

      // Mark the plan as applied if we used a planId
      if (planId) {
        await prisma.action.update({
          where: { id: planId },
          data: { applied: true },
        })
      }

      // Deduct credits after successful apply
      await deductCredits(request, planId ? `Applied AI plan ${planId}` : 'Applied AI-generated operations')

      return reply.send({
        success: true,
        ...result,
        planId,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors,
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to apply AI operations',
      })
    }
  })
}
