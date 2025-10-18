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
import { getSystemPrompt } from '@/lib/ai/systemPrompt';
import { extractWorkbookContext, formatContextForAI } from '@/lib/ai/workbookContext';
import extractActionsFromReply from '@/lib/ai/actionExtractor';

// Utility for logging AI interactions and effects
function logAIInteraction(event: string, details: any) {
  console.log(`[AI-Workbook] ${event}:`, details);
}

export function MainLayout() {
  // New workbook system
  const {
    workbook,
    currentSheetId,
    currentSheet,
    setCell,
    clearCell,
    addNewSheet,
    switchSheet,
    renameSheet,
    deleteSheetById,
    recompute,
  } = useWorkbook();

  const [workbookName, setWorkbookName] = useState(() => workbook.meta.title || 'Untitled');
  const [settingsOpen, setSettingsOpen] = useState(false);
  
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
        const reply = await chatWithAI(content, history);
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

      // Use the official system prompt in ACT mode so AI knows when to act
      const systemPrompt = getSystemPrompt('act');

      // Call chatWithAI (conversation-first)
  // Build conversation history from latest messages snapshot
  const conversationHistory = (() => messages.map(m => ({ role: m.role, content: m.content })))();
  const aiReply = await chatWithAI(
    content + '\n\n' + (workbookContextText ? `Workbook Context:\n${workbookContextText}` : ''),
    conversationHistory,
    systemPrompt
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
      const actions = extractActionsFromReply(aiReply);
      if (actions && actions.length > 0) {
          console.log('[AI-Workbook] Extracted actions from AI reply:', actions);

        // Convert AI actions to workbook operations using existing converter
        const operations = convertToWorkbookActions(actions, {
          currentSheet: {
            cells: currentSheet?.cells || {},
            grid: currentSheet?.grid,
          },
        });

        console.log('[AI-Workbook] Converted operations:', operations);

        // Apply operations safely
          logAIInteraction('Workbook before operations', safeStringify(workbook));
          let uiChanged = false;
          operations.forEach(op => {
            try {
              if (op.cell === null) {
                logAIInteraction('Clear cell', { address: op.address });
                clearCell(op.address);
                uiChanged = true;
              } else {
                console.log('[AI-Workbook] Set cell:', { address: op.address, cell: JSON.stringify(op.cell, null, 2) });
                setCell(op.address, op.cell);
                uiChanged = true;
              }
            } catch (err) {
              logAIInteraction('Error applying operation', { op, error: err });
            }
          });
          logAIInteraction('Workbook after operations', safeStringify(workbook));
          if (!uiChanged) {
            logAIInteraction('UI did not update after AI operations', { operations });
          }

          // Removed setTimeout recompute - operations.ts already handles eager compute with sync:true

        // Optionally append a short confirmation to the assistant message
        const confirmMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `✓ Applied ${operations.length} operation(s) as requested.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMessage]);
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
  }, [workbook, currentSheetId, currentSheet, setCell, clearCell, recompute, messages]);

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
