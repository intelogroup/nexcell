import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const createFromTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
})

export default async function templateRoutes(fastify: FastifyInstance) {
  /**
   * Get all public templates
   * Optional query param: category
   */
  fastify.get('/templates', {
    schema: {
      description: 'Get all public workbook templates',
      tags: ['templates'],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  isOfficial: { type: 'boolean' },
                  usageCount: { type: 'number' },
                }
              }
            }
          }
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

  /**
   * Get a specific template by ID
   */
  fastify.get('/templates/:id', {
    schema: {
      description: 'Get a specific template by ID',
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
          message: 'Template not found or not available'
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

  /**
   * Create a new workbook from a template
   */
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
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' }
        }
      }
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { name, description } = createFromTemplateSchema.parse(request.body)
      const user = request.user!

      // Get the template
      const template = await prisma.workbookTemplate.findUnique({
        where: { id }
      })

      if (!template || !template.isPublic) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Template not found'
        })
      }

      // Create a new workbook from the template
      const workbook = await prisma.workbook.create({
        data: {
          name,
          description: description || `Created from ${template.name}`,
          data: template.data,
          ownerId: user.id
        }
      })

      // Increment usage count
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
          version: workbook.version,
          createdAt: workbook.createdAt,
          updatedAt: workbook.updatedAt
        }
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid workbook data',
          details: error.errors
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create workbook from template'
      })
    }
  })

  /**
   * Get template categories
   */
  fastify.get('/templates/categories', {
    schema: {
      description: 'Get all template categories',
      tags: ['templates']
    }
  }, async (request, reply) => {
    try {
      // Get unique categories from templates
      const categories = await prisma.workbookTemplate.findMany({
        where: { isPublic: true },
        select: { category: true },
        distinct: ['category']
      })

      const categoryList = categories
        .map(c => c.category)
        .filter((c): c is string => c !== null)

      return reply.send({ categories: categoryList })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch categories'
      })
    }
  })
}
