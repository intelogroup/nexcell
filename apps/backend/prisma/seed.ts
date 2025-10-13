import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Workbook templates to seed into the database
 */
const templates = [
  {
    name: 'Blank Workbook',
    description: 'Start with a clean slate - perfect for any project',
    category: 'Basic',
    data: {
      sheets: [{
        name: 'Sheet1',
        cells: {},
        formats: {},
      }],
      metadata: {
        activeSheet: 'Sheet1',
        theme: 'light',
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Monthly Budget',
    description: 'Track your income and expenses with automatic calculations',
    category: 'Finance',
    data: {
      sheets: [{
        name: 'Budget',
        cells: {
          // Header
          'A1': { value: 'Category', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'B1': { value: 'Amount', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'C1': { value: 'Notes', format: { bold: true, backgroundColor: '#E8F4F8' } },
          
          // Income section
          'A2': { value: 'INCOME', format: { bold: true } },
          'A3': { value: 'Salary', format: {} },
          'B3': { value: 0, format: {} },
          'A4': { value: 'Freelance', format: {} },
          'B4': { value: 0, format: {} },
          'A5': { value: 'Other Income', format: {} },
          'B5': { value: 0, format: {} },
          'A6': { value: 'Total Income', format: { bold: true } },
          'B6': { value: null, formula: '=SUM(B3:B5)', format: { bold: true } },
          
          // Expenses
          'A8': { value: 'EXPENSES', format: { bold: true } },
          'A9': { value: 'Rent/Mortgage', format: {} },
          'B9': { value: 0, format: {} },
          'A10': { value: 'Utilities', format: {} },
          'B10': { value: 0, format: {} },
          'A11': { value: 'Groceries', format: {} },
          'B11': { value: 0, format: {} },
          'A12': { value: 'Transportation', format: {} },
          'B12': { value: 0, format: {} },
          'A13': { value: 'Entertainment', format: {} },
          'B13': { value: 0, format: {} },
          'A14': { value: 'Insurance', format: {} },
          'B14': { value: 0, format: {} },
          'A15': { value: 'Other Expenses', format: {} },
          'B15': { value: 0, format: {} },
          'A16': { value: 'Total Expenses', format: { bold: true } },
          'B16': { value: null, formula: '=SUM(B9:B15)', format: { bold: true } },

          // Summary
          'A18': { value: 'NET (Income - Expenses)', format: { bold: true, backgroundColor: '#FFFACD' } },
          'B18': { value: null, formula: '=B6-B16', format: { bold: true, backgroundColor: '#FFFACD' } },
        },
        formats: {},
      }],
      metadata: {
        activeSheet: 'Budget',
        theme: 'light',
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Task Tracker',
    description: 'Keep track of tasks, priorities, and deadlines',
    category: 'Productivity',
    data: {
      sheets: [{
        name: 'Tasks',
        cells: {
          // Header
          'A1': { value: 'Task', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'B1': { value: 'Status', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'C1': { value: 'Priority', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'D1': { value: 'Due Date', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'E1': { value: 'Assigned To', format: { bold: true, backgroundColor: '#E8F4F8' } },
          
          // Example tasks
          'A2': { value: 'Complete project proposal', format: {} },
          'B2': { value: 'In Progress', format: {} },
          'C2': { value: 'High', format: { color: '#D32F2F' } },
          'D2': { value: '2025-10-25', format: {} },
          'E2': { value: 'John', format: {} },
          
          'A3': { value: 'Review code changes', format: {} },
          'B3': { value: 'To Do', format: {} },
          'C3': { value: 'Medium', format: { color: '#F57C00' } },
          'D3': { value: '2025-10-22', format: {} },
          'E3': { value: 'Sarah', format: {} },
          
          'A4': { value: 'Update documentation', format: {} },
          'B4': { value: 'To Do', format: {} },
          'C4': { value: 'Low', format: { color: '#388E3C' } },
          'D4': { value: '2025-10-28', format: {} },
          'E4': { value: 'Mike', format: {} },
        },
        formats: {},
      }],
      metadata: {
        activeSheet: 'Tasks',
        theme: 'light',
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Sales Tracker',
    description: 'Track sales performance and calculate revenue',
    category: 'Business',
    data: {
      sheets: [{
        name: 'Sales',
        cells: {
          // Header
          'A1': { value: 'Date', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'B1': { value: 'Product', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'C1': { value: 'Quantity', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'D1': { value: 'Unit Price', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'E1': { value: 'Total', format: { bold: true, backgroundColor: '#E8F4F8' } },
          
          // Sample data
          'A2': { value: '2025-10-15', format: {} },
          'B2': { value: 'Product A', format: {} },
          'C2': { value: 5, format: {} },
          'D2': { value: 25.99, format: {} },
          'E2': { value: null, formula: '=C2*D2', format: {} },
          
          'A3': { value: '2025-10-16', format: {} },
          'B3': { value: 'Product B', format: {} },
          'C3': { value: 3, format: {} },
          'D3': { value: 45.50, format: {} },
          'E3': { value: null, formula: '=C3*D3', format: {} },
          
          'A4': { value: '2025-10-17', format: {} },
          'B4': { value: 'Product C', format: {} },
          'C4': { value: 10, format: {} },
          'D4': { value: 15.99, format: {} },
          'E4': { value: null, formula: '=C4*D4', format: {} },
          
          // Total
          'B5': { value: 'TOTAL', format: { bold: true } },
          'E5': { value: null, formula: '=SUM(E2:E4)', format: { bold: true, backgroundColor: '#FFFACD' } },
        },
        formats: {},
      }],
      metadata: {
        activeSheet: 'Sales',
        theme: 'light',
      }
    },
    isPublic: true,
    isOfficial: true,
  },
  {
    name: 'Class Gradebook',
    description: 'Track student grades and calculate averages',
    category: 'Education',
    data: {
      sheets: [{
        name: 'Grades',
        cells: {
          // Header
          'A1': { value: 'Student', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'B1': { value: 'Test 1', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'C1': { value: 'Test 2', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'D1': { value: 'Test 3', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'E1': { value: 'Average', format: { bold: true, backgroundColor: '#E8F4F8' } },
          'F1': { value: 'Grade', format: { bold: true, backgroundColor: '#E8F4F8' } },
          
          // Sample students
          'A2': { value: 'Alice Johnson', format: {} },
          'B2': { value: 92, format: {} },
          'C2': { value: 88, format: {} },
          'D2': { value: 95, format: {} },
          'E2': { value: null, formula: '=AVERAGE(B2:D2)', format: {} },
          'F2': { value: 'A', format: {} },
          
          'A3': { value: 'Bob Smith', format: {} },
          'B3': { value: 85, format: {} },
          'C3': { value: 92, format: {} },
          'D3': { value: 88, format: {} },
          'E3': { value: null, formula: '=AVERAGE(B3:D3)', format: {} },
          'F3': { value: 'B+', format: {} },
          
          'A4': { value: 'Carol White', format: {} },
          'B4': { value: 78, format: {} },
          'C4': { value: 82, format: {} },
          'D4': { value: 85, format: {} },
          'E4': { value: null, formula: '=AVERAGE(B4:D4)', format: {} },
          'F4': { value: 'B-', format: {} },
        },
        formats: {},
      }],
      metadata: {
        activeSheet: 'Grades',
        theme: 'light',
      }
    },
    isPublic: true,
    isOfficial: true,
  },
]

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting database seed...')

  // Seed templates
  console.log('\n� Seeding workbook templates...')
  for (const template of templates) {
    // Check if template already exists
    const existing = await prisma.workbookTemplate.findFirst({
      where: { name: template.name }
    })

    if (existing) {
      // Update existing template
      await prisma.workbookTemplate.update({
        where: { id: existing.id },
        data: {
          description: template.description,
          category: template.category,
          data: template.data,
          isPublic: template.isPublic,
          isOfficial: template.isOfficial,
        }
      })
      console.log(`  🔄 Updated: ${template.name}`)
    } else {
      // Create new template
      await prisma.workbookTemplate.create({
        data: template
      })
      console.log(`  ✅ Created: ${template.name}`)
    }
  }

  console.log(`\n✅ Successfully seeded ${templates.length} templates!`)
  console.log('\n📊 Database seed complete!')
}

/**
 * Execute seed
 */
main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
