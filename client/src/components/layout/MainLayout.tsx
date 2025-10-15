import { useState } from 'react';
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
import { computeWorkbook } from '@/lib/workbook/hyperformula';
import { parseAICommand, describeAction, EXAMPLE_COMMANDS } from '@/lib/ai/aiService';
import { parseCommandWithAI, convertToWorkbookActions, findNextEmptyRow } from '@/lib/ai/openrouter';

export function MainLayout() {
  // New workbook system
  const {
    workbook,
    currentSheetId,
    currentSheet,
    setCell,
    clearCell,
    updateWorkbook,
    addNewSheet,
    switchSheet,
    renameSheet,
    deleteSheetById,
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
  const cells = workbookToCellArray(workbook, currentSheetId, ROWS, COLS);

  // Apply AI actions to workbook
  const applyAction = (action: any) => {
    switch (action.type) {
      case 'setCellValue': {
        const address = toAddress(action.row + 1, action.col + 1); // Convert to 1-based
        const cell = createCellFromInput(String(action.value));
        setCell(address, cell);
        break;
      }
      case 'setCellFormula': {
        const address = toAddress(action.row + 1, action.col + 1);
        setCell(address, {
          formula: action.formula,
          dataType: 'formula',
        });
        break;
      }
      case 'clearRange': {
        updateWorkbook(wb => {
          const sheet = wb.sheets.find(s => s.id === currentSheetId);
          if (sheet && sheet.cells) {
            for (let r = action.startRow; r <= action.endRow; r++) {
              for (let c = action.startCol; c <= action.endCol; c++) {
                const address = toAddress(r + 1, c + 1);
                delete sheet.cells[address];
              }
            }
          }
          return wb;
        });
        break;
      }
      case 'setRange': {
        action.values.forEach((row: any[], r: number) => {
          row.forEach((value: any, c: number) => {
            const address = toAddress(action.startRow + r + 1, action.startCol + c + 1);
            const cell = createCellFromInput(String(value));
            setCell(address, cell);
          });
        });
        break;
      }
      case 'setFormulaRange': {
        action.formulas.forEach((row: string[], r: number) => {
          row.forEach((formula: string, c: number) => {
            const address = toAddress(action.startRow + r + 1, action.startCol + c + 1);
            setCell(address, {
              formula,
              dataType: 'formula',
            });
          });
        });
        break;
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages([...messages, newMessage]);

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

    // Try pattern matching first (fast)
    const command = parseAICommand(content, currentSheetId);
    
    if (command.actions.length > 0) {
      // Apply actions using pattern matching
      command.actions.forEach(action => applyAction(action));
      
      const actionDescriptions = command.actions.map(describeAction).join('\n• ');
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✓ Done! I've applied:\n• ${actionDescriptions}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    // Fall back to AI (OpenRouter) for complex commands
    const apiKey = localStorage.getItem('openrouter_api_key') || 
                   import.meta.env.VITE_OPENROUTER_API_KEY;
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

      // Get context - include existing data for better AI understanding
      const nextRow = findNextEmptyRow(currentSheet?.cells || {});
      const existingCells = currentSheet?.cells || {};
      
      // Sample some existing data to give AI context
      const sampleData: string[] = [];
      Object.entries(existingCells).slice(0, 10).forEach(([addr, cell]) => {
        const displayValue = cell.formula || cell.raw || '';
        sampleData.push(`${addr}: ${displayValue}`);
      });
      
      const context = {
        lastRow: nextRow - 1,
        lastCol: 5,
        selectedCell: undefined,
        clipboardData: undefined,
        existingData: sampleData.length > 0 ? sampleData : undefined,
      };

      // Call AI
      const aiResponse = await parseCommandWithAI(content, apiKey, context);
      
      console.log('AI Response:', aiResponse);

      // Remove thinking message
      setMessages((prev) => prev.filter((m) => m.id !== thinkingMessage.id));

      if (aiResponse.success && aiResponse.actions.length > 0) {
        console.log('AI Actions:', aiResponse.actions);
        
        // Convert AI actions to workbook operations
        const operations = convertToWorkbookActions(aiResponse.actions, {
          currentSheet: {
            cells: currentSheet?.cells || {},
            grid: currentSheet?.grid,
          },
        });
        
        console.log('Workbook Operations:', operations);

        // Apply all operations
        operations.forEach(op => {
          if (op.cell === null) {
            // Delete cell
            clearCell(op.address);
          } else {
            setCell(op.address, op.cell);
          }
        });

        // Success message
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✓ ${aiResponse.explanation}\n\nApplied ${operations.length} operation(s).`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // AI couldn't understand
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `I'm not sure how to help with that. ${aiResponse.explanation}\n\nTry being more specific, like:\n• "set A1 to 100"\n• "fill column B with 0"\n• "add formula =SUM(A1:A10) to B1"`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('AI error:', error);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error processing your request. Try a simpler command like:\n${EXAMPLE_COMMANDS.slice(0, 3).map(cmd => `• ${cmd}`).join('\n')}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  const handleCellEdit = (row: number, col: number, value: string) => {
    const address = toAddress(row + 1, col + 1); // Convert 0-based to 1-based
    const cell = createCellFromInput(value);
    setCell(address, cell);
  };

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
