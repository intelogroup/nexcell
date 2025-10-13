import 'dotenv/config'
import { prisma } from './src/lib/prisma.js'

type Args = {
  email?: string
  clerkId?: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const out: Args = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if ((a === '--email' || a === '-e') && args[i + 1]) {
      out.email = args[i + 1]
      i++
    } else if ((a === '--id' || a === '--clerkId' || a === '-i') && args[i + 1]) {
      out.clerkId = args[i + 1]
      i++
    }
  }
  // Fallback to env vars if provided
  out.email = out.email || process.env.VERIFY_EMAIL
  out.clerkId = out.clerkId || process.env.VERIFY_CLERK_ID
  return out
}

async function main() {
  const { email, clerkId } = parseArgs()
  console.log('🔎 Verifying users in database...')
  if (email) console.log(`   Filter: email = ${email}`)
  if (clerkId) console.log(`   Filter: clerkId = ${clerkId}`)
  console.log('')

  try {
    const where: any = {}
    if (email) where.email = email
    if (clerkId) where.clerkId = clerkId

    const users = await prisma.user.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (users.length === 0) {
      console.log('❌ No matching users found.')
    } else {
      console.log(`✅ Found ${users.length} user(s):`)
      for (const u of users) {
        console.log('-'.repeat(60))
        console.log({
          id: u.id,
          clerkId: u.clerkId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })
      }
      console.log('-'.repeat(60))
    }
  } catch (err) {
    console.error('❌ Error querying users:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()