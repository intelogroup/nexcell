/**
 * Test script to verify workbook templates are accessible
 * Run with: tsx apps/backend/test-templates.ts
 */

import fetch from 'node-fetch'

const API_URL = 'http://localhost:3001'

async function testTemplates() {
  console.log('🧪 Testing Workbook Templates\n')

  try {
    // Test 1: Fetch templates (no auth required for public templates)
    console.log('1️⃣  Fetching public templates...')
    const templatesResponse = await fetch(`${API_URL}/api/templates`)
    
    if (!templatesResponse.ok) {
      throw new Error(`HTTP ${templatesResponse.status}: ${await templatesResponse.text()}`)
    }

    const templatesData = await templatesResponse.json() as any
    console.log(`   ✅ Found ${templatesData.templates?.length || 0} templates\n`)

    // Display templates
    if (templatesData.templates && templatesData.templates.length > 0) {
      console.log('📋 Available Templates:')
      console.log('─'.repeat(80))
      
      templatesData.templates.forEach((template: any, index: number) => {
        console.log(`\n${index + 1}. ${template.name}`)
        console.log(`   Category: ${template.category}`)
        console.log(`   Description: ${template.description}`)
        console.log(`   Official: ${template.isOfficial ? '✓' : '✗'}`)
        console.log(`   Usage Count: ${template.usageCount}`)
        console.log(`   ID: ${template.id}`)
      })
      
      console.log('\n' + '─'.repeat(80))

      // Find blank workbook
      const blankTemplate = templatesData.templates.find((t: any) => 
        t.name === 'Blank Workbook'
      )

      if (blankTemplate) {
        console.log('\n✅ BLANK WORKBOOK TEMPLATE FOUND!')
        console.log(`   ID: ${blankTemplate.id}`)
        console.log(`   Ready to use for creating new workbooks`)
      } else {
        console.log('\n⚠️  Blank Workbook template not found')
        console.log('   Run: cd apps/backend && pnpm db:seed')
      }

    } else {
      console.log('\n⚠️  No templates found in database')
      console.log('   Run: cd apps/backend && pnpm db:seed')
    }

    console.log('\n✅ Template test complete!\n')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    console.error('\nMake sure the backend server is running:')
    console.error('   cd apps/backend && pnpm dev')
    process.exit(1)
  }
}

// Run test
testTemplates()
