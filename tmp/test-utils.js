/**
 * Test Utilities and Fixtures
 * 
 * Reusable helper functions, data generators, mock responses,
 * and validation utilities for AI workbook operations testing.
 * 
 * Usage:
 *   import { generateSampleData, mockAIResponses, validateOperations } from './test-utils.js';
 */

// ============================================================================
// HELPER FUNCTIONS (Action Extraction & Conversion)
// ============================================================================

export function extractActionsFromReply(reply) {
  const actionsMatch = reply.match(/<actions>\s*([\s\S]*?)\s*<\/actions>/);
  const jsonMatch = reply.match(/```(?:json)?\s*(\[\s*{[\s\S]*?}\s*\])\s*```/);
  
  const jsonStr = actionsMatch ? actionsMatch[1] : (jsonMatch ? jsonMatch[1] : null);
  
  if (!jsonStr) {
    return [];
  }
  
  try {
    const actions = JSON.parse(jsonStr);
    return Array.isArray(actions) ? actions : [];
  } catch (error) {
    console.error('Failed to parse actions JSON:', error);
    return [];
  }
}

export function parseAddress(address) {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  
  const col = match[1];
  const row = parseInt(match[2], 10);
  
  let colNum = 0;
  for (let i = 0; i < col.length; i++) {
    colNum = colNum * 26 + (col.charCodeAt(i) - 64);
  }
  
  return { row, col: colNum };
}

export function toAddress(row, col) {
  let colStr = '';
  let c = col;
  while (c > 0) {
    const remainder = (c - 1) % 26;
    colStr = String.fromCharCode(65 + remainder) + colStr;
    c = Math.floor((c - 1) / 26);
  }
  return colStr + row;
}

export function columnLetterToNumber(col) {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

export function cellFromValue(value) {
  if (value === null || value === undefined || value === '') {
    return { type: 'empty', value: null };
  }
  
  if (typeof value === 'number') {
    return { type: 'number', value };
  }
  
  if (typeof value === 'boolean') {
    return { type: 'boolean', value };
  }
  
  if (typeof value === 'string') {
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return { type: 'date', value };
    }
    
    return { type: 'text', value };
  }
  
  return { type: 'text', value: String(value) };
}

export function convertToWorkbookActions(actions) {
  const operations = [];
  
  actions.forEach(action => {
    try {
      switch (action.type) {
        case 'setCellValue': {
          if (action.cell && action.value !== undefined) {
            const cell = cellFromValue(action.value);
            operations.push({
              address: action.cell,
              type: cell.type,
              value: cell.value
            });
          }
          break;
        }
        
        case 'setCellFormula': {
          if (action.cell && action.formula) {
            operations.push({
              address: action.cell,
              type: 'formula',
              value: action.formula.startsWith('=') ? action.formula : `=${action.formula}`
            });
          }
          break;
        }
        
        case 'fillRange': {
          const rangeObj = action.target || action.range;
          if (rangeObj && typeof rangeObj === 'object' && action.values) {
            const { start, end } = rangeObj;
            const startAddr = parseAddress(start);
            
            if (!startAddr) {
              operations.push({
                address: 'ERROR',
                type: 'error',
                value: `Invalid start address: ${start}`
              });
              return;
            }
            
            const values = action.values;
            const isSingleColumn = values.every(v => Array.isArray(v) && v.length === 1);
            
            if (isSingleColumn) {
              values.forEach((rowValue, idx) => {
                const value = Array.isArray(rowValue) ? rowValue[0] : rowValue;
                const actualValue = Array.isArray(value) && value.length === 1 ? value[0] : value;
                const row = startAddr.row + idx;
                const address = toAddress(row, startAddr.col);
                const cell = cellFromValue(actualValue);
                operations.push({
                  address,
                  type: cell.type,
                  value: cell.value
                });
              });
            } else {
              values.forEach((rowValues, rowIdx) => {
                if (Array.isArray(rowValues)) {
                  rowValues.forEach((value, colIdx) => {
                    const row = startAddr.row + rowIdx;
                    const col = startAddr.col + colIdx;
                    const address = toAddress(row, col);
                    const cell = cellFromValue(value);
                    operations.push({
                      address,
                      type: cell.type,
                      value: cell.value
                    });
                  });
                }
              });
            }
          }
          break;
        }
        
        case 'setRange': {
          if (action.cells) {
            Object.entries(action.cells).forEach(([address, value]) => {
              const cell = cellFromValue(value);
              operations.push({
                address,
                type: cell.type,
                value: cell.value
              });
            });
          } else if (action.range && action.values) {
            const { start, end } = action.range;
            const startAddr = parseAddress(start);
            
            if (!startAddr) {
              operations.push({
                address: 'ERROR',
                type: 'error',
                value: `Invalid start address: ${start}`
              });
              return;
            }
            
            action.values.forEach((rowValues, rowIdx) => {
              if (Array.isArray(rowValues)) {
                rowValues.forEach((value, colIdx) => {
                  const row = startAddr.row + rowIdx;
                  const col = startAddr.col + colIdx;
                  const address = toAddress(row, col);
                  
                  if (typeof value === 'string' && value.startsWith('=')) {
                    operations.push({
                      address,
                      type: 'formula',
                      value
                    });
                  } else {
                    const cell = cellFromValue(value);
                    operations.push({
                      address,
                      type: cell.type,
                      value: cell.value
                    });
                  }
                });
              }
            });
          }
          break;
        }
        
        case 'clearRange': {
          if (action.range) {
            const { start, end } = action.range;
            const startAddr = parseAddress(start);
            const endAddr = parseAddress(end);
            
            if (startAddr && endAddr) {
              for (let row = startAddr.row; row <= endAddr.row; row++) {
                for (let col = startAddr.col; col <= endAddr.col; col++) {
                  operations.push({
                    address: toAddress(row, col),
                    type: 'empty',
                    value: null
                  });
                }
              }
            }
          }
          break;
        }
        
        case 'addSheet': {
          operations.push({
            address: 'SHEET',
            type: 'metadata',
            value: `Create sheet: ${action.sheetName || action.name}`
          });
          break;
        }
        
        case 'setStyle': {
          operations.push({
            address: action.cell || action.range?.start,
            type: 'style',
            value: JSON.stringify(action.style)
          });
          break;
        }
      }
    } catch (error) {
      console.error(`Error processing action ${action.type}:`, error);
      operations.push({
        address: 'ERROR',
        type: 'error',
        value: error.message
      });
    }
  });
  
  return operations;
}

// ============================================================================
// DATA GENERATORS
// ============================================================================

export const DataGenerators = {
  /**
   * Generate random names
   */
  names: (count = 10) => {
    const firstNames = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Karen', 'Leo', 'Mary', 'Nathan', 'Olivia', 'Peter', 'Quinn', 'Rachel', 'Sam', 'Tina'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    return Array(count).fill(null).map(() => {
      const first = firstNames[Math.floor(Math.random() * firstNames.length)];
      const last = lastNames[Math.floor(Math.random() * lastNames.length)];
      return `${first} ${last}`;
    });
  },
  
  /**
   * Generate random numbers in range
   */
  numbers: (count = 10, min = 0, max = 100) => {
    return Array(count).fill(null).map(() => 
      Math.floor(Math.random() * (max - min + 1)) + min
    );
  },
  
  /**
   * Generate random dates
   */
  dates: (count = 10, startDate = '2024-01-01') => {
    const start = new Date(startDate);
    return Array(count).fill(null).map((_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date.toISOString().split('T')[0];
    });
  },
  
  /**
   * Generate employee data
   */
  employees: (count = 10) => {
    const departments = ['Sales', 'Engineering', 'HR', 'Marketing', 'Finance'];
    const names = DataGenerators.names(count);
    const salaries = DataGenerators.numbers(count, 40000, 120000);
    const ages = DataGenerators.numbers(count, 22, 65);
    
    return names.map((name, i) => ({
      name,
      age: ages[i],
      department: departments[i % departments.length],
      salary: salaries[i]
    }));
  },
  
  /**
   * Generate product data
   */
  products: (count = 5) => {
    const products = ['Laptop', 'Mouse', 'Keyboard', 'Monitor', 'Webcam', 'Headset', 'Speaker', 'Microphone', 'Tablet', 'Phone'];
    const prices = DataGenerators.numbers(count, 10, 2000);
    const quantities = DataGenerators.numbers(count, 1, 100);
    
    return Array(count).fill(null).map((_, i) => ({
      name: products[i % products.length],
      quantity: quantities[i],
      price: prices[i],
      total: quantities[i] * prices[i]
    }));
  },
  
  /**
   * Generate budget categories
   */
  budgetCategories: () => {
    return [
      { category: 'Rent', budgeted: 1500, actual: 1500 },
      { category: 'Groceries', budgeted: 600, actual: 550 },
      { category: 'Utilities', budgeted: 200, actual: 215 },
      { category: 'Transport', budgeted: 300, actual: 280 },
      { category: 'Entertainment', budgeted: 200, actual: 250 }
    ];
  },
  
  /**
   * Generate sales data
   */
  salesData: (count = 4) => {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const products = DataGenerators.products(count);
    
    return products.map(product => ({
      product: product.name,
      ...Object.fromEntries(quarters.map(q => [q, Math.floor(Math.random() * 50000) + 10000]))
    }));
  }
};

// ============================================================================
// MOCK AI RESPONSES
// ============================================================================

export const MockResponses = {
  fillRange: (start, end, values) => {
    return `<actions>[{"type":"fillRange","target":{"start":"${start}","end":"${end}"},"values":${JSON.stringify(values)}}]</actions>`;
  },
  
  setRange: (start, end, values) => {
    return `<actions>[{"type":"setRange","range":{"start":"${start}","end":"${end}"},"values":${JSON.stringify(values)}}]</actions>`;
  },
  
  setCellValue: (cell, value) => {
    return `<actions>[{"type":"setCellValue","cell":"${cell}","value":${JSON.stringify(value)}}]</actions>`;
  },
  
  setCellFormula: (cell, formula) => {
    return `<actions>[{"type":"setCellFormula","cell":"${cell}","formula":"${formula}"}]</actions>`;
  },
  
  addSheet: (sheetName) => {
    return `<actions>[{"type":"addSheet","sheetName":"${sheetName}"}]</actions>`;
  },
  
  setStyle: (cell, style) => {
    return `<actions>[{"type":"setStyle","cell":"${cell}","style":${JSON.stringify(style)}}]</actions>`;
  },
  
  clearRange: (start, end) => {
    return `<actions>[{"type":"clearRange","range":{"start":"${start}","end":"${end}"}}]</actions>`;
  }
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const Validators = {
  /**
   * Validate operation count
   */
  operationCount: (operations, expected) => {
    return operations.length === expected;
  },
  
  /**
   * Validate operation types distribution
   */
  operationTypes: (operations, expectedTypes) => {
    const actualTypes = {};
    operations.forEach(op => {
      actualTypes[op.type] = (actualTypes[op.type] || 0) + 1;
    });
    
    return Object.entries(expectedTypes).every(([type, count]) => 
      actualTypes[type] === count
    );
  },
  
  /**
   * Validate address range
   */
  addressRange: (operations, startAddr, endAddr) => {
    const addresses = operations.map(op => op.address);
    return addresses.includes(startAddr) && addresses.includes(endAddr);
  },
  
  /**
   * Validate formulas present
   */
  hasFormulas: (operations) => {
    return operations.some(op => op.type === 'formula');
  },
  
  /**
   * Validate no errors
   */
  noErrors: (operations) => {
    return !operations.some(op => op.type === 'error');
  },
  
  /**
   * Validate specific cell value
   */
  cellValue: (operations, address, expectedValue) => {
    const op = operations.find(op => op.address === address);
    return op && op.value === expectedValue;
  }
};

// ============================================================================
// PERFORMANCE MEASUREMENT
// ============================================================================

export class PerformanceTimer {
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.measurements = [];
  }
  
  start() {
    this.startTime = performance.now();
  }
  
  stop() {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    this.measurements.push(duration);
    return duration;
  }
  
  getAverage() {
    if (this.measurements.length === 0) return 0;
    const sum = this.measurements.reduce((a, b) => a + b, 0);
    return sum / this.measurements.length;
  }
  
  getStats() {
    if (this.measurements.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, total: 0 };
    }
    
    return {
      count: this.measurements.length,
      min: Math.min(...this.measurements),
      max: Math.max(...this.measurements),
      avg: this.getAverage(),
      total: this.measurements.reduce((a, b) => a + b, 0)
    };
  }
  
  report() {
    const stats = this.getStats();
    console.log(`\n--- Performance Report: ${this.name} ---`);
    console.log(`Measurements: ${stats.count}`);
    console.log(`Min: ${stats.min.toFixed(2)}ms`);
    console.log(`Max: ${stats.max.toFixed(2)}ms`);
    console.log(`Avg: ${stats.avg.toFixed(2)}ms`);
    console.log(`Total: ${stats.total.toFixed(2)}ms`);
  }
}

export function measureAsync(name, fn) {
  return async (...args) => {
    const timer = new PerformanceTimer(name);
    timer.start();
    const result = await fn(...args);
    const duration = timer.stop();
    console.log(`${name}: ${duration.toFixed(2)}ms`);
    return result;
  };
}

// ============================================================================
// TEST SCENARIO BUILDER
// ============================================================================

export class TestScenarioBuilder {
  constructor(name) {
    this.scenario = {
      name,
      prompts: [],
      responses: [],
      validations: []
    };
  }
  
  addStep(prompt, response, validation) {
    this.scenario.prompts.push(prompt);
    this.scenario.responses.push(response);
    this.scenario.validations.push(validation);
    return this;
  }
  
  addFillRange(prompt, start, end, values, validation) {
    const response = MockResponses.fillRange(start, end, values);
    return this.addStep(prompt, response, validation);
  }
  
  addSetRange(prompt, start, end, values, validation) {
    const response = MockResponses.setRange(start, end, values);
    return this.addStep(prompt, response, validation);
  }
  
  addFormula(prompt, cell, formula, validation) {
    const response = MockResponses.setCellFormula(cell, formula);
    return this.addStep(prompt, response, validation);
  }
  
  build() {
    return this.scenario;
  }
}

// ============================================================================
// WORKBOOK STATE SIMULATOR
// ============================================================================

export class WorkbookStateSimulator {
  constructor() {
    this.cells = new Map();
    this.sheets = ['Sheet1'];
    this.activeSheet = 'Sheet1';
  }
  
  applyOperations(operations) {
    operations.forEach(op => {
      if (op.type === 'metadata') {
        // Handle sheet operations
        const match = op.value.match(/Create sheet: (.+)/);
        if (match) {
          this.sheets.push(match[1]);
        }
      } else if (op.address && op.address !== 'ERROR' && op.address !== 'SHEET') {
        const key = `${this.activeSheet}!${op.address}`;
        if (op.type === 'empty') {
          this.cells.delete(key);
        } else {
          this.cells.set(key, { type: op.type, value: op.value });
        }
      }
    });
  }
  
  getCellValue(address, sheet = null) {
    const key = `${sheet || this.activeSheet}!${address}`;
    const cell = this.cells.get(key);
    return cell ? cell.value : null;
  }
  
  getCellType(address, sheet = null) {
    const key = `${sheet || this.activeSheet}!${address}`;
    const cell = this.cells.get(key);
    return cell ? cell.type : 'empty';
  }
  
  getRange(startAddr, endAddr, sheet = null) {
    const start = parseAddress(startAddr);
    const end = parseAddress(endAddr);
    const values = [];
    
    for (let row = start.row; row <= end.row; row++) {
      const rowValues = [];
      for (let col = start.col; col <= end.col; col++) {
        const addr = toAddress(row, col);
        rowValues.push(this.getCellValue(addr, sheet));
      }
      values.push(rowValues);
    }
    
    return values;
  }
  
  getStats() {
    return {
      sheets: this.sheets.length,
      cells: this.cells.size,
      types: this.getTypeDistribution()
    };
  }
  
  getTypeDistribution() {
    const types = {};
    this.cells.forEach(cell => {
      types[cell.type] = (types[cell.type] || 0) + 1;
    });
    return types;
  }
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  // Helpers
  extractActionsFromReply,
  parseAddress,
  toAddress,
  columnLetterToNumber,
  cellFromValue,
  convertToWorkbookActions,
  
  // Generators
  DataGenerators,
  
  // Mocks
  MockResponses,
  
  // Validators
  Validators,
  
  // Performance
  PerformanceTimer,
  measureAsync,
  
  // Builders
  TestScenarioBuilder,
  WorkbookStateSimulator
};
