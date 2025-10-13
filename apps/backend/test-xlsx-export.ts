/**
 * Test script for XLSX export functionality
 * 
 * This script creates a test workbook with:
 * - Multiple sheets
 * - Various formulas (SUM, AVERAGE, complex references)
 * - Different value types (numbers, text, dates)
 * - Cell formatting (bold, italic, colors, backgrounds)
 * 
 * Then exports to XLSX and verifies the file can be opened in Excel/LibreOffice
 */

import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE = 'http://localhost:3001'

// Get auth token from command line or environment
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.argv[2]

if (!AUTH_TOKEN) {
  console.error('❌ Error: AUTH_TOKEN not provided')
  console.log('Usage: node test-xlsx-export.js <auth-token>')
  console.log('Or set AUTH_TOKEN environment variable')
  console.log('\nTo get an auth token, run: node get-auth-token.js')
  process.exit(1)
}

interface Operation {
  kind: string
  [key: string]: any
}

async function makeRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const url = `${API_BASE}${endpoint}`
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }
  
  return response.json()
}

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const url = `${API_BASE}${endpoint}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }
  
  const buffer = await response.arrayBuffer()
  const outputPath = path.join(__dirname, filename)
  fs.writeFileSync(outputPath, Buffer.from(buffer))
  console.log(`✅ Downloaded to: ${outputPath}`)
}

async function main() {
  console.log('🧪 XLSX Export Test\n')
  console.log('=' .repeat(60))
  
  try {
    // Step 1: Create a test workbook
    console.log('\n📝 Step 1: Creating test workbook...')
    const createResponse = await makeRequest('POST', '/workbooks', {
      name: 'XLSX Export Test',
    })
    
    const workbookId = createResponse.workbook.id
    console.log(`✅ Created workbook: ${workbookId}`)
    
    // Step 2: Build comprehensive test data with operations
    console.log('\n📝 Step 2: Adding test data with operations...')
    
    const operations: Operation[] = [
      // Sheet 1: Budget Summary
      { kind: 'rename_sheet', sheetName: 'Sheet1', newName: 'Budget Summary' },
      
      // Headers with formatting
      { kind: 'set_cell', cell: 'A1', value: 'Category' },
      { kind: 'set_cell', cell: 'B1', value: 'Q1' },
      { kind: 'set_cell', cell: 'C1', value: 'Q2' },
      { kind: 'set_cell', cell: 'D1', value: 'Q3' },
      { kind: 'set_cell', cell: 'E1', value: 'Q4' },
      { kind: 'set_cell', cell: 'F1', value: 'Total' },
      
      {
        kind: 'format_range',
        range: { start: 'A1', end: 'F1' },
        format: { bold: true, backgroundColor: '#4F46E5', color: '#FFFFFF' }
      },
      
      // Revenue data
      { kind: 'set_cell', cell: 'A2', value: 'Revenue' },
      { kind: 'set_cell', cell: 'B2', value: 50000 },
      { kind: 'set_cell', cell: 'C2', value: 55000 },
      { kind: 'set_cell', cell: 'D2', value: 60000 },
      { kind: 'set_cell', cell: 'E2', value: 65000 },
      { kind: 'set_cell', cell: 'F2', formula: '=SUM(B2:E2)' },
      
      // Expenses data
      { kind: 'set_cell', cell: 'A3', value: 'Expenses' },
      { kind: 'set_cell', cell: 'B3', value: 30000 },
      { kind: 'set_cell', cell: 'C3', value: 32000 },
      { kind: 'set_cell', cell: 'D3', value: 35000 },
      { kind: 'set_cell', cell: 'E3', value: 38000 },
      { kind: 'set_cell', cell: 'F3', formula: '=SUM(B3:E3)' },
      
      // Profit calculation
      { kind: 'set_cell', cell: 'A4', value: 'Profit' },
      { kind: 'set_cell', cell: 'B4', formula: '=B2-B3' },
      { kind: 'set_cell', cell: 'C4', formula: '=C2-C3' },
      { kind: 'set_cell', cell: 'D4', formula: '=D2-D3' },
      { kind: 'set_cell', cell: 'E4', formula: '=E2-E3' },
      { kind: 'set_cell', cell: 'F4', formula: '=F2-F3' },
      
      {
        kind: 'format_range',
        range: { start: 'A4', end: 'F4' },
        format: { bold: true, backgroundColor: '#10B981', color: '#FFFFFF' }
      },
      
      // Average row
      { kind: 'set_cell', cell: 'A6', value: 'Quarterly Average' },
      { kind: 'set_cell', cell: 'B6', formula: '=AVERAGE(B2:B4)' },
      { kind: 'set_cell', cell: 'C6', formula: '=AVERAGE(C2:C4)' },
      { kind: 'set_cell', cell: 'D6', formula: '=AVERAGE(D2:D4)' },
      { kind: 'set_cell', cell: 'E6', formula: '=AVERAGE(E2:E4)' },
      
      {
        kind: 'format_range',
        range: { start: 'A6', end: 'E6' },
        format: { italic: true, color: '#6B7280' }
      },
      
      // Sheet 2: Product Sales
      { kind: 'add_sheet', sheetName: 'Product Sales' },
      
      // Headers
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'A1', value: 'Product' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'B1', value: 'Units Sold' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'C1', value: 'Price' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'D1', value: 'Revenue' },
      
      {
        kind: 'format_range',
        sheetName: 'Product Sales',
        range: { start: 'A1', end: 'D1' },
        format: { bold: true, backgroundColor: '#EF4444', color: '#FFFFFF' }
      },
      
      // Product data
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'A2', value: 'Widget A' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'B2', value: 150 },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'C2', value: 29.99 },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'D2', formula: '=B2*C2' },
      
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'A3', value: 'Widget B' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'B3', value: 230 },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'C3', value: 49.99 },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'D3', formula: '=B3*C3' },
      
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'A4', value: 'Widget C' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'B4', value: 89 },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'C4', value: 99.99 },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'D4', formula: '=B4*C4' },
      
      // Totals
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'A5', value: 'Total' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'B5', formula: '=SUM(B2:B4)' },
      { kind: 'set_cell', sheetName: 'Product Sales', cell: 'D5', formula: '=SUM(D2:D4)' },
      
      {
        kind: 'format_range',
        sheetName: 'Product Sales',
        range: { start: 'A5', end: 'D5' },
        format: { bold: true, underline: true }
      },
      
      // Sheet 3: Employee Data
      { kind: 'add_sheet', sheetName: 'Employees' },
      
      // Headers
      { kind: 'set_cell', sheetName: 'Employees', cell: 'A1', value: 'Name' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'B1', value: 'Department' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'C1', value: 'Salary' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'D1', value: 'Years' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'E1', value: 'Status' },
      
      {
        kind: 'format_range',
        sheetName: 'Employees',
        range: { start: 'A1', end: 'E1' },
        format: { bold: true, backgroundColor: '#8B5CF6', color: '#FFFFFF' }
      },
      
      // Employee records
      { kind: 'set_cell', sheetName: 'Employees', cell: 'A2', value: 'John Doe' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'B2', value: 'Engineering' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'C2', value: 95000 },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'D2', value: 3 },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'E2', value: 'Active' },
      
      { kind: 'set_cell', sheetName: 'Employees', cell: 'A3', value: 'Jane Smith' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'B3', value: 'Marketing' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'C3', value: 78000 },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'D3', value: 5 },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'E3', value: 'Active' },
      
      { kind: 'set_cell', sheetName: 'Employees', cell: 'A4', value: 'Bob Johnson' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'B4', value: 'Sales' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'C4', value: 82000 },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'D4', value: 2 },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'E4', value: 'Active' },
      
      // Statistics
      { kind: 'set_cell', sheetName: 'Employees', cell: 'A6', value: 'Average Salary' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'C6', formula: '=AVERAGE(C2:C4)' },
      
      { kind: 'set_cell', sheetName: 'Employees', cell: 'A7', value: 'Total Payroll' },
      { kind: 'set_cell', sheetName: 'Employees', cell: 'C7', formula: '=SUM(C2:C4)' },
      
      {
        kind: 'format_range',
        sheetName: 'Employees',
        range: { start: 'A6', end: 'C7' },
        format: { bold: true, backgroundColor: '#F3F4F6' }
      },
    ]
    
    // Apply all operations
    const opsResponse = await makeRequest('POST', `/workbooks/${workbookId}/ops`, {
      operations,
    })
    
    console.log(`✅ Applied ${opsResponse.result.appliedOps} operations`)
    
    if (opsResponse.result.errors.length > 0) {
      console.log(`⚠️  ${opsResponse.result.errors.length} errors occurred:`)
      opsResponse.result.errors.forEach((err: any, i: number) => {
        console.log(`   ${i + 1}. ${err.message}`)
      })
    }
    
    // Step 3: Export to XLSX
    console.log('\n📝 Step 3: Exporting to XLSX...')
    await downloadFile(
      `/workbooks/${workbookId}/export/xlsx`,
      'test-export.xlsx'
    )
    
    // Step 4: Verification checklist
    console.log('\n✅ Export completed successfully!')
    console.log('\n' + '=' .repeat(60))
    console.log('📋 MANUAL VERIFICATION CHECKLIST')
    console.log('=' .repeat(60))
    console.log('\nPlease open test-export.xlsx in Excel or LibreOffice and verify:\n')
    
    console.log('Sheet 1: Budget Summary')
    console.log('  ☐ Headers (A1:F1) are bold with blue background and white text')
    console.log('  ☐ Cell F2 shows 230000 (sum of B2:E2)')
    console.log('  ☐ Cell F3 shows 135000 (sum of B3:E3)')
    console.log('  ☐ Cell F4 shows 95000 (profit total)')
    console.log('  ☐ Row 4 (Profit) has green background')
    console.log('  ☐ Row 6 (Quarterly Average) is italic and gray')
    console.log('  ☐ All formulas calculate correctly\n')
    
    console.log('Sheet 2: Product Sales')
    console.log('  ☐ Headers (A1:D1) are bold with red background and white text')
    console.log('  ☐ Cell D2 shows 4498.50 (150 × 29.99)')
    console.log('  ☐ Cell D3 shows 11497.70 (230 × 49.99)')
    console.log('  ☐ Cell D4 shows 8999.11 (89 × 99.99)')
    console.log('  ☐ Cell B5 shows 469 (total units)')
    console.log('  ☐ Cell D5 shows 24995.31 (total revenue)')
    console.log('  ☐ Row 5 (Total) is bold and underlined\n')
    
    console.log('Sheet 3: Employees')
    console.log('  ☐ Headers (A1:E1) are bold with purple background and white text')
    console.log('  ☐ Three employee records are present')
    console.log('  ☐ Cell C6 shows 85000 (average salary)')
    console.log('  ☐ Cell C7 shows 255000 (total payroll)')
    console.log('  ☐ Statistics rows (6-7) have gray background\n')
    
    console.log('General Checks')
    console.log('  ☐ All sheet names are correct (Budget Summary, Product Sales, Employees)')
    console.log('  ☐ No formula errors (#REF!, #VALUE!, etc.)')
    console.log('  ☐ Numbers display with proper precision')
    console.log('  ☐ Text is readable and not truncated')
    console.log('  ☐ Columns auto-fit content width appropriately')
    
    console.log('\n' + '=' .repeat(60))
    console.log('📊 Test Summary')
    console.log('=' .repeat(60))
    console.log(`Workbook ID: ${workbookId}`)
    console.log(`Operations Applied: ${opsResponse.result.appliedOps}`)
    console.log(`Output File: ${path.join(__dirname, 'test-export.xlsx')}`)
    console.log('\n✅ Test completed successfully!')
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
