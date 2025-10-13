import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { workbookValidation } from '../services/workbook-validation.service.js'
import { workbookOps } from '../services/workbook-ops.service.js'
import { OperationsSchema } from '../types/operations.js'
import { xlsxExportService } from '../services/xlsx-export.service.js'
import { WorkbookData } from '../services/ai.service.js'

// Default workbook structure
const defaultWorkbookData = {
  sheets: [
    {
      name: 'Sheet1',
      cells: {},
      formats: {},
    },
  ],
  metadata: {
    activeSheet: 'Sheet1',
    theme: 'light',
  },
}

// Validation schemas
const createWorkbookSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  data: z.any().optional(), // JSONB data - will validate structure separately
})

const updateWorkbookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  data: z.any().optional(),
})

export default async function workbookRoutes(fastify: FastifyInstance) {
  // Create a new workbook
  fastify.post('/workbooks', {
    schema: {
      description: 'Create a new workbook',
      tags: ['workbooks'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
    const { name, description, data } = createWorkbookSchema.parse(request.body)

    // User is already fetched in middleware - no N+1 query
    const user = request.user!

    // Validate workbook data
    const workbookData = data || defaultWorkbookData
    const validation = workbookValidation.validate(workbookData)
    
    if (!validation.isValid) {
      return reply.status(400).send({
        error: 'Invalid Workbook Data',
        message: 'Workbook data validation failed',
        errors: validation.errors
      })
    }

    // Create workbook
    const workbook = await prisma.workbook.create({
        data: {
          name,
          description: description || null,
          data: data || defaultWorkbookData,
          ownerId: user.id,
        },
      })

      return reply.status(201).send({
        success: true,
        workbook: {
          id: workbook.id,
          name: workbook.name,
          description: workbook.description,
          version: workbook.version,
          createdAt: workbook.createdAt,
          updatedAt: workbook.updatedAt,
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid workbook data',
          details: error.errors,
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create workbook',
      })
    }
  })

  // Get all workbooks for the current user
  fastify.get('/workbooks', {
    schema: {
      description: 'Get all workbooks for the current user',
      tags: ['workbooks'],
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      // User is already fetched in middleware - no N+1 query!
      const user = request.user!

      const workbooks = await prisma.workbook.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      })

      return reply.send({ workbooks })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch workbooks',
      })
    }
  })

  // Get a specific workbook
  fastify.get('/workbooks/:id', {
    schema: {
      description: 'Get a specific workbook by ID',
      tags: ['workbooks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      // User is already fetched in middleware - no N+1 query!
      const user = request.user!

      const workbook = await prisma.workbook.findFirst({
        where: {
          id,
          ownerId: user.id,
        },
      })

      if (!workbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      return reply.send({ workbook })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch workbook',
      })
    }
  })

  // Update a workbook
  fastify.put('/workbooks/:id', {
    schema: {
      description: 'Update a workbook',
      tags: ['workbooks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const updateData = updateWorkbookSchema.parse(request.body)

      // User is already fetched in middleware - no N+1 query!
      const user = request.user!

      // Verify ownership
      const existingWorkbook = await prisma.workbook.findFirst({
        where: {
          id,
          ownerId: user.id,
        },
      })

      if (!existingWorkbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      // Update workbook and increment version
      const updatePayload: any = {
        version: existingWorkbook.version + 1,
        updatedAt: new Date(),
      }
      
      if (updateData.name !== undefined) updatePayload.name = updateData.name
      if (updateData.description !== undefined) updatePayload.description = updateData.description || null
      if (updateData.data !== undefined) updatePayload.data = updateData.data
      
      const workbook = await prisma.workbook.update({
        where: { id },
        data: updatePayload,
      })

      return reply.send({
        success: true,
        workbook: {
          id: workbook.id,
          name: workbook.name,
          description: workbook.description,
          version: workbook.version,
          updatedAt: workbook.updatedAt,
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid workbook data',
          details: error.errors,
        })
      }

      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update workbook',
      })
    }
  })

  // Delete a workbook
  fastify.delete('/workbooks/:id', {
    schema: {
      description: 'Delete a workbook',
      tags: ['workbooks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      // User is already fetched in middleware - no N+1 query!
      const user = request.user!

      // Verify ownership
      const existingWorkbook = await prisma.workbook.findFirst({
        where: {
          id,
          ownerId: user.id,
        },
      })

      if (!existingWorkbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      // Delete workbook (cascade will delete related actions)
      await prisma.workbook.delete({
        where: { id },
      })

      return reply.send({
        success: true,
        message: 'Workbook deleted successfully',
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete workbook',
      })
    }
  })

  // Apply operations to a workbook
  fastify.post('/workbooks/:id/ops', {
    schema: {
      description: 'Apply operations to a workbook',
      tags: ['workbooks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['operations'],
        properties: {
          operations: { type: 'array' },
          description: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { operations: unknown[], description?: string }

      // User is already fetched in middleware - no N+1 query!
      const user = request.user!

      // Verify ownership and fetch workbook
      const existingWorkbook = await prisma.workbook.findFirst({
        where: {
          id,
          ownerId: user.id,
        },
      })

      if (!existingWorkbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      // Validate operations with Zod
      let operations
      try {
        operations = OperationsSchema.parse(body.operations)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation Error',
            message: 'Invalid operations',
            details: error.errors,
          })
        }
        throw error
      }

      // Get old snapshot for undo functionality
      const oldSnapshot = existingWorkbook.data

      // Apply operations using workbook ops service
      const result = workbookOps.applyOperations(
        existingWorkbook.data as any,
        operations
      )

      // Check if there were errors
      if (result.errors.length > 0) {
        return reply.status(400).send({
          error: 'Operation Error',
          message: 'Some operations failed to apply',
          errors: result.errors,
          appliedOps: result.diff.length,
          partialResult: {
            diff: result.diff,
          },
        })
      }

      // Update workbook with new data and increment version
      const updatedWorkbook = await prisma.workbook.update({
        where: { id },
        data: {
          data: result.next,
          version: existingWorkbook.version + 1,
          updatedAt: new Date(),
        },
      })

      // Create Action record for undo/redo and audit trail
      const action = await prisma.action.create({
        data: {
          type: 'operations',
          workbookId: id,
          userId: user.id,
          applied: true,
          message: body.description || `Applied ${operations.length} operation(s)`,
          data: {
            operations: operations as any,
            diff: result.diff as any,
          } as any,
          oldSnapshot: oldSnapshot as any,
          newSnapshot: result.next as any,
        },
      })

      return reply.send({
        success: true,
        appliedOps: operations.length,
        errors: [],
        diff: result.diff,
        workbook: {
          id: updatedWorkbook.id,
          version: updatedWorkbook.version,
          updatedAt: updatedWorkbook.updatedAt,
        },
        actionId: action.id,
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
        message: 'Failed to apply operations',
      })
    }
  })

  // Export workbook to XLSX
  fastify.get('/workbooks/:id/export/xlsx', {
    schema: {
      description: 'Export a workbook to XLSX format',
      tags: ['workbooks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth,
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const user = request.user!

      // Fetch workbook
      const workbook = await prisma.workbook.findFirst({
        where: {
          id,
          ownerId: user.id,
        },
      })

      if (!workbook) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Workbook not found or you do not have access.',
        })
      }

      // Export to XLSX
      const buffer = await xlsxExportService.exportToXlsx(
        workbook.data as unknown as WorkbookData
      )

      // Set headers for file download
      const filename = `${workbook.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`
      
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      reply.header('Content-Length', buffer.length)

      return reply.send(buffer)
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to export workbook',
      })
    }
  })
}
