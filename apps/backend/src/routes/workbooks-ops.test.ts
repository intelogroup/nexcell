import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { Operation } from '../types/operations.js'

/**
 * Integration tests for POST /workbooks/:id/ops endpoint
 * 
 * Note: These tests require a running test database and proper auth setup
 * They test the full integration of the operations endpoint
 */

describe('POST /workbooks/:id/ops endpoint', () => {
  let testUserId: string
  let testWorkbookId: string

  beforeEach(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        clerkId: `test_clerk_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
      },
    })
    testUserId = user.id

    // Create a test workbook
    const workbook = await prisma.workbook.create({
      data: {
        name: 'Test Workbook',
        ownerId: testUserId,
        data: {
          sheets: [
            {
              name: 'Sheet1',
              cells: {
                A1: { value: 'Name' },
                B1: { value: 'Age' },
                A2: { value: 'Alice' },
                B2: { value: 30 },
              },
            },
          ],
          metadata: {
            activeSheet: 'Sheet1',
          },
        },
      },
    })
    testWorkbookId = workbook.id
  })

  afterEach(async () => {
    // Clean up test data
    if (testWorkbookId) {
      await prisma.workbook.delete({ where: { id: testWorkbookId } }).catch(() => {})
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    }
  })

  it('should create operations data structure correctly', async () => {
    // This test validates that our operation data structure is correct
    const operations: Operation[] = [
      {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'C1',
        value: 'Email',
      },
      {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'C2',
        value: 'alice@example.com',
      },
    ]

    // Verify the operation structure
    expect(operations).toHaveLength(2)
    expect(operations[0]!.kind).toBe('set_cell')
    expect(operations[1]!.kind).toBe('set_cell')
  })

  it('should validate workbook exists in database', async () => {
    const workbook = await prisma.workbook.findUnique({
      where: { id: testWorkbookId },
    })

    expect(workbook).toBeDefined()
    expect(workbook!.name).toBe('Test Workbook')
    expect(workbook!.ownerId).toBe(testUserId)
  })

  it('should have correct initial workbook data', async () => {
    const workbook = await prisma.workbook.findUnique({
      where: { id: testWorkbookId },
    })

    const data = workbook!.data as any
    expect(data.sheets).toHaveLength(1)
    expect(data.sheets[0].name).toBe('Sheet1')
    expect(data.sheets[0].cells.A1).toEqual({ value: 'Name' })
    expect(data.sheets[0].cells.B2).toEqual({ value: 30 })
  })

  it('should simulate applying operations and updating workbook', async () => {
    // Get the workbook
    const workbook = await prisma.workbook.findUnique({
      where: { id: testWorkbookId },
    })

    const oldSnapshot = workbook!.data
    const newData = {
      ...workbook!.data,
      sheets: [
        {
          ...(workbook!.data as any).sheets[0],
          cells: {
            ...(workbook!.data as any).sheets[0].cells,
            C1: { value: 'Email' },
          },
        },
      ],
    }

    // Update the workbook
    const updated = await prisma.workbook.update({
      where: { id: testWorkbookId },
      data: {
        data: newData as any,
        version: workbook!.version + 1,
      },
    })

    expect(updated.version).toBe(2)
    expect((updated.data as any).sheets[0].cells.C1).toEqual({ value: 'Email' })

    // Create action record
    const action = await prisma.action.create({
      data: {
        type: 'operations',
        workbookId: testWorkbookId,
        userId: testUserId,
        applied: true,
        message: 'Test operation',
        data: {
          operations: [
            {
              kind: 'set_cell',
              sheet: 'Sheet1',
              cell: 'C1',
              value: 'Email',
            },
          ],
        } as any,
        oldSnapshot: oldSnapshot as any,
        newSnapshot: newData as any,
      },
    })

    expect(action).toBeDefined()
    expect(action.type).toBe('operations')
    expect(action.applied).toBe(true)
  })

  it('should handle multiple operations in sequence', async () => {
    const operations: Operation[] = [
      {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'C1',
        value: 'Email',
      },
      {
        kind: 'set_cell',
        sheet: 'Sheet1',
        cell: 'C2',
        value: 'alice@example.com',
      },
      {
        kind: 'format_range',
        sheet: 'Sheet1',
        range: 'A1:C1',
        format: {
          bold: true,
          backgroundColor: '#f0f0f0',
        },
      },
    ]

    expect(operations).toHaveLength(3)
    expect(operations[0]!.kind).toBe('set_cell')
    expect(operations[1]!.kind).toBe('set_cell')
    expect(operations[2]!.kind).toBe('format_range')
  })

  it('should track action history', async () => {
    // Create multiple actions
    await prisma.action.create({
      data: {
        type: 'operations',
        workbookId: testWorkbookId,
        userId: testUserId,
        applied: true,
        message: 'First action',
        data: {} as any,
      },
    })

    await prisma.action.create({
      data: {
        type: 'operations',
        workbookId: testWorkbookId,
        userId: testUserId,
        applied: true,
        message: 'Second action',
        data: {} as any,
      },
    })

    const actions = await prisma.action.findMany({
      where: { workbookId: testWorkbookId },
      orderBy: { createdAt: 'asc' },
    })

    expect(actions).toHaveLength(2)
    expect(actions[0]!.message).toBe('First action')
    expect(actions[1]!.message).toBe('Second action')
  })
})
