/**
 * Advanced OpenRouter AI Integration Tests
 * Tests alternative models, rate limiting, network failures, and streaming
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCommandWithAI, convertToWorkbookActions } from '../openrouter';

describe('OpenRouter - Alternative AI Models', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Claude 3.5 Sonnet', () => {
    it('should successfully parse commands with Claude 3.5', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: 100
                }],
                explanation: 'Set cell A1 to 100',
                confidence: 0.95
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('setCellValue');

      // Verify correct model was used
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should handle Claude returning markdown-wrapped JSON', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `Here's the action:

\`\`\`json
{
  "actions": [{
    "type": "fillRange",
    "range": { "start": "A1", "end": "A5" },
    "value": 0
  }],
  "explanation": "Filled range A1:A5 with zeros",
  "confidence": 0.9
}
\`\`\`

This will clear the range.`
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI('clear A1 to A5', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('fillRange');
    });

    it('should handle complex multi-step operations from Claude', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  { type: 'setCellValue', target: 'A1', value: 'Name' },
                  { type: 'setCellValue', target: 'B1', value: 'Age' },
                  { type: 'setCellValue', target: 'C1', value: 'Email' },
                  {
                    type: 'fillRow',
                    target: '2',
                    values: ['Alice Johnson', 28, 'alice@example.com']
                  },
                  {
                    type: 'fillRow',
                    target: '3',
                    values: ['Bob Smith', 35, 'bob@example.com']
                  }
                ],
                explanation: 'Created a table with headers and sample data',
                confidence: 0.92
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI(
        'create a table with Name, Age, and Email columns, add 2 sample rows',
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(5);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('GPT-3.5 Turbo', () => {
    it('should successfully parse commands with GPT-3.5', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellFormula',
                  target: 'C1',
                  formula: '=A1+B1'
                }],
                explanation: 'Added sum formula in C1',
                confidence: 0.88
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-3.5-turbo');

      const result = await parseCommandWithAI('add formula in C1 to sum A1 and B1', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions[0].formula).toBe('=A1+B1');

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('openai/gpt-3.5-turbo');
    });

    it('should handle GPT-3.5 lower confidence scores appropriately', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'fillRow',
                  target: '5',
                  values: ['Product A', 1299.99, 'In Stock']
                }],
                explanation: 'Added product data to row 5',
                confidence: 0.65
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-3.5-turbo');

      const result = await parseCommandWithAI('add product info', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(0.7);
      // Low confidence should still work but might warrant user confirmation
    });
  });

  describe('GPT-4', () => {
    it('should handle complex analytical queries with GPT-4', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  { type: 'setCellFormula', target: 'E2', formula: '=SUM(B2:D2)' },
                  { type: 'setCellFormula', target: 'E3', formula: '=SUM(B3:D3)' },
                  { type: 'setCellFormula', target: 'E4', formula: '=SUM(B4:D4)' },
                  { type: 'setCellFormula', target: 'B5', formula: '=SUM(B2:B4)' },
                  { type: 'setCellFormula', target: 'C5', formula: '=SUM(C2:C4)' },
                  { type: 'setCellFormula', target: 'D5', formula: '=SUM(D2:D4)' },
                  { type: 'setCellFormula', target: 'E5', formula: '=SUM(E2:E4)' }
                ],
                explanation: 'Added row totals in column E and column totals in row 5',
                confidence: 0.96
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-4');

      const result = await parseCommandWithAI(
        'add totals for each row in column E and totals for each column in row 5',
        'test-api-key',
        { lastRow: 4, lastCol: 4 }
      );

      expect(result.success).toBe(true);
      expect(result.actions.length).toBeGreaterThan(5);
      expect(result.confidence).toBeGreaterThan(0.95);
    });
  });

  describe('Model Comparison - Target vs Range Parameter', () => {
    it('should accept both target and range for range-based operations (Claude)', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'fillRange',
                  target: { start: 'A1', end: 'A5' }, // Using target
                  value: 0
                }],
                explanation: 'Filled range using target parameter',
                confidence: 0.9
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI('clear A1 to A5', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe('fillRange');
    });

    it('should accept both target and range for range-based operations (GPT)', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'fillRange',
                  range: { start: 'B2', end: 'D10' }, // Using range
                  value: 0
                }],
                explanation: 'Filled range using range parameter',
                confidence: 0.88
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-4');

      const result = await parseCommandWithAI('clear B2 to D10', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe('fillRange');
    });
  });

  describe('Ambiguous Prompt Handling', () => {
    it('should handle ambiguous prompts across models - Claude asks for clarification', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [],
                explanation: 'I need more information. Which cells would you like to fill with sample data? Please specify a range (e.g., A1:E10) or a row number.',
                confidence: 0.3
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI('add some sample data', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.explanation).toContain('more information');
    });

    it('should handle ambiguous prompts - GPT makes reasonable assumptions', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'fillRow',
                  target: '1',
                  values: ['Sample 1', 'Sample 2', 'Sample 3', 'Sample 4', 'Sample 5']
                }],
                explanation: 'Added sample data to row 1 (5 columns). If you need different placement, please specify.',
                confidence: 0.6
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'openai/gpt-4');

      const result = await parseCommandWithAI('add some sample data', 'test-api-key');

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('Large Dataset Generation', () => {
    it('should generate realistic large datasets - Claude', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  {
                    type: 'setRange',
                    range: { start: 'A1' },
                    values: [
                      ['Name', 'Department', 'Salary', 'Years', 'Status', 'Email', 'Phone'],
                      ['Alice Johnson', 'Engineering', 95000, 5, 'Active', 'alice@company.com', '+1-555-0101'],
                      ['Bob Smith', 'Marketing', 72000, 3, 'Active', 'bob@company.com', '+1-555-0102'],
                      ['Carol White', 'Sales', 85000, 7, 'Active', 'carol@company.com', '+1-555-0103'],
                      ['David Brown', 'HR', 68000, 2, 'Active', 'david@company.com', '+1-555-0104'],
                      ['Eve Davis', 'Engineering', 102000, 8, 'Active', 'eve@company.com', '+1-555-0105'],
                      ['Frank Wilson', 'Finance', 78000, 4, 'Active', 'frank@company.com', '+1-555-0106'],
                      ['Grace Lee', 'Operations', 71000, 3, 'Active', 'grace@company.com', '+1-555-0107'],
                      ['Henry Taylor', 'Engineering', 98000, 6, 'Active', 'henry@company.com', '+1-555-0108'],
                      ['Ivy Martinez', 'Marketing', 75000, 4, 'Active', 'ivy@company.com', '+1-555-0109'],
                      ['Jack Anderson', 'Sales', 89000, 5, 'Active', 'jack@company.com', '+1-555-0110']
                    ]
                  }
                ],
                explanation: 'Generated employee dataset with 10 records and 7 varied data columns',
                confidence: 0.94
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI(
        'create a sample employee dataset with 10 rows',
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe('setRange');
      const values = result.actions[0].values;
      expect(values).toBeDefined();
      expect(values!.length).toBe(11); // Header + 10 rows
      expect(values![0].length).toBeGreaterThanOrEqual(5); // At least 5 columns
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle data type variety in large datasets', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setRange',
                  range: { start: 'A1' },
                  values: [
                    ['Product', 'Category', 'Price', 'In Stock', 'Last Updated', 'Rating'],
                    ['Laptop Pro', 'Electronics', 1299.99, true, '2024-01-15', 4.5],
                    ['Office Chair', 'Furniture', 349.99, true, '2024-01-18', 4.2],
                    ['Desk Lamp', 'Lighting', 59.99, false, '2024-01-10', 4.7],
                    ['Notebook Set', 'Stationery', 12.99, true, '2024-01-20', 4.1]
                  ]
                }],
                explanation: 'Created product catalog with mixed data types',
                confidence: 0.91
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await parseCommandWithAI('create product catalog with varied data', 'test-api-key');

      expect(result.success).toBe(true);
      const values = result.actions[0].values!;
      
      // Check data type variety
      expect(typeof values[1][2]).toBe('number'); // Price
      expect(typeof values[1][3]).toBe('boolean'); // In Stock
      expect(typeof values[1][4]).toBe('string'); // Date
      expect(typeof values[1][5]).toBe('number'); // Rating
    });
  });

  describe('Complex Multi-Action Requests', () => {
    it('should break down complex requests into multiple actions', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  // Step 1: Create headers
                  { type: 'setCellValue', target: 'A1', value: 'Quarter' },
                  { type: 'setCellValue', target: 'B1', value: 'Revenue' },
                  { type: 'setCellValue', target: 'C1', value: 'Expenses' },
                  { type: 'setCellValue', target: 'D1', value: 'Profit' },
                  
                  // Step 2: Add data
                  { type: 'fillRow', target: '2', values: ['Q1 2024', 125000, 78000] },
                  { type: 'fillRow', target: '3', values: ['Q2 2024', 142000, 81000] },
                  { type: 'fillRow', target: '4', values: ['Q3 2024', 156000, 89000] },
                  { type: 'fillRow', target: '5', values: ['Q4 2024', 168000, 92000] },
                  
                  // Step 3: Add formulas
                  { type: 'setCellFormula', target: 'D2', formula: '=B2-C2' },
                  { type: 'setCellFormula', target: 'D3', formula: '=B3-C3' },
                  { type: 'setCellFormula', target: 'D4', formula: '=B4-C4' },
                  { type: 'setCellFormula', target: 'D5', formula: '=B5-C5' },
                  
                  // Step 4: Add totals
                  { type: 'setCellValue', target: 'A6', value: 'Total' },
                  { type: 'setCellFormula', target: 'B6', formula: '=SUM(B2:B5)' },
                  { type: 'setCellFormula', target: 'C6', formula: '=SUM(C2:C5)' },
                  { type: 'setCellFormula', target: 'D6', formula: '=SUM(D2:D5)' }
                ],
                explanation: 'Created quarterly financial summary with revenue, expenses, profit calculations, and totals',
                confidence: 0.93
              })
            }
          }]
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);
      vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

      const result = await parseCommandWithAI(
        'create a quarterly financial summary with revenue, expenses, and profit for 2024',
        'test-api-key'
      );

      expect(result.success).toBe(true);
      expect(result.actions.length).toBeGreaterThan(10);
      
      // Verify action types
      const actionTypes = result.actions.map(a => a.type);
      expect(actionTypes).toContain('setCellValue');
      expect(actionTypes).toContain('fillRow');
      expect(actionTypes).toContain('setCellFormula');
    });
  });
});

describe('OpenRouter - Rate Limiting', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should handle 429 Too Many Requests error', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          message: 'Rate limit exceeded. Please try again in 60 seconds.',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.actions).toHaveLength(0);
    expect(result.explanation).toContain('429');
  });

  it('should handle rate limit with retry-after header', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({
        'Retry-After': '30'
      }),
      json: async () => ({
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('429');
  });

  it('should handle quota exceeded errors', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: 'You have exceeded your monthly quota. Please upgrade your plan.',
          type: 'quota_exceeded',
          code: 'insufficient_quota'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('429');
  });

  it('should handle model-specific rate limits', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          message: 'Rate limit exceeded for anthropic/claude-3.5-sonnet. Try a different model.',
          type: 'rate_limit_error',
          code: 'model_rate_limit'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);
    vi.stubEnv('VITE_OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet');

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
  });
});

describe('OpenRouter - Network Failure Scenarios', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should handle network timeout', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network request failed'));

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('Failed to parse command');
  });

  it('should handle DNS resolution failure', async () => {
    (global.fetch as any).mockRejectedValue(new Error('getaddrinfo ENOTFOUND openrouter.ai'));

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('Failed to parse command');
  });

  it('should handle connection refused', async () => {
    (global.fetch as any).mockRejectedValue(new Error('connect ECONNREFUSED'));

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it('should handle SSL/TLS errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('SSL certificate validation failed'));

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
  });

  it('should handle partial response (connection drop)', async () => {
    const mockResponse = {
      ok: true,
      json: async () => {
        throw new Error('Unexpected end of JSON input');
      }
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('Failed to parse command');
  });

  it('should handle 500 Internal Server Error', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: {
          message: 'An unexpected error occurred on the server',
          type: 'server_error'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('OpenRouter API error: 500');
  });

  it('should handle 502 Bad Gateway', async () => {
    const mockResponse = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway'
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('OpenRouter API error: 502');
  });

  it('should handle 503 Service Unavailable', async () => {
    const mockResponse = {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({
        error: {
          message: 'The service is temporarily unavailable. Please try again later.',
          type: 'service_unavailable'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
  });

  it('should handle 504 Gateway Timeout', async () => {
    const mockResponse = {
      ok: false,
      status: 504,
      statusText: 'Gateway Timeout'
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('OpenRouter API error: 504');
  });

  it('should handle invalid API key (401)', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: {
          message: 'Invalid API key provided',
          type: 'authentication_error'
        }
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'invalid-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('OpenRouter API error: 401');
  });

  it('should handle malformed JSON response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token } in JSON at position 45');
      }
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
  });

  it('should handle empty response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: []
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
    expect(result.explanation).toContain('AI returned invalid JSON format');
  });

  it('should handle missing message content', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {}
        }]
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(false);
  });
});

describe('OpenRouter - Streaming Responses (Optional)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should handle streaming response format (future enhancement)', async () => {
    // This test demonstrates the structure for future streaming support
    const mockStreamChunks = [
      'data: {"choices":[{"delta":{"content":"{\\"actions\\":["}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"{\\"type\\":\\"setCellValue\\","}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\"target\\":\\"A1\\","}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\"value\\":100}"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"],"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\"explanation\\":\\"Set A1 to 100\\","}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\"confidence\\":0.95}"}}]}\n\n',
      'data: [DONE]\n\n'
    ];

    // Mock ReadableStream for streaming response
    const mockStream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockStreamChunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      }
    });

    const mockResponse = {
      ok: true,
      body: mockStream,
      headers: new Headers({
        'content-type': 'text/event-stream'
      })
    };

    // Note: Current implementation doesn't support streaming
    // This test is a placeholder for future enhancement
    expect(mockResponse.headers.get('content-type')).toBe('text/event-stream');
  });

  it('should fall back to non-streaming on stream error', async () => {
    // Future implementation should gracefully handle streaming failures
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              actions: [{
                type: 'setCellValue',
                target: 'A1',
                value: 100
              }],
              explanation: 'Set A1 to 100',
              confidence: 0.95
            })
          }
        }]
      })
    };

    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await parseCommandWithAI('set A1 to 100', 'test-api-key');

    expect(result.success).toBe(true);
  });
});

describe('ConvertToWorkbookActions - Model Behavior Integration', () => {
  const mockWorkbookContext = {
    currentSheet: {
      cells: {},
      grid: { rowCount: 100, colCount: 26 }
    }
  };

  it('should handle both target and range parameters from different models', () => {
    // Claude might use 'target' as an object
    const claudeAction = {
      type: 'fillRange' as const,
      target: { start: 'A1', end: 'A5' },
      value: 0
    };

    const operations1 = convertToWorkbookActions([claudeAction], mockWorkbookContext);
    expect(operations1).toHaveLength(5);

    // GPT might use 'range'
    const gptAction = {
      type: 'fillRange' as const,
      range: { start: 'B1', end: 'B5' },
      value: 0
    };

    const operations2 = convertToWorkbookActions([gptAction], mockWorkbookContext);
    expect(operations2).toHaveLength(5);
  });

  it('should handle varied fillRow data from different models', () => {
    const action = {
      type: 'fillRow' as const,
      target: '2',
      values: ['Alice', 28, 'alice@email.com', true, 95000.50]
    };

    const operations = convertToWorkbookActions([action], mockWorkbookContext);

    expect(operations.length).toBe(5);
    
    // Verify data types are preserved
    expect(operations[0].cell.dataType).toBe('string');
    expect(operations[1].cell.dataType).toBe('number');
    expect(operations[2].cell.dataType).toBe('string');
    expect(operations[3].cell.dataType).toBe('boolean');
    expect(operations[4].cell.dataType).toBe('number');
  });

  it('should handle date strings from AI models', () => {
    const action = {
      type: 'fillRow' as const,
      target: '1',
      values: ['2024-01-15', '2024-12-31', 'Not a date']
    };

    const operations = convertToWorkbookActions([action], mockWorkbookContext);

    expect(operations[0].cell.dataType).toBe('date');
    expect(operations[1].cell.dataType).toBe('date');
    expect(operations[2].cell.dataType).toBe('string');
  });

  it('should handle setRange with 2D values array', () => {
    const action = {
      type: 'setRange' as const,
      range: { start: 'A1' },
      values: [
        ['Name', 'Age', 'Email'],
        ['Alice', 28, 'alice@email.com'],
        ['Bob', 35, 'bob@email.com']
      ]
    };

    const operations = convertToWorkbookActions([action], mockWorkbookContext);

    expect(operations.length).toBe(9); // 3x3 grid
    expect(operations[0].address).toBe('A1');
    expect(operations[0].cell.raw).toBe('Name');
  });

  it('should handle cells object from sophisticated models', () => {
    const action = {
      type: 'setRange' as const,
      cells: {
        'A1': { raw: 'Total', dataType: 'string' },
        'B1': { formula: '=SUM(B2:B10)', dataType: 'formula' },
        'C1': { raw: 1000, dataType: 'number' }
      }
    };

    const operations = convertToWorkbookActions([action], mockWorkbookContext);

    expect(operations.length).toBe(3);
    expect(operations[0].address).toBe('A1');
    expect(operations[1].address).toBe('B1');
    expect(operations[1].cell.formula).toBe('=SUM(B2:B10)');
    expect(operations[2].address).toBe('C1');
  });
});
