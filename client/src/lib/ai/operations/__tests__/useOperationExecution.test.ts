import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOperationExecution } from '../useOperationExecution';
import type { WorkbookJSON } from '../../../workbook/types';
import { createWorkbook } from '../../../workbook/utils';

// Mock the dependencies
vi.mock('../operation-generator', () => ({
  generateWorkbookOperations: vi.fn(),
}));

vi.mock('../executor', () => ({
  WorkbookOperationExecutor: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock('../../workbookContext', () => ({
  extractWorkbookContext: vi.fn().mockResolvedValue({
    totalSheets: 1,
    activeSheet: 'Sheet1',
    sheets: [],
    totalFormulas: 0,
    namedRanges: [],
    potentialErrors: [],
  }),
}));

import { generateWorkbookOperations } from '../operation-generator';
import { WorkbookOperationExecutor } from '../executor';

describe('useOperationExecution', () => {
  let mockWorkbook: WorkbookJSON;
  let mockSetWorkbook: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkbook = createWorkbook('Test Workbook');
    mockSetWorkbook = vi.fn();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook)
    );

    expect(result.current.isExecuting).toBe(false);
    expect(result.current.lastResult).toBeNull();
    expect(typeof result.current.executeFromPrompt).toBe('function');
    expect(typeof result.current.clearLastResult).toBe('function');
  });

  it('should execute operations from prompt successfully', async () => {
    // Mock successful generation
    (generateWorkbookOperations as any).mockResolvedValue({
      success: true,
      operations: [
        {
          type: 'setCells',
          params: {
            sheet: 'Sheet1',
            cells: {
              A1: { value: 'Hello', dataType: 'string' },
            },
          },
        },
      ],
      explanation: 'Set cell A1 to "Hello"',
      confidence: 0.95,
      errors: [],
      warnings: [],
    });

    // Mock successful execution
    const mockExecute = vi.fn().mockResolvedValue({
      success: true,
      workbook: { ...mockWorkbook, sheets: [{ ...mockWorkbook.sheets[0], cells: { A1: { value: 'Hello' } } }] },
      successCount: 1,
      errors: [],
      warnings: [],
    });

    (WorkbookOperationExecutor as any).mockImplementation(() => ({
      execute: mockExecute,
    }));

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook, { mode: 'act' })
    );

    const executionResult = await result.current.executeFromPrompt('Set A1 to Hello');

    await waitFor(() => {
      expect(executionResult.success).toBe(true);
    });

    expect(executionResult.explanation).toBe('Set cell A1 to "Hello"');
    expect(executionResult.confidence).toBe(0.95);
    expect(executionResult.operationCount).toBe(1);
    expect(mockSetWorkbook).toHaveBeenCalled();
  });

  it('should handle generation errors', async () => {
    (generateWorkbookOperations as any).mockResolvedValue({
      success: false,
      operations: [],
      explanation: '',
      confidence: 0,
      errors: [{ code: 'API_ERROR', message: 'API key not configured' }],
      warnings: [],
    });

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook)
    );

    const executionResult = await result.current.executeFromPrompt('Test prompt');

    await waitFor(() => {
      expect(executionResult.success).toBe(false);
    });

    expect(executionResult.errors).toContain('API key not configured');
    expect(mockSetWorkbook).not.toHaveBeenCalled();
  });

  it('should block execution in plan mode', async () => {
    (generateWorkbookOperations as any).mockResolvedValue({
      success: true,
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
      explanation: 'Plan to set A1',
      confidence: 0.9,
      errors: [],
      warnings: [],
    });

    const mockExecute = vi.fn().mockResolvedValue({
      success: false,
      workbook: null,
      successCount: 0,
      errors: [{ code: 'PLAN_MODE_BLOCKED', message: 'Operations blocked in plan mode' }],
      warnings: [],
    });

    (WorkbookOperationExecutor as any).mockImplementation(() => ({
      execute: mockExecute,
    }));

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook, { mode: 'plan' })
    );

    const executionResult = await result.current.executeFromPrompt('Set A1 to Test');

    await waitFor(() => {
      expect(executionResult.success).toBe(false);
    });

    expect(executionResult.errors).toContain('Operations blocked - switch to Act mode to execute');
    expect(mockSetWorkbook).not.toHaveBeenCalled();
  });

  it('should set isExecuting state during execution', async () => {
    let resolveGeneration: any;
    const generationPromise = new Promise((resolve) => {
      resolveGeneration = resolve;
    });

    (generateWorkbookOperations as any).mockReturnValue(generationPromise);

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook)
    );

    // Start execution
    const executionPromise = result.current.executeFromPrompt('Test');

    // Check that isExecuting is true
    await waitFor(() => {
      expect(result.current.isExecuting).toBe(true);
    });

    // Resolve the generation
    resolveGeneration({
      success: true,
      operations: [],
      explanation: 'Done',
      confidence: 1,
      errors: [],
      warnings: [],
    });

    await executionPromise;

    // Check that isExecuting is false after completion
    await waitFor(() => {
      expect(result.current.isExecuting).toBe(false);
    });
  });

  it('should store last execution result', async () => {
    (generateWorkbookOperations as any).mockResolvedValue({
      success: true,
      operations: [],
      explanation: 'Test explanation',
      confidence: 0.8,
      errors: [],
      warnings: ['Test warning'],
    });

    const mockExecute = vi.fn().mockResolvedValue({
      success: true,
      workbook: mockWorkbook,
      successCount: 0,
      errors: [],
      warnings: [],
    });

    (WorkbookOperationExecutor as any).mockImplementation(() => ({
      execute: mockExecute,
    }));

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook)
    );

    await result.current.executeFromPrompt('Test');

    await waitFor(() => {
      expect(result.current.lastResult).not.toBeNull();
    });

    expect(result.current.lastResult?.explanation).toBe('Test explanation');
    expect(result.current.lastResult?.confidence).toBe(0.8);
    expect(result.current.lastResult?.warnings).toContain('Test warning');
  });

  it('should clear last result', async () => {
    (generateWorkbookOperations as any).mockResolvedValue({
      success: true,
      operations: [],
      explanation: 'Test',
      confidence: 1,
      errors: [],
      warnings: [],
    });

    const mockExecute = vi.fn().mockResolvedValue({
      success: true,
      workbook: mockWorkbook,
      successCount: 0,
      errors: [],
      warnings: [],
    });

    (WorkbookOperationExecutor as any).mockImplementation(() => ({
      execute: mockExecute,
    }));

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook)
    );

    await result.current.executeFromPrompt('Test');

    await waitFor(() => {
      expect(result.current.lastResult).not.toBeNull();
    });

    result.current.clearLastResult();

    await waitFor(() => {
      expect(result.current.lastResult).toBeNull();
    });
  });

  it('should handle unexpected errors gracefully', async () => {
    (generateWorkbookOperations as any).mockRejectedValue(new Error('Unexpected error'));

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook)
    );

    const executionResult = await result.current.executeFromPrompt('Test');

    await waitFor(() => {
      expect(executionResult.success).toBe(false);
    });

    expect(executionResult.errors).toContain('Unexpected error');
    expect(result.current.isExecuting).toBe(false);
  });

  it('should pass conversation history to generator', async () => {
    const mockHistory = [
      { id: '1', role: 'user', content: 'Previous message', timestamp: new Date() },
    ];

    (generateWorkbookOperations as any).mockResolvedValue({
      success: true,
      operations: [],
      explanation: 'Done',
      confidence: 1,
      errors: [],
      warnings: [],
    });

    const mockExecute = vi.fn().mockResolvedValue({
      success: true,
      workbook: mockWorkbook,
      successCount: 0,
      errors: [],
      warnings: [],
    });

    (WorkbookOperationExecutor as any).mockImplementation(() => ({
      execute: mockExecute,
    }));

    const { result } = renderHook(() =>
      useOperationExecution(mockWorkbook, mockSetWorkbook, {
        conversationHistory: mockHistory,
      })
    );

    await result.current.executeFromPrompt('Test');

    expect(generateWorkbookOperations).toHaveBeenCalledWith(
      'Test',
      expect.anything(),
      mockHistory,
      expect.anything()
    );
  });
});
