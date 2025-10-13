import 'dotenv/config'
import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { config } from './config/index.js'
import { registerAuthPlugin } from './middleware/auth.js'
import { healthRoutes } from './routes/health.js'

const fastify = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    } : undefined
  }
})

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false
})

await fastify.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true
})

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})

// Register authentication
await registerAuthPlugin(fastify)

// Swagger documentation
await fastify.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Nexcel API',
      description: 'AI-powered spreadsheet assistant API',
      version: '1.0.0'
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: 'Development server'
      }
    ]
  }
})

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  }
})

// Register routes
await fastify.register(healthRoutes, { prefix: '/api' })

// Import and register routes
const authRoutes = await import('./routes/auth.js')
const workbookRoutes = await import('./routes/workbooks.js')
const creditsRoutes = await import('./routes/credits.js')
const templateRoutes = await import('./routes/templates.js')
const aiRoutes = await import('./routes/ai.js')
const conversationRoutes = await import('./routes/conversations.js')
const actionRoutes = await import('./routes/actions.js')

await fastify.register(authRoutes.default, { prefix: '/api' })
await fastify.register(workbookRoutes.default, { prefix: '/api' })
await fastify.register(creditsRoutes.default, { prefix: '/api' })
await fastify.register(templateRoutes.default, { prefix: '/api' })
await fastify.register(aiRoutes.default, { prefix: '/api' })
await fastify.register(conversationRoutes.default, { prefix: '/api' })
await fastify.register(actionRoutes.default, { prefix: '/api' })

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: config.PORT, 
      host: '0.0.0.0' 
    })
    fastify.log.info(`Server listening on port ${config.PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()