import { useState, useMemo, useCallback } from 'react';
import { Header } from './Header';
import { SettingsDialog } from './SettingsDialog';
import { SheetTabs } from './SheetTabs';
import { ChatInterface } from '../chat/ChatInterface';
import { CanvasRenderer } from '../canvas/CanvasRenderer';
import { type Message } from '@/lib/types';
import { 
  useWorkbook,
  workbookToCellArray,
  createCellFromInput,
  toAddress,
} from '@/lib/workbook';
import { safeStringify } from '@/lib/workbook/utils';
import { computeWorkbook } from '@/lib/workbook/hyperformula';
import { EXAMPLE_COMMANDS, chatWithAI } from '@/lib/ai/aiService';
import { convertToWorkbookActions } from '@/lib/ai/openrouter';
import { getSystemPrompt } from '@/lib/ai/enhancedPrompt';
import { extractWorkbookContext, formatContextForAI } from '@/lib/ai/workbookContext';
import extractActionsFromReply from '@/lib/ai/actionExtractor';
import { validateWorkbook, type ValidationResult } from '@/lib/ai/operations/validation';

// Utility for logging AI interactions and effects
function logAIInteraction(event: string, details: any) {
  console.log(`[AI-Workbook] ${event}:`, details);
}

/**
 * Format validation result for AI feedback
 * Creates a concise summary of errors/warnings for the AI to address
 */
function formatValidationForAI(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return '';
  }

  const lines: string[] = ['⚠️ VALIDATION FEEDBACK:'];
  
  if (result.errors.length > 0) {
    lines.push('\nERRORS (Must fix):');
    result.errors.forEach((error, i) => {
      const location = error.sheetName && error.cellAddress 
        ? `${error.sheetName}!${error.cellAddress}` 
        : error.sheetId || 'Unknown';
      lines.push(`${i + 1}. [${error.category}] ${location}: ${error.message}`);
      if (error.suggestion) {
        lines.push(`   💡 Suggestion: ${error.suggestion}`);
      }
    });
  }

  if (result.warnings.length > 0) {
    lines.push('\nWARNINGS (Should address):');
    result.warnings.forEach((warning, i) => {
      const location = warning.sheetName && warning.cellAddress 
        ? `${warning.sheetName}!${warning.cellAddress}` 
        : warning.sheetId || 'Unknown';
      lines.push(`${i + 1}. [${warning.category}] ${location}: ${warning.message}`);
    });
  }

  lines.push('\nPlease fix these issues and try again.');
  
  return lines.join('\n');
}

/**
 * Format validation result for user display
 * Creates a user-friendly summary
 */
function formatValidationForUser(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0 && result.suggestions.length === 0) {
    return '✅ Validation passed! Your workbook looks good.';
  }

  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push(`❌ ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''} found`);
  }
  
  if (result.warnings.length > 0) {
    parts.push(`⚠️ ${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`);
  }
  
  if (result.suggestions.length > 0) {
    parts.push(`💡 ${result.suggestions.length} suggestion${result.suggestions.length !== 1 ? 's' : ''}`);
  }

  const summary = parts.join(', ');
  
  const lines: string[] = [summary];
  
  // Show first few errors with details
  if (result.errors.length > 0) {
    lines.push('\nErrors:');
    result.errors.slice(0, 3).forEach(error => {
      const location = error.sheetName && error.cellAddress 
        ? `${error.sheetName}!${error.cellAddress}` 
        : '';
      lines.push(`• ${location ? location + ': ' : ''}${error.message}`);
    });
    if (result.errors.length > 3) {
      lines.push(`  ... and ${result.errors.length - 3} more`);
    }
  }

  // Show first few warnings
  if (result.warnings.length > 0 && result.warnings.length <= 3) {
    lines.push('\nWarnings:');
    result.warnings.slice(0, 3).forEach(warning => {
      const location = warning.sheetName && warning.cellAddress 
        ? `${warning.sheetName}!${warning.cellAddress}` 
        : '';
      lines.push(`• ${location ? location + ': ' : ''}${warning.message}`);
    });
  }

  return lines.join('\n');
}

export function MainLayout() {
  // New workbook system
  const {
    workbook,
    currentSheetId,
    currentSheet,
    setCell,
    clearCell,
    batchSetCells,
    addNewSheet,
    switchSheet,
    renameSheet,
    deleteSheetById,
    recompute,
  } = useWorkbook();

  const [workbookName, setWorkbookName] = useState(() => workbook.meta.title || 'Untitled');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'plan' | 'act'>('act'); // Track chat mode
  const [activePlan, setActivePlan] = useState<string | null>(null); // Store plan from plan mode
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome to Nexcell! I can help you work with your spreadsheet.\n\nTry commands like:\n' + 
        EXAMPLE_COMMANDS.slice(0, 3).map(cmd => `• ${cmd}`).join('\n'),
      timestamp: new Date(),
    },
  ]);

  const ROWS = 100;
  const COLS = 20;

  // Convert workbook to cell array for rendering
  // Memoize conversion and log only when workbook or sheet changes to avoid noisy logs
  const cells = useMemo(() => {
    try {
      // Use safe stringify to avoid circular JSON errors (HF runtime is non-enumerable but other cycles may exist)
      logAIInteraction('Workbook used for UI canvas', safeStringify(workbook));
    } catch (e) {
      // ignore logging errors
    }

    return workbookToCellArray(workbook, currentSheetId, ROWS, COLS);
  }, [workbook, currentSheetId, ROWS, COLS]);

  // Apply AI actions to workbook

  const handleSendMessage = useCallback(async (content: string) => {
    // Capture current mode for this execution (avoid closure issues)
    const currentChatMode: 'plan' | 'act' = chatMode;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // Handle help command
    if (content.toLowerCase().trim() === 'help' || content.toLowerCase().trim() === '?') {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `🤖 I can help you with:\n\n• Set cell values (e.g., "set A1 to 100")\n• Add formulas (e.g., "put =SUM(A1:A10) in B1")\n• Fill columns/rows (e.g., "fill column B with 0")\n• Paste data (e.g., "paste these values to next row")\n• Clear ranges (e.g., "clear A1:A10")\n\nJust type naturally and I'll understand!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    // If this is a casual greeting or short chit-chat, send it to the conversational
    // chat path (chatWithAI) so the model responds conversationally and DOES NOT
    // attempt to generate structured workbook actions.
    const isCasualGreeting = (msg: string) => {
      if (!msg) return false;
      const trimmed = msg.trim().toLowerCase();
      return /^(hi|hello|hey|hiya|yo|how are you|good morning|good afternoon|good evening)[\.!?\s]*$/i.test(trimmed)
        || (trimmed.length <= 4 && /^(hi|hey|yo)$/i.test(trimmed));
    };

    if (isCasualGreeting(content)) {
      // Check for API key first to avoid throwing inside chatWithAI when
      // no OpenRouter key is configured. This mirrors the check used in
      // the AI-first flow below.
      const apiKey = localStorage.getItem('openrouter_api_key') || import.meta.env.VITE_OPENROUTER_API_KEY;
      if (!apiKey) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Hi! To use the AI chat features you need to configure an OpenRouter API key in Settings. I'm still here to help with basic tips — try typing "help".`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      try {
        // Use functional read of messages for conversation history to avoid stale closure
        let history: { role: string; content: string }[] = [];
        setMessages((prev) => {
          history = prev.map(m => ({ role: m.role, content: m.content }));
          return prev;
        });
        const reply = await chatWithAI(content, history, undefined, { mode: currentChatMode });
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
          logAIInteraction('AI chat reply', reply);
      } catch (err) {
          logAIInteraction('chatWithAI error', err);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `I'm here! How can I help you today?`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      return;
    }

    // AI-first flow: always send the message and workbook context to chatWithAI
    const apiKey = localStorage.getItem('openrouter_api_key') || import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ OpenRouter API key not found. Please add your API key in settings.\n\nFor basic commands, try:\n${EXAMPLE_COMMANDS.slice(0, 3).map(cmd => `• ${cmd}`).join('\n')}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    try {
      // Show thinking message
      const thinkingMessage: Message = {
        id: Date.now().toString() + '-thinking',
        role: 'assistant',
        content: '🤔 Understanding your request...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, thinkingMessage]);

      // Build full workbook context for AI
      let workbookContextText = '';
        try {
        // Use safe stringify for logging to avoid circular structure throw when serializing HF internals or other cycles
        logAIInteraction('Workbook used for AI context', safeStringify(workbook));
        const ctx = await extractWorkbookContext(workbook, currentSheetId);
        workbookContextText = formatContextForAI(ctx);
      } catch (ctxErr) {
        console.warn('Failed to extract workbook context for AI:', ctxErr);
      }

      // Use the system prompt matching current mode so AI knows whether to plan or act
      const systemPrompt = getSystemPrompt(currentChatMode);

      // Call chatWithAI (conversation-first)
      // Build conversation history from latest messages snapshot (last 50 for richer context)
      const conversationHistory = (() => {
        const allMessages = messages.map(m => ({ role: m.role, content: m.content }));
        // Keep last 50 messages for context (increased from 10 for better context retention)
        return allMessages.slice(-50);
      })();
      
      const aiReply = await chatWithAI(
        content + '\n\n' + (workbookContextText ? `Workbook Context:\n${workbookContextText}` : ''),
        conversationHistory,
        systemPrompt,
        { mode: currentChatMode } // Pass mode option to chatWithAI
      );

      // Remove thinking message
      setMessages((prev) => prev.filter((m) => m.id !== thinkingMessage.id));

      // Append the assistant's natural reply
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiReply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Try to extract structured actions from the assistant reply
      console.log('[AI-Workbook] Raw AI reply:', aiReply);
      const actions = extractActionsFromReply(aiReply);
      console.log('[AI-Workbook] Extracted actions result:', actions);
      
      if (actions && actions.length > 0) {
          console.log('[AI-Workbook] Processing', actions.length, 'actions:', actions);

        // Check if we're in plan mode - block ALL execution (including sheet operations)
        if (currentChatMode === 'plan') {
          console.log('[AI-Workbook] ⚠️ Operations blocked: Chat is in PLAN mode');
          
          // Save the plan for later execution
          const planSummary = `Planned operations:\n` +
            actions.map(a => {
              if (a.type === 'addSheet') return `• Create sheet "${a.sheetName}"`;
              if (a.type === 'deleteSheet') return `• Delete sheet "${a.sheetName}"`;
              if (a.type === 'renameSheet') return `• Rename "${a.oldName}" to "${a.newName}"`;
              if (a.type === 'setCellValue') return `• Set ${a.target} to "${a.value}"`;
              if (a.type === 'setCellFormula') return `• Set ${a.target} formula to "${a.formula}"`;
              if (a.type === 'fillRange') return `• Fill range ${a.range?.start}:${a.range?.end}`;
              if (a.type === 'clearRange') return `• Clear range ${a.range?.start}:${a.range?.end}`;
              return `• ${a.type}`;
            }).join('\n');
          
          setActivePlan(planSummary);
          
          const planBlockedMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'system',
            content: `⚠️ Plan mode is active - operations were NOT executed.\n\n` +
              planSummary +
              `\n\n💡 Switch to ACT mode and I'll help you execute this plan.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, planBlockedMessage]);
          return; // Exit early, don't execute
        }

        // Handle sheet operations (addSheet, deleteSheet, renameSheet)
        for (const action of actions) {
          if (action.type === 'addSheet') {
            const newSheet = addNewSheet(action.sheetName);
            console.log('[AI-Workbook] Created new sheet:', newSheet.name);
          } else if (action.type === 'deleteSheet') {
            if (action.sheetName) {
              const sheet = workbook.sheets.find(s => s.name === action.sheetName);
              if (sheet) {
                deleteSheetById(sheet.id);
                console.log('[AI-Workbook] Deleted sheet:', action.sheetName);
              }
            }
          } else if (action.type === 'renameSheet') {
            if (action.oldName && action.newName) {
              const sheet = workbook.sheets.find(s => s.name === action.oldName);
              if (sheet) {
                renameSheet(sheet.id, action.newName);
                console.log('[AI-Workbook] Renamed sheet:', action.oldName, '->', action.newName);
              }
            }
          }
        }

        // Convert AI actions to workbook cell operations using existing converter
        const operations = convertToWorkbookActions(actions, {
          currentSheet: {
            cells: currentSheet?.cells || {},
            grid: currentSheet?.grid,
          },
        });

        console.log('[AI-Workbook] Converted cell operations:', operations);

        // Apply cell operations in batch for better performance
          logAIInteraction('Workbook before operations', safeStringify(workbook));
          
          // Batch all cell operations together to avoid multiple recomputes
          if (operations.length > 0) {
            try {
              console.log(`[AI-Workbook] Applying batch of ${operations.length} operations`);
              
              // Convert to batch format
              const batchCells = operations.map(op => ({
                address: op.address,
                cell: op.cell, // Can be null for deletion
              }));
              
              // Apply all at once with a single recompute
              batchSetCells(batchCells);
              
              console.log('[AI-Workbook] Batch operations applied successfully');
            } catch (err) {
              logAIInteraction('Error applying batch operations', err);
            }
          }
          
          // Debug: Check if formulas have computed values
          operations.forEach(op => {
            if (op.cell && 'formula' in op.cell) {
              const cellData = currentSheet?.cells?.[op.address];
              console.log(`[AI-Debug] After applying ${op.address}:`, {
                formula: op.cell.formula,
                hasComputed: !!cellData?.computed,
                computedValue: cellData?.computed?.v,
                raw: cellData?.raw
              });
            }
          });
          
          logAIInteraction('Workbook after operations', safeStringify(workbook));

          // Removed setTimeout recompute - operations.ts already handles eager compute with sync:true

        // Phase 7.3: Validate workbook after operations
        const validationResult = validateWorkbook(workbook);
        logAIInteraction('Validation result', validationResult);

        // Show validation results to user
        const validationMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `✓ Applied ${operations.length} operation(s).\n\n${formatValidationForUser(validationResult)}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, validationMessage]);

        // Clear the plan after successful execution in act mode
        if (chatMode === 'act' && activePlan && operations.length > 0) {
          setActivePlan(null);
        }

        // If validation found errors/warnings, send feedback to AI for auto-correction
        if (!validationResult.isValid || validationResult.warnings.length > 0) {
          const aiValidationFeedback = formatValidationForAI(validationResult);
          
          if (aiValidationFeedback && validationResult.errors.length > 0) {
            // Only auto-request fix for errors, not warnings
            logAIInteraction('Sending validation feedback to AI for auto-correction', aiValidationFeedback);
            
            const fixRequestMessage: Message = {
              id: (Date.now() + 3).toString(),
              role: 'system',
              content: 'Validation errors detected. Requesting AI to fix issues...',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, fixRequestMessage]);

            // Send validation feedback back to AI
            try {
              const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
              const fixPrompt = `${aiValidationFeedback}\n\nPlease fix these validation errors in the workbook.`;
              
              // Auto-fix should use current mode - respects user's plan/act preference
              const fixReply = await chatWithAI(fixPrompt, conversationHistory, getSystemPrompt(currentChatMode), { mode: currentChatMode });
              
              // Remove the "requesting fix" message
              setMessages((prev) => prev.filter((m) => m.id !== fixRequestMessage.id));
              
              // Add AI's fix response
              const fixResponseMessage: Message = {
                id: (Date.now() + 4).toString(),
                role: 'assistant',
                content: fixReply,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, fixResponseMessage]);
              
              // Try to extract and apply fix actions
              const fixActions = extractActionsFromReply(fixReply);
              if (fixActions && fixActions.length > 0) {
                const fixOperations = convertToWorkbookActions(fixActions, {
                  currentSheet: {
                    cells: currentSheet?.cells || {},
                    grid: currentSheet?.grid,
                  },
                });
                
                if (fixOperations.length > 0) {
                  // Check plan mode before applying fix operations too
                  if (currentChatMode === 'plan') {
                    console.log('[AI-Workbook] ⚠️ Fix operations blocked: Chat is in PLAN mode');
                    const fixBlockedMessage: Message = {
                      id: (Date.now() + 5).toString(),
                      role: 'system',
                      content: `⚠️ Plan mode is active - fix operations were NOT executed.\n\nSwitch to ACT mode to apply fixes.`,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, fixBlockedMessage]);
                  } else {
                    const batchFixCells = fixOperations.map(op => ({
                      address: op.address,
                      cell: op.cell,
                    }));
                    batchSetCells(batchFixCells);
                    
                    // Validate again after fixes
                    const revalidationResult = validateWorkbook(workbook);
                    if (revalidationResult.isValid) {
                      const successMessage: Message = {
                        id: (Date.now() + 5).toString(),
                        role: 'assistant',
                        content: '✅ Validation errors fixed successfully!',
                        timestamp: new Date(),
                      };
                      setMessages((prev) => [...prev, successMessage]);
                    } else {
                      logAIInteraction('Re-validation still has issues', revalidationResult);
                    }
                  }
                }
              }
            } catch (err) {
              logAIInteraction('Auto-correction failed', err);
              const errorMessage: Message = {
                id: (Date.now() + 4).toString(),
                role: 'system',
                content: '⚠️ Unable to auto-correct validation errors. Please review and fix manually.',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev.filter((m) => m.id !== fixRequestMessage.id), errorMessage]);
            }
          }
        }
      } else {
        logAIInteraction('No actions extracted from AI reply', { reply: aiReply });
      }
    } catch (error) {
        logAIInteraction('AI-first flow error', error);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error processing your request. Try a simpler command like:\n${EXAMPLE_COMMANDS.slice(0, 3).map(cmd => `• ${cmd}`).join('\n')}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  }, [workbook, currentSheetId, currentSheet, setCell, clearCell, recompute, messages, chatMode, batchSetCells, addNewSheet, renameSheet, deleteSheetById]);

  const handleModeChange = useCallback((newMode: 'plan' | 'act') => {
    // If switching from plan to act with an active plan, offer to execute it
    if (chatMode === 'plan' && newMode === 'act' && activePlan) {
      const executePrompt = `I'm ready to execute the plan. Here's what we discussed:\n\n${activePlan}\n\nShould I proceed with these changes?`;
      const message: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: executePrompt,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, message]);
    }
    
    // If switching to plan mode, clear any previous plan
    if (newMode === 'plan') {
      setActivePlan(null);
    }
    
    setChatMode(newMode);
  }, [chatMode, activePlan, setMessages]);

  const handleCellEdit = useCallback((row: number, col: number, value: string) => {
    const address = toAddress(row + 1, col + 1); // Convert 0-based to 1-based
    const cell = createCellFromInput(value);
    logAIInteraction('User cell edit', { address, cell });
    setCell(address, cell);
  }, [setCell]);

  const handleExportJSON = () => {
    const json = JSON.stringify(workbook, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workbookName.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportXLSX = async () => {
    try {
      // Ensure formulas are computed and cached so exported files have correct cached values
      try {
        const result = computeWorkbook(workbook);
        console.log('Recompute before export:', result);
      } catch (e) {
        console.warn('Recompute before export failed:', e);
      }

      // Prefer ExcelJSAdapter for higher fidelity exports when available
      let buffer: ArrayBuffer;
      let warnings: string[] = [];
      try {
        const { ExcelJSAdapter } = await import('@/lib/workbook/adapters/exceljs');
        const adapter = new ExcelJSAdapter();
        buffer = await adapter.export(workbook);
        // adapters may push warnings into workbook.exportWarnings
        warnings = workbook.exportWarnings || [];
      } catch (e) {
        console.warn('ExcelJS adapter failed or not available, falling back to SheetJS:', e);
        // Fallback to SheetJS
        const { SheetJSAdapter } = await import('@/lib/workbook/adapters/sheetjs');
        const adapter = new SheetJSAdapter();
        buffer = await adapter.export(workbook);
        warnings = workbook.exportWarnings || [];
      }
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workbookName.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Surface any export warnings to the user
      if (warnings && warnings.length > 0) {
        console.warn('Export warnings:', warnings);
        alert('Export completed with warnings. See console for details.');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export workbook. See console for details.');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header 
        workbookName={workbookName} 
        onWorkbookNameChange={setWorkbookName}
        onExportXLSX={handleExportXLSX}
        onExportJSON={handleExportJSON}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      
      <SettingsDialog 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-full md:w-96 border-r border-gray-200 bg-white flex flex-col">
          <ChatInterface 
            messages={messages}
            onSendMessage={handleSendMessage}
            initialMode={chatMode}
            onModeChange={handleModeChange}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <CanvasRenderer 
              data={cells}
              onCellEdit={handleCellEdit}
            />
          </div>
          
          {/* Sheet Tabs */}
          <SheetTabs
            sheets={workbook.sheets}
            currentSheetId={currentSheetId}
            onSheetChange={switchSheet}
            onAddSheet={addNewSheet}
            onRenameSheet={renameSheet}
            onDeleteSheet={deleteSheetById}
          />
        </div>
      </div>
    </div>
  );
}
