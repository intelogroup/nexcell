import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreditsService } from './credits.service'
import type { PrismaClient } from '@prisma/client'

// Create a mock Prisma client
const createMockPrisma = () => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
})

describe('CreditsService', () => {
  let service: CreditsService
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    service = new CreditsService(mockPrisma as unknown as PrismaClient)
    vi.clearAllMocks()
  })

  describe('getBalance', () => {
    it('should return user credit balance', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 100 })
      
      const balance = await service.getBalance('user-123')
      
      expect(balance).toBe(100)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { credits: true }
      })
    })

    it('should return 0 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      
      const balance = await service.getBalance('non-existent')
      
      expect(balance).toBe(0)
    })

    it('should handle users with 0 credits', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 0 })
      
      const balance = await service.getBalance('user-123')
      
      expect(balance).toBe(0)
    })
  })

  describe('hasEnough', () => {
    it('should return true when user has sufficient credits', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 100 })
      
      const result = await service.hasEnough('user-123', 50)
      
      expect(result).toBe(true)
    })

    it('should return false when user has insufficient credits', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 10 })
      
      const result = await service.hasEnough('user-123', 50)
      
      expect(result).toBe(false)
    })

    it('should return true when user has exact amount needed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 50 })
      
      const result = await service.hasEnough('user-123', 50)
      
      expect(result).toBe(true)
    })

    it('should return false for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      
      const result = await service.hasEnough('user-123', 50)
      
      expect(result).toBe(false)
    })
  })

  describe('deduct', () => {
    it('should deduct credits from user account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 100 })
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 90,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.deduct('user-123', 10, 'AI request')
      
      expect(newBalance).toBe(90)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          credits: {
            decrement: 10
          }
        }
      })
    })

    it('should throw error when insufficient credits', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 5 })
      
      await expect(
        service.deduct('user-123', 10, 'AI request')
      ).rejects.toThrow('Insufficient credits. Required: 10, Available: 5')
      
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('should handle deducting exact balance', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 10 })
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 0,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.deduct('user-123', 10, 'AI request')
      
      expect(newBalance).toBe(0)
    })

    it('should handle large deductions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 1000 })
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 0,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.deduct('user-123', 1000, 'Large operation')
      
      expect(newBalance).toBe(0)
    })

    it('should handle decimal amounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ credits: 10.5 })
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 10.45,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.deduct('user-123', 0.05, 'Small operation')
      
      expect(newBalance).toBe(10.45)
    })
  })

  describe('add', () => {
    it('should add credits to user account', async () => {
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 150,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.add('user-123', 50, 'Credit purchase')
      
      expect(newBalance).toBe(150)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          credits: {
            increment: 50
          }
        }
      })
    })

    it('should handle adding to zero balance', async () => {
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 100,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.add('user-123', 100, 'Initial credits')
      
      expect(newBalance).toBe(100)
    })

    it('should handle large credit additions', async () => {
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 10000,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.add('user-123', 10000, 'Enterprise package')
      
      expect(newBalance).toBe(10000)
    })

    it('should handle decimal amounts', async () => {
      mockPrisma.user.update.mockResolvedValue({ 
        id: 'user-123',
        credits: 100.05,
        clerkUserId: 'clerk-123',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      const newBalance = await service.add('user-123', 0.05, 'Bonus credits')
      
      expect(newBalance).toBe(100.05)
    })
  })

  describe('estimateAICost', () => {
    it('should calculate cost for 1000 tokens', () => {
      const cost = service.estimateAICost(1000)
      expect(cost).toBe(0.01)
    })

    it('should calculate cost for 5000 tokens', () => {
      const cost = service.estimateAICost(5000)
      expect(cost).toBe(0.05)
    })

    it('should handle zero tokens', () => {
      const cost = service.estimateAICost(0)
      expect(cost).toBe(0)
    })

    it('should handle small token counts', () => {
      const cost = service.estimateAICost(100)
      expect(cost).toBe(0.001)
    })

    it('should handle large token counts', () => {
      const cost = service.estimateAICost(100000)
      expect(cost).toBe(1)
    })
  })

  describe('calculateAICost', () => {
    it('should calculate GPT-4 cost correctly', () => {
      const cost = service.calculateAICost(1000, 500, 'gpt-4')
      // (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
      expect(cost).toBe(0.06)
    })

    it('should calculate GPT-3.5 cost correctly', () => {
      const cost = service.calculateAICost(1000, 500, 'gpt-3.5-turbo')
      // (1000/1000 * 0.0015) + (500/1000 * 0.002) = 0.0015 + 0.001 = 0.0025
      expect(cost).toBe(0.0025)
    })

    it('should calculate Claude 3 Opus cost correctly', () => {
      const cost = service.calculateAICost(1000, 500, 'claude-3-opus')
      // (1000/1000 * 0.015) + (500/1000 * 0.075) = 0.015 + 0.0375 = 0.0525
      expect(cost).toBe(0.0525)
    })

    it('should calculate Claude 3 Sonnet cost correctly', () => {
      const cost = service.calculateAICost(1000, 500, 'claude-3-sonnet')
      // (1000/1000 * 0.003) + (500/1000 * 0.015) = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 4)
    })

    it('should default to GPT-4 pricing for unknown model', () => {
      const cost = service.calculateAICost(1000, 500, 'unknown-model')
      expect(cost).toBe(0.06) // Same as GPT-4
    })

    it('should handle zero tokens', () => {
      const cost = service.calculateAICost(0, 0, 'gpt-4')
      expect(cost).toBe(0)
    })

    it('should handle only input tokens', () => {
      const cost = service.calculateAICost(1000, 0, 'gpt-4')
      expect(cost).toBe(0.03)
    })

    it('should handle only output tokens', () => {
      const cost = service.calculateAICost(0, 1000, 'gpt-4')
      expect(cost).toBe(0.06)
    })

    it('should handle large token counts', () => {
      const cost = service.calculateAICost(100000, 50000, 'gpt-4')
      // (100000/1000 * 0.03) + (50000/1000 * 0.06) = 3 + 3 = 6
      expect(cost).toBe(6)
    })
  })
})
