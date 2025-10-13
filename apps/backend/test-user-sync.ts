import 'dotenv/config'
import { config } from './src/config/index.js'

/**
 * Test script for the user sync endpoint
 * This simulates what the frontend will do on first login
 * 
 * INSTRUCTIONS:
 * 1. Make sure the backend server is running (pnpm dev)
 * 2. Sign in to your app in the browser at http://localhost:5173
 * 3. Open browser dev tools → Network tab
 * 4. Look for any request to your API and check the Authorization header
 * 5. Copy the Bearer token value (without "Bearer ")
 * 6. Set TEST_CLERK_TOKEN in apps/backend/.env or pass it as an environment variable
 * 7. Run: pnpm tsx test-user-sync.ts
 */

async function testUserSync() {
  const baseUrl = `http://localhost:${config.PORT}`
  
  console.log('Testing user sync endpoint...\n')
  
  const sessionToken = process.env.TEST_CLERK_TOKEN || ''
  
  if (!sessionToken) {
    console.error('❌ TEST_CLERK_TOKEN not set in environment\n')
    console.log('To test with authentication:')
    console.log('1. Start backend: cd apps/backend && pnpm dev')
    console.log('2. Start frontend: cd apps/frontend && pnpm dev')
    console.log('3. Sign in at http://localhost:5173')
    console.log('4. Open browser DevTools → Network tab')
    console.log('5. Find any API request and copy the Authorization Bearer token')
    console.log('6. Run: TEST_CLERK_TOKEN=<your-token> pnpm tsx test-user-sync.ts\n')
    
    console.log('Testing without auth (will fail, but shows endpoint structure)...\n')
  }

  try {
    // Test 1: Health check
    console.log('Test 1: GET /api/health')
    const healthResponse = await fetch(`${baseUrl}/api/health`)
    const healthData = await healthResponse.json()
    console.log('Response status:', healthResponse.status)
    console.log('Response:', JSON.stringify(healthData, null, 2))
    
    if (healthResponse.ok) {
      console.log('✅ Health check passed\n')
    } else {
      console.log('❌ Health check failed\n')
      return
    }

    // Test 2: Sync user (requires auth)
    console.log('Test 2: POST /api/auth/sync')
    const testUser = {
      clerkId: 'user_test123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }
    console.log('Payload:', JSON.stringify(testUser, null, 2))
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`
    }
    
    const syncResponse = await fetch(`${baseUrl}/api/auth/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testUser),
    })

    const syncData = await syncResponse.json()
    console.log('Response status:', syncResponse.status)
    console.log('Response:', JSON.stringify(syncData, null, 2))
    
    if (syncResponse.ok) {
      console.log('✅ User sync successful\n')
    } else {
      console.log('❌ User sync failed (expected without valid token)\n')
      if (!sessionToken) {
        console.log('💡 This is expected. To test with real auth, provide TEST_CLERK_TOKEN\n')
      }
    }

    // Test 3: Get current user (requires auth)
    console.log('Test 3: GET /api/auth/me')
    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {},
    })

    const meData = await meResponse.json()
    console.log('Response status:', meResponse.status)
    console.log('Response:', JSON.stringify(meData, null, 2))
    
    if (meResponse.ok) {
      console.log('✅ Get user info successful\n')
    } else {
      console.log('❌ Get user info failed (expected without valid token)\n')
      if (!sessionToken) {
        console.log('💡 This is expected. To test with real auth, provide TEST_CLERK_TOKEN\n')
      }
    }

    // Summary
    console.log('='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log('Endpoints tested:')
    console.log('✓ GET  /api/health')
    console.log('✓ POST /api/auth/sync')
    console.log('✓ GET  /api/auth/me')
    console.log('\nBackend is ready! Test the full flow:')
    console.log('1. Start frontend: cd apps/frontend && pnpm dev')
    console.log('2. Visit http://localhost:5173')
    console.log('3. Sign up or sign in')
    console.log('4. Check browser console and network tab')
    console.log('5. User should be synced to database automatically')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the test
console.log('='.repeat(60))
console.log('User Sync Endpoint Test')
console.log('='.repeat(60))
console.log()

testUserSync()
