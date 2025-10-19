/**
 * Live API Testing Suite
 * Tests real OpenRouter API calls with various prompts
 * 
 * Run: node tmp/live-api-tests.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load client/.env file manually
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../client/.env');
    console.log(`Loading .env from: ${envPath}`);
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (match) {
        const key = match[1];
        const value = match[2];
        env[key] = value;
      }
    });
    
    console.log(`Loaded ${Object.keys(env).length} environment variables`);
    return env;
  } catch (error) {
    console.error('Failed to load .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const API_KEY = env.VITE_OPENROUTER_API_KEY;
const MODEL = env.VITE_OPENROUTER_MODEL || 'openai/gpt-4';
const MAX_TOKENS = parseInt(env.VITE_OPENROUTER_MAX_TOKENS || '4096');

if (!API_KEY) {
  console.error('❌ VITE_OPENROUTER_API_KEY not found in client/.env');
  process.exit(1);
}

console.log(`🔧 Configuration:`);
console.log(`   API Key: ${API_KEY.substring(0, 20)}...`);
console.log(`   Model: ${MODEL}`);
console.log(`   Max Tokens: ${MAX_TOKENS}`);
console.log();

// System prompt for Excel-like operations
const SYSTEM_PROMPT = `You are an AI assistant helping users work with spreadsheets. Parse user requests into structured actions.

Return actions in this format:
<actions>[{"type":"setCellValue","target":"A1","value":"Hello"}]</actions>

Supported action types:
- setCellValue: Set a single cell value
- setCellFormula: Set a cell formula
- setRange: Set multiple cells at once
- fillRange: Fill a range with values (array of arrays)
- clearRange: Clear a range of cells
- addSheet: Add a new sheet

Examples:
User: "Put 'Revenue' in A1"
Response: <actions>[{"type":"setCellValue","target":"A1","value":"Revenue"}]</actions>

User: "Create a budget table with categories in A1:A5"
Response: <actions>[{"type":"fillRange","target":{"start":"A1","end":"A5"},"values":[["Rent"],["Salaries"],["Marketing"],["Utilities"],["Supplies"]]}]</actions>

User: "Add formula in B10 to sum B1:B9"
Response: <actions>[{"type":"setCellFormula","target":"B10","formula":"=SUM(B1:B9)"}]</actions>`;

/**
 * Make API call to OpenRouter
 */
async function callOpenRouter(userPrompt, options = {}) {
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nexcell.app',
        'X-Title': 'Nexcell Live API Test'
      },
      body: JSON.stringify({
        model: options.model || MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: options.maxTokens || MAX_TOKENS,
        temperature: options.temperature || 0.7
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        duration,
        statusCode: response.status
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      response: data,
      content: data.choices?.[0]?.message?.content || '',
      duration,
      usage: data.usage,
      model: data.model
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Extract actions from AI response
 */
function extractActions(content) {
  const match = content.match(/<actions>(.*?)<\/actions>/s);
  if (!match) return null;
  
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return { parseError: e.message, raw: match[1] };
  }
}

/**
 * Test scenarios
 */
const TEST_SCENARIOS = [
  {
    id: 'simple-value',
    name: 'Simple Cell Value',
    prompt: 'Put "Hello World" in cell A1',
    expectedActions: 1,
    expectedType: 'setCellValue',
    validate: (actions) => {
      if (actions.length !== 1) return 'Expected 1 action';
      if (actions[0].type !== 'setCellValue') return 'Expected setCellValue';
      if (actions[0].target !== 'A1') return 'Expected target A1';
      if (actions[0].value !== 'Hello World') return 'Expected value "Hello World"';
      return null;
    }
  },
  {
    id: 'formula',
    name: 'Simple Formula',
    prompt: 'Add a SUM formula in B10 that adds B1 through B9',
    expectedActions: 1,
    expectedType: 'setCellFormula',
    validate: (actions) => {
      if (actions.length !== 1) return 'Expected 1 action';
      if (actions[0].type !== 'setCellFormula') return 'Expected setCellFormula';
      if (!actions[0].formula) return 'Expected formula property';
      if (!actions[0].formula.includes('SUM')) return 'Expected SUM formula';
      return null;
    }
  },
  {
    id: 'fill-range',
    name: 'Fill Range with Data',
    prompt: 'Create a list of fruits in A1:A5: Apple, Banana, Cherry, Date, Elderberry',
    expectedActions: 1,
    expectedType: 'fillRange',
    validate: (actions) => {
      if (actions.length !== 1) return 'Expected 1 action';
      const action = actions[0];
      if (action.type !== 'fillRange' && action.type !== 'setRange') {
        return `Expected fillRange or setRange, got ${action.type}`;
      }
      if (!action.values) return 'Expected values array';
      return null;
    }
  },
  {
    id: 'budget-table',
    name: 'Budget Table (Multi-Step)',
    prompt: 'Create a budget table with headers "Category" in A1, "Amount" in B1, then add three rows: Rent: 1500, Food: 500, Transport: 200',
    expectedActions: 1, // May be 1 setRange or multiple actions
    validate: (actions) => {
      if (actions.length === 0) return 'Expected at least 1 action';
      // Accept either single setRange or multiple setCellValue actions
      return null;
    }
  },
  {
    id: 'sales-dashboard',
    name: 'Sales Dashboard with Formulas',
    prompt: 'Create a sales report with Product in A1, Q1 in B1, Q2 in C1, Total in D1. Add Laptop in A2 with sales 1000 and 1200. Add a formula in D2 to sum B2:C2',
    expectedActions: 1,
    validate: (actions) => {
      if (actions.length === 0) return 'Expected at least 1 action';
      // Check if any action includes formulas
      const hasFormula = actions.some(a => 
        a.type === 'setCellFormula' || 
        (a.values && JSON.stringify(a.values).includes('=SUM'))
      );
      if (!hasFormula) return 'Expected formula in response';
      return null;
    }
  },
  {
    id: 'clear-range',
    name: 'Clear Range',
    prompt: 'Clear cells A1 to C10',
    expectedActions: 1,
    expectedType: 'clearRange',
    validate: (actions) => {
      if (actions.length !== 1) return 'Expected 1 action';
      if (actions[0].type !== 'clearRange') return 'Expected clearRange';
      // Accept either range or target property (AI may use either)
      if (!actions[0].range && !actions[0].target) return 'Expected range or target property';
      return null;
    }
  },
  {
    id: 'dates',
    name: 'Date Operations',
    prompt: 'Put today\'s date in A1 and tomorrow\'s date in A2',
    expectedActions: 1,
    validate: (actions) => {
      if (actions.length === 0) return 'Expected at least 1 action';
      return null;
    }
  },
  {
    id: 'large-dataset',
    name: 'Large Dataset Generation',
    prompt: 'Create a list of 20 employee names in column A starting from A1',
    expectedActions: 1,
    validate: (actions) => {
      if (actions.length !== 1) return 'Expected 1 action';
      const action = actions[0];
      if (!action.values) return 'Expected values array';
      if (action.values.length < 15) return 'Expected at least 15 rows';
      return null;
    }
  },
  {
    id: 'ambiguous-prompt',
    name: 'Ambiguous Prompt (Error Handling)',
    prompt: 'Do something with the spreadsheet',
    expectedActions: 0, // AI should ask for clarification
    validate: (actions) => {
      // Accept any response - AI should handle ambiguity gracefully
      // If AI returns no actions and asks for clarification, that's good
      // If AI makes a reasonable assumption, that's also acceptable
      return null;
    }
  },
  {
    id: 'complex-workflow',
    name: 'Complex Multi-Step Workflow',
    prompt: 'Create a complete expense tracker with headers (Date, Category, Amount, Notes) in row 1, add 5 sample expenses, and a total formula at the bottom',
    expectedActions: 1,
    validate: (actions) => {
      if (actions.length === 0) return 'Expected at least 1 action';
      return null;
    }
  }
];

/**
 * Run a single test
 */
async function runTest(scenario) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${scenario.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Prompt: "${scenario.prompt}"\n`);

  const result = await callOpenRouter(scenario.prompt);

  if (!result.success) {
    console.log(`❌ API Call Failed`);
    console.log(`   Error: ${result.error}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.statusCode) {
      console.log(`   Status Code: ${result.statusCode}`);
    }
    return {
      scenario: scenario.id,
      passed: false,
      error: result.error,
      duration: result.duration
    };
  }

  console.log(`✅ API Call Successful`);
  console.log(`   Duration: ${result.duration}ms`);
  console.log(`   Model: ${result.model}`);
  console.log(`   Tokens: ${result.usage?.total_tokens || 'N/A'}`);
  
  // Extract actions
  const actions = extractActions(result.content);
  
  if (!actions) {
    console.log(`\n⚠️  No Actions Found`);
    console.log(`   Response: ${result.content.substring(0, 200)}...`);
    
    // For ambiguous prompts, no actions is acceptable
    if (scenario.expectedActions === 0) {
      console.log(`\n✅ Test Passed (AI correctly asked for clarification)`);
      return {
        scenario: scenario.id,
        passed: true,
        duration: result.duration,
        tokens: result.usage?.total_tokens,
        actions: []
      };
    }
    
    return {
      scenario: scenario.id,
      passed: false,
      error: 'No actions found in response',
      duration: result.duration,
      response: result.content
    };
  }

  if (actions.parseError) {
    console.log(`\n❌ Action Parse Error`);
    console.log(`   Error: ${actions.parseError}`);
    console.log(`   Raw: ${actions.raw}`);
    return {
      scenario: scenario.id,
      passed: false,
      error: `Parse error: ${actions.parseError}`,
      duration: result.duration
    };
  }

  console.log(`\n📋 Extracted Actions: ${actions.length}`);
  actions.forEach((action, i) => {
    console.log(`   ${i + 1}. ${action.type} ${action.target || action.range ? `→ ${JSON.stringify(action.target || action.range)}` : ''}`);
  });

  // Validate
  const validationError = scenario.validate(actions);
  
  if (validationError) {
    console.log(`\n❌ Validation Failed`);
    console.log(`   ${validationError}`);
    console.log(`\n   Actions:`);
    console.log(JSON.stringify(actions, null, 2));
    return {
      scenario: scenario.id,
      passed: false,
      error: validationError,
      duration: result.duration,
      actions
    };
  }

  console.log(`\n✅ Test Passed`);
  return {
    scenario: scenario.id,
    passed: true,
    duration: result.duration,
    tokens: result.usage?.total_tokens,
    actions
  };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Nexcell Live API Testing Suite                                           ║');
  console.log('║  Testing real OpenRouter API with various prompts                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log();

  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    const result = await runTest(scenario);
    results.push(result);
    
    // Rate limiting: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens || 0), 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms`);
  console.log(`🎫 Total Tokens Used: ${totalTokens}`);
  console.log();

  // Failed tests details
  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.scenario}: ${r.error}`);
      });
    console.log();
  }

  // Performance stats
  console.log('Performance Breakdown:');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} ${r.scenario.padEnd(30)} ${r.duration}ms`);
  });
  console.log();

  // Export results
  const report = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    totalTests: results.length,
    passed,
    failed,
    successRate: (passed / results.length) * 100,
    avgDuration,
    totalTokens,
    results: results.map(r => ({
      scenario: r.scenario,
      passed: r.passed,
      error: r.error,
      duration: r.duration,
      tokens: r.tokens,
      actionCount: r.actions?.length
    }))
  };

  // Save report
  const fs = await import('fs');
  const reportPath = resolve(__dirname, 'live-api-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Detailed report saved to: ${reportPath}`);
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
