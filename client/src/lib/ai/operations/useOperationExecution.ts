/**
 * useOperationExecution Hook
 * 
 * React hook that integrates AI operation generation with workbook execution.
 * Provides a clean interface for ChatInterface to execute AI-generated operations.
 * 
 * Workflow:
 * 1. User sends message in chat
 * 2. Generate operations from prompt using generateWorkbookOperations()
 * 3. Execute operations using WorkbookOperationExecutor
 * 4. Update workbook state
 * 5. Return result to chat for display
 * 
 * Usage:
 * ```typescript
 * const { executeFromPrompt, isExecuting } = useOperationExecution(workbook, setWorkbook);
 * 
 * const handleSendMessage = async (prompt: string) => {
 *   const result = await executeFromPrompt(prompt);
 *   if (result.success) {
 *     addMessage({ role: 'assistant', content: result.explanation });
 *   }
 * };
 * ```
 */

import { useState, useCallback } from 'react';
import { generateWorkbookOperations, type GenerationResult } from './operation-generator';
import { WorkbookOperationExecutor, type ExecutorOptions } from './executor';
import { extractWorkbookContext } from '../workbookContext';
import type { WorkbookJSON } from '../../workbook/types';
import type { Message } from '../../types';

/**
 * Result from operation execution
 */
export interface ExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** AI's explanation of what was done */
  explanation: string;
  /** Updated workbook (null if execution failed) */
  workbook: WorkbookJSON | null;
  /** Number of operations executed */
  operationCount: number;
  /** Errors encountered */
  errors: string[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
  /** Execution time in milliseconds */
  executionTime: number;
  /** Confidence score from AI (0-1) */
  confidence: number;
}

/**
 * Hook options
 */
export interface UseOperationExecutionOptions {
  /** Current chat mode ('plan' or 'act') */
  mode?: 'plan' | 'act';
  /** Active sheet ID for context */
  activeSheetId?: string;
  /** Conversation history for AI context */
  conversationHistory?: Message[];
  /** Enable debug logging */
  debug?: boolean;
  /** Stop execution on first error */
  stopOnError?: boolean;
}

/**
 * React hook for executing AI operations on workbooks
 * 
 * @param workbook - Current workbook state
 * @param setWorkbook - Function to update workbook state
 * @param options - Hook options
 * @returns Execution functions and state
 */
export function useOperationExecution(
  workbook: WorkbookJSON,
  setWorkbook: (workbook: WorkbookJSON) => void,
  options: UseOperationExecutionOptions = {}
) {
  const {
    mode = 'act',
    activeSheetId,
    conversationHistory = [],
    debug = false,
    stopOnError = false,
  } = options;

  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);

  /**
   * Execute operations from a user prompt
   * 
   * Full workflow:
   * 1. Extract workbook context
   * 2. Generate operations from prompt via AI
   * 3. Execute operations on workbook
   * 4. Update workbook state
   * 5. Return result
   */
  const executeFromPrompt = useCallback(async (
    prompt: string
  ): Promise<ExecutionResult> => {
    const startTime = Date.now();
    setIsExecuting(true);

    try {
      if (debug) {
        console.log('[useOperationExecution] Starting execution for prompt:', prompt);
        console.log('[useOperationExecution] Mode:', mode);
        console.log('[useOperationExecution] Current workbook:', workbook);
      }

      // Step 1: Extract workbook context for AI
      let context;
      try {
        context = await extractWorkbookContext(workbook, activeSheetId);
        if (debug) {
          console.log('[useOperationExecution] Workbook context:', context);
        }
      } catch (error) {
        console.warn('[useOperationExecution] Failed to extract workbook context:', error);
        // Continue without context - AI can still generate operations
      }

      // Step 2: Generate operations from prompt
      if (debug) {
        console.log('[useOperationExecution] Generating operations from AI...');
      }

      const generationResult: GenerationResult = await generateWorkbookOperations(
        prompt,
        context,
        conversationHistory,
        { debug }
      );

      if (!generationResult.success) {
        const executionTime = Date.now() - startTime;
        const result: ExecutionResult = {
          success: false,
          explanation: 'Failed to generate operations from your request.',
          workbook: null,
          operationCount: 0,
          errors: generationResult.errors.map(e => e.message),
          warnings: generationResult.warnings,
          executionTime,
          confidence: 0,
        };
        setLastResult(result);
        return result;
      }

      if (debug) {
        console.log('[useOperationExecution] Generated operations:', generationResult.operations);
        console.log('[useOperationExecution] AI explanation:', generationResult.explanation);
        console.log('[useOperationExecution] Confidence:', generationResult.confidence);
      }

      // Step 3: Execute operations on workbook
      const executor = new WorkbookOperationExecutor();
      
      const executorOptions: ExecutorOptions = {
        stopOnError,
        cloneWorkbook: false, // We'll handle state immutability ourselves
        debug,
        mode, // Pass mode to executor (blocks execution in 'plan' mode)
      };

      if (debug) {
        console.log('[useOperationExecution] Executing operations...');
      }

      const executionResult = await executor.execute(
        generationResult.operations,
        workbook,
        executorOptions
      );

      if (debug) {
        console.log('[useOperationExecution] Execution result:', executionResult);
      }

      // Step 4: Check for plan mode blocking
      if (mode === 'plan') {
        const executionTime = Date.now() - startTime;
        const result: ExecutionResult = {
          success: false,
          explanation: generationResult.explanation + '\n\n⚠️ Operations are ready but not executed (plan mode active).',
          workbook: null,
          operationCount: generationResult.operations.length,
          errors: ['Operations blocked - switch to Act mode to execute'],
          warnings: generationResult.warnings,
          executionTime,
          confidence: generationResult.confidence,
        };
        setLastResult(result);
        return result;
      }

      // Step 5: Update workbook state if execution succeeded
      if (executionResult.success && executionResult.workbook) {
        if (debug) {
          console.log('[useOperationExecution] Updating workbook state');
        }
        setWorkbook(executionResult.workbook);
      }

      // Step 6: Build final result
      const executionTime = Date.now() - startTime;
      const result: ExecutionResult = {
        success: executionResult.success,
        explanation: generationResult.explanation,
        workbook: executionResult.workbook,
        operationCount: executionResult.successCount,
        errors: executionResult.errors.map(e => e.message),
        warnings: [
          ...generationResult.warnings,
          ...executionResult.warnings,
        ],
        executionTime,
        confidence: generationResult.confidence,
      };

      setLastResult(result);

      if (debug) {
        console.log('[useOperationExecution] Final result:', result);
      }

      return result;

    } catch (error: any) {
      console.error('[useOperationExecution] Unexpected error:', error);
      
      const executionTime = Date.now() - startTime;
      const result: ExecutionResult = {
        success: false,
        explanation: 'An unexpected error occurred while processing your request.',
        workbook: null,
        operationCount: 0,
        errors: [error.message || 'Unknown error'],
        warnings: [],
        executionTime,
        confidence: 0,
      };

      setLastResult(result);
      return result;

    } finally {
      setIsExecuting(false);
    }
  }, [workbook, setWorkbook, mode, activeSheetId, conversationHistory, debug, stopOnError]);

  /**
   * Clear last execution result
   */
  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    /** Execute operations from a user prompt */
    executeFromPrompt,
    /** Whether execution is in progress */
    isExecuting,
    /** Last execution result (null if no execution yet) */
    lastResult,
    /** Clear last execution result */
    clearLastResult,
  };
}
