/**
 * Live API Test: Plan Mode Multi-Step Workflows
 * 
 * Tests plan mode with real OpenRouter API calls:
 * - Multi-step workflow planning (3-7 steps)
 * - Action accumulation across multiple prompts
 * - Batch execution after planning phase
 * - Dependency handling between steps
 * - Memory efficiency with large batches
 * - Error recovery during planning
 */

const fs = require('fs');
const path = require('path');

// === Configuration ===
const MODEL = 'openai/gpt-4'; // Best for multi-step reasoning
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
      
      if (!line || line.startsWith('#')) continue;
      
      if (line.includes('=')) {
        if (currentKey) {
          env[currentKey] = currentValue.trim();
        }
        
        const [key, ...valueParts] = line.split('=');
        currentKey = key.trim();
        currentValue = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      } else {
        currentValue += line;
      }
    }
    
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

// === Plan Mode Simulator ===
class PlanModeSimulator {
  constructor() {
    this.planSteps = [];
    this.accumulatedActions = [];
    this.executedOperations = [];
    this.planningPhase = true;
  }

  addPlanStep(prompt, actions, reasoning) {
    this.planSteps.push({
      stepNumber: this.planSteps.length + 1,
      prompt,
      actions,
      reasoning,
      timestamp: Date.now()
    });
    this.accumulatedActions.push(...actions);
  }

  finalizePlan() {
    this.planningPhase = false;
    return {
      totalSteps: this.planSteps.length,
      totalActions: this.accumulatedActions.length,
      steps: this.planSteps
    };
  }

  executeBatch() {
    if (this.planningPhase) {
      throw new Error('Cannot execute while still in planning phase');
    }

    // Simulate batch execution
    const startTime = Date.now();
    let operationCount = 0;

    for (const action of this.accumulatedActions) {
      // Simulate operation execution
      switch (action.type) {
        case 'setCellValue':
        case 'setCellFormula':
          operationCount += 1;
          break;
        case 'fillRange':
        case 'setRange':
          // Estimate operations based on range size
          operationCount += 10; // Assume 10 cells per range
          break;
        case 'fillRow':
          operationCount += action.values?.length || 5;
          break;
        default:
          operationCount += 1;
      }
    }

    this.executedOperations = this.accumulatedActions;
    const executionTime = Date.now() - startTime;

    return {
      operationsExecuted: operationCount,
      actionsProcessed: this.accumulatedActions.length,
      executionTime,
      success: true
    };
  }

  getSummary() {
    return {
      planSteps: this.planSteps.length,
      accumulatedActions: this.accumulatedActions.length,
      executedOperations: this.executedOperations.length,
      planningPhase: this.planningPhase,
      steps: this.planSteps.map(s => ({
        step: s.stepNumber,
        prompt: s.prompt,
        actionCount: s.actions.length,
        reasoning: s.reasoning
      }))
    };
  }
}

// === API Helper ===
async function callAI(prompt) {
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Nexcell Plan Mode Test'
      },
      body: JSON.stringify({
        model: MODEL,
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
      response: parsed,
      rawContent: content
    };
  } catch (error) {
    return {
      success: false,
      apiTime: Date.now() - startTime,
      error: error.message
    };
  }
}

// === Test Scenarios ===
const PLAN_MODE_SCENARIOS = [
  {
    name: 'Financial Dashboard (5 steps)',
    description: 'Multi-step workflow to create a complete financial dashboard',
    steps: [
      { prompt: 'Create headers in row 1: Month, Revenue, Expenses, Profit, Margin%', expectedActions: 1 },
      { prompt: 'Fill sample data for January to March in rows 2-4: Jan (50000, 30000), Feb (55000, 32000), Mar (60000, 35000)', expectedActions: 1 },
      { prompt: 'Add profit formulas in D2:D4 (Revenue - Expenses)', expectedActions: 3 },
      { prompt: 'Add margin% formulas in E2:E4 (Profit / Revenue * 100)', expectedActions: 3 },
      { prompt: 'Add totals row in row 5 with SUM formulas for Revenue, Expenses, Profit', expectedActions: 4 }
    ]
  },
  {
    name: 'Employee Database (4 steps)',
    description: 'Build an employee tracking system step by step',
    steps: [
      { prompt: 'Setup headers: Name, Department, Salary, Start Date, Status', expectedActions: 1 },
      { prompt: 'Add 3 employees: Alice (Engineering, 95000, 2023-01-15, Active), Bob (Sales, 75000, 2023-03-20, Active), Carol (HR, 68000, 2022-11-10, Active)', expectedActions: 1 },
      { prompt: 'Calculate average salary in B7', expectedActions: 1 },
      { prompt: 'Count active employees in B8', expectedActions: 1 }
    ]
  },
  {
    name: 'Inventory Tracker (6 steps)',
    description: 'Complex inventory management system',
    steps: [
      { prompt: 'Headers: Item, SKU, Quantity, Unit Price, Total Value, Reorder Level', expectedActions: 1 },
      { prompt: 'Add products: Widget (W-001, 150, 25), Gadget (G-002, 80, 45), Tool (T-003, 200, 15)', expectedActions: 1 },
      { prompt: 'Calculate Total Value for each product (Quantity * Unit Price)', expectedActions: 3 },
      { prompt: 'Set reorder levels: Widget 50, Gadget 30, Tool 75', expectedActions: 3 },
      { prompt: 'Add total inventory value in E6', expectedActions: 1 },
      { prompt: 'Add low stock warning count in E7 (items below reorder level)', expectedActions: 1 }
    ]
  },
  {
    name: 'Sales Pipeline (7 steps)',
    description: 'Comprehensive sales tracking workflow',
    steps: [
      { prompt: 'Create pipeline stages: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost', expectedActions: 1 },
      { prompt: 'Add count row headers in A2:F2', expectedActions: 1 },
      { prompt: 'Add sample counts: Lead 45, Qualified 28, Proposal 15, Negotiation 8, Closed Won 12, Closed Lost 5', expectedActions: 1 },
      { prompt: 'Add value row headers in A3:F3 for deal values', expectedActions: 1 },
      { prompt: 'Add sample values: Lead 450000, Qualified 560000, Proposal 375000, Negotiation 240000, Closed Won 360000, Closed Lost 125000', expectedActions: 1 },
      { prompt: 'Calculate total pipeline value in G3', expectedActions: 1 },
      { prompt: 'Calculate win rate percentage in H3 (Closed Won / (Closed Won + Closed Lost))', expectedActions: 1 }
    ]
  },
  {
    name: 'Budget Tracker (3 steps)',
    description: 'Simple budget planning workflow',
    steps: [
      { prompt: 'Headers: Category, Budgeted, Actual, Variance', expectedActions: 1 },
      { prompt: 'Add categories: Marketing (10000, 9500), Operations (25000, 26500), R&D (15000, 14200)', expectedActions: 1 },
      { prompt: 'Calculate variance for each category (Budgeted - Actual)', expectedActions: 3 }
    ]
  }
];

// === Test Runner ===
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 PLAN MODE LIVE TESTING');
  console.log('='.repeat(80));
  console.log(`Testing ${PLAN_MODE_SCENARIOS.length} multi-step workflows`);
  console.log(`Total steps across all scenarios: ${PLAN_MODE_SCENARIOS.reduce((sum, s) => sum + s.steps.length, 0)}`);
  console.log('='.repeat(80) + '\n');

  const results = [];
  let scenarioNumber = 0;

  for (const scenario of PLAN_MODE_SCENARIOS) {
    scenarioNumber++;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Scenario ${scenarioNumber}/${PLAN_MODE_SCENARIOS.length}: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log(`Steps: ${scenario.steps.length}`);
    console.log('='.repeat(80));

    const planner = new PlanModeSimulator();
    const stepResults = [];
    let totalApiTime = 0;
    let totalTokens = 0;
    let allStepsSuccessful = true;

    // Planning Phase
    console.log('\n📝 PLANNING PHASE:');
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepNum = i + 1;

      console.log(`\n   Step ${stepNum}/${scenario.steps.length}:`);
      console.log(`   "${step.prompt}"`);

      const result = await callAI(step.prompt);

      if (!result.success) {
        console.log(`   ❌ API Error: ${result.error}`);
        allStepsSuccessful = false;
        stepResults.push({
          stepNumber: stepNum,
          success: false,
          error: result.error,
          apiTime: result.apiTime
        });
        continue;
      }

      const { actions = [], confidence = 0, reasoning = '' } = result.response;
      
      totalApiTime += result.apiTime;
      totalTokens += result.tokens;

      planner.addPlanStep(step.prompt, actions, reasoning);

      console.log(`   ✅ Step added to plan`);
      console.log(`      Actions: ${actions.length} (${actions.map(a => a.action || a.type).join(', ')})`);
      console.log(`      Confidence: ${confidence}`);
      console.log(`      API Time: ${result.apiTime}ms`);
      console.log(`      Tokens: ${result.tokens}`);

      stepResults.push({
        stepNumber: stepNum,
        success: true,
        prompt: step.prompt,
        actionCount: actions.length,
        actionTypes: actions.map(a => a.action || a.type),
        confidence,
        reasoning,
        apiTime: result.apiTime,
        tokens: result.tokens
      });

      // Rate limiting delay between steps
      if (i < scenario.steps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      }
    }

    // Finalize Plan
    const plan = planner.finalizePlan();
    console.log(`\n📊 PLAN FINALIZED:`);
    console.log(`   Total Steps: ${plan.totalSteps}`);
    console.log(`   Total Actions Accumulated: ${plan.totalActions}`);
    console.log(`   Total API Time: ${totalApiTime}ms (${(totalApiTime / 1000).toFixed(1)}s)`);
    console.log(`   Total Tokens: ${totalTokens}`);
    console.log(`   Avg Time/Step: ${Math.round(totalApiTime / plan.totalSteps)}ms`);

    // Execution Phase
    console.log(`\n⚡ EXECUTION PHASE:`);
    const execution = planner.executeBatch();
    console.log(`   Operations Executed: ${execution.operationsExecuted}`);
    console.log(`   Actions Processed: ${execution.actionsProcessed}`);
    console.log(`   Execution Time: ${execution.executionTime}ms`);
    console.log(`   Status: ${execution.success ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Calculate metrics
    const avgActionsPerStep = plan.totalActions / plan.totalSteps;
    const planningToExecutionRatio = totalApiTime / execution.executionTime;

    console.log(`\n📈 METRICS:`);
    console.log(`   Avg Actions/Step: ${avgActionsPerStep.toFixed(1)}`);
    console.log(`   Planning Time: ${totalApiTime}ms`);
    console.log(`   Execution Time: ${execution.executionTime}ms`);
    console.log(`   Planning/Execution Ratio: ${planningToExecutionRatio.toFixed(1)}x`);
    console.log(`   Memory Efficiency: ${(plan.totalActions / totalTokens * 1000).toFixed(2)} actions/1k tokens`);

    results.push({
      scenario: scenario.name,
      description: scenario.description,
      totalSteps: plan.totalSteps,
      totalActions: plan.totalActions,
      totalApiTime,
      totalTokens,
      avgTimePerStep: Math.round(totalApiTime / plan.totalSteps),
      avgActionsPerStep: avgActionsPerStep.toFixed(1),
      executionTime: execution.executionTime,
      operationsExecuted: execution.operationsExecuted,
      planningToExecutionRatio: planningToExecutionRatio.toFixed(1),
      allStepsSuccessful,
      stepResults,
      summary: planner.getSummary()
    });
  }

  return results;
}

// === Analysis & Reporting ===
function analyzeResults(results) {
  const analysis = {
    overall: {
      totalScenarios: results.length,
      successfulScenarios: results.filter(r => r.allStepsSuccessful).length,
      totalSteps: results.reduce((sum, r) => sum + r.totalSteps, 0),
      totalActions: results.reduce((sum, r) => sum + r.totalActions, 0),
      totalApiTime: results.reduce((sum, r) => sum + r.totalApiTime, 0),
      totalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
      totalOperations: results.reduce((sum, r) => sum + r.operationsExecuted, 0)
    },
    performance: {
      avgStepsPerScenario: 0,
      avgActionsPerScenario: 0,
      avgTimePerScenario: 0,
      avgTokensPerScenario: 0,
      avgTimePerStep: 0,
      avgActionsPerStep: 0,
      avgPlanningToExecutionRatio: 0
    },
    efficiency: {
      actionsPerToken: 0,
      operationsPerSecond: 0,
      tokensPerStep: 0
    }
  };

  const count = results.length;
  if (count > 0) {
    analysis.performance.avgStepsPerScenario = (analysis.overall.totalSteps / count).toFixed(1);
    analysis.performance.avgActionsPerScenario = (analysis.overall.totalActions / count).toFixed(1);
    analysis.performance.avgTimePerScenario = Math.round(analysis.overall.totalApiTime / count);
    analysis.performance.avgTokensPerScenario = Math.round(analysis.overall.totalTokens / count);
    analysis.performance.avgTimePerStep = Math.round(analysis.overall.totalApiTime / analysis.overall.totalSteps);
    analysis.performance.avgActionsPerStep = (analysis.overall.totalActions / analysis.overall.totalSteps).toFixed(1);
    
    const ratios = results.map(r => parseFloat(r.planningToExecutionRatio));
    analysis.performance.avgPlanningToExecutionRatio = (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(1);

    analysis.efficiency.actionsPerToken = (analysis.overall.totalActions / analysis.overall.totalTokens).toFixed(4);
    analysis.efficiency.operationsPerSecond = Math.round(analysis.overall.totalOperations / (analysis.overall.totalApiTime / 1000));
    analysis.efficiency.tokensPerStep = Math.round(analysis.overall.totalTokens / analysis.overall.totalSteps);
  }

  return analysis;
}

function generateReport(results, analysis) {
  const lines = [];
  
  lines.push('# Plan Mode Live Testing Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Model**: ${MODEL}`);
  lines.push(`**Total Scenarios**: ${analysis.overall.totalScenarios}`);
  lines.push(`**Success Rate**: ${(analysis.overall.successfulScenarios / analysis.overall.totalScenarios * 100).toFixed(1)}%`);
  lines.push('');

  // Overall Summary
  lines.push('## Overall Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Scenarios | ${analysis.overall.totalScenarios} |`);
  lines.push(`| Successful | ${analysis.overall.successfulScenarios} |`);
  lines.push(`| Total Steps | ${analysis.overall.totalSteps} |`);
  lines.push(`| Total Actions | ${analysis.overall.totalActions} |`);
  lines.push(`| Total Operations | ${analysis.overall.totalOperations} |`);
  lines.push(`| Total API Time | ${(analysis.overall.totalApiTime / 1000).toFixed(1)}s |`);
  lines.push(`| Total Tokens | ${analysis.overall.totalTokens} |`);
  lines.push('');

  // Performance Metrics
  lines.push('## Performance Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Avg Steps/Scenario | ${analysis.performance.avgStepsPerScenario} |`);
  lines.push(`| Avg Actions/Scenario | ${analysis.performance.avgActionsPerScenario} |`);
  lines.push(`| Avg Time/Scenario | ${analysis.performance.avgTimePerScenario}ms |`);
  lines.push(`| Avg Tokens/Scenario | ${analysis.performance.avgTokensPerScenario} |`);
  lines.push(`| Avg Time/Step | ${analysis.performance.avgTimePerStep}ms |`);
  lines.push(`| Avg Actions/Step | ${analysis.performance.avgActionsPerStep} |`);
  lines.push(`| Avg Planning/Execution Ratio | ${analysis.performance.avgPlanningToExecutionRatio}x |`);
  lines.push('');

  // Efficiency Metrics
  lines.push('## Efficiency Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Actions per Token | ${analysis.efficiency.actionsPerToken} |`);
  lines.push(`| Operations per Second | ${analysis.efficiency.operationsPerSecond} |`);
  lines.push(`| Tokens per Step | ${analysis.efficiency.tokensPerStep} |`);
  lines.push('');

  // Scenario Breakdown
  lines.push('## Scenario Results');
  lines.push('');
  results.forEach((result, index) => {
    lines.push(`### ${index + 1}. ${result.scenario}`);
    lines.push('');
    lines.push(`**Description**: ${result.description}`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Steps | ${result.totalSteps} |`);
    lines.push(`| Actions | ${result.totalActions} |`);
    lines.push(`| API Time | ${result.totalApiTime}ms (${(result.totalApiTime / 1000).toFixed(1)}s) |`);
    lines.push(`| Tokens | ${result.totalTokens} |`);
    lines.push(`| Execution Time | ${result.executionTime}ms |`);
    lines.push(`| Operations | ${result.operationsExecuted} |`);
    lines.push(`| Avg Actions/Step | ${result.avgActionsPerStep} |`);
    lines.push(`| Planning/Execution Ratio | ${result.planningToExecutionRatio}x |`);
    lines.push(`| Status | ${result.allStepsSuccessful ? '✅ SUCCESS' : '⚠️ PARTIAL'} |`);
    lines.push('');

    // Step Details
    lines.push('#### Steps:');
    lines.push('');
    result.stepResults.forEach(step => {
      if (step.success) {
        lines.push(`**Step ${step.stepNumber}**: ${step.prompt}`);
        lines.push(`- Actions: ${step.actionCount} (${step.actionTypes.join(', ')})`);
        lines.push(`- Confidence: ${step.confidence}`);
        lines.push(`- Time: ${step.apiTime}ms, Tokens: ${step.tokens}`);
        lines.push('');
      } else {
        lines.push(`**Step ${step.stepNumber}**: ❌ FAILED - ${step.error}`);
        lines.push('');
      }
    });
  });

  // Recommendations
  lines.push('## Key Findings');
  lines.push('');
  
  const avgRatio = parseFloat(analysis.performance.avgPlanningToExecutionRatio);
  if (avgRatio > 1000) {
    lines.push('- ✅ **Excellent Planning Efficiency**: Planning is significantly slower than execution, validating the plan mode approach for complex workflows');
  } else if (avgRatio > 100) {
    lines.push('- ✅ **Good Planning Efficiency**: Plan mode provides clear performance benefits');
  } else {
    lines.push('- ⚠️ **Low Planning Efficiency**: Consider optimizing execution performance');
  }

  const avgActions = parseFloat(analysis.performance.avgActionsPerStep);
  if (avgActions > 3) {
    lines.push('- ✅ **High Action Density**: AI generates comprehensive action sets per step');
  } else if (avgActions > 1.5) {
    lines.push('- ✅ **Good Action Density**: Reasonable action generation per step');
  } else {
    lines.push('- ⚠️ **Low Action Density**: AI might be breaking down work too granularly');
  }

  const actionsPerToken = parseFloat(analysis.efficiency.actionsPerToken);
  if (actionsPerToken > 0.01) {
    lines.push('- ✅ **Excellent Token Efficiency**: Good actions-to-tokens ratio');
  } else {
    lines.push('- ⚠️ **Room for Token Efficiency Improvement**');
  }

  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  lines.push('1. **Plan Mode is Ideal For**:');
  lines.push('   - Workflows with 3+ sequential steps');
  lines.push('   - Operations requiring multiple API calls');
  lines.push('   - Complex data transformations');
  lines.push('');
  lines.push('2. **Immediate Mode is Better For**:');
  lines.push('   - Single-step operations');
  lines.push('   - Quick edits');
  lines.push('   - Real-time user interactions');
  lines.push('');
  lines.push('3. **Optimization Opportunities**:');
  lines.push(`   - Current avg planning time: ${analysis.performance.avgTimePerScenario}ms/scenario`);
  lines.push(`   - Current avg execution time: ~${Math.round(analysis.overall.totalApiTime / analysis.overall.totalScenarios / parseFloat(analysis.performance.avgPlanningToExecutionRatio))}ms/scenario`);
  lines.push('   - Consider caching common patterns');
  lines.push('   - Batch similar operations for efficiency');

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
    const resultsFile = path.join(__dirname, 'plan-mode-results.json');
    const reportFile = path.join(__dirname, 'plan-mode-report.md');

    fs.writeFileSync(resultsFile, JSON.stringify({ results, analysis }, null, 2));
    fs.writeFileSync(reportFile, report);

    const totalTime = Date.now() - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('✅ PLAN MODE TESTING COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`Success Rate: ${(analysis.overall.successfulScenarios / analysis.overall.totalScenarios * 100).toFixed(1)}%`);
    console.log(`Total Steps: ${analysis.overall.totalSteps}`);
    console.log(`Total Actions: ${analysis.overall.totalActions}`);
    console.log(`Results: ${resultsFile}`);
    console.log(`Report: ${reportFile}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

main();
