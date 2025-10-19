# Plan Mode Live Testing Report

**Generated**: 2025-10-19T22:41:00.086Z
**Model**: openai/gpt-4
**Total Scenarios**: 5
**Success Rate**: 80.0%

## Overall Summary

| Metric | Value |
|--------|-------|
| Total Scenarios | 5 |
| Successful | 4 |
| Total Steps | 24 |
| Total Actions | 113 |
| Total Operations | 113 |
| Total API Time | 16.6s |
| Total Tokens | 9935 |

## Performance Metrics

| Metric | Value |
|--------|-------|
| Avg Steps/Scenario | 4.8 |
| Avg Actions/Scenario | 22.6 |
| Avg Time/Scenario | 3326ms |
| Avg Tokens/Scenario | 1987 |
| Avg Time/Step | 693ms |
| Avg Actions/Step | 4.7 |
| Avg Planning/Execution Ratio | Infinityx |

## Efficiency Metrics

| Metric | Value |
|--------|-------|
| Actions per Token | 0.0114 |
| Operations per Second | 7 |
| Tokens per Step | 414 |

## Scenario Results

### 1. Financial Dashboard (5 steps)

**Description**: Multi-step workflow to create a complete financial dashboard

| Metric | Value |
|--------|-------|
| Steps | 5 |
| Actions | 20 |
| API Time | 3477ms (3.5s) |
| Tokens | 2022 |
| Execution Time | 0ms |
| Operations | 20 |
| Avg Actions/Step | 4.0 |
| Planning/Execution Ratio | Infinityx |
| Status | ✅ SUCCESS |

#### Steps:

**Step 1**: Create headers in row 1: Month, Revenue, Expenses, Profit, Margin%
- Actions: 5 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 1287ms, Tokens: 390

**Step 2**: Fill sample data for January to March in rows 2-4: Jan (50000, 30000), Feb (55000, 32000), Mar (60000, 35000)
- Actions: 6 (setRange, setRange, setRange, setRange, setRange, setRange)
- Confidence: 0.95
- Time: 490ms, Tokens: 496

**Step 3**: Add profit formulas in D2:D4 (Revenue - Expenses)
- Actions: 3 (setCellFormula, setCellFormula, setCellFormula)
- Confidence: 0.95
- Time: 659ms, Tokens: 366

**Step 4**: Add margin% formulas in E2:E4 (Profit / Revenue * 100)
- Actions: 3 (setCellFormula, setCellFormula, setCellFormula)
- Confidence: 0.95
- Time: 490ms, Tokens: 381

**Step 5**: Add totals row in row 5 with SUM formulas for Revenue, Expenses, Profit
- Actions: 3 (setCellFormula, setCellFormula, setCellFormula)
- Confidence: 0.95
- Time: 551ms, Tokens: 389

### 2. Employee Database (4 steps)

**Description**: Build an employee tracking system step by step

| Metric | Value |
|--------|-------|
| Steps | 4 |
| Actions | 22 |
| API Time | 2829ms (2.8s) |
| Tokens | 1803 |
| Execution Time | 0ms |
| Operations | 22 |
| Avg Actions/Step | 5.5 |
| Planning/Execution Ratio | Infinityx |
| Status | ✅ SUCCESS |

#### Steps:

**Step 1**: Setup headers: Name, Department, Salary, Start Date, Status
- Actions: 5 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 646ms, Tokens: 399

**Step 2**: Add 3 employees: Alice (Engineering, 95000, 2023-01-15, Active), Bob (Sales, 75000, 2023-03-20, Active), Carol (HR, 68000, 2022-11-10, Active)
- Actions: 15 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 651ms, Tokens: 787

**Step 3**: Calculate average salary in B7
- Actions: 1 (setCellFormula)
- Confidence: 0.95
- Time: 769ms, Tokens: 310

**Step 4**: Count active employees in B8
- Actions: 1 (setCellFormula)
- Confidence: 0.95
- Time: 763ms, Tokens: 307

### 3. Inventory Tracker (6 steps)

**Description**: Complex inventory management system

| Metric | Value |
|--------|-------|
| Steps | 5 |
| Actions | 23 |
| API Time | 3385ms (3.4s) |
| Tokens | 2069 |
| Execution Time | 0ms |
| Operations | 23 |
| Avg Actions/Step | 4.6 |
| Planning/Execution Ratio | Infinityx |
| Status | ⚠️ PARTIAL |

#### Steps:

**Step 1**: Headers: Item, SKU, Quantity, Unit Price, Total Value, Reorder Level
- Actions: 6 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 779ms, Tokens: 431

**Step 2**: Add products: Widget (W-001, 150, 25), Gadget (G-002, 80, 45), Tool (T-003, 200, 15)
- Actions: 12 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 829ms, Tokens: 582

**Step 3**: Calculate Total Value for each product (Quantity * Unit Price)
- Actions: 3 (setCellFormula, setCellFormula, setCellFormula)
- Confidence: 0.95
- Time: 549ms, Tokens: 399

**Step 4**: ❌ FAILED - Expected property name or '}' in JSON at position 24 (line 3 column 7)

**Step 5**: Add total inventory value in E6
- Actions: 1 (setCellFormula)
- Confidence: 0.95
- Time: 684ms, Tokens: 331

**Step 6**: Add low stock warning count in E7 (items below reorder level)
- Actions: 1 (setCellValue)
- Confidence: 0.95
- Time: 544ms, Tokens: 326

### 4. Sales Pipeline (7 steps)

**Description**: Comprehensive sales tracking workflow

| Metric | Value |
|--------|-------|
| Steps | 7 |
| Actions | 34 |
| API Time | 5046ms (5.0s) |
| Tokens | 2856 |
| Execution Time | 0ms |
| Operations | 34 |
| Avg Actions/Step | 4.9 |
| Planning/Execution Ratio | Infinityx |
| Status | ✅ SUCCESS |

#### Steps:

**Step 1**: Create pipeline stages: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost
- Actions: 6 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 563ms, Tokens: 416

**Step 2**: Add count row headers in A2:F2
- Actions: 1 (fillRow)
- Confidence: 0.95
- Time: 751ms, Tokens: 323

**Step 3**: Add sample counts: Lead 45, Qualified 28, Proposal 15, Negotiation 8, Closed Won 12, Closed Lost 5
- Actions: 12 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 638ms, Tokens: 552

**Step 4**: Add value row headers in A3:F3 for deal values
- Actions: 1 (fillRow)
- Confidence: 0.95
- Time: 635ms, Tokens: 323

**Step 5**: Add sample values: Lead 450000, Qualified 560000, Proposal 375000, Negotiation 240000, Closed Won 360000, Closed Lost 125000
- Actions: 12 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 1268ms, Tokens: 576

**Step 6**: Calculate total pipeline value in G3
- Actions: 1 (setCellFormula)
- Confidence: 0.95
- Time: 657ms, Tokens: 324

**Step 7**: Calculate win rate percentage in H3 (Closed Won / (Closed Won + Closed Lost))
- Actions: 1 (setCellFormula)
- Confidence: 0.95
- Time: 534ms, Tokens: 342

### 5. Budget Tracker (3 steps)

**Description**: Simple budget planning workflow

| Metric | Value |
|--------|-------|
| Steps | 3 |
| Actions | 14 |
| API Time | 1895ms (1.9s) |
| Tokens | 1185 |
| Execution Time | 0ms |
| Operations | 14 |
| Avg Actions/Step | 4.7 |
| Planning/Execution Ratio | Infinityx |
| Status | ✅ SUCCESS |

#### Steps:

**Step 1**: Headers: Category, Budgeted, Actual, Variance
- Actions: 4 (setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 466ms, Tokens: 373

**Step 2**: Add categories: Marketing (10000, 9500), Operations (25000, 26500), R&D (15000, 14200)
- Actions: 9 (setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue, setCellValue)
- Confidence: 0.95
- Time: 756ms, Tokens: 497

**Step 3**: Calculate variance for each category (Budgeted - Actual)
- Actions: 1 (setCellFormula)
- Confidence: 0.95
- Time: 673ms, Tokens: 315

## Key Findings

- ✅ **Excellent Planning Efficiency**: Planning is significantly slower than execution, validating the plan mode approach for complex workflows
- ✅ **High Action Density**: AI generates comprehensive action sets per step
- ✅ **Excellent Token Efficiency**: Good actions-to-tokens ratio

## Recommendations

1. **Plan Mode is Ideal For**:
   - Workflows with 3+ sequential steps
   - Operations requiring multiple API calls
   - Complex data transformations

2. **Immediate Mode is Better For**:
   - Single-step operations
   - Quick edits
   - Real-time user interactions

3. **Optimization Opportunities**:
   - Current avg planning time: 3326ms/scenario
   - Current avg execution time: ~0ms/scenario
   - Consider caching common patterns
   - Batch similar operations for efficiency