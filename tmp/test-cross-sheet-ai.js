/**
 * Live AI Test: Cross-Sheet Formula References
 * 
 * Tests AI's ability to generate cross-sheet formulas like Sheet1!A1
 * Uses real OpenRouter API calls to validate AI understanding
 * 
 * Run: node tmp/test-cross-sheet-ai.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Environment Setup
// ============================================================================

function loadEnv() {
  const envPath = path.join(__dirname, '..', 'client', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found at ' + envPath);
  }
  
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  let currentKey = null;
  let currentValue = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    if (trimmed.includes('=')) {
      // Save previous key-value pair
      if (currentKey) {
        process.env[currentKey] = currentValue.trim();
      }
      // Start new key-value pair
      const [key, ...valueParts] = trimmed.split('=');
      currentKey = key.trim();
      currentValue = valueParts.join('=').trim();
    } else {
      // Continuation of previous value
      currentValue += ' ' + trimmed;
    }
  }
  
  // Save last key-value pair
  if (currentKey) {
    process.env[currentKey] = currentValue.trim();
  }
}

loadEnv();

const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'undefined') {
  throw new Error('VITE_OPENROUTER_API_KEY not found in client/.env');
}

console.log('✅ API Key loaded successfully\n');

// ============================================================================
// OpenRouter API Client
// ============================================================================

async function callOpenRouter(userPrompt, systemPrompt) {
  const startTime = Date.now();
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const duration = Date.now() - startTime;
  const content = data.choices[0]?.message?.content || '';
  const tokens = data.usage?.total_tokens || 0;

  return { content, duration, tokens };
}

// ============================================================================
// AI Operation Parser
// ============================================================================

function parseOperations(aiResponse) {
  try {
    // Try to extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { error: 'No JSON found in response', raw: aiResponse };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      operations: parsed.operations || [],
      explanation: parsed.explanation || '',
      confidence: parsed.confidence || 0,
    };
  } catch (err) {
    return { error: err.message, raw: aiResponse };
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

function hasCrossSheetFormula(operations, sheetPattern) {
  const regex = new RegExp(sheetPattern, 'i');
  
  for (const op of operations) {
    if (op.type === 'setFormula') {
      if (regex.test(op.params.formula)) return true;
    } else if (op.type === 'setCells') {
      for (const [addr, cell] of Object.entries(op.params.cells || {})) {
        if (cell.formula && regex.test(cell.formula)) return true;
      }
    }
  }
  
  return false;
}

function validateCrossSheetReference(operations, expectedPattern) {
  if (!hasCrossSheetFormula(operations, expectedPattern)) {
    return { valid: false, reason: `No cross-sheet formula matching ${expectedPattern}` };
  }
  return { valid: true };
}

function validateMultiSheetOperations(operations, expectedSheets) {
  const sheetsFound = new Set();
  
  for (const op of operations) {
    if (op.type === 'addSheet') {
      sheetsFound.add(op.params.name);
    } else if (op.type === 'setCells' || op.type === 'setFormula') {
      sheetsFound.add(op.params.sheet);
    }
  }
  
  for (const sheet of expectedSheets) {
    if (!sheetsFound.has(sheet)) {
      return { valid: false, reason: `Missing sheet: ${sheet}` };
    }
  }
  
  return { valid: true };
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an AI assistant for Nexcell, a spreadsheet application. Generate workbook operations as JSON.

# Available Operations

1. addSheet - Add a new sheet
{
  "type": "addSheet",
  "params": { "name": "SheetName" }
}

2. setCells - Set multiple cells (preferred for bulk)
{
  "type": "setCells",
  "params": {
    "sheet": "SheetName",
    "cells": {
      "A1": { "value": "Header", "dataType": "string" },
      "B1": { "formula": "=Sheet1!A1*2", "dataType": "formula" }
    }
  }
}

3. setFormula - Set single formula
{
  "type": "setFormula",
  "params": {
    "sheet": "SheetName",
    "cell": "A1",
    "formula": "=Sheet1!B5+Sheet2!C10"
  }
}

4. compute - Trigger recalculation
{
  "type": "compute",
  "params": {}
}

# Cross-Sheet References

Use SheetName!CellRef format:
- =Sheet1!A1 - Reference cell A1 on Sheet1
- =SUM(Sales!B2:B10) - Sum range from Sales sheet
- =Data!B5+Report!C3 - Multi-sheet formula

# Response Format

{
  "operations": [/* array of operations */],
  "explanation": "I'll create...",
  "confidence": 0.9
}

ALWAYS respond with valid JSON. Use cross-sheet references when referencing other sheets.`;

// ============================================================================
// Test Scenarios
// ============================================================================

const TEST_SCENARIOS = [
  {
    id: 'basic-cross-sheet-ref',
    name: 'Basic Cross-Sheet Reference',
    prompt: 'Create two sheets: "Data" with value 100 in A1, and "Summary" with formula referencing Data!A1',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Data', 'Summary']);
      if (!v1.valid) return v1;
      
      const v2 = validateCrossSheetReference(ops, 'Data!A1');
      return v2;
    },
  },
  {
    id: 'sum-from-another-sheet',
    name: 'SUM Formula Across Sheets',
    prompt: 'Create "Sales" sheet with numbers 10, 20, 30 in A1:A3. Then create "Report" sheet with SUM formula referencing Sales!A1:A3 in cell B1',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Sales', 'Report']);
      if (!v1.valid) return v1;
      
      const v2 = validateCrossSheetReference(ops, 'Sales!A[0-9]:A[0-9]|SUM.*Sales!');
      return v2;
    },
  },
  {
    id: 'multi-sheet-rollup',
    name: 'Multi-Sheet Rollup Formula',
    prompt: 'Create 3 sheets: Q1, Q2, Q3 each with 1000 in cell A1. Then create "Annual" sheet with formula that adds Q1!A1 + Q2!A1 + Q3!A1 in cell B2',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Q1', 'Q2', 'Q3', 'Annual']);
      if (!v1.valid) return v1;
      
      const hasQ1 = hasCrossSheetFormula(ops, 'Q1!A1');
      const hasQ2 = hasCrossSheetFormula(ops, 'Q2!A1');
      const hasQ3 = hasCrossSheetFormula(ops, 'Q3!A1');
      
      if (!hasQ1 || !hasQ2 || !hasQ3) {
        return { valid: false, reason: 'Missing one or more Q1!A1, Q2!A1, Q3!A1 references' };
      }
      
      return { valid: true };
    },
  },
  {
    id: 'budget-consolidation',
    name: 'Budget Consolidation',
    prompt: 'Create "Income" sheet with Salary=5000 in B1, Bonus=1000 in B2, Total formula in B3. Create "Expenses" sheet with Rent=2000 in B1, Food=800 in B2, Total formula in B3. Then create "Summary" sheet that references Income!B3 and Expenses!B3 to calculate Net Savings',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Income', 'Expenses', 'Summary']);
      if (!v1.valid) return v1;
      
      const hasIncome = hasCrossSheetFormula(ops, 'Income!B3');
      const hasExpenses = hasCrossSheetFormula(ops, 'Expenses!B3');
      
      if (!hasIncome || !hasExpenses) {
        return { valid: false, reason: 'Missing Income!B3 or Expenses!B3 reference in Summary sheet' };
      }
      
      return { valid: true };
    },
  },
  {
    id: 'department-rollup',
    name: 'Department Revenue Rollup',
    prompt: 'Create 3 sheets: "Engineering" with revenue 50000 in C5, "Marketing" with revenue 30000 in C5, "Sales" with revenue 75000 in C5. Create "Company" sheet with formula in D10 that sums all three department revenues',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Engineering', 'Marketing', 'Sales', 'Company']);
      if (!v1.valid) return v1;
      
      const hasEng = hasCrossSheetFormula(ops, 'Engineering!C5');
      const hasMkt = hasCrossSheetFormula(ops, 'Marketing!C5');
      const hasSales = hasCrossSheetFormula(ops, 'Sales!C5');
      
      if (!hasEng || !hasMkt || !hasSales) {
        return { valid: false, reason: 'Missing department C5 references' };
      }
      
      return { valid: true };
    },
  },
  {
    id: 'cross-sheet-vlookup',
    name: 'Cross-Sheet VLOOKUP',
    prompt: 'Create "Products" sheet with product codes in A1:A3 (P001, P002, P003) and prices in B1:B3 (10, 20, 30). Create "Orders" sheet with product code P002 in A1 and VLOOKUP formula in B1 that looks up price from Products sheet',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Products', 'Orders']);
      if (!v1.valid) return v1;
      
      const hasVlookup = hasCrossSheetFormula(ops, 'VLOOKUP.*Products!|Products!.*VLOOKUP');
      if (!hasVlookup) {
        return { valid: false, reason: 'Missing VLOOKUP with Products sheet reference' };
      }
      
      return { valid: true };
    },
  },
  {
    id: 'conditional-cross-sheet',
    name: 'Conditional Cross-Sheet Formula',
    prompt: 'Create "Targets" sheet with goal 1000 in A1. Create "Actuals" sheet with value 1200 in A1. Create "Status" sheet with IF formula in B1 that checks if Actuals!A1 exceeds Targets!A1',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Targets', 'Actuals', 'Status']);
      if (!v1.valid) return v1;
      
      const hasActuals = hasCrossSheetFormula(ops, 'Actuals!A1');
      const hasTargets = hasCrossSheetFormula(ops, 'Targets!A1');
      const hasIF = hasCrossSheetFormula(ops, 'IF');
      
      if (!hasActuals || !hasTargets || !hasIF) {
        return { valid: false, reason: 'Missing IF formula with Targets!A1 and Actuals!A1 references' };
      }
      
      return { valid: true };
    },
  },
  {
    id: 'average-across-sheets',
    name: 'AVERAGE Across Multiple Sheets',
    prompt: 'Create "Test1" sheet with scores 85, 90, 78 in A1:A3. Create "Test2" sheet with scores 92, 88, 95 in A1:A3. Create "Final" sheet with two formulas: B1 = AVERAGE of Test1 scores, B2 = AVERAGE of Test2 scores, B3 = overall average of B1 and B2',
    validate: (ops) => {
      const v1 = validateMultiSheetOperations(ops, ['Test1', 'Test2', 'Final']);
      if (!v1.valid) return v1;
      
      const hasTest1 = hasCrossSheetFormula(ops, 'Test1!A');
      const hasTest2 = hasCrossSheetFormula(ops, 'Test2!A');
      
      if (!hasTest1 || !hasTest2) {
        return { valid: false, reason: 'Missing AVERAGE formulas referencing Test1 or Test2' };
      }
      
      return { valid: true };
    },
  },
];

// ============================================================================
// Test Runner
// ============================================================================

async function runTest(scenario, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test ${index + 1}/${total}: ${scenario.name}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Prompt: "${scenario.prompt}"\n`);
  
  const result = {
    id: scenario.id,
    name: scenario.name,
    prompt: scenario.prompt,
    success: false,
    duration: 0,
    tokens: 0,
    operations: [],
    validation: { valid: false, reason: '' },
    error: null,
  };
  
  try {
    // Call OpenRouter API
    const { content, duration, tokens } = await callOpenRouter(scenario.prompt, SYSTEM_PROMPT);
    result.duration = duration;
    result.tokens = tokens;
    
    console.log(`⏱️  API Response Time: ${duration}ms`);
    console.log(`📊 Tokens Used: ${tokens}`);
    console.log(`\n📝 AI Response:\n${content}\n`);
    
    // Parse operations
    const parsed = parseOperations(content);
    if (parsed.error) {
      result.error = parsed.error;
      result.rawResponse = parsed.raw;
      console.log(`❌ Parse Error: ${parsed.error}`);
      return result;
    }
    
    result.operations = parsed.operations;
    result.explanation = parsed.explanation;
    result.confidence = parsed.confidence;
    
    console.log(`✅ Parsed ${parsed.operations.length} operations`);
    console.log(`💡 Explanation: ${parsed.explanation}`);
    console.log(`🎯 Confidence: ${parsed.confidence}`);
    
    // Validate operations
    const validation = scenario.validate(parsed.operations);
    result.validation = validation;
    
    if (validation.valid) {
      result.success = true;
      console.log(`\n✅ VALIDATION PASSED`);
    } else {
      console.log(`\n❌ VALIDATION FAILED: ${validation.reason}`);
    }
    
  } catch (error) {
    result.error = error.message;
    console.log(`❌ Test Error: ${error.message}`);
  }
  
  return result;
}

async function runAllTests() {
  console.log('🚀 Starting Cross-Sheet AI Tests\n');
  console.log(`Total Scenarios: ${TEST_SCENARIOS.length}`);
  console.log(`Model: GPT-4 Turbo`);
  console.log(`Temperature: 0.3 (deterministic)\n`);
  
  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const scenario = TEST_SCENARIOS[i];
    const result = await runTest(scenario, i, TEST_SCENARIOS.length);
    results.push(result);
    
    // Delay between requests to avoid rate limiting
    if (i < TEST_SCENARIOS.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // ============================================================================
  // Generate Report
  // ============================================================================
  
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80) + '\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  const passRate = ((passed / results.length) * 100).toFixed(1);
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`📊 Total Tokens: ${results.reduce((sum, r) => sum + r.tokens, 0)}`);
  console.log(`⚡ Avg Response Time: ${(results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(0)}ms`);
  
  console.log('\n📋 Detailed Results:\n');
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    console.log(`${i + 1}. ${status} ${r.name}`);
    if (!r.success) {
      console.log(`   Reason: ${r.validation.reason || r.error || 'Unknown'}`);
    }
    console.log(`   Duration: ${r.duration}ms, Tokens: ${r.tokens}, Ops: ${r.operations.length}`);
  });
  
  // Save results to JSON
  const jsonPath = path.join(__dirname, 'cross-sheet-ai-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${jsonPath}`);
  
  // Generate Markdown Report
  const mdReport = generateMarkdownReport(results, totalDuration);
  const mdPath = path.join(__dirname, 'cross-sheet-ai-report.md');
  fs.writeFileSync(mdPath, mdReport);
  console.log(`📄 Report saved to: ${mdPath}\n`);
}

function generateMarkdownReport(results, totalDuration) {
  const passed = results.filter(r => r.success).length;
  const passRate = ((passed / results.length) * 100).toFixed(1);
  const avgDuration = (results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(0);
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
  
  let md = `# Cross-Sheet Formula AI Test Report

## Overview

- **Date**: ${new Date().toISOString()}
- **Model**: GPT-4 Turbo
- **Temperature**: 0.3 (deterministic)
- **Total Tests**: ${results.length}
- **Pass Rate**: ${passRate}% (${passed}/${results.length})

## Performance Metrics

- **Total Duration**: ${(totalDuration / 1000).toFixed(1)}s
- **Average Response Time**: ${avgDuration}ms
- **Total Tokens Used**: ${totalTokens}
- **Average Tokens**: ${(totalTokens / results.length).toFixed(0)}

## Test Results

| # | Test Name | Status | Duration | Tokens | Ops | Validation |
|---|-----------|--------|----------|--------|-----|------------|
`;
  
  results.forEach((r, i) => {
    const status = r.success ? '✅ PASS' : '❌ FAIL';
    const validation = r.success ? 'Valid' : (r.validation.reason || r.error || 'Unknown');
    md += `| ${i + 1} | ${r.name} | ${status} | ${r.duration}ms | ${r.tokens} | ${r.operations.length} | ${validation} |\n`;
  });
  
  md += `\n## Detailed Test Cases\n\n`;
  
  results.forEach((r, i) => {
    md += `### ${i + 1}. ${r.name}\n\n`;
    md += `**Status**: ${r.success ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    md += `**Prompt**: "${r.prompt}"\n\n`;
    md += `**Performance**:\n`;
    md += `- Response Time: ${r.duration}ms\n`;
    md += `- Tokens: ${r.tokens}\n`;
    md += `- Operations Generated: ${r.operations.length}\n\n`;
    
    if (r.explanation) {
      md += `**AI Explanation**: ${r.explanation}\n\n`;
    }
    
    if (r.confidence) {
      md += `**Confidence**: ${r.confidence}\n\n`;
    }
    
    if (r.operations.length > 0) {
      md += `**Operations**:\n\`\`\`json\n${JSON.stringify(r.operations, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (!r.success) {
      md += `**Validation Error**: ${r.validation.reason || r.error || 'Unknown'}\n\n`;
    }
    
    md += `---\n\n`;
  });
  
  md += `## Key Findings\n\n`;
  
  const successfulTests = results.filter(r => r.success);
  if (successfulTests.length > 0) {
    md += `### ✅ Successful Patterns\n\n`;
    successfulTests.forEach(r => {
      md += `- **${r.name}**: AI correctly generated cross-sheet formulas\n`;
    });
    md += `\n`;
  }
  
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    md += `### ❌ Failed Patterns\n\n`;
    failedTests.forEach(r => {
      md += `- **${r.name}**: ${r.validation.reason || r.error}\n`;
    });
    md += `\n`;
  }
  
  md += `## Recommendations\n\n`;
  
  if (passRate >= 90) {
    md += `✅ **Excellent Performance**: AI demonstrates strong understanding of cross-sheet formulas (${passRate}% pass rate).\n\n`;
  } else if (passRate >= 70) {
    md += `⚠️  **Good Performance**: AI handles most cross-sheet scenarios correctly (${passRate}% pass rate). Some edge cases need attention.\n\n`;
  } else {
    md += `❌ **Needs Improvement**: AI struggles with cross-sheet formulas (${passRate}% pass rate). Consider:\n`;
    md += `- Improving system prompt with more examples\n`;
    md += `- Adding cross-sheet reference documentation\n`;
    md += `- Training with more cross-sheet scenarios\n\n`;
  }
  
  md += `### Next Steps\n\n`;
  md += `1. Review failed test cases and update system prompt\n`;
  md += `2. Add more cross-sheet examples to AI training\n`;
  md += `3. Test with different AI models (Claude, GPT-3.5)\n`;
  md += `4. Implement cross-sheet validation in operation executor\n`;
  md += `5. Add UI feedback for cross-sheet reference errors\n`;
  
  return md;
}

// ============================================================================
// Main Execution
// ============================================================================

runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
