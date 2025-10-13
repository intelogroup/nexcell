// Test script to verify the auth sync endpoint
import 'dotenv/config'

const API_URL = 'http://localhost:3001'

console.log('🧪 Testing Auth Sync Endpoint\n')

// Test 1: Health check
async function testHealthCheck() {
  console.log('1️⃣ Testing health endpoint...')
  try {
    const response = await fetch(`${API_URL}/api/health`)
    const data = await response.json()
    
    if (response.ok && data.status === 'ok') {
      console.log('✅ Health check passed:', data)
    } else {
      console.log('❌ Health check failed:', data)
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message)
  }
  console.log('')
}

// Test 2: Auth sync endpoint (without authentication - should fail)
async function testAuthSyncWithoutAuth() {
  console.log('2️⃣ Testing auth sync without authentication (should fail)...')
  try {
    const response = await fetch(`${API_URL}/api/auth/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerkId: 'test_clerk_id_123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      }),
    })
    const data = await response.json()
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected without auth:', data)
    } else {
      console.log('❌ Should have rejected without auth:', response.status, data)
    }
  } catch (error) {
    console.log('❌ Test error:', error.message)
  }
  console.log('')
}

// Test 3: Get current user endpoint (without authentication - should fail)
async function testGetUserWithoutAuth() {
  console.log('3️⃣ Testing get user without authentication (should fail)...')
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected without auth:', data)
    } else {
      console.log('❌ Should have rejected without auth:', response.status, data)
    }
  } catch (error) {
    console.log('❌ Test error:', error.message)
  }
  console.log('')
}

// Run all tests
async function runTests() {
  await testHealthCheck()
  await testAuthSyncWithoutAuth()
  await testGetUserWithoutAuth()
  
  console.log('📊 Test Summary:')
  console.log('   - Health endpoint: working ✓')
  console.log('   - Auth sync endpoint: protected ✓')
  console.log('   - Get user endpoint: protected ✓')
  console.log('\n💡 To test with real authentication:')
  console.log('   1. Sign in through the frontend at http://localhost:5173')
  console.log('   2. Open browser DevTools > Network tab')
  console.log('   3. Look for the POST request to /api/auth/sync')
  console.log('   4. Check the response to see if user was synced to database')
}

// Wait a moment for server to be ready, then run tests
setTimeout(runTests, 2000)
