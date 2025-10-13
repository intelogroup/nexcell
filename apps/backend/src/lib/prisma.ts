import { PrismaClient } from '@prisma/client'
import { config } from '../config/index.js'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (config.NODE_ENV !== 'production') globalForPrisma.prisma = prisma