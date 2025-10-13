/**
 * End-to-End AI Integration Test
 * 
 * This script tests the complete AI workflow:
 * 1. Create a test workbook with sample data
 * 2. Generate an AI plan from natural language instructions
 * 3. Apply the plan to the workbook
 * 4. Verify the result
 * 5. Check credit deduction
 * 6. Verify Action logging
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const API_URL = 'http://localhost:3001'

// Test user credentials - you'll need to create this user in Clerk
// Or use an existing test user's token
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || ''

interface TestResult {
  testName: string
  passed: boolean
  message: string
  details?: any
}

const results: TestResult[] = []

function logResult(result: TestResult) {
  results.push(result)
  const icon = result.passed ? '✅' : '❌'
  console.log(`${icon} ${result.testName}: ${result.message}`)
  if (result.details) {
    console.log('   Details:', JSON.stringify(result.details, null, 2))
  }
}

async function makeRequest(
  method: string,
  path: string,
  body?: any,
  token: string = TEST_AUTH_TOKEN
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  return response
}

async function runTest() {
  console.log('\n🧪 Starting AI Integration E2E Test\n')
  console.log('=' .repeat(60))

  if (!TEST_AUTH_TOKEN) {
    console.error('❌ ERROR: TEST_AUTH_TOKEN environment variable is required')
    console.error('Please set it to a valid Clerk JWT token for testing')
    console.error('\nTo get a token:')
    console.error('1. Sign in to the frontend')
    console.error('2. Open browser console')
    console.error('3. Run: await window.Clerk.session.getToken()')
    console.error('4. Copy the token and set: $env:TEST_AUTH_TOKEN="<token>"')
    process.exit(1)
  }

  let testWorkbookId: string | null = null
  let testUserId: string | null = null
  let initialCredits: number = 0

  try {
    // Test 1: Create a test workbook with sample data
    console.log('\n📝 Test 1: Create test workbook with sample data')
    const createResponse = await makeRequest('POST', '/api/workbooks', {
      name: 'AI Test Workbook',
      description: 'Testing AI integration',
      data: {
        sheets: [
          {
            name: 'Sheet1',
            cells: {
              A1: { value: 10 },
              A2: { value: 20 },
              A3: { value: 30 },
              A4: { value: 40 },
              A5: { value: 50 },
            },
          },
        ],
      },
    })

    if (!createResponse.ok) {
      const error = await createResponse.json()
      throw new Error(`Failed to create workbook: ${JSON.stringify(error)}`)
    }

    const createData = await createResponse.json()
    testWorkbookId = createData.workbook.id
    testUserId = createData.workbook.ownerId

    logResult({
      testName: 'Create Workbook',
      passed: true,
      message: `Created workbook ${testWorkbookId}`,
      details: { workbookId: testWorkbookId, userId: testUserId },
    })

    // Test 2: Check initial credits
    console.log('\n💰 Test 2: Check initial credits')
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { credits: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    initialCredits = user.credits
    logResult({
      testName: 'Initial Credits',
      passed: true,
      message: `User has ${initialCredits} credits`,
      details: { credits: initialCredits },
    })

    // Test 3: Generate AI plan
    console.log('\n🤖 Test 3: Generate AI plan from instructions')
    const instructions = 'Create a SUM formula in cell A10 that adds all values from A1 to A5'
    
    const planResponse = await makeRequest('POST', '/api/ai/plan', {
      workbookId: testWorkbookId,
      instructions,
    })

    if (!planResponse.ok) {
      const error = await planResponse.json()
      throw new Error(`Failed to generate plan: ${JSON.stringify(error)}`)
    }

    const planData = await planResponse.json()
    const plan = planData.plan

    logResult({
      testName: 'Generate AI Plan',
      passed: plan && plan.operations && plan.operations.length > 0,
      message: `Generated plan with ${plan.operations.length} operation(s)`,
      details: {
        planId: plan.id,
        operations: plan.operations,
        reasoning: plan.reasoning,
        warnings: plan.warnings,
      },
    })

    // Test 4: Verify credit deduction for plan (5 credits)
    console.log('\n💳 Test 4: Verify credit deduction for plan generation')
    const userAfterPlan = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { credits: true },
    })

    const planCreditDeduction = initialCredits - (userAfterPlan?.credits || 0)
    logResult({
      testName: 'Plan Credit Deduction',
      passed: planCreditDeduction === 5,
      message: `${planCreditDeduction} credits deducted (expected 5)`,
      details: {
        before: initialCredits,
        after: userAfterPlan?.credits,
        deducted: planCreditDeduction,
      },
    })

    // Test 5: Verify Action was logged for plan
    console.log('\n📋 Test 5: Verify Action logged for plan')
    const planAction = await prisma.action.findFirst({
      where: {
        id: plan.id,
        type: 'ai_plan',
        workbookId: testWorkbookId,
        userId: testUserId,
      },
    })

    logResult({
      testName: 'Plan Action Logged',
      passed: !!planAction && planAction.applied === false,
      message: planAction
        ? `Action logged with applied=${planAction.applied}`
        : 'Action not found',
      details: {
        actionId: planAction?.id,
        type: planAction?.type,
        applied: planAction?.applied,
      },
    })

    // Test 6: Apply the AI plan
    console.log('\n⚡ Test 6: Apply the AI plan')
    const applyResponse = await makeRequest('POST', '/api/ai/apply', {
      workbookId: testWorkbookId,
      planId: plan.id,
    })

    if (!applyResponse.ok) {
      const error = await applyResponse.json()
      throw new Error(`Failed to apply plan: ${JSON.stringify(error)}`)
    }

    const applyData = await applyResponse.json()

    logResult({
      testName: 'Apply AI Plan',
      passed: applyData.success && applyData.result.appliedOps > 0,
      message: `Applied ${applyData.result.appliedOps} operation(s)`,
      details: {
        appliedOps: applyData.result.appliedOps,
        errors: applyData.result.errors,
        workbookVersion: applyData.workbook.version,
      },
    })

    // Test 7: Verify credit deduction for apply (10 credits)
    console.log('\n💳 Test 7: Verify credit deduction for apply')
    const userAfterApply = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { credits: true },
    })

    const applyCreditDeduction = (userAfterPlan?.credits || 0) - (userAfterApply?.credits || 0)
    logResult({
      testName: 'Apply Credit Deduction',
      passed: applyCreditDeduction === 10,
      message: `${applyCreditDeduction} credits deducted (expected 10)`,
      details: {
        before: userAfterPlan?.credits,
        after: userAfterApply?.credits,
        deducted: applyCreditDeduction,
        totalDeducted: initialCredits - (userAfterApply?.credits || 0),
      },
    })

    // Test 8: Verify plan was marked as applied
    console.log('\n✔️ Test 8: Verify plan marked as applied')
    const updatedPlanAction = await prisma.action.findFirst({
      where: {
        id: plan.id,
        type: 'ai_plan',
      },
    })

    logResult({
      testName: 'Plan Marked Applied',
      passed: updatedPlanAction?.applied === true,
      message: updatedPlanAction
        ? `Plan applied=${updatedPlanAction.applied}`
        : 'Plan action not found',
      details: { applied: updatedPlanAction?.applied },
    })

    // Test 9: Verify workbook was updated correctly
    console.log('\n📊 Test 9: Verify workbook result')
    const workbookResponse = await makeRequest('GET', `/api/workbooks/${testWorkbookId}`)
    
    if (!workbookResponse.ok) {
      throw new Error('Failed to fetch updated workbook')
    }

    const workbookData = await workbookResponse.json()
    const workbook = workbookData.workbook
    const cellA10 = workbook.data?.sheets?.[0]?.cells?.A10

    // Check if A10 has the expected SUM formula
    const hasFormula = cellA10?.formula && cellA10.formula.includes('SUM')
    logResult({
      testName: 'Workbook Result',
      passed: hasFormula || false,
      message: hasFormula
        ? `Cell A10 has formula: ${cellA10.formula}`
        : 'Formula not found in A10',
      details: {
        cellA10,
        version: workbook.version,
        allCells: workbook.data?.sheets?.[0]?.cells,
      },
    })

    // Test 10: Verify Action was logged for apply
    console.log('\n📝 Test 10: Verify Action logged for apply')
    const applyAction = await prisma.action.findFirst({
      where: {
        workbookId: testWorkbookId,
        userId: testUserId,
        type: 'workbook_ops',
      },
      orderBy: { createdAt: 'desc' },
    })

    logResult({
      testName: 'Apply Action Logged',
      passed: !!applyAction,
      message: applyAction
        ? `Action logged with type=${applyAction.type}`
        : 'Action not found',
      details: {
        actionId: applyAction?.id,
        type: applyAction?.type,
        message: applyAction?.message,
      },
    })

  } catch (error) {
    logResult({
      testName: 'Test Execution',
      passed: false,
      message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`,
      details: error,
    })
  } finally {
    // Cleanup: Delete test workbook
    if (testWorkbookId) {
      console.log('\n🧹 Cleanup: Deleting test workbook')
      try {
        await makeRequest('DELETE', `/api/workbooks/${testWorkbookId}`)
        console.log('✅ Test workbook deleted')
      } catch (error) {
        console.log('⚠️ Failed to delete test workbook:', error)
      }
    }

    await prisma.$disconnect()
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Test Summary\n')
  const passed = results.filter(r => r.passed).length
  const total = results.length
  const percentage = Math.round((passed / total) * 100)

  console.log(`Total Tests: ${total}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${total - passed}`)
  console.log(`Success Rate: ${percentage}%\n`)

  if (passed === total) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('❌ Some tests failed. Review the details above.')
    process.exit(1)
  }
}

// Run the test
runTest().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
