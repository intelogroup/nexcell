import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

// Request schemas
const getActionsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['pending', 'applied', 'cancelled']).optional(),
})

const createActionSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1).max(500),
  affectedRange: z.string().min(1),
  data: z.record(z.any()),
  preview: z.object({
    before: z.record(z.any()),
    after: z.record(z.any()),
  }).optional(),
  metadata: z.object({
    confidence: z.number().min(0).max(1).optional(),
    tokensUsed: z.number().optional(),
    estimatedCells: z.number().optional(),
  }).optional(),
})

const updateActionSchema = z.object({
  status: z.enum(['applied', 'cancelled']),
  appliedData: z.record(z.any()).optional(),
})

export default async function actionRoutes(fastify: FastifyInstance) {
  // GET /workbooks/:workbookId/actions - Get actions for a workbook
  fastify.get('/workbooks/:workbookId/actions', {
    schema: {
      description: 'Get AI-proposed actions for a workbook',
      tags: ['actions'],
      params: {
        type: 'object',
        required: ['workbookId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['pending', 'applied', 'cancelled'] },
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId } = request.params as { workbookId: string }
      const query = getActionsSchema.parse(request.query)
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

      // Build where clause
      const whereClause: any = { workbookId }
      if (query.status) {
        // Map frontend status to backend applied field
        if (query.status === 'applied') {
          whereClause.applied = true
        } else if (query.status === 'cancelled') {
          whereClause.applied = false
          whereClause.type = 'cancelled' // Custom handling
        } else {
          whereClause.applied = false
          whereClause.NOT = { type: 'cancelled' }
        }
      }

      // Fetch actions
      const [actions, totalCount] = await Promise.all([
        prisma.action.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
          select: {
            id: true,
            type: true,
            message: true,
            data: true,
            oldSnapshot: true,
            newSnapshot: true,
            confidence: true,
            applied: true,
            costEstimate: true,
            createdAt: true,
          },
        }),
        prisma.action.count({
          where: whereClause,
        }),
      ])

      // Transform to match frontend format
      const transformedActions = actions.map((action) => ({
        id: action.id,
        description: action.message || 'No description',
        affectedRange: (action.data as any)?.affectedRange || 'Unknown',
        status: action.applied ? 'applied' : (action.type === 'cancelled' ? 'cancelled' : 'pending'),
        timestamp: action.createdAt,
        preview: action.oldSnapshot && action.newSnapshot ? {
          before: action.oldSnapshot,
          after: action.newSnapshot,
        } : undefined,
        metadata: {
          confidence: action.confidence,
          tokensUsed: (action.data as any)?.tokensUsed,
          estimatedCells: (action.data as any)?.estimatedCells,
        },
      }))

      return reply.send({
        success: true,
        actions: transformedActions,
        pagination: {
          total: totalCount,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < totalCount,
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
        message: 'Failed to fetch actions',
      })
    }
  })

  // POST /workbooks/:workbookId/actions - Create a new action
  fastify.post('/workbooks/:workbookId/actions', {
    schema: {
      description: 'Create a new AI-proposed action',
      tags: ['actions'],
      params: {
        type: 'object',
        required: ['workbookId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
        },
      },
      body: {
        type: 'object',
        required: ['type', 'description', 'affectedRange', 'data'],
        properties: {
          type: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          affectedRange: { type: 'string', minLength: 1 },
          data: { type: 'object' },
          preview: {
            type: 'object',
            properties: {
              before: { type: 'object' },
              after: { type: 'object' },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              tokensUsed: { type: 'number' },
              estimatedCells: { type: 'number' },
            },
          },
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId } = request.params as { workbookId: string }
      const body = createActionSchema.parse(request.body)
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

      // Create action
      const action = await prisma.action.create({
        data: {
          workbookId,
          userId: user.id,
          type: body.type,
          message: body.description,
          data: {
            ...body.data,
            affectedRange: body.affectedRange,
            ...body.metadata,
          },
          oldSnapshot: body.preview?.before,
          newSnapshot: body.preview?.after,
          confidence: body.metadata?.confidence,
          applied: false,
        },
        select: {
          id: true,
          type: true,
          message: true,
          data: true,
          oldSnapshot: true,
          newSnapshot: true,
          confidence: true,
          applied: true,
          createdAt: true,
        },
      })

      // Transform to match frontend format
      const transformedAction = {
        id: action.id,
        description: action.message || 'No description',
        affectedRange: (action.data as any)?.affectedRange || body.affectedRange,
        status: 'pending' as const,
        timestamp: action.createdAt,
        preview: action.oldSnapshot && action.newSnapshot ? {
          before: action.oldSnapshot,
          after: action.newSnapshot,
        } : undefined,
        metadata: {
          confidence: action.confidence,
          tokensUsed: (action.data as any)?.tokensUsed,
          estimatedCells: (action.data as any)?.estimatedCells,
        },
      }

      return reply.status(201).send({
        success: true,
        action: transformedAction,
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
        message: 'Failed to create action',
      })
    }
  })

  // PATCH /workbooks/:workbookId/actions/:actionId - Update action status
  fastify.patch('/workbooks/:workbookId/actions/:actionId', {
    schema: {
      description: 'Update action status (apply or cancel)',
      tags: ['actions'],
      params: {
        type: 'object',
        required: ['workbookId', 'actionId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
          actionId: { type: 'string', minLength: 1 },
        },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['applied', 'cancelled'] },
          appliedData: { type: 'object' },
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId, actionId } = request.params as { workbookId: string; actionId: string }
      const body = updateActionSchema.parse(request.body)
      const user = request.user!

      // Verify workbook ownership and action exists
      const action = await prisma.action.findFirst({
        where: {
          id: actionId,
          workbookId,
          workbook: {
            ownerId: user.id,
          },
        },
      })

      if (!action) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Action not found or you do not have access.',
        })
      }

      // Update action
      const updatedAction = await prisma.action.update({
        where: { id: actionId },
        data: {
          applied: body.status === 'applied',
          type: body.status === 'cancelled' ? 'cancelled' : action.type,
          data: body.appliedData ? {
            ...(action.data as any),
            ...body.appliedData,
          } : action.data,
        },
        select: {
          id: true,
          type: true,
          message: true,
          data: true,
          oldSnapshot: true,
          newSnapshot: true,
          confidence: true,
          applied: true,
          createdAt: true,
        },
      })

      // Transform to match frontend format
      const transformedAction = {
        id: updatedAction.id,
        description: updatedAction.message || 'No description',
        affectedRange: (updatedAction.data as any)?.affectedRange || 'Unknown',
        status: body.status,
        timestamp: updatedAction.createdAt,
        preview: updatedAction.oldSnapshot && updatedAction.newSnapshot ? {
          before: updatedAction.oldSnapshot,
          after: updatedAction.newSnapshot,
        } : undefined,
        metadata: {
          confidence: updatedAction.confidence,
          tokensUsed: (updatedAction.data as any)?.tokensUsed,
          estimatedCells: (updatedAction.data as any)?.estimatedCells,
        },
      }

      return reply.send({
        success: true,
        action: transformedAction,
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
        message: 'Failed to update action',
      })
    }
  })

  // DELETE /workbooks/:workbookId/actions/:actionId - Delete an action
  fastify.delete('/workbooks/:workbookId/actions/:actionId', {
    schema: {
      description: 'Delete an action',
      tags: ['actions'],
      params: {
        type: 'object',
        required: ['workbookId', 'actionId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
          actionId: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId, actionId } = request.params as { workbookId: string; actionId: string }
      const user = request.user!

      // Verify ownership and delete
      const action = await prisma.action.findFirst({
        where: {
          id: actionId,
          workbookId,
          workbook: {
            ownerId: user.id,
          },
        },
      })

      if (!action) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Action not found or you do not have access.',
        })
      }

      await prisma.action.delete({
        where: { id: actionId },
      })

      return reply.send({
        success: true,
        message: 'Action deleted successfully',
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete action',
      })
    }
  })
}
