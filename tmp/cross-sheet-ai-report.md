# Cross-Sheet Formula AI Test Report

## Overview

- **Date**: 2025-10-19T22:50:43.689Z
- **Model**: GPT-4 Turbo
- **Temperature**: 0.3 (deterministic)
- **Total Tests**: 8
- **Pass Rate**: 100.0% (8/8)

## Performance Metrics

- **Total Duration**: 83.3s
- **Average Response Time**: 8645ms
- **Total Tokens Used**: 6521
- **Average Tokens**: 815

## Test Results

| # | Test Name | Status | Duration | Tokens | Ops | Validation |
|---|-----------|--------|----------|--------|-----|------------|
| 1 | Basic Cross-Sheet Reference | ✅ PASS | 6252ms | 608 | 4 | Valid |
| 2 | SUM Formula Across Sheets | ✅ PASS | 6051ms | 667 | 4 | Valid |
| 3 | Multi-Sheet Rollup Formula | ✅ PASS | 9354ms | 811 | 8 | Valid |
| 4 | Budget Consolidation | ✅ PASS | 12713ms | 1019 | 7 | Valid |
| 5 | Department Revenue Rollup | ✅ PASS | 8235ms | 807 | 8 | Valid |
| 6 | Cross-Sheet VLOOKUP | ✅ PASS | 8334ms | 810 | 4 | Valid |
| 7 | Conditional Cross-Sheet Formula | ✅ PASS | 7772ms | 797 | 6 | Valid |
| 8 | AVERAGE Across Multiple Sheets | ✅ PASS | 10446ms | 1002 | 9 | Valid |

## Detailed Test Cases

### 1. Basic Cross-Sheet Reference

**Status**: ✅ PASSED

**Prompt**: "Create two sheets: "Data" with value 100 in A1, and "Summary" with formula referencing Data!A1"

**Performance**:
- Response Time: 6252ms
- Tokens: 608
- Operations Generated: 4

**AI Explanation**: I'll create two sheets named 'Data' and 'Summary'. In the 'Data' sheet, I'll set cell A1 to the value 100. In the 'Summary' sheet, I'll set cell A1 with a formula that references cell A1 from the 'Data' sheet.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Data"
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Summary"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Data",
      "cells": {
        "A1": {
          "value": "100",
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Summary",
      "cell": "A1",
      "formula": "=Data!A1"
    }
  }
]
```

---

### 2. SUM Formula Across Sheets

**Status**: ✅ PASSED

**Prompt**: "Create "Sales" sheet with numbers 10, 20, 30 in A1:A3. Then create "Report" sheet with SUM formula referencing Sales!A1:A3 in cell B1"

**Performance**:
- Response Time: 6051ms
- Tokens: 667
- Operations Generated: 4

**AI Explanation**: I'll create a 'Sales' sheet with numbers 10, 20, and 30 in cells A1 to A3. Then, I'll create a 'Report' sheet and place a SUM formula in cell B1 that references the range A1 to A3 from the 'Sales' sheet.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Sales"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Sales",
      "cells": {
        "A1": {
          "value": 10,
          "dataType": "number"
        },
        "A2": {
          "value": 20,
          "dataType": "number"
        },
        "A3": {
          "value": 30,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Report"
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Report",
      "cell": "B1",
      "formula": "=SUM(Sales!A1:A3)"
    }
  }
]
```

---

### 3. Multi-Sheet Rollup Formula

**Status**: ✅ PASSED

**Prompt**: "Create 3 sheets: Q1, Q2, Q3 each with 1000 in cell A1. Then create "Annual" sheet with formula that adds Q1!A1 + Q2!A1 + Q3!A1 in cell B2"

**Performance**:
- Response Time: 9354ms
- Tokens: 811
- Operations Generated: 8

**AI Explanation**: I'll create three sheets named Q1, Q2, and Q3, each with a value of 1000 in cell A1. Then, I'll create an 'Annual' sheet where cell B2 will calculate the sum of A1 from Q1, Q2, and Q3.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Q1"
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Q2"
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Q3"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Q1",
      "cells": {
        "A1": {
          "value": "1000",
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Q2",
      "cells": {
        "A1": {
          "value": "1000",
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Q3",
      "cells": {
        "A1": {
          "value": "1000",
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Annual"
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Annual",
      "cell": "B2",
      "formula": "=Q1!A1 + Q2!A1 + Q3!A1"
    }
  }
]
```

---

### 4. Budget Consolidation

**Status**: ✅ PASSED

**Prompt**: "Create "Income" sheet with Salary=5000 in B1, Bonus=1000 in B2, Total formula in B3. Create "Expenses" sheet with Rent=2000 in B1, Food=800 in B2, Total formula in B3. Then create "Summary" sheet that references Income!B3 and Expenses!B3 to calculate Net Savings"

**Performance**:
- Response Time: 12713ms
- Tokens: 1019
- Operations Generated: 7

**AI Explanation**: I'll create three sheets named 'Income', 'Expenses', and 'Summary'. In the 'Income' sheet, I will set the Salary and Bonus values and calculate their Total. In the 'Expenses' sheet, I will set the Rent and Food values and calculate their Total. In the 'Summary' sheet, I will calculate the Net Savings by referencing the Total from both the 'Income' and 'Expenses' sheets.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Income"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Income",
      "cells": {
        "A1": {
          "value": "Salary",
          "dataType": "string"
        },
        "B1": {
          "value": 5000,
          "dataType": "number"
        },
        "A2": {
          "value": "Bonus",
          "dataType": "string"
        },
        "B2": {
          "value": 1000,
          "dataType": "number"
        },
        "A3": {
          "value": "Total",
          "dataType": "string"
        },
        "B3": {
          "formula": "=SUM(B1:B2)",
          "dataType": "formula"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Expenses"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Expenses",
      "cells": {
        "A1": {
          "value": "Rent",
          "dataType": "string"
        },
        "B1": {
          "value": 2000,
          "dataType": "number"
        },
        "A2": {
          "value": "Food",
          "dataType": "string"
        },
        "B2": {
          "value": 800,
          "dataType": "number"
        },
        "A3": {
          "value": "Total",
          "dataType": "string"
        },
        "B3": {
          "formula": "=SUM(B1:B2)",
          "dataType": "formula"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Summary"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Summary",
      "cells": {
        "A1": {
          "value": "Net Savings",
          "dataType": "string"
        },
        "B1": {
          "formula": "=Income!B3-Expenses!B3",
          "dataType": "formula"
        }
      }
    }
  },
  {
    "type": "compute",
    "params": {}
  }
]
```

---

### 5. Department Revenue Rollup

**Status**: ✅ PASSED

**Prompt**: "Create 3 sheets: "Engineering" with revenue 50000 in C5, "Marketing" with revenue 30000 in C5, "Sales" with revenue 75000 in C5. Create "Company" sheet with formula in D10 that sums all three department revenues"

**Performance**:
- Response Time: 8235ms
- Tokens: 807
- Operations Generated: 8

**AI Explanation**: I'll create four sheets named 'Engineering', 'Marketing', 'Sales', and 'Company'. In each department sheet, I'll set the revenue in cell C5. Then, in the 'Company' sheet, I'll add a formula in cell D10 to sum the revenues from all three departments.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Engineering"
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Marketing"
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Sales"
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Company"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Engineering",
      "cells": {
        "C5": {
          "value": 50000,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Marketing",
      "cells": {
        "C5": {
          "value": 30000,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Sales",
      "cells": {
        "C5": {
          "value": 75000,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Company",
      "cell": "D10",
      "formula": "=SUM(Engineering!C5, Marketing!C5, Sales!C5)"
    }
  }
]
```

---

### 6. Cross-Sheet VLOOKUP

**Status**: ✅ PASSED

**Prompt**: "Create "Products" sheet with product codes in A1:A3 (P001, P002, P003) and prices in B1:B3 (10, 20, 30). Create "Orders" sheet with product code P002 in A1 and VLOOKUP formula in B1 that looks up price from Products sheet"

**Performance**:
- Response Time: 8334ms
- Tokens: 810
- Operations Generated: 4

**AI Explanation**: I'll create two sheets named 'Products' and 'Orders'. In the 'Products' sheet, I'll list product codes in column A and their corresponding prices in column B. In the 'Orders' sheet, I'll place the product code 'P002' in cell A1 and set a VLOOKUP formula in B1 to find and display the price from the 'Products' sheet.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Products"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Products",
      "cells": {
        "A1": {
          "value": "P001",
          "dataType": "string"
        },
        "A2": {
          "value": "P002",
          "dataType": "string"
        },
        "A3": {
          "value": "P003",
          "dataType": "string"
        },
        "B1": {
          "value": 10,
          "dataType": "number"
        },
        "B2": {
          "value": 20,
          "dataType": "number"
        },
        "B3": {
          "value": 30,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Orders"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Orders",
      "cells": {
        "A1": {
          "value": "P002",
          "dataType": "string"
        },
        "B1": {
          "formula": "=VLOOKUP(A1,Products!A1:B3,2,FALSE)",
          "dataType": "formula"
        }
      }
    }
  }
]
```

---

### 7. Conditional Cross-Sheet Formula

**Status**: ✅ PASSED

**Prompt**: "Create "Targets" sheet with goal 1000 in A1. Create "Actuals" sheet with value 1200 in A1. Create "Status" sheet with IF formula in B1 that checks if Actuals!A1 exceeds Targets!A1"

**Performance**:
- Response Time: 7772ms
- Tokens: 797
- Operations Generated: 6

**AI Explanation**: I'll create three sheets named 'Targets', 'Actuals', and 'Status'. In the 'Targets' sheet, I'll set cell A1 to a goal of 1000. In the 'Actuals' sheet, I'll set cell A1 to a value of 1200. In the 'Status' sheet, I'll set a formula in cell B1 to check if the value in 'Actuals' A1 exceeds the goal in 'Targets' A1. If it does, it will display 'Exceeds'; otherwise, it will display 'Does Not Exceed'.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Targets"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Targets",
      "cells": {
        "A1": {
          "value": "1000",
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Actuals"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Actuals",
      "cells": {
        "A1": {
          "value": "1200",
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Status"
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Status",
      "cell": "B1",
      "formula": "=IF(Actuals!A1>Targets!A1, \"Exceeds\", \"Does Not Exceed\")"
    }
  }
]
```

---

### 8. AVERAGE Across Multiple Sheets

**Status**: ✅ PASSED

**Prompt**: "Create "Test1" sheet with scores 85, 90, 78 in A1:A3. Create "Test2" sheet with scores 92, 88, 95 in A1:A3. Create "Final" sheet with two formulas: B1 = AVERAGE of Test1 scores, B2 = AVERAGE of Test2 scores, B3 = overall average of B1 and B2"

**Performance**:
- Response Time: 10446ms
- Tokens: 1002
- Operations Generated: 9

**AI Explanation**: I'll create three sheets named 'Test1', 'Test2', and 'Final'. In 'Test1', I'll enter scores 85, 90, and 78 in cells A1 to A3. In 'Test2', I'll enter scores 92, 88, and 95 in cells A1 to A3. In the 'Final' sheet, I'll set formulas to calculate the average scores of 'Test1' and 'Test2' in cells B1 and B2, respectively, and then calculate the overall average of these two averages in cell B3.

**Confidence**: 0.9

**Operations**:
```json
[
  {
    "type": "addSheet",
    "params": {
      "name": "Test1"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Test1",
      "cells": {
        "A1": {
          "value": 85,
          "dataType": "number"
        },
        "A2": {
          "value": 90,
          "dataType": "number"
        },
        "A3": {
          "value": 78,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Test2"
    }
  },
  {
    "type": "setCells",
    "params": {
      "sheet": "Test2",
      "cells": {
        "A1": {
          "value": 92,
          "dataType": "number"
        },
        "A2": {
          "value": 88,
          "dataType": "number"
        },
        "A3": {
          "value": 95,
          "dataType": "number"
        }
      }
    }
  },
  {
    "type": "addSheet",
    "params": {
      "name": "Final"
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Final",
      "cell": "B1",
      "formula": "=AVERAGE(Test1!A1:A3)"
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Final",
      "cell": "B2",
      "formula": "=AVERAGE(Test2!A1:A3)"
    }
  },
  {
    "type": "setFormula",
    "params": {
      "sheet": "Final",
      "cell": "B3",
      "formula": "=AVERAGE(Final!B1:B2)"
    }
  },
  {
    "type": "compute",
    "params": {}
  }
]
```

---

## Key Findings

### ✅ Successful Patterns

- **Basic Cross-Sheet Reference**: AI correctly generated cross-sheet formulas
- **SUM Formula Across Sheets**: AI correctly generated cross-sheet formulas
- **Multi-Sheet Rollup Formula**: AI correctly generated cross-sheet formulas
- **Budget Consolidation**: AI correctly generated cross-sheet formulas
- **Department Revenue Rollup**: AI correctly generated cross-sheet formulas
- **Cross-Sheet VLOOKUP**: AI correctly generated cross-sheet formulas
- **Conditional Cross-Sheet Formula**: AI correctly generated cross-sheet formulas
- **AVERAGE Across Multiple Sheets**: AI correctly generated cross-sheet formulas

## Recommendations

✅ **Excellent Performance**: AI demonstrates strong understanding of cross-sheet formulas (100.0% pass rate).

### Next Steps

1. Review failed test cases and update system prompt
2. Add more cross-sheet examples to AI training
3. Test with different AI models (Claude, GPT-3.5)
4. Implement cross-sheet validation in operation executor
5. Add UI feedback for cross-sheet reference errors
