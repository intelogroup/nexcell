import { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

/**
 * Credits Service - Manages user credit balance and transactions
 * 
 * Credit costs (from PRD):
 * - AI request: Variable based on tokens (0.001-0.01 credits per token)
 * - File import: 0.1 credits
 * - Export to Excel/CSV: 0.05 credits
 */
export class CreditsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get user's current credit balance
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    })
    
    return user?.credits ?? 0
  }

  /**
   * Check if user has sufficient credits
   */
  async hasEnough(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId)
    return balance >= amount
  }

  /**
   * Deduct credits from user account
   * @throws Error if insufficient credits
   */
  async deduct(userId: string, amount: number, reason: string): Promise<number> {
    const currentBalance = await this.getBalance(userId)
    
    if (currentBalance < amount) {
      throw new Error(`Insufficient credits. Required: ${amount}, Available: ${currentBalance}`)
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          decrement: amount
        }
      }
    })

    // Log the transaction for audit trail
    await this.logTransaction(userId, -amount, reason, user.credits)
    
    return user.credits
  }

  /**
   * Add credits to user account (for purchases or admin operations)
   */
  async add(userId: string, amount: number, reason: string): Promise<number> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: amount
        }
      }
    })

    await this.logTransaction(userId, amount, reason, user.credits)
    return user.credits
  }

  /**
   * Estimate AI request cost based on token count
   * @param tokens - Number of tokens used in AI request
   * @returns Cost in credits
   */
  estimateAICost(tokens: number): number {
    // Price per 1000 tokens (varies by model, using average)
    const PRICE_PER_1000_TOKENS = 0.01 // $0.01 per 1K tokens
    return (tokens / 1000) * PRICE_PER_1000_TOKENS
  }

  /**
   * Calculate cost for AI request with context size
   */
  calculateAICost(inputTokens: number, outputTokens: number, model: string = 'gpt-4'): number {
    // Different models have different pricing
    const MODEL_PRICES: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 }, // Per 1K tokens
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 }
    }

    const pricing = MODEL_PRICES[model] ?? MODEL_PRICES['gpt-4']!
    const inputCost = (inputTokens / 1000) * pricing.input
    const outputCost = (outputTokens / 1000) * pricing.output
    
    return inputCost + outputCost
  }

  /**
   * Log credit transaction for audit trail
   * @private
   */
  private async logTransaction(
    userId: string,
    amount: number,
    reason: string,
    newBalance: number
  ): Promise<void> {
    // For now, just log to console. Later: store in database table
    const timestamp = new Date().toISOString()
    const type = amount > 0 ? 'CREDIT' : 'DEBIT'
    
    console.log(`[${timestamp}] CREDITS ${type} - User: ${userId}, Amount: ${amount}, Reason: "${reason}", New Balance: ${newBalance}`)
    
    // TODO: Add to database table for proper audit trail
    // await this.prisma.creditTransaction.create({
    //   data: { userId, amount, reason, newBalance }
    // })
  }
}

// Export singleton instance
export const creditsService = new CreditsService(prisma)
