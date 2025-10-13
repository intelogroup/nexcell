import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { creditsService } from '../services/credits.service.js'

const addCreditsSchema = z.object({
  amount: z.number().positive().max(1000),
  reason: z.string().optional()
})

export default async function creditsRoutes(fastify: FastifyInstance) {
  
  /**
   * Get current user's credit balance
   */
  fastify.get('/credits/balance', {
    schema: {
      description: 'Get current user credit balance',
      tags: ['credits'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            balance: { type: 'number' },
            userId: { type: 'string' }
          }
        }
      }
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

  /**
   * Add credits to user account (for testing/admin purposes)
   * In production, this would be restricted to admin users only
   */
  fastify.post('/credits/add', {
    schema: {
      description: 'Add credits to user account (testing/admin)',
      tags: ['credits'],
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 0.01, maximum: 1000 },
          reason: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            balance: { type: 'number' },
            added: { type: 'number' }
          }
        }
      }
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { amount, reason = 'Manual addition (testing)' } = addCreditsSchema.parse(request.body)
      const user = request.user!
      
      const newBalance = await creditsService.add(user.id, amount, reason)
      
      return reply.send({
        success: true,
        balance: newBalance,
        added: amount
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid credit amount',
          details: error.errors
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add credits'
      })
    }
  })

  /**
   * Get credit cost estimate for an operation
   */
  fastify.post('/credits/estimate', {
    schema: {
      description: 'Estimate credit cost for an operation',
      tags: ['credits'],
      body: {
        type: 'object',
        required: ['operation'],
        properties: {
          operation: { type: 'string', enum: ['ai-request', 'import', 'export'] },
          metadata: { type: 'object' }
        }
      }
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { operation, metadata } = request.body as { operation: string; metadata: any }
      let estimatedCost = 0

      switch (operation) {
        case 'ai-request':
          // Estimate based on context size (words to tokens ~= 1.3x)
          const estimatedTokens = metadata?.contextSize ? Math.ceil(metadata.contextSize * 1.3) : 1000
          estimatedCost = creditsService.estimateAICost(estimatedTokens)
          break
        
        case 'import':
          estimatedCost = 0.1 // Fixed cost for import
          break
        
        case 'export':
          estimatedCost = 0.05 // Fixed cost for export
          break
        
        default:
          return reply.status(400).send({
            error: 'Invalid Operation',
            message: 'Unknown operation type'
          })
      }

      return reply.send({
        success: true,
        operation,
        estimatedCost,
        currency: 'credits'
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to estimate cost'
      })
    }
  })
}
