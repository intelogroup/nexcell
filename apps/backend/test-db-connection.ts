import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connection successful!')
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT current_database(), version()`
    console.log('Database info:', result)
    
    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    console.error('\nPlease check:')
    console.error('1. DATABASE_URL is set correctly in apps/backend/.env')
    console.error('2. Your database is running and accessible')
    console.error('3. The connection string format is correct')
    process.exit(1)
  }
}

testConnection()
