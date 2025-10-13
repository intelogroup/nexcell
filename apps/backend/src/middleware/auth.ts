import 'dotenv/config'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config/index.js'
import { prisma } from '../lib/prisma.js'
import { User } from '@prisma/client'

export async function registerAuthPlugin(fastify: FastifyInstance) {
  if (!config.CLERK_SECRET_KEY) {
    fastify.log.warn('CLERK_SECRET_KEY not provided, authentication will be disabled')
    return
  }

  // Dynamic import to handle ESM issues
  const clerkFastify = await import('@clerk/fastify')
  
  const options: any = {
    secretKey: config.CLERK_SECRET_KEY,
  }
  
  if (config.CLERK_PUBLISHABLE_KEY) {
    options.publishableKey = config.CLERK_PUBLISHABLE_KEY
  }
  
  await fastify.register(clerkFastify.clerkPlugin, options)
}

/**
 * Authentication middleware that verifies JWT and fetches user from database
 * This prevents N+1 query problem by caching user lookup in request context
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Dynamic import to handle ESM issues
    const { getAuth } = await import('@clerk/fastify')
    const { userId } = getAuth(request)
    
    if (!userId) {
      return reply.status(401).send({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      })
    }
    
    // For the sync endpoint, we only need to verify the JWT - user might not exist in DB yet
    if (request.url === '/api/auth/sync') {
      request.userId = userId
      return // Skip database lookup for sync endpoint
    }
    
    // Fetch user from database and cache in request context
    // This eliminates the N+1 query problem - we only query once per request
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      }
    })
    
    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found. Please sync your account first.',
      })
    }
    
    // Add both userId (Clerk ID) and user (DB record) to request context
    request.userId = userId
    request.user = user
  } catch (error) {
    request.log.error(error, 'Error in authentication middleware')
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    })
  }
}

// Extend FastifyRequest type to include userId and user
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    user?: Pick<User, 'id' | 'clerkId' | 'email' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'>
  }
}