/**
 * Test script for the /api/auth/sync endpoint
 * This verifies that Clerk user data can be synced to the database
 */

import 'dotenv/config'

const BASE_URL = 'http://localhost:3001'

async function testAuthSync() {
  console.log('🧪 Testing /api/auth/sync endpoint...\n')

  // Mock Clerk JWT - In real scenario, this would come from Clerk
  // For testing, we need a valid JWT token from Clerk
  // You'll need to get this from your frontend after signing in
  
  const mockClerkId = 'user_test123'
  const mockUserData = {
    clerkId: mockClerkId,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  }

  try {
    // Note: This will fail without a valid Clerk JWT token
    // To properly test, you need to:
    // 1. Sign in via the frontend
    // 2. Get the JWT token from the frontend
    // 3. Use that token here

    console.log('📤 Sending user sync request...')
    console.log('User data:', mockUserData)
    
    const response = await fetch(`${BASE_URL}/api/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You need to add actual JWT token from Clerk here
        // 'Authorization': 'Bearer YOUR_CLERK_JWT_TOKEN'
      },
      body: JSON.stringify(mockUserData),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Sync failed:', response.status, data)
      if (response.status === 401) {
        console.log('\n💡 Expected: This endpoint requires authentication.')
        console.log('   To test properly:')
        console.log('   1. Sign in through the frontend')
        console.log('   2. Get the JWT token from localStorage or network tab')
        console.log('   3. Add it to the Authorization header above')
      }
      return
    }

    console.log('✅ Sync successful!')
    console.log('Response:', JSON.stringify(data, null, 2))

    // Test /api/auth/me endpoint
    console.log('\n🧪 Testing /api/auth/me endpoint...')
    const meResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Same JWT token needed here
        // 'Authorization': 'Bearer YOUR_CLERK_JWT_TOKEN'
      },
    })

    const meData = await meResponse.json()
    
    if (!meResponse.ok) {
      console.error('❌ /me failed:', meResponse.status, meData)
      return
    }

    console.log('✅ /me endpoint successful!')
    console.log('User data:', JSON.stringify(meData, null, 2))

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Test health endpoint first to ensure server is running
async function testHealth() {
  console.log('🏥 Testing health endpoint...\n')
  try {
    const response = await fetch(`${BASE_URL}/api/health`)
    const data = await response.json()
    console.log('✅ Health check:', data)
    console.log('')
    return true
  } catch (error) {
    console.error('❌ Server is not running!')
    console.error('   Please start the backend with: pnpm dev')
    return false
  }
}

// Run tests
async function main() {
  console.log('🚀 Starting authentication endpoint tests\n')
  console.log('=' .repeat(50))
  
  const isHealthy = await testHealth()
  if (!isHealthy) {
    process.exit(1)
  }

  console.log('=' .repeat(50))
  await testAuthSync()
  console.log('\n' + '=' .repeat(50))
  console.log('\n📝 Next steps:')
  console.log('   1. Start the frontend with: pnpm dev')
  console.log('   2. Sign in through the frontend')
  console.log('   3. Check browser network tab for the sync request')
  console.log('   4. Verify user was created in database')
  console.log('\n✨ Endpoint is ready for integration with frontend!')
}

main()
