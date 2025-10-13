import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

// Request schemas
const getConversationsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
})

const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000),
  metadata: z.object({
    tokensUsed: z.number().optional(),
    confidence: z.number().min(0).max(1).optional(),
    affectedRange: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
})

export default async function conversationRoutes(fastify: FastifyInstance) {
  // GET /workbooks/:workbookId/conversations - Get conversation history for a workbook
  fastify.get('/workbooks/:workbookId/conversations', {
    schema: {
      description: 'Get AI conversation history for a workbook',
      tags: ['conversations'],
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
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId } = request.params as { workbookId: string }
      const query = getConversationsSchema.parse(request.query)
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

      // Fetch conversation messages
      const [messages, totalCount] = await Promise.all([
        prisma.conversationMessage.findMany({
          where: { workbookId },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        }),
        prisma.conversationMessage.count({
          where: { workbookId },
        }),
      ])

      // Reverse to get chronological order (oldest first)
      messages.reverse()

      return reply.send({
        success: true,
        messages,
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
        message: 'Failed to fetch conversation history',
      })
    }
  })

  // POST /workbooks/:workbookId/conversations - Add a message to conversation
  fastify.post('/workbooks/:workbookId/conversations', {
    schema: {
      description: 'Add a message to AI conversation history',
      tags: ['conversations'],
      params: {
        type: 'object',
        required: ['workbookId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
        },
      },
      body: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: { type: 'string', minLength: 1, maxLength: 10000 },
          metadata: {
            type: 'object',
            properties: {
              tokensUsed: { type: 'number' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              affectedRange: { type: 'string' },
              model: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId } = request.params as { workbookId: string }
      const body = createMessageSchema.parse(request.body)
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

      // Create conversation message
      const message = await prisma.conversationMessage.create({
        data: {
          workbookId,
          userId: user.id,
          role: body.role,
          content: body.content,
          metadata: body.metadata || {},
        },
        select: {
          id: true,
          role: true,
          content: true,
          metadata: true,
          createdAt: true,
        },
      })

      return reply.status(201).send({
        success: true,
        message,
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
        message: 'Failed to create message',
      })
    }
  })

  // DELETE /workbooks/:workbookId/conversations - Clear conversation history for a workbook
  fastify.delete('/workbooks/:workbookId/conversations', {
    schema: {
      description: 'Clear AI conversation history for a workbook',
      tags: ['conversations'],
      params: {
        type: 'object',
        required: ['workbookId'],
        properties: {
          workbookId: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { workbookId } = request.params as { workbookId: string }
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

      // Delete all conversation messages for this workbook
      const result = await prisma.conversationMessage.deleteMany({
        where: { workbookId },
      })

      return reply.send({
        success: true,
        deletedCount: result.count,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to clear conversation history',
      })
    }
  })
}
