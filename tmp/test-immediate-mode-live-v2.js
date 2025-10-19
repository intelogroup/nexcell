/**
 * Live API Test: Immediate Execution Mode
 * Tests real-time execution with actual OpenRouter API calls
 * Simulates immediate execution flow
 */

const fs = require('fs');

// Read API key from .env file
function loadEnvFile(path) {
  try {
    const content = fs.readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    const env = {};
    let currentKey = null;
    let currentValue = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        if (currentKey) {
          env[currentKey] = currentValue.trim();
          currentKey = null;
          currentValue = '';
        }
        continue;
      }
      
      // Check if this is a key=value line
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        // Save previous key if exists
        if (currentKey) {
          env[currentKey] = currentValue.trim();
        }
        
        currentKey = match[1].trim();
        currentValue = match[2].trim();
        
        // Remove quotes if present
        if ((currentValue.startsWith('"') && currentValue.endsWith('"')) || 
            (currentValue.startsWith("'") && currentValue.endsWith("'"))) {
          currentValue = currentValue.slice(1, -1);
        }
      } else if (currentKey) {
        // Continuation of previous value
        currentValue += trimmed;
      }
    }
    
    // Save last key
    if (currentKey) {
      env[currentKey] = currentValue.trim();
    }
    
    return env;
  } catch (error) {
    console.error('Failed to load .env file:', error.message);
    return {};
  }
}

const env = loadEnvFile('./client/.env');
const API_KEY = env.VITE_OPENROUTER_API_KEY;
const MODEL = env.VITE_OPENROUTER_MODEL || 'openai/gpt-4';
const DELAY_BETWEEN_TESTS = 1500;

// Helper to delay between tests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Results collector
const results = {
  timestamp: new Date().toISOString(),
  mode: 'immediate',
  model: MODEL,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  tests: [],
  performance: {
    totalTime: 0,
    avgApiTime: 0,
    avgTotalTime: 0,
    minApiTime: Infinity,
    maxApiTime: 0,
  }
};

/**
 * Call OpenRouter API
 */
async function callAI(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'Nexcell Immediate Mode Test',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `You are a spreadsheet AI assistant. Parse user commands into structured JSON actions.

Available actions:
- setCellValue: Set a single cell to a value
- setCellFormula: Set a cell to a formula (must start with =)
- fillRange: Fill a rectangular range with values or a formula
- fillRow: Fill an entire row with value/formula
- setRange: Set multiple cells with 2D array

Respond ONLY with valid JSON in this exact format:
{
  "actions": [
    {
      "type": "setCellValue",
      "target": "A1",
      "value": 100
    }
  ],
  "explanation": "Set cell A1 to 100",
  "confidence": 0.95
}

For fillRow with sample data, use:
{
  "actions": [
    {
      "type": "fillRow",
      "target": "1",
      "values": ["Name", "Age", "Email"]
    }
  ],
  "explanation": "Created headers",
  "confidence": 0.9
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Parse JSON response
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '')
    .trim();
  
  return JSON.parse(cleaned);
}

/**
 * Test immediate execution
 */
async function testImmediateExecution(testName, command, expectedBehavior) {
  console.log(`\n🧪 Testing: ${testName}`);
  console.log(`📝 Command: "${command}"`);
  
  const testResult = {
    name: testName,
    command,
    success: false,
    apiTime: 0,
    actionsGenerated: 0,
    errors: [],
    aiResponse: null,
  };

  try {
    // Step 1: Call AI API (measure time)
    const apiStart = Date.now();
    const aiResponse = await callAI(command);
    const apiTime = Date.now() - apiStart;
    
    testResult.apiTime = apiTime;
    testResult.aiResponse = aiResponse;
    testResult.actionsGenerated = aiResponse.actions?.length || 0;
    
    console.log(`✅ AI Response: ${testResult.actionsGenerated} actions, confidence: ${aiResponse.confidence}`);
    console.log(`   Explanation: ${aiResponse.explanation}`);
    console.log(`   API Time: ${apiTime}ms`);
    
    // Step 2: Validate immediate execution characteristics
    if (apiTime > 5000) {
      console.warn(`⚠️  API time ${apiTime}ms exceeds 5s threshold for immediate mode`);
    }
    
    // Step 3: Verify actions match expected behavior
    if (expectedBehavior) {
      const result = expectedBehavior(aiResponse);
      if (!result.passed) {
        throw new Error(`Validation failed: ${result.message}`);
      }
      console.log(`✓ Validation: ${result.message}`);
    }
    
    testResult.success = true;
    console.log(`✅ Test passed`);
    
  } catch (error) {
    testResult.success = false;
    testResult.errors.push(error.message);
    console.error(`❌ Test failed: ${error.message}`);
  }
  
  results.tests.push(testResult);
  results.totalTests++;
  if (testResult.success) {
    results.passedTests++;
  } else {
    results.failedTests++;
  }
  
  // Update performance metrics
  results.performance.totalTime += testResult.apiTime;
  results.performance.minApiTime = Math.min(results.performance.minApiTime, testResult.apiTime);
  results.performance.maxApiTime = Math.max(results.performance.maxApiTime, testResult.apiTime);
  
  return testResult;
}

/**
 * Main test suite
 */
async function runImmediateExecutionTests() {
  console.log('🚀 Starting Immediate Execution Mode Tests with Live API');
  console.log(`   Model: ${MODEL}`);
  console.log('=' .repeat(60));
  
  if (!API_KEY) {
    console.error('❌ VITE_OPENROUTER_API_KEY not found in .env');
    process.exit(1);
  }
  
  const startTime = Date.now();
  
  // Test 1: Simple immediate value set
  await testImmediateExecution(
    'Simple immediate value',
    'set A1 to 100',
    (response) => ({
      passed: response.actions?.length > 0 && response.actions[0].type === 'setCellValue',
      message: response.actions?.length > 0 
        ? `Generated ${response.actions.length} action(s) for immediate execution` 
        : 'No actions generated'
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 2: Immediate formula execution
  await testImmediateExecution(
    'Immediate formula calculation',
    'set A1 to 50, B1 to 30, and C1 to =A1+B1',
    (response) => ({
      passed: response.actions?.length >= 3,
      message: response.actions?.length >= 3
        ? `Generated ${response.actions.length} actions for immediate execution with formulas` 
        : `Only ${response.actions?.length || 0} actions generated`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 3: Immediate range fill
  await testImmediateExecution(
    'Immediate range fill',
    'fill A1 to A5 with value 10',
    (response) => ({
      passed: response.actions?.length > 0,
      message: `Generated range fill action for immediate execution`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 4: Immediate multi-step with dependencies
  await testImmediateExecution(
    'Multi-step with formula dependencies',
    'create a budget: Income in A1 with 5000, Expenses in A2 with 3200, and calculate Savings in A3 as the difference',
    (response) => {
      const hasValues = response.actions?.some(a => a.type === 'setCellValue');
      const hasFormula = response.actions?.some(a => a.type === 'setCellFormula' || a.formula);
      return {
        passed: hasValues && (hasFormula || response.actions.length >= 3),
        message: `Budget workflow: ${response.actions?.length || 0} actions (values: ${hasValues}, formulas: ${hasFormula})`
      };
    }
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 5: Immediate table creation
  await testImmediateExecution(
    'Immediate table creation',
    'create a 3-column table with headers Name, Age, City and add 2 sample rows',
    (response) => ({
      passed: response.actions?.length >= 3,
      message: `Table creation: ${response.actions?.length || 0} actions for immediate execution`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 6: Immediate column formula fill
  await testImmediateExecution(
    'Immediate column formula propagation',
    'set A1 to 10, A2 to 20, A3 to 30, and fill B1:B3 with formulas that double the A column values',
    (response) => ({
      passed: response.actions?.length >= 4,
      message: `Column formulas: ${response.actions?.length || 0} actions generated`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 7: Immediate aggregate function
  await testImmediateExecution(
    'Immediate SUM calculation',
    'put 10, 20, 30, 40, 50 in A1 through A5, then calculate the sum in A6',
    (response) => ({
      passed: response.actions?.length >= 5,
      message: `SUM workflow: ${response.actions?.length || 0} actions for immediate execution`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 8: Immediate date operation
  await testImmediateExecution(
    'Immediate date handling',
    'set A1 to today\'s date and B1 to a formula that adds 30 days',
    (response) => ({
      passed: response.actions?.length >= 2,
      message: `Date operations: ${response.actions?.length || 0} actions generated`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 9: Immediate complex scenario
  await testImmediateExecution(
    'Immediate complex workflow',
    'create a sales report: Headers in row 1 (Product, Price, Quantity, Total), add 3 product rows with sample data, and calculate totals with formulas in the Total column',
    (response) => ({
      passed: response.actions?.length >= 5,
      message: `Complex workflow: ${response.actions?.length || 0} actions for immediate execution`
    })
  );
  await delay(DELAY_BETWEEN_TESTS);
  
  // Test 10: Immediate execution speed test
  await testImmediateExecution(
    'Speed test - simple operation',
    'set B5 to 999',
    (response) => ({
      passed: response.actions?.length > 0,
      message: `Speed test completed with ${response.actions?.length || 0} action(s)`
    })
  );
  
  // Calculate final statistics
  const totalTime = Date.now() - startTime;
  results.performance.avgApiTime = results.tests.reduce((sum, t) => sum + t.apiTime, 0) / results.tests.length;
  results.performance.avgTotalTime = results.performance.avgApiTime; // In immediate mode, API time is the bottleneck
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passedTests} ✅`);
  console.log(`Failed: ${results.failedTests} ❌`);
  console.log(`Pass Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);
  console.log(`\nPerformance:`);
  console.log(`  Test Suite Time: ${totalTime}ms`);
  console.log(`  Avg API Time: ${results.performance.avgApiTime.toFixed(0)}ms`);
  console.log(`  Min API Time: ${results.performance.minApiTime}ms`);
  console.log(`  Max API Time: ${results.performance.maxApiTime}ms`);
  
  // Check immediate execution criteria
  const avgTime = results.performance.avgApiTime;
  console.log(`\n📈 Immediate Execution Analysis:`);
  if (avgTime < 1000) {
    console.log(`✅ EXCELLENT: Avg ${avgTime.toFixed(0)}ms - Very responsive for immediate mode`);
  } else if (avgTime < 2000) {
    console.log(`✅ GOOD: Avg ${avgTime.toFixed(0)}ms - Acceptable for immediate mode`);
  } else if (avgTime < 5000) {
    console.log(`⚠️  ACCEPTABLE: Avg ${avgTime.toFixed(0)}ms - May feel slow, consider loading indicators`);
  } else {
    console.log(`❌ TOO SLOW: Avg ${avgTime.toFixed(0)}ms - Consider async/background execution`);
  }
  
  // Additional immediate mode insights
  const fastTests = results.tests.filter(t => t.apiTime < 1000).length;
  const slowTests = results.tests.filter(t => t.apiTime > 3000).length;
  console.log(`\nSpeed Distribution:`);
  console.log(`  Fast (<1s): ${fastTests}/${results.totalTests}`);
  console.log(`  Slow (>3s): ${slowTests}/${results.totalTests}`);
  
  // Save results
  const resultsPath = './tmp/immediate-mode-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${resultsPath}`);
  
  // Generate markdown report
  generateMarkdownReport(results);
  
  return results;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results) {
  const avgTime = results.performance.avgApiTime;
  const rating = avgTime < 1000 ? 'EXCELLENT ✅' 
    : avgTime < 2000 ? 'GOOD ✅'
    : avgTime < 5000 ? 'ACCEPTABLE ⚠️'
    : 'NEEDS IMPROVEMENT ❌';

  const report = `# Immediate Execution Mode - Live API Test Results

**Test Date:** ${results.timestamp}  
**Mode:** Immediate Execution  
**Model:** ${results.model}  
**Total Tests:** ${results.totalTests}  
**Pass Rate:** ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%

## Summary

- ✅ Passed: ${results.passedTests}
- ❌ Failed: ${results.failedTests}

## Performance Metrics

| Metric | Value |
|--------|-------|
| Avg API Time | ${avgTime.toFixed(0)}ms |
| Min API Time | ${results.performance.minApiTime}ms |
| Max API Time | ${results.performance.maxApiTime}ms |
| **Rating** | **${rating}** |

## Immediate Mode Validation

${avgTime < 1000 
  ? '✅ **EXCELLENT**: Average API response time is very fast. Users will experience immediate feedback.'
  : avgTime < 2000
    ? '✅ **GOOD**: Average API response time is acceptable for immediate execution. UI feels responsive.'
    : avgTime < 5000
      ? '⚠️ **ACCEPTABLE**: Average API response time is reasonable but may feel sluggish. Consider:\n- Adding loading indicators\n- Optimistic UI updates\n- Showing partial results while computing'
      : '❌ **TOO SLOW**: Average API response time exceeds threshold for immediate mode. Recommendations:\n- Use async/background execution\n- Implement request queuing\n- Add progress indicators\n- Consider Plan Mode for complex operations'}

## Speed Distribution

${results.tests.map(t => {
  const icon = t.apiTime < 1000 ? '🚀' : t.apiTime < 2000 ? '✅' : t.apiTime < 3000 ? '⚠️' : '🐌';
  return `${icon} ${t.apiTime}ms - ${t.name}`;
}).join('\n')}

## Test Details

${results.tests.map((test, idx) => `
### ${idx + 1}. ${test.name}

**Command:** \`${test.command}\`  
**Status:** ${test.success ? '✅ Passed' : '❌ Failed'}  
**API Time:** ${test.apiTime}ms  
**Actions Generated:** ${test.actionsGenerated}  
**Confidence:** ${test.aiResponse?.confidence || 'N/A'}

${test.aiResponse ? `**Explanation:** ${test.aiResponse.explanation}` : ''}

${test.errors.length > 0 ? `**Errors:**\n${test.errors.map(e => `- ${e}`).join('\n')}` : ''}
`).join('\n')}

## Key Findings

1. **Immediate Execution Performance:** ${avgTime < 2000 ? 'Meets requirements' : 'May need optimization'}
2. **AI Response Quality:** ${((results.passedTests / results.totalTests) * 100).toFixed(0)}% success rate
3. **Consistency:** ${results.performance.maxApiTime - results.performance.minApiTime}ms variance between fastest and slowest
4. **User Experience:** ${avgTime < 1000 ? 'Feels instant' : avgTime < 2000 ? 'Feels responsive' : avgTime < 5000 ? 'Feels acceptable with loading indicator' : 'Feels slow, needs async execution'}

## Recommendations

${avgTime < 1000 
  ? '- ✅ Continue using immediate execution for all simple operations\n- ✅ No loading indicators needed\n- ✅ Users will experience seamless interaction'
  : avgTime < 2000
    ? '- ✅ Continue using immediate execution\n- Consider subtle loading indicators for operations >1s\n- Implement optimistic UI updates for better perceived performance'
    : avgTime < 5000
      ? '- ⚠️ Add clear loading indicators\n- Implement optimistic UI updates\n- Consider Plan Mode for complex multi-step workflows\n- Add "Quick Actions" for common operations with caching'
      : '- ❌ Move complex operations to background execution\n- Use Plan Mode for multi-step workflows\n- Implement request queuing and batching\n- Add comprehensive progress indicators\n- Consider server-side caching for common operations'}

## Action Type Analysis

${(() => {
  const actionTypes = {};
  results.tests.forEach(test => {
    if (test.aiResponse?.actions) {
      test.aiResponse.actions.forEach(action => {
        actionTypes[action.type] = (actionTypes[action.type] || 0) + 1;
      });
    }
  });
  return Object.entries(actionTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `- ${type}: ${count} actions`)
    .join('\n');
})()}

---

**Generated:** ${new Date().toISOString()}
`;

  const reportPath = './tmp/immediate-mode-test-report.md';
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Report saved to ${reportPath}`);
}

// Run tests
runImmediateExecutionTests()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
