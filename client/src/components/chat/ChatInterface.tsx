import { useRef, useEffect, useState } from 'react';
import PlanPreview from '../ai/PlanPreview';
import type { AIPlan } from '../../lib/ai/planTypes';
import { Send } from 'lucide-react';
import { type Message } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

export function ChatInterface({ messages, onSendMessage, isLoading }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      // If user requests a plan preview (prefix `/plan `) use a mock generator
      if (input.trim().startsWith('/plan ')) {
        const intent = input.trim().substring(6).trim();
        const mockPlan = generateAIPlanMock(intent);
        setPreviewPlan(mockPlan);
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }

      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-xs text-gray-500 mt-0.5">Ask me anything about your spreadsheet</p>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex flex-col gap-1',
              message.role === 'user' ? 'items-end' : 'items-start'
            )}
          >
            <div className="text-xs text-gray-500 px-1">
              {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : 'System'}
            </div>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-2 text-sm',
                message.role === 'user'
                  ? 'bg-accent-500 text-white'
                  : message.role === 'system'
                  ? 'bg-gray-100 text-gray-600 italic'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 rounded-lg bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Plan preview modal (mock) */}
      {previewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl">
            <PlanPreview
              plan={previewPlan}
              onApprove={() => {
                // For mock, simply send an assistant message that plan was applied
                onSendMessage(`(Plan applied) ${previewPlan.planId}`);
                setPreviewPlan(null);
              }}
              onReject={() => {
                onSendMessage(`(Plan rejected) ${previewPlan.planId}`);
                setPreviewPlan(null);
              }}
              onClose={() => setPreviewPlan(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Simple mock plan generator for local testing
function generateAIPlanMock(intent: string): AIPlan {
  return {
    planId: `mock-${Date.now()}`,
    operations: [
      { type: 'SET_CELL', sheetId: 'Sheet1', address: 'A1', before: 'Old', after: `AI: ${intent}` },
      { type: 'SET_CELL', sheetId: 'Sheet1', address: 'B1', before: 1, after: 2 },
    ],
    reasoning: `This mock plan will set A1 and B1 to satisfy intent: ${intent}`,
    warnings: intent.toLowerCase().includes('volatile') ? ['Contains volatile functions'] : [],
  };
}
