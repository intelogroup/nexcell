/**
 * Tests for AI Operation Generator
 * 
 * Focus on:
 * - JSON parsing from AI responses (with various formats)
 * - Operation validation
 * - Error handling and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWorkbookOperations } from './operation-generator';
import type { WorkbookContext } from '../workbookContext';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AI Operation Generator', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Set API key for tests
    localStorage.setItem('openrouter_api_key', 'test-key');
  });

  afterEach(() => {
    localStorage.removeItem('openrouter_api_key');
  });

  describe('JSON Parsing', () => {
    it('should parse clean JSON response', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
        ],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('createWorkbook');
      expect(result.explanation).toBe('Creating workbook');
      expect(result.confidence).toBe(0.9);
    });

    it('should parse JSON wrapped in markdown code blocks', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
        ],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      const markdownWrapped = '```json\n' + JSON.stringify(mockResponse) + '\n```';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: markdownWrapped } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
    });

    it('should parse JSON with leading text', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
        ],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      const withLeadingText = 'Here is the JSON:\n' + JSON.stringify(mockResponse);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: withLeadingText } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
    });

    it('should parse JSON with trailing text', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
        ],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      const withTrailingText = JSON.stringify(mockResponse) + '\n\nLet me know if you need changes!';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: withTrailingText } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
    });

    it('should handle missing operations field', async () => {
      const mockResponse = {
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PARSE_ERROR');
      expect(result.errors[0].message).toContain('missing "operations" field');
    });

    it('should handle non-array operations field', async () => {
      const mockResponse = {
        operations: 'not an array',
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PARSE_ERROR');
      expect(result.errors[0].message).toContain('not an array');
    });

    it('should handle empty operations array', async () => {
      const mockResponse = {
        operations: [],
        explanation: 'No operations needed',
        confidence: 0.5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Do nothing');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PARSE_ERROR');
      expect(result.errors[0].message).toContain('empty');
    });

    it('should handle invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is not JSON at all' } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PARSE_ERROR');
      expect(result.errors[0].message).toContain('Failed to parse');
    });

    it('should clamp confidence to 0-1 range', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
        ],
        explanation: 'Creating workbook',
        confidence: 1.5, // Out of range
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.confidence).toBe(1); // Clamped to 1
    });
  });

  describe('Operation Validation', () => {
    it('should validate createWorkbook operation', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
        ],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about missing createWorkbook name', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: {} }, // Missing name
        ],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Missing \'name\' parameter');
    });

    it('should validate setCells operation', async () => {
      const mockResponse = {
        operations: [
          {
            type: 'setCells',
            params: {
              sheet: 'Sheet1',
              cells: {
                A1: { value: 'Test', dataType: 'string' },
              },
            },
          },
        ],
        explanation: 'Setting cells',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Set cell A1');

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about missing dataType in setCells', async () => {
      const mockResponse = {
        operations: [
          {
            type: 'setCells',
            params: {
              sheet: 'Sheet1',
              cells: {
                A1: { value: 'Test' }, // Missing dataType
              },
            },
          },
        ],
        explanation: 'Setting cells',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Set cell A1');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('missing \'dataType\'');
    });

    it('should validate setFormula operation', async () => {
      const mockResponse = {
        operations: [
          {
            type: 'setFormula',
            params: {
              sheet: 'Sheet1',
              cell: 'B1',
              formula: '=A1*2',
            },
          },
        ],
        explanation: 'Setting formula',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Set formula in B1');

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about formula missing = prefix', async () => {
      const mockResponse = {
        operations: [
          {
            type: 'setFormula',
            params: {
              sheet: 'Sheet1',
              cell: 'B1',
              formula: 'A1*2', // Missing =
            },
          },
        ],
        explanation: 'Setting formula',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Set formula in B1');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('must start with \'=\'');
    });

    it('should validate all operation types', async () => {
      const mockResponse = {
        operations: [
          { type: 'createWorkbook', params: { name: 'Test' } },
          { type: 'addSheet', params: { name: 'Sheet2' } },
          { type: 'removeSheet', params: { sheetId: 'sheet1' } },
          { type: 'setCells', params: { sheet: 'Sheet1', cells: { A1: { value: 1, dataType: 'number' } } } },
          { type: 'setFormula', params: { sheet: 'Sheet1', cell: 'B1', formula: '=A1*2' } },
          { type: 'compute', params: {} },
          { type: 'applyFormat', params: { sheet: 'Sheet1', range: 'A1:B1', format: { bold: true } } },
          { type: 'mergeCells', params: { sheet: 'Sheet1', range: 'A1:B1' } },
          { type: 'defineNamedRange', params: { name: 'Data', range: 'Sheet1!A1:A10' } },
        ],
        explanation: 'Complex operations',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Do everything');

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(9);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about unknown operation type', async () => {
      const mockResponse = {
        operations: [
          { type: 'unknownOperation', params: { data: 'test' } },
        ],
        explanation: 'Unknown operation',
        confidence: 0.5,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Do something unknown');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Unknown operation type');
    });

    it('should warn about missing required params', async () => {
      const mockResponse = {
        operations: [
          { type: 'addSheet', params: {} }, // Missing name
          { type: 'setCells', params: { cells: {} } }, // Missing sheet
          { type: 'setFormula', params: { sheet: 'Sheet1' } }, // Missing cell and formula
        ],
        explanation: 'Invalid operations',
        confidence: 0.3,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Do invalid things');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('API Error Handling', () => {
    it('should handle missing API key', async () => {
      localStorage.removeItem('openrouter_api_key');

      const result = await generateWorkbookOperations('Create a workbook', undefined, [], { apiKey: '' });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_KEY');
    });

    it('should handle API timeout', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 100)
        )
      );

      const result = await generateWorkbookOperations('Create a workbook', undefined, [], { timeout: 50 });

      expect(result.success).toBe(false);
    });

    it('should handle rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('RATE_LIMIT');
    });

    it('should handle general API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('API_ERROR');
    });

    it('should handle empty API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await generateWorkbookOperations('Create a workbook');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('API_ERROR');
      expect(result.errors[0].message).toContain('No response from AI');
    });
  });

  describe('Context Integration', () => {
    it('should include workbook context in request', async () => {
      const context: WorkbookContext = {
        sheets: [{ id: 'sheet1', name: 'Sheet1', rowCount: 100, colCount: 26, cellCount: 10, formulaCount: 2, hasData: true, dataRange: 'A1:B10' }],
        activeSheet: 'sheet1',
        totalSheets: 1,
        formulaCells: [],
        totalFormulas: 2,
        formulaDependencies: [],
        dataStatistics: {
          totalCells: 2600,
          populatedCells: 10,
          emptyCells: 2590,
          formulaCells: 2,
          valueCells: 8,
          errorCells: 0,
          dataTypes: { numbers: 5, strings: 3, booleans: 0, dates: 0, errors: 0 },
        },
        namedRanges: [],
        potentialErrors: [],
        circularReferences: [],
        validationWarnings: [],
      };

      const mockResponse = {
        operations: [{ type: 'addSheet', params: { name: 'Sheet2' } }],
        explanation: 'Adding sheet',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Add a new sheet', context);

      expect(result.success).toBe(true);
      
      // Verify context was included in request
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages.length).toBeGreaterThan(1);
      const contextMessage = requestBody.messages.find((m: any) => m.content.includes('Current workbook context'));
      expect(contextMessage).toBeDefined();
    });

    it('should include conversation history in request', async () => {
      const history = [
        { role: 'user', content: 'Create a workbook' },
        { role: 'assistant', content: 'Created workbook' },
      ];

      const mockResponse = {
        operations: [{ type: 'addSheet', params: { name: 'Sheet2' } }],
        explanation: 'Adding sheet',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Add a sheet', undefined, history);

      expect(result.success).toBe(true);
      
      // Verify history was included
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages.length).toBeGreaterThan(2);
    });
  });

  describe('Debug Mode', () => {
    it('should include rawResponse in debug mode', async () => {
      const mockResponse = {
        operations: [{ type: 'createWorkbook', params: { name: 'Test' } }],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook', undefined, [], { debug: true });

      expect(result.success).toBe(true);
      expect(result.rawResponse).toBeDefined();
    });

    it('should not include rawResponse when debug is false', async () => {
      const mockResponse = {
        operations: [{ type: 'createWorkbook', params: { name: 'Test' } }],
        explanation: 'Creating workbook',
        confidence: 0.9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }],
        }),
      });

      const result = await generateWorkbookOperations('Create a workbook', undefined, [], { debug: false });

      expect(result.success).toBe(true);
      expect(result.rawResponse).toBeUndefined();
    });
  });
});
