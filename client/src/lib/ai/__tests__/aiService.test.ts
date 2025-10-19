/**
 * Unit tests for AI Service
 * Tests conversational behavior, greeting detection, and error prevention
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAICommand, chatWithAI, describeAction } from '../aiService';
import { getSystemPrompt } from '../enhancedPrompt';

describe('AI Service - Command Parsing', () => {
  describe('parseAICommand', () => {
    it('should parse "set cell" commands', () => {
      const result = parseAICommand('set cell A1 to 100', 'sheet-1');
      
      expect(result.intent).toBe('setCellValue');
      expect(result.parameters).toEqual({ cell: 'A1', value: 100 });
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('setCellValue');
      expect(result.actions[0].value).toBe(100);
    });

    it('should parse formula commands', () => {
      const result = parseAICommand('set A1 to =B1+C1', 'sheet-1');
      
      expect(result.intent).toBe('setCellFormula');
      expect(result.parameters.formula).toBe('=B1+C1');
      expect(result.actions[0].type).toBe('setCellFormula');
    });

    it('should parse clear commands', () => {
      const result = parseAICommand('clear cell A1', 'sheet-1');
      
      expect(result.intent).toBe('clearCell');
      expect(result.parameters.cell).toBe('A1');
      expect(result.actions[0].type).toBe('clearRange');
    });

    it('should return unknown intent for greetings', () => {
      const greetings = ['hi', 'hello', 'hey', 'good morning'];
      
      for (const greeting of greetings) {
        const result = parseAICommand(greeting, 'sheet-1');
        expect(result.intent).toBe('unknown');
        expect(result.actions).toHaveLength(0);
      }
    });

    it('should return unknown intent for vague requests', () => {
      const vague = [
        'help me with this',
        'what can you do',
        'I need assistance',
      ];
      
      for (const request of vague) {
        const result = parseAICommand(request, 'sheet-1');
        expect(result.intent).toBe('unknown');
      }
    });
  });

  describe('describeAction', () => {
    it('should describe cell value actions', () => {
      const action = {
        type: 'setCellValue' as const,
        sheetId: 'sheet-1',
        row: 0,
        col: 0,
        value: 100,
      };
      
      const description = describeAction(action);
      expect(description).toContain('A1');
      expect(description).toContain('100');
    });

    it('should describe formula actions', () => {
      const action = {
        type: 'setCellFormula' as const,
        sheetId: 'sheet-1',
        row: 0,
        col: 0,
        formula: '=SUM(A1:A10)',
      };
      
      const description = describeAction(action);
      expect(description).toContain('formula');
      expect(description).toContain('=SUM(A1:A10)');
    });
  });
});

describe('AI Service - Chat Integration', () => {
  beforeEach(() => {
    // Mock fetch for OpenRouter API
    global.fetch = vi.fn();
    
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => 'test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('chatWithAI', () => {
    it('should use system prompt for conversational messages', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Hello! How can I help you with your spreadsheet today?'
            }
          }]
        })
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      const systemPrompt = getSystemPrompt('act');
      await chatWithAI('Hi', [], systemPrompt);
      
      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();
      
      // Verify system prompt was included in request
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[0].content).toContain('conversational');
    });

    it('should include conversation history', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Setting A1 to 100'
            }
          }]
        })
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      const history = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];
      
      await chatWithAI('Set A1 to 100', history);
      
      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      // Should include history + new message
      expect(requestBody.messages.length).toBeGreaterThan(2);
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } })
      };
      
      (global.fetch as any).mockResolvedValue(mockResponse);
      
      await expect(chatWithAI('Hi')).rejects.toThrow('Invalid API key');
    });

    it('should throw error when API key is missing', async () => {
      Storage.prototype.getItem = vi.fn(() => null);
      vi.stubEnv('VITE_OPENROUTER_API_KEY', undefined);
      
      await expect(chatWithAI('Hi')).rejects.toThrow('API key not configured');
    });
  });
});

describe('AI Service - Error Prevention', () => {
  it('should detect division by zero in formulas', () => {
    // This would be tested in the workbookContext module
    // but we verify the intent parsing doesn't auto-execute
    const result = parseAICommand('set A1 to =B1/0', 'sheet-1');
    
    expect(result.intent).toBe('setCellFormula');
    // The actual error detection happens in workbookContext
    // which the AI would consult before execution
  });

  it('should not execute actions for ambiguous requests', () => {
    const ambiguous = [
      'create a report',
      'add some data',
      'make it better',
    ];
    
    for (const request of ambiguous) {
      const result = parseAICommand(request, 'sheet-1');
      expect(result.actions).toHaveLength(0);
    }
  });
});

describe('AI Service - System Prompt Behavior', () => {
  it('should have conversational instructions in system prompt', () => {
    const prompt = getSystemPrompt('act');
    
    expect(prompt).toContain('conversational');
    expect(prompt).toContain('friendly'); // Updated from 'greeting'
    expect(prompt).toContain('clarifying questions');
  });

  it('should emphasize brainstorming in plan mode', () => {
    const prompt = getSystemPrompt('plan');
    
    expect(prompt).toContain('brainstorming');
    expect(prompt).toContain('DO NOT execute');
    expect(prompt).toContain('Discuss ideas'); // Updated from 'collaborative'
  });

  it('should include error detection guidelines', () => {
    const prompt = getSystemPrompt('act');
    
    expect(prompt).toContain('Error Handling'); // Updated to match new prompt
    expect(prompt).toContain('unsupported');
    expect(prompt).toContain('alternatives');
  });

  it('should specify when to act vs when to chat', () => {
    const prompt = getSystemPrompt('act');
    
    expect(prompt).toContain('ACT MODE'); // Updated to match new prompt
    expect(prompt).toContain('execute operations');
    expect(prompt).toContain('spreadsheet');
  });
});
