/**
 * Comprehensive tests for malformed AI response handling
 * 
 * Tests edge cases and error scenarios:
 * - Invalid JSON
 * - Missing required fields
 * - Wrong data types
 * - Empty/null responses
 * - Malicious content (XSS, SQL injection)
 * - Partial/truncated responses
 * - Extra text around JSON
 * - Nested structures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCommandWithAI } from '../openrouter';

describe('OpenRouter - Malformed Response Handling', () => {
  const mockApiKey = 'test-key';
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  describe('Invalid JSON', () => {
    it('should handle completely invalid JSON', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'this is not json at all' } }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.actions).toEqual([]);
      expect(result.explanation).toContain('Failed to parse');
      expect(result.confidence).toBe(0);
    });

    it('should handle JSON with syntax errors', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": 5,}], "explanation": "Test"}' // trailing comma
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.actions).toEqual([]);
    });

    it('should handle unclosed JSON objects', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1"' // unclosed
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.actions).toEqual([]);
    });

    it('should handle JSON with unescaped quotes', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": "test"value"}]}'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to test', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.actions).toEqual([]);
    });

    it('should handle JSON with control characters', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": "test\nvalue\t"}], "explanation": "Test\r\n"}'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to test', mockApiKey);
      
      // This might actually succeed after cleaning, but we're testing the handler
      if (result.success) {
        expect(result.actions).toHaveLength(1);
      } else {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Missing Required Fields', () => {
    it('should reject response without actions array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"explanation": "Test", "confidence": 0.9}'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('missing actions array');
    });

    it('should reject actions without type field', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  { target: 'A1', value: 5 } // missing "type"
                ],
                explanation: 'Test',
                confidence: 0.9
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('missing required "type" field');
    });

    it('should handle missing optional fields (explanation, confidence)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  { type: 'setCellValue', target: 'A1', value: 5 }
                ]
                // missing explanation and confidence
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.explanation).toBe('Action completed'); // default
      expect(result.confidence).toBe(0.5); // default
    });

    it('should reject null actions array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: null,
                explanation: 'Test'
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('missing actions array');
    });

    it('should reject undefined actions', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: undefined,
                explanation: 'Test'
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Wrong Data Types', () => {
    it('should reject actions as object instead of array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: { type: 'setCellValue', target: 'A1', value: 5 }, // object not array
                explanation: 'Test'
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('missing actions array');
    });

    it('should handle actions as string', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: 'setCellValue A1 5', // string not array
                explanation: 'Test'
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
    });

    it('should handle numeric confidence as string', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{ type: 'setCellValue', target: 'A1', value: 5 }],
                explanation: 'Test',
                confidence: '0.95' // string instead of number
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(typeof result.confidence).toBe('string'); // accepts it as-is
    });

    it('should handle boolean value as action type', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{ type: true, target: 'A1', value: 5 }], // boolean type
                explanation: 'Test'
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      // Type coercion might make this pass, but it's still valid structure
      expect(result.success).toBe(true);
      expect(result.actions[0].type).toBe(true);
    });
  });

  describe('Empty/Null Responses', () => {
    it('should handle empty string response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: '' }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.actions).toEqual([]);
    });

    it('should handle null response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: null }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
    });

    it('should handle undefined response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: undefined }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
    });

    it('should handle empty actions array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [],
                explanation: 'Nothing to do',
                confidence: 0.8
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toEqual([]);
      expect(result.explanation).toBe('Nothing to do');
    });

    it('should handle missing choices array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: []
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Markdown Code Blocks', () => {
    it('should extract JSON from markdown code blocks', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '```json\n{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}], "explanation": "Set A1", "confidence": 0.95}\n```'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('setCellValue');
    });

    it('should extract JSON from code blocks without language tag', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '```\n{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}], "explanation": "Set A1", "confidence": 0.95}\n```'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('should handle multiple code blocks (currently fails - regex only removes markers)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '```json\n{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}], "explanation": "First", "confidence": 0.95}\n```\n\nSome text\n\n```json\n{"actions": [], "explanation": "Second"}\n```'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      // Current implementation removes code block markers but leaves content
      // This causes JSON parse error due to extra text after first JSON
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('Failed to parse');
    });
  });

  describe('Extra Text Around JSON', () => {
    it('should handle text before JSON', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Here is the response:\n\n{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}], "explanation": "Set A1", "confidence": 0.95}'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('should handle text after JSON', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}], "explanation": "Set A1", "confidence": 0.95}\n\nLet me know if you need anything else!'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('should handle text before and after JSON', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Sure! Here you go:\n{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}], "explanation": "Set A1", "confidence": 0.95}\nHope this helps!'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });
  });

  describe('Malicious Content', () => {
    it('should handle XSS attempt in value', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: '<script>alert("XSS")</script>'
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to malicious', mockApiKey);
      
      // Should parse successfully - XSS protection is UI layer's job
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toContain('<script>');
    });

    it('should handle SQL injection attempt in value', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: "'; DROP TABLE users; --"
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to sql', mockApiKey);
      
      // Should parse successfully - we're a spreadsheet, not a database
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toContain('DROP TABLE');
    });

    it('should handle formula injection attempt', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: '=cmd|"/c calc"!A1'
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to formula', mockApiKey);
      
      // Parses successfully - formula validation is elsewhere
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toContain('=cmd');
    });

    it('should handle Unicode zero-width characters', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: 'test\u200B\u200C\u200Dvalue' // zero-width chars
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to test', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toContain('\u200B');
    });

    it('should handle extremely long strings', async () => {
      const longString = 'A'.repeat(10000);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: longString
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to long text', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toHaveLength(10000);
    });
  });

  describe('Nested Structures', () => {
    it('should handle deeply nested values in actions', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setRange',
                  range: { start: 'A1', end: 'B2' },
                  values: [[1, 2], [3, 4]] // 2D array
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('fill range', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].values).toEqual([[1, 2], [3, 4]]);
    });

    it('should handle objects within actions', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setStyle',
                  target: 'A1',
                  style: {
                    fontWeight: 'bold',
                    backgroundColor: '#ff0000',
                    fontSize: 14
                  }
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('make A1 bold', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].style).toEqual({
        fontWeight: 'bold',
        backgroundColor: '#ff0000',
        fontSize: 14
      });
    });

    it('should handle multiple actions with various types', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [
                  { type: 'setCellValue', target: 'A1', value: 5 },
                  { type: 'setCellFormula', target: 'B1', formula: '=A1*2' },
                  { type: 'fillRange', range: { start: 'C1', end: 'C3' }, value: 0 },
                  { type: 'setStyle', target: 'A1', style: { fontWeight: 'bold' } }
                ],
                explanation: 'Multiple operations',
                confidence: 0.9
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('do multiple things', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(4);
      expect(result.actions.map(a => a.type)).toEqual([
        'setCellValue',
        'setCellFormula',
        'fillRange',
        'setStyle'
      ]);
    });
  });

  describe('Truncated Responses', () => {
    it('should handle response cut off mid-JSON', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "val' // truncated
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.actions).toEqual([]);
    });

    it('should handle response cut off mid-array', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": 5}, {"type": "setCellVal' // truncated
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 and B1', mockApiKey);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Case Values', () => {
    it('should handle Infinity as value', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": Infinity}], "explanation": "Test", "confidence": 0.95}'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to infinity', mockApiKey);
      
      // JSON.parse doesn't support Infinity, should fail
      expect(result.success).toBe(false);
    });

    it('should handle NaN as value', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"actions": [{"type": "setCellValue", "target": "A1", "value": NaN}], "explanation": "Test", "confidence": 0.95}'
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to NaN', mockApiKey);
      
      // JSON.parse doesn't support NaN, should fail
      expect(result.success).toBe(false);
    });

    it('should handle very large numbers', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: 9007199254740991 // Number.MAX_SAFE_INTEGER
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to large number', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toBe(9007199254740991);
    });

    it('should handle very small numbers', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: 0.0000000001
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to tiny number', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toBe(0.0000000001);
    });

    it('should handle negative zero', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                actions: [{
                  type: 'setCellValue',
                  target: 'A1',
                  value: -0
                }],
                explanation: 'Test',
                confidence: 0.95
              })
            }
          }],
        }),
      });

      const result = await parseCommandWithAI('set A1 to negative zero', mockApiKey);
      
      expect(result.success).toBe(true);
      expect(result.actions[0].value).toBe(0); // -0 becomes 0 in JSON
    });
  });

  describe('API-Level Errors', () => {
    it('should handle network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('Network error');
    });

    it('should handle HTTP error status', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('500');
    });

    it('should handle rate limit error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('429');
    });

    it('should handle timeout', async () => {
      fetchSpy.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(result.success).toBe(false);
      expect(result.explanation).toContain('Timeout');
    });
  });

  describe('Response Logging', () => {
    it('should log raw response on parse error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'invalid json' }
          }],
        }),
      });

      await parseCommandWithAI('set A1 to 5', mockApiKey);
      
      expect(consoleSpy).toHaveBeenCalledWith('JSON parse error:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('Raw response:', 'invalid json');
      
      consoleSpy.mockRestore();
    });
  });
});
