/**
 * Live API Test: Model Variations
 * 
 * Tests different OpenRouter models for consistency:
 * - anthropic/claude-3.5-sonnet (best quality, slower)
 * - openai/gpt-4 (high quality, balanced)
 * - openai/gpt-3.5-turbo (fast, cheaper)
 * 
 * Validates:
 * - JSON format consistency
 * - Action correctness
 * - Response time differences
 * - Cost efficiency
 * - Confidence scores
 */

const fs = require('fs');
const path = require('path');

// === Configuration ===
const MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    expectedSpeed: 'slow',
    expectedCost: 'high'
  },
  {
    id: 'openai/gpt-4',
    name: 'GPT-4',
    expectedSpeed: 'medium',
    expectedCost: 'medium'
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    expectedSpeed: 'fast',
    expectedCost: 'low'
  }
];

const TEST_SCENARIOS = [
  {
    name: 'Simple Cell Value',
    prompt: 'Set cell A1 to "Revenue" and B1 to 50000',
    expectedActions: ['setCellValue'],
    minActions: 2,
    maxActions: 2
  },
  {
    name: 'Formula Creation',
    prompt: 'In A1 put "Price", A2 put 100. In B1 put "Tax Rate", B2 put 0.08. In C1 put "Total", C2 calculate price plus tax',
    expectedActions: ['setCellValue', 'setCellFormula'],
    minActions: 5,
    maxActions: 7
  },
  {
    name: 'Range Fill',
    prompt: 'Create a simple expense tracker with headers in row 1: Item, Amount, Date. Fill rows 2-4 with sample data',
    expectedActions: ['setCellValue', 'setRange', 'fillRange'],
    minActions: 4,
    maxActions: 15
  },
  {
    name: 'Aggregation Formula',
    prompt: 'Put numbers 10, 20, 30, 40, 50 in cells A1 through A5. Calculate the total in A6',
    expectedActions: ['setCellValue', 'setCellFormula', 'setRange'],
    minActions: 2,
    maxActions: 7
  },
  {
    name: 'Multi-Column Data',
    prompt: 'Create a product inventory with Name in A1-A3 (Widget, Gadget, Tool), Quantity in B1-B3 (100, 50, 75), Price in C1-C3 (10, 20, 15)',
    expectedActions: ['setCellValue', 'setRange', 'fillRange'],
    minActions: 3,
    maxActions: 12
  }
];

const DELAY_BETWEEN_REQUESTS = 2000; // 2s to avoid rate limiting

// === Environment Setup ===
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    
    let currentKey = null;
    let currentValue = '';
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) continue;
      
      // Check if line contains = (new key-value pair)
      if (line.includes('=')) {
        // Save previous key-value if exists
        if (currentKey) {
          env[currentKey] = currentValue.trim();
        }
        
        const [key, ...valueParts] = line.split('=');
        currentKey = key.trim();
        currentValue = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      } else {
        // Continuation of previous value
        currentValue += line;
      }
    }
    
    // Save last key-value
    if (currentKey) {
      env[currentKey] = currentValue.trim();
    }
    
    return env;
  } catch (error) {
    console.error(`Failed to load env file: ${error.message}`);
    return {};
  }
}

const envPath = path.join(__dirname, '..', 'client', '.env');
const env = loadEnvFile(envPath);
const API_KEY = env.VITE_OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('❌ VITE_OPENROUTER_API_KEY not found in client/.env');
  process.exit(1);
}

console.log('✅ API key loaded from client/.env');

// === API Helper ===
async function callAI(prompt, model) {
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Nexcell Model Variation Test'
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          {
            role: 'system',
            content: `You are a spreadsheet automation assistant. Convert user requests into a JSON array of actions.

Available actions:
- setCellValue: { action: "setCellValue", target: "A1", value: "text or number" }
- setCellFormula: { action: "setCellFormula", target: "A1", formula: "=SUM(B1:B5)" }
- setRange: { action: "setRange", range: "A1:B5", values: [[1,2],[3,4]] }
- fillRange: { action: "fillRange", range: "A1:A10", value: 0 }
- fillRow: { action: "fillRow", row: 1, values: ["A","B","C"] }
- clearRange: { action: "clearRange", target: "A1:B5" }

Respond ONLY with valid JSON in this format:
{
  "actions": [ /* array of action objects */ ],
  "confidence": 0.95,
  "reasoning": "Brief explanation"
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const endTime = Date.now();
    const apiTime = endTime - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from markdown code blocks if present
    let jsonContent = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1];
    }
    
    const parsed = JSON.parse(jsonContent);

    return {
      success: true,
      apiTime,
      tokens: data.usage?.total_tokens || 0,
      model: model.id,
      response: parsed,
      rawContent: content
    };
  } catch (error) {
    return {
      success: false,
      apiTime: Date.now() - startTime,
      model: model.id,
      error: error.message
    };
  }
}

// === Test Runner ===
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 MODEL VARIATION TESTING');
  console.log('='.repeat(80));
  console.log(`Testing ${MODELS.length} models across ${TEST_SCENARIOS.length} scenarios`);
  console.log(`Total API calls: ${MODELS.length * TEST_SCENARIOS.length}`);
  console.log('='.repeat(80) + '\n');

  const results = [];
  let testNumber = 0;

  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Scenario: ${scenario.name}`);
    console.log(`   Prompt: "${scenario.prompt}"`);
    console.log(`   Expected Actions: ${scenario.expectedActions.join(', ')}`);
    console.log(`   Expected Count: ${scenario.minActions}-${scenario.maxActions}`);
    console.log('   ' + '-'.repeat(70));

    const scenarioResults = [];

    for (const model of MODELS) {
      testNumber++;
      console.log(`\n   [${testNumber}/${MODELS.length * TEST_SCENARIOS.length}] Testing with ${model.name}...`);

      const result = await callAI(scenario.prompt, model);
      
      if (!result.success) {
        console.log(`   ❌ API Error: ${result.error}`);
        scenarioResults.push({
          model: model.name,
          modelId: model.id,
          success: false,
          error: result.error,
          apiTime: result.apiTime
        });
        continue;
      }

      const { actions = [], confidence = 0, reasoning = '' } = result.response;
      const actionTypes = actions.map(a => a.action);
      const uniqueActionTypes = [...new Set(actionTypes)];
      
      // Validation
      const hasExpectedActions = scenario.expectedActions.some(expected => 
        uniqueActionTypes.includes(expected)
      );
      const correctCount = actions.length >= scenario.minActions && 
                          actions.length <= scenario.maxActions;
      const allValidActions = actions.every(a => 
        ['setCellValue', 'setCellFormula', 'setRange', 'fillRange', 'fillRow', 'clearRange'].includes(a.action)
      );

      const passed = hasExpectedActions && allValidActions;

      console.log(`   ${passed ? '✅' : '⚠️'} ${model.name}:`);
      console.log(`      Time: ${result.apiTime}ms`);
      console.log(`      Tokens: ${result.tokens}`);
      console.log(`      Actions: ${actions.length} (${actionTypes.join(', ')})`);
      console.log(`      Confidence: ${confidence}`);
      console.log(`      Valid Actions: ${allValidActions ? 'Yes' : 'No'}`);
      console.log(`      Has Expected: ${hasExpectedActions ? 'Yes' : 'No'}`);
      console.log(`      Count OK: ${correctCount ? 'Yes' : `No (${scenario.minActions}-${scenario.maxActions} expected)`}`);

      scenarioResults.push({
        model: model.name,
        modelId: model.id,
        success: true,
        passed,
        apiTime: result.apiTime,
        tokens: result.tokens,
        actionCount: actions.length,
        actionTypes: uniqueActionTypes,
        allActionTypes: actionTypes,
        confidence,
        reasoning,
        hasExpectedActions,
        correctCount,
        allValidActions,
        actions
      });

      // Rate limiting delay
      if (testNumber < MODELS.length * TEST_SCENARIOS.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }

    results.push({
      scenario: scenario.name,
      prompt: scenario.prompt,
      modelResults: scenarioResults
    });
  }

  return results;
}

// === Analysis & Reporting ===
function analyzeResults(results) {
  const analysis = {
    models: {},
    scenarios: {},
    overall: {
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalErrors: 0
    }
  };

  // Initialize model stats
  MODELS.forEach(model => {
    analysis.models[model.name] = {
      modelId: model.id,
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      totalTime: 0,
      totalTokens: 0,
      avgTime: 0,
      avgTokens: 0,
      avgConfidence: 0,
      avgActionCount: 0,
      actionTypeDistribution: {},
      confidenceScores: []
    };
  });

  // Analyze each scenario
  results.forEach(result => {
    const scenarioName = result.scenario;
    analysis.scenarios[scenarioName] = {
      modelComparison: {}
    };

    result.modelResults.forEach(modelResult => {
      const modelStats = analysis.models[modelResult.model];
      modelStats.totalTests++;
      analysis.overall.totalTests++;

      if (!modelResult.success) {
        modelStats.errors++;
        analysis.overall.totalErrors++;
        return;
      }

      if (modelResult.passed) {
        modelStats.passed++;
        analysis.overall.totalPassed++;
      } else {
        modelStats.failed++;
        analysis.overall.totalFailed++;
      }

      modelStats.totalTime += modelResult.apiTime;
      modelStats.totalTokens += modelResult.tokens;
      modelStats.confidenceScores.push(modelResult.confidence);
      modelStats.avgActionCount = ((modelStats.avgActionCount * (modelStats.totalTests - 1)) + modelResult.actionCount) / modelStats.totalTests;

      // Track action types
      modelResult.allActionTypes.forEach(actionType => {
        modelStats.actionTypeDistribution[actionType] = 
          (modelStats.actionTypeDistribution[actionType] || 0) + 1;
      });

      // Scenario comparison
      analysis.scenarios[scenarioName].modelComparison[modelResult.model] = {
        passed: modelResult.passed,
        apiTime: modelResult.apiTime,
        tokens: modelResult.tokens,
        actionCount: modelResult.actionCount,
        confidence: modelResult.confidence
      };
    });
  });

  // Calculate averages
  Object.values(analysis.models).forEach(modelStats => {
    if (modelStats.totalTests > 0) {
      modelStats.avgTime = Math.round(modelStats.totalTime / modelStats.totalTests);
      modelStats.avgTokens = Math.round(modelStats.totalTokens / modelStats.totalTests);
      modelStats.avgConfidence = modelStats.confidenceScores.reduce((a, b) => a + b, 0) / modelStats.confidenceScores.length;
      modelStats.passRate = (modelStats.passed / modelStats.totalTests * 100).toFixed(1);
    }
  });

  analysis.overall.passRate = analysis.overall.totalTests > 0
    ? (analysis.overall.totalPassed / analysis.overall.totalTests * 100).toFixed(1)
    : 0;

  return analysis;
}

function generateReport(results, analysis) {
  const lines = [];
  
  lines.push('# Model Variation Test Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Total Tests**: ${analysis.overall.totalTests}`);
  lines.push(`**Pass Rate**: ${analysis.overall.passRate}%`);
  lines.push('');

  // Overall Summary
  lines.push('## Overall Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Tests | ${analysis.overall.totalTests} |`);
  lines.push(`| Passed | ${analysis.overall.totalPassed} (${analysis.overall.passRate}%) |`);
  lines.push(`| Failed | ${analysis.overall.totalFailed} |`);
  lines.push(`| Errors | ${analysis.overall.totalErrors} |`);
  lines.push('');

  // Model Comparison
  lines.push('## Model Performance Comparison');
  lines.push('');
  lines.push('| Model | Pass Rate | Avg Time | Avg Tokens | Avg Confidence | Avg Actions |');
  lines.push('|-------|-----------|----------|------------|----------------|-------------|');
  
  Object.entries(analysis.models).forEach(([modelName, stats]) => {
    lines.push(`| ${modelName} | ${stats.passRate}% | ${stats.avgTime}ms | ${stats.avgTokens} | ${stats.avgConfidence.toFixed(2)} | ${stats.avgActionCount.toFixed(1)} |`);
  });
  lines.push('');

  // Speed Ranking
  lines.push('## Speed Ranking');
  lines.push('');
  const sortedBySpeed = Object.entries(analysis.models).sort((a, b) => a[1].avgTime - b[1].avgTime);
  sortedBySpeed.forEach(([modelName, stats], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    lines.push(`${medal} **${modelName}**: ${stats.avgTime}ms avg`);
  });
  lines.push('');

  // Cost Efficiency Ranking
  lines.push('## Token Efficiency Ranking');
  lines.push('');
  const sortedByTokens = Object.entries(analysis.models).sort((a, b) => a[1].avgTokens - b[1].avgTokens);
  sortedByTokens.forEach(([modelName, stats], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    lines.push(`${medal} **${modelName}**: ${stats.avgTokens} tokens avg`);
  });
  lines.push('');

  // Quality Ranking
  lines.push('## Quality Ranking (Pass Rate)');
  lines.push('');
  const sortedByQuality = Object.entries(analysis.models).sort((a, b) => b[1].passRate - a[1].passRate);
  sortedByQuality.forEach(([modelName, stats], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    lines.push(`${medal} **${modelName}**: ${stats.passRate}% pass rate`);
  });
  lines.push('');

  // Action Type Distribution
  lines.push('## Action Type Distribution by Model');
  lines.push('');
  Object.entries(analysis.models).forEach(([modelName, stats]) => {
    lines.push(`### ${modelName}`);
    lines.push('');
    const sortedActions = Object.entries(stats.actionTypeDistribution).sort((a, b) => b[1] - a[1]);
    sortedActions.forEach(([action, count]) => {
      const percentage = (count / stats.totalTests * 100).toFixed(1);
      lines.push(`- **${action}**: ${count} (${percentage}% of tests)`);
    });
    lines.push('');
  });

  // Scenario Breakdown
  lines.push('## Scenario Breakdown');
  lines.push('');
  Object.entries(analysis.scenarios).forEach(([scenarioName, scenarioData]) => {
    lines.push(`### ${scenarioName}`);
    lines.push('');
    lines.push('| Model | Pass | Time (ms) | Tokens | Actions | Confidence |');
    lines.push('|-------|------|-----------|--------|---------|------------|');
    
    Object.entries(scenarioData.modelComparison).forEach(([modelName, data]) => {
      const passIcon = data.passed ? '✅' : '⚠️';
      lines.push(`| ${modelName} | ${passIcon} | ${data.apiTime} | ${data.tokens} | ${data.actionCount} | ${data.confidence} |`);
    });
    lines.push('');
  });

  // Detailed Results
  lines.push('## Detailed Test Results');
  lines.push('');
  results.forEach((result, index) => {
    lines.push(`### Test ${index + 1}: ${result.scenario}`);
    lines.push('');
    lines.push(`**Prompt**: "${result.prompt}"`);
    lines.push('');
    
    result.modelResults.forEach(modelResult => {
      lines.push(`#### ${modelResult.model}`);
      
      if (!modelResult.success) {
        lines.push('```');
        lines.push(`❌ Error: ${modelResult.error}`);
        lines.push('```');
      } else {
        lines.push('```json');
        lines.push(JSON.stringify({
          passed: modelResult.passed,
          apiTime: modelResult.apiTime,
          tokens: modelResult.tokens,
          confidence: modelResult.confidence,
          actionCount: modelResult.actionCount,
          actions: modelResult.actions,
          reasoning: modelResult.reasoning
        }, null, 2));
        lines.push('```');
      }
      lines.push('');
    });
  });

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  
  const fastest = sortedBySpeed[0];
  const mostEfficient = sortedByTokens[0];
  const bestQuality = sortedByQuality[0];
  
  lines.push(`- **For Speed**: Use **${fastest[0]}** (${fastest[1].avgTime}ms avg)`);
  lines.push(`- **For Cost**: Use **${mostEfficient[0]}** (${mostEfficient[1].avgTokens} tokens avg)`);
  lines.push(`- **For Quality**: Use **${bestQuality[0]}** (${bestQuality[1].passRate}% pass rate)`);
  lines.push('');
  
  lines.push('### Use Case Recommendations');
  lines.push('');
  lines.push('- **Interactive/Immediate Mode**: Prefer faster models (GPT-3.5 Turbo)');
  lines.push('- **Plan Mode/Batch**: Can use slower but higher quality models (Claude 3.5)');
  lines.push('- **Cost-Sensitive Apps**: GPT-3.5 Turbo for best token efficiency');
  lines.push('- **Quality-Critical**: Claude 3.5 Sonnet for best reasoning');

  return lines.join('\n');
}

// === Main Execution ===
async function main() {
  const startTime = Date.now();

  try {
    const results = await runTests();
    const analysis = analyzeResults(results);
    const report = generateReport(results, analysis);

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(__dirname, 'model-variation-results.json');
    const reportFile = path.join(__dirname, 'model-variation-report.md');

    fs.writeFileSync(resultsFile, JSON.stringify({ results, analysis }, null, 2));
    fs.writeFileSync(reportFile, report);

    const totalTime = Date.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('✅ MODEL VARIATION TESTING COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`Pass Rate: ${analysis.overall.passRate}%`);
    console.log(`Results: ${resultsFile}`);
    console.log(`Report: ${reportFile}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

main();
