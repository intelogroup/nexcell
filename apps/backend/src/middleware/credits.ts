import { FastifyRequest, FastifyReply } from 'fastify'
import { creditsService } from '../services/credits.service.js'

/**
 * Middleware to check if user has sufficient credits for an operation
 * 
 * Usage:
 *   fastify.post('/api/action', {
 *     preHandler: [requireAuth, requireCredits(0.5)]
 *   }, handler)
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

    try {
      const hasEnough = await creditsService.hasEnough(user.id, amount)
      
      if (!hasEnough) {
        const currentBalance = await creditsService.getBalance(user.id)
        
        return reply.status(402).send({
          error: 'Insufficient Credits',
          message: `This action requires ${amount} credits. You have ${currentBalance.toFixed(2)} credits.`,
          required: amount,
          balance: currentBalance
        })
      }

      // Store the cost in request for later deduction
      request.creditCost = amount
      
    } catch (error) {
      request.log.error(error, 'Error checking credits')
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to check credit balance'
      })
    }
  }
}

/**
 * Helper to deduct credits after successful operation
 * Call this in your route handler after the operation succeeds
 */
export async function deductCredits(
  request: FastifyRequest,
  reason: string
): Promise<number | null> {
  const user = request.user
  const amount = request.creditCost
  
  if (!user || !amount) {
    return null
  }

  try {
    const newBalance = await creditsService.deduct(user.id, amount, reason)
    return newBalance
  } catch (error) {
    request.log.error(error, 'Failed to deduct credits')
    // Don't fail the request, just log the error
    return null
  }
}

// Extend FastifyRequest to include creditCost
declare module 'fastify' {
  interface FastifyRequest {
    creditCost?: number
  }
}
