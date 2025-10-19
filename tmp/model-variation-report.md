# Model Variation Test Report

**Generated**: 2025-10-19T22:25:46.085Z
**Total Tests**: 15
**Pass Rate**: 93.3%

## Overall Summary

| Metric | Value |
|--------|-------|
| Total Tests | 15 |
| Passed | 14 (93.3%) |
| Failed | 1 |
| Errors | 0 |

## Model Performance Comparison

| Model | Pass Rate | Avg Time | Avg Tokens | Avg Confidence | Avg Actions |
|-------|-----------|----------|------------|----------------|-------------|
| Claude 3.5 Sonnet | 80.0% | 1039ms | 467 | 0.99 | 3.0 |
| GPT-4 | 100.0% | 655ms | 411 | 0.95 | 3.8 |
| GPT-3.5 Turbo | 100.0% | 503ms | 378 | 0.95 | 2.6 |

## Speed Ranking

🥇 **GPT-3.5 Turbo**: 503ms avg
🥈 **GPT-4**: 655ms avg
🥉 **Claude 3.5 Sonnet**: 1039ms avg

## Token Efficiency Ranking

🥇 **GPT-3.5 Turbo**: 378 tokens avg
🥈 **GPT-4**: 411 tokens avg
🥉 **Claude 3.5 Sonnet**: 467 tokens avg

## Quality Ranking (Pass Rate)

🥇 **GPT-4**: 100.0% pass rate
🥈 **GPT-3.5 Turbo**: 100.0% pass rate
🥉 **Claude 3.5 Sonnet**: 80.0% pass rate

## Action Type Distribution by Model

### Claude 3.5 Sonnet

- **setCellValue**: 7 (140.0% of tests)
- **fillRow**: 4 (80.0% of tests)
- **setCellFormula**: 2 (40.0% of tests)
- **setRange**: 2 (40.0% of tests)

### GPT-4

- **setCellValue**: 12 (240.0% of tests)
- **setRange**: 4 (80.0% of tests)
- **setCellFormula**: 2 (40.0% of tests)
- **fillRow**: 1 (20.0% of tests)

### GPT-3.5 Turbo

- **setCellValue**: 7 (140.0% of tests)
- **setCellFormula**: 2 (40.0% of tests)
- **setRange**: 2 (40.0% of tests)
- **fillRow**: 1 (20.0% of tests)
- **fillRange**: 1 (20.0% of tests)

## Scenario Breakdown

### Simple Cell Value

| Model | Pass | Time (ms) | Tokens | Actions | Confidence |
|-------|------|-----------|--------|---------|------------|
| Claude 3.5 Sonnet | ✅ | 1388 | 380 | 2 | 1 |
| GPT-4 | ✅ | 832 | 340 | 2 | 0.95 |
| GPT-3.5 Turbo | ✅ | 438 | 324 | 2 | 0.95 |

### Formula Creation

| Model | Pass | Time (ms) | Tokens | Actions | Confidence |
|-------|------|-----------|--------|---------|------------|
| Claude 3.5 Sonnet | ✅ | 543 | 572 | 6 | 0.98 |
| GPT-4 | ✅ | 653 | 485 | 6 | 0.95 |
| GPT-3.5 Turbo | ✅ | 434 | 454 | 6 | 0.95 |

### Range Fill

| Model | Pass | Time (ms) | Tokens | Actions | Confidence |
|-------|------|-----------|--------|---------|------------|
| Claude 3.5 Sonnet | ✅ | 1257 | 479 | 2 | 0.98 |
| GPT-4 | ✅ | 536 | 396 | 2 | 0.95 |
| GPT-3.5 Turbo | ✅ | 755 | 392 | 2 | 0.95 |

### Aggregation Formula

| Model | Pass | Time (ms) | Tokens | Actions | Confidence |
|-------|------|-----------|--------|---------|------------|
| Claude 3.5 Sonnet | ✅ | 549 | 422 | 2 | 0.99 |
| GPT-4 | ✅ | 719 | 432 | 6 | 0.95 |
| GPT-3.5 Turbo | ✅ | 438 | 362 | 2 | 0.95 |

### Multi-Column Data

| Model | Pass | Time (ms) | Tokens | Actions | Confidence |
|-------|------|-----------|--------|---------|------------|
| Claude 3.5 Sonnet | ⚠️ | 1460 | 482 | 3 | 0.98 |
| GPT-4 | ✅ | 537 | 400 | 3 | 0.95 |
| GPT-3.5 Turbo | ✅ | 451 | 359 | 1 | 0.95 |

## Detailed Test Results

### Test 1: Simple Cell Value

**Prompt**: "Set cell A1 to "Revenue" and B1 to 50000"

#### Claude 3.5 Sonnet
```json
{
  "passed": true,
  "apiTime": 1388,
  "tokens": 380,
  "confidence": 1,
  "actionCount": 2,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": "Revenue"
    },
    {
      "action": "setCellValue",
      "target": "B1",
      "value": 50000
    }
  ],
  "reasoning": "Simple request to set two specific cell values - one text and one number"
}
```

#### GPT-4
```json
{
  "passed": true,
  "apiTime": 832,
  "tokens": 340,
  "confidence": 0.95,
  "actionCount": 2,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": "Revenue"
    },
    {
      "action": "setCellValue",
      "target": "B1",
      "value": 50000
    }
  ],
  "reasoning": "The request is to set specific values to cells A1 and B1."
}
```

#### GPT-3.5 Turbo
```json
{
  "passed": true,
  "apiTime": 438,
  "tokens": 324,
  "confidence": 0.95,
  "actionCount": 2,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": "Revenue"
    },
    {
      "action": "setCellValue",
      "target": "B1",
      "value": 50000
    }
  ],
  "reasoning": "The user requested to set specific values in cells A1 and B1."
}
```

### Test 2: Formula Creation

**Prompt**: "In A1 put "Price", A2 put 100. In B1 put "Tax Rate", B2 put 0.08. In C1 put "Total", C2 calculate price plus tax"

#### Claude 3.5 Sonnet
```json
{
  "passed": true,
  "apiTime": 543,
  "tokens": 572,
  "confidence": 0.98,
  "actionCount": 6,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": "Price"
    },
    {
      "action": "setCellValue",
      "target": "A2",
      "value": 100
    },
    {
      "action": "setCellValue",
      "target": "B1",
      "value": "Tax Rate"
    },
    {
      "action": "setCellValue",
      "target": "B2",
      "value": 0.08
    },
    {
      "action": "setCellValue",
      "target": "C1",
      "value": "Total"
    },
    {
      "action": "setCellFormula",
      "target": "C2",
      "formula": "=A2*(1+B2)"
    }
  ],
  "reasoning": "Setting up a simple price calculation with tax. Headers in row 1, values in row 2, with a formula to calculate total price including tax in C2."
}
```

#### GPT-4
```json
{
  "passed": true,
  "apiTime": 653,
  "tokens": 485,
  "confidence": 0.95,
  "actionCount": 6,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": "Price"
    },
    {
      "action": "setCellValue",
      "target": "A2",
      "value": 100
    },
    {
      "action": "setCellValue",
      "target": "B1",
      "value": "Tax Rate"
    },
    {
      "action": "setCellValue",
      "target": "B2",
      "value": 0.08
    },
    {
      "action": "setCellValue",
      "target": "C1",
      "value": "Total"
    },
    {
      "action": "setCellFormula",
      "target": "C2",
      "formula": "=A2+(A2*B2)"
    }
  ],
  "reasoning": "Added labels to cells A1, B1, and C1. Set the price and tax rate in A2 and B2 respectively. The total amount in C2 is calculated using the formula which adds the price and the product of price and tax rate."
}
```

#### GPT-3.5 Turbo
```json
{
  "passed": true,
  "apiTime": 434,
  "tokens": 454,
  "confidence": 0.95,
  "actionCount": 6,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": "Price"
    },
    {
      "action": "setCellValue",
      "target": "A2",
      "value": 100
    },
    {
      "action": "setCellValue",
      "target": "B1",
      "value": "Tax Rate"
    },
    {
      "action": "setCellValue",
      "target": "B2",
      "value": 0.08
    },
    {
      "action": "setCellValue",
      "target": "C1",
      "value": "Total"
    },
    {
      "action": "setCellFormula",
      "target": "C2",
      "formula": "=A2+B2*A2"
    }
  ],
  "reasoning": "The user requested to set values for price, tax rate, and calculate the total based on the formula provided."
}
```

### Test 3: Range Fill

**Prompt**: "Create a simple expense tracker with headers in row 1: Item, Amount, Date. Fill rows 2-4 with sample data"

#### Claude 3.5 Sonnet
```json
{
  "passed": true,
  "apiTime": 1257,
  "tokens": 479,
  "confidence": 0.98,
  "actionCount": 2,
  "actions": [
    {
      "action": "fillRow",
      "row": 1,
      "values": [
        "Item",
        "Amount",
        "Date"
      ]
    },
    {
      "action": "setRange",
      "range": "A2:C4",
      "values": [
        [
          "Groceries",
          85.5,
          "2024-01-15"
        ],
        [
          "Gas",
          45,
          "2024-01-16"
        ],
        [
          "Coffee",
          4.75,
          "2024-01-17"
        ]
      ]
    }
  ],
  "reasoning": "Creating a basic expense tracker with headers in row 1 and sample data in rows 2-4. Using fillRow for headers and setRange for sample data to efficiently set multiple cells at once."
}
```

#### GPT-4
```json
{
  "passed": true,
  "apiTime": 536,
  "tokens": 396,
  "confidence": 0.95,
  "actionCount": 2,
  "actions": [
    {
      "action": "fillRow",
      "row": 1,
      "values": [
        "Item",
        "Amount",
        "Date"
      ]
    },
    {
      "action": "setRange",
      "range": "A2:C4",
      "values": [
        [
          "Groceries",
          50,
          "01/01/2022"
        ],
        [
          "Fuel",
          30,
          "01/02/2022"
        ],
        [
          "Rent",
          500,
          "01/03/2022"
        ]
      ]
    }
  ],
  "reasoning": "First, we set the headers in row 1. Then, we fill in rows 2 to 4 with sample data for the expense tracker."
}
```

#### GPT-3.5 Turbo
```json
{
  "passed": true,
  "apiTime": 755,
  "tokens": 392,
  "confidence": 0.95,
  "actionCount": 2,
  "actions": [
    {
      "action": "fillRow",
      "row": 1,
      "values": [
        "Item",
        "Amount",
        "Date"
      ]
    },
    {
      "action": "fillRange",
      "range": "A2:C4",
      "values": [
        [
          "Groceries",
          50,
          "2022-10-01"
        ],
        [
          "Gas",
          30,
          "2022-10-02"
        ],
        [
          "Dinner",
          40,
          "2022-10-03"
        ]
      ]
    }
  ],
  "reasoning": "The user requested to create an expense tracker with headers and fill sample data in rows 2-4."
}
```

### Test 4: Aggregation Formula

**Prompt**: "Put numbers 10, 20, 30, 40, 50 in cells A1 through A5. Calculate the total in A6"

#### Claude 3.5 Sonnet
```json
{
  "passed": true,
  "apiTime": 549,
  "tokens": 422,
  "confidence": 0.99,
  "actionCount": 2,
  "actions": [
    {
      "action": "setRange",
      "range": "A1:A5",
      "values": [
        [
          10
        ],
        [
          20
        ],
        [
          30
        ],
        [
          40
        ],
        [
          50
        ]
      ]
    },
    {
      "action": "setCellFormula",
      "target": "A6",
      "formula": "=SUM(A1:A5)"
    }
  ],
  "reasoning": "Setting 5 sequential values in column A and adding a sum formula in A6 to calculate their total"
}
```

#### GPT-4
```json
{
  "passed": true,
  "apiTime": 719,
  "tokens": 432,
  "confidence": 0.95,
  "actionCount": 6,
  "actions": [
    {
      "action": "setCellValue",
      "target": "A1",
      "value": 10
    },
    {
      "action": "setCellValue",
      "target": "A2",
      "value": 20
    },
    {
      "action": "setCellValue",
      "target": "A3",
      "value": 30
    },
    {
      "action": "setCellValue",
      "target": "A4",
      "value": 40
    },
    {
      "action": "setCellValue",
      "target": "A5",
      "value": 50
    },
    {
      "action": "setCellFormula",
      "target": "A6",
      "formula": "=SUM(A1:A5)"
    }
  ],
  "reasoning": "Numbers are set in cells A1 through A5 and the total is calculated in A6."
}
```

#### GPT-3.5 Turbo
```json
{
  "passed": true,
  "apiTime": 438,
  "tokens": 362,
  "confidence": 0.95,
  "actionCount": 2,
  "actions": [
    {
      "action": "setRange",
      "range": "A1:A5",
      "values": [
        [
          10
        ],
        [
          20
        ],
        [
          30
        ],
        [
          40
        ],
        [
          50
        ]
      ]
    },
    {
      "action": "setCellFormula",
      "target": "A6",
      "formula": "=SUM(A1:A5)"
    }
  ],
  "reasoning": "The user requested to put numbers in cells A1 through A5 and calculate the total in A6."
}
```

### Test 5: Multi-Column Data

**Prompt**: "Create a product inventory with Name in A1-A3 (Widget, Gadget, Tool), Quantity in B1-B3 (100, 50, 75), Price in C1-C3 (10, 20, 15)"

#### Claude 3.5 Sonnet
```json
{
  "passed": false,
  "apiTime": 1460,
  "tokens": 482,
  "confidence": 0.98,
  "actionCount": 3,
  "actions": [
    {
      "action": "fillRow",
      "row": 1,
      "values": [
        "Widget",
        100,
        10
      ]
    },
    {
      "action": "fillRow",
      "row": 2,
      "values": [
        "Gadget",
        50,
        20
      ]
    },
    {
      "action": "fillRow",
      "row": 3,
      "values": [
        "Tool",
        75,
        15
      ]
    }
  ],
  "reasoning": "Creating a 3-row inventory table using fillRow actions to populate product names, quantities and prices in columns A, B and C respectively"
}
```

#### GPT-4
```json
{
  "passed": true,
  "apiTime": 537,
  "tokens": 400,
  "confidence": 0.95,
  "actionCount": 3,
  "actions": [
    {
      "action": "setRange",
      "range": "A1:A3",
      "values": [
        [
          "Widget"
        ],
        [
          "Gadget"
        ],
        [
          "Tool"
        ]
      ]
    },
    {
      "action": "setRange",
      "range": "B1:B3",
      "values": [
        [
          100
        ],
        [
          50
        ],
        [
          75
        ]
      ]
    },
    {
      "action": "setRange",
      "range": "C1:C3",
      "values": [
        [
          10
        ],
        [
          20
        ],
        [
          15
        ]
      ]
    }
  ],
  "reasoning": "Setting the ranges for product names, quantities, and prices respectively."
}
```

#### GPT-3.5 Turbo
```json
{
  "passed": true,
  "apiTime": 451,
  "tokens": 359,
  "confidence": 0.95,
  "actionCount": 1,
  "actions": [
    {
      "action": "setRange",
      "range": "A1:C3",
      "values": [
        [
          "Widget",
          "Gadget",
          "Tool"
        ],
        [
          100,
          50,
          75
        ],
        [
          10,
          20,
          15
        ]
      ]
    }
  ],
  "reasoning": "Setting the product inventory data in the specified ranges."
}
```

## Recommendations

- **For Speed**: Use **GPT-3.5 Turbo** (503ms avg)
- **For Cost**: Use **GPT-3.5 Turbo** (378 tokens avg)
- **For Quality**: Use **GPT-4** (100.0% pass rate)

### Use Case Recommendations

- **Interactive/Immediate Mode**: Prefer faster models (GPT-3.5 Turbo)
- **Plan Mode/Batch**: Can use slower but higher quality models (Claude 3.5)
- **Cost-Sensitive Apps**: GPT-3.5 Turbo for best token efficiency
- **Quality-Critical**: Claude 3.5 Sonnet for best reasoning