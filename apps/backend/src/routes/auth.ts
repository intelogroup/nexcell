import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

// Validation schema for user sync
const syncUserSchema = z.object({
  clerkId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

export default async function authRoutes(fastify: FastifyInstance) {
  // Sync user from Clerk to our database
  fastify.post('/auth/sync', {
    schema: {
      description: 'Sync user from Clerk to database',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['clerkId', 'email'],
        properties: {
          clerkId: { type: 'string' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { clerkId, email, firstName, lastName } = syncUserSchema.parse(request.body)

      // Verify that the clerkId matches the authenticated user
      if (request.userId !== clerkId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot sync user data for another user',
        })
      }

      // Upsert user (create if doesn't exist, update if exists)
      const user = await prisma.user.upsert({
        where: { clerkId },
        update: {
          email,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          updatedAt: new Date(),
        },
        create: {
          clerkId,
          email,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
        },
      })

      return reply.send({
        success: true,
        user: {
          id: user.id,
          clerkId: user.clerkId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid user data',
          details: error.errors,
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to sync user',
      })
    }
  })

  // Get current user info
  fastify.get('/auth/me', {
    schema: {
      description: 'Get current authenticated user',
      tags: ['auth'],
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    // User is already fetched and cached in middleware - no database query needed!
    return reply.send({ user: request.user })
  })
}
