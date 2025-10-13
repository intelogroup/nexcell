import { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { config } from '../config/index.js'

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    }
  })

  fastify.get('/health/ready', {
    schema: {
      description: 'Readiness check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                ai: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async () => {
    const checks = {
      database: 'ok',
      ai: 'ok'
    }
    let overallStatus = 'ready'

    // Check database connectivity
    try {
      const start = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const duration = Date.now() - start

      if (duration > 2000) {
        checks.database = 'fail'
        overallStatus = 'degraded'
      } else if (duration > 500) {
        checks.database = 'degraded'
        overallStatus = 'degraded'
      }
    } catch (error) {
      fastify.log.error('Database health check failed:', error)
      checks.database = 'fail'
      overallStatus = 'fail'
    }

    // Check AI provider keys
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

    if (!hasOpenAI && !hasAnthropic) {
      checks.ai = 'missing'
      // Don't fail overall status - AI is optional for basic functionality
    } else {
      checks.ai = 'ok'
    }

    return {
      status: overallStatus,
      checks
    }
  })
}