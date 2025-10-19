import { useRef, useEffect, useState } from 'react';
import PlanPreview from '../ai/PlanPreview';
import type { AIPlan } from '../../lib/ai/planTypes';
import { Send, Loader2, AlertCircle, Info, ChevronDown } from 'lucide-react';
import { type Message } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  /** Called when the user clicks undo on a message that has an attached action */
  onUndoMessage?: (messageId: string) => void;
  /** Optional initial mode: 'plan' shows plan-focused UI, 'act' shows action-focused UI */
  initialMode?: 'plan' | 'act';
  /** Called when the mode toggle changes */
  onModeChange?: (mode: 'plan' | 'act') => void;
  isLoading?: boolean;
}

export function ChatInterface({ 
  messages, 
  onSendMessage, 
  onUndoMessage, 
  initialMode, 
  onModeChange, 
  isLoading 
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [previewPlan, setPreviewPlan] = useState<AIPlan | null>(null);
  const [mode, setMode] = useState<'plan' | 'act'>(initialMode || 'act');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    // jsdom used in tests doesn't implement scrollIntoView; guard the call
    const endEl = messagesEndRef.current as any;
    if (endEl && typeof endEl.scrollIntoView === 'function') {
      endEl.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Monitor scroll position for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 3);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    const endEl = messagesEndRef.current as any;
    if (endEl && typeof endEl.scrollIntoView === 'function') {
      endEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleModeToggle = (newMode: 'plan' | 'act') => {
    setMode(newMode);
    onModeChange?.(newMode);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Chat header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 truncate">AI Assistant</h2>
                <p className="text-xs text-gray-600 mt-0.5 truncate">
              {mode === 'plan' ? 'Planning mode - Review before execution' : 'Acting mode - Commands execute immediately'}
            </p>
          </div>
          
          {/* Mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shadow-sm">
            <button
              aria-pressed={mode === 'plan'}
              aria-label="Switch to Plan mode"
              onClick={() => handleModeToggle('plan')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                mode === 'plan' 
                  ? 'bg-white text-accent-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Info className="w-3 h-3 inline-block mr-1" />
              Plan
            </button>
            <button
              aria-pressed={mode === 'act'}
              aria-label="Switch to Act mode"
              onClick={() => handleModeToggle('act')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                mode === 'act' 
                  ? 'bg-white text-accent-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Send className="w-3 h-3 inline-block mr-1" />
              Act
            </button>
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-accent-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
              <p className="text-sm text-gray-600 mb-4">
                Ask me to help with formulas, data entry, formatting, or analysis.
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Try: "Set A1 to 100"</p>
                <p>Or: "Create a SUM formula for row 1"</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                'flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200',
                message.role === 'user' ? 'items-end' : 'items-start'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Message metadata */}
              <div className="flex items-center gap-2 px-1">
                <span className={cn(
                  'text-[11px] font-semibold tracking-wide',
                  message.role === 'user' ? 'text-accent-700' :
                  message.role === 'assistant' ? 'text-sky-700' :
                  'text-gray-600'
                )}>
                  {message.role === 'user' ? '👤 You' : 
                   message.role === 'assistant' ? '🤖 AI Assistant' : 
                   'ℹ️ System'}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-[11px] text-gray-500">
                  {formatTimestamp(new Date(message.timestamp))}
                </span>
              </div>

              {/* Message bubble */}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words transition-all',
                  message.role === 'user'
                    // User bubble with light blue background and dark blue text for better contrast
                    ? 'bg-accent-100 text-accent-900 border border-accent-200 rounded-br-md'
                    : message.role === 'system'
                    // Subtle system bubble with stronger border for readability
                    ? 'bg-amber-50 text-amber-900 border border-amber-300 rounded-tl-md'
                    // Assistant bubble with slight gray background and border for contrast
                    : 'bg-gray-50 text-gray-900 border border-gray-200 rounded-tl-md'
                )}
              >
                {/* Message content */}
                <div className={cn(
                  message.role === 'assistant' && 'leading-relaxed'
                )}>
                  {message.content}
                </div>
                
                {/* Action button for undo */}
                {('action' in message && (message as any).action) && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2 justify-end">
                    <button
                      onClick={() => onUndoMessage?.(message.id)}
                      className="text-xs text-accent-700 hover:text-accent-800 font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1 rounded px-2 py-1"
                      aria-label="Undo this action"
                    >
                      ↶ Undo
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <span className="text-xs font-medium text-blue-600">🤖 AI Assistant</span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-400">Thinking...</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-accent-500 animate-spin" />
                <span className="text-sm text-gray-700">Processing your request...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-32 right-8 z-10">
          <button
            onClick={scrollToBottom}
            className="bg-white border border-gray-300 rounded-full p-2 shadow-lg hover:shadow-xl transition-all hover:bg-gray-50"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4 shadow-lg">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'plan' ? "Describe what you want to accomplish..." : "Type a command or question..."}
              className={cn(
                'w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent',
                'placeholder:text-gray-500 transition-all',
                'min-h-[48px] max-h-[120px]',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
              rows={1}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'h-12 w-12 rounded-xl flex items-center justify-center transition-all shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2',
              input.trim() && !isLoading
                ? 'bg-accent-600 text-white hover:bg-accent-700 hover:shadow-md active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
        
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Enter</kbd> to send, 
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono ml-1">Shift+Enter</kbd> for new line
          </p>
          {mode === 'plan' && (
            <div className="flex items-center gap-1 text-xs text-amber-700">
              <AlertCircle className="w-3 h-3" />
              <span>Plan mode active</span>
            </div>
          )}
        </div>
      </div>

      {/* Plan preview modal */}
      {previewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-200">
            <PlanPreview
              plan={previewPlan}
              onApprove={() => {
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
