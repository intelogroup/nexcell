/**
 * ChatPanel Component
 * 
 * Modern chat interface for workbook-contextual AI assistance.
 * Features:
 * - Message history with user/AI bubbles
 * - Context indicators (selected range, etc.)
 * - Action cards for AI suggestions
 * - Quick action templates
 */

import { useState, useEffect, useRef } from 'react'
import { useChatStore, useChatMessages, useIsProcessing, usePendingActions } from '../../stores/chat.store'
import { useSendMessage, useSyncChatWithWorkbook, useSyncSelectedRange, useApplyAction, useCancelAction } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble.tsx'
import { ContextIndicator } from './ContextIndicator.tsx'
import { ActionCard } from './ActionCard.tsx'
import { Send, Loader2, Trash2, Download, Sparkles } from 'lucide-react'
import type { PromptTemplate } from '../../types/chat.types'

interface ChatPanelProps {
  workbookId: string
}

// Quick action prompt templates
const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'create-table',
    icon: '📊',
    label: 'Create table',
    prompt: 'Create a table with columns for ',
    category: 'create',
  },
  {
    id: 'fill-data',
    icon: '🔢',
    label: 'Fill with data',
    prompt: 'Fill the selected range with sample data',
    category: 'create',
  },
  {
    id: 'format-currency',
    icon: '💰',
    label: 'Format as currency',
    prompt: 'Format the selected cells as currency (USD)',
    category: 'format',
  },
  {
    id: 'add-formulas',
    icon: '📈',
    label: 'Add formulas',
    prompt: 'Add a SUM formula to calculate totals',
    category: 'create',
  },
  {
    id: 'apply-styling',
    icon: '🎨',
    label: 'Apply styling',
    prompt: 'Apply professional formatting to the selected table',
    category: 'format',
  },
]

export function ChatPanel({ workbookId }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [showTemplates, setShowTemplates] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Sync chat context with workbook
  useSyncChatWithWorkbook()
  useSyncSelectedRange()
  
  // Get chat state
  const messages = useChatMessages()
  const isProcessing = useIsProcessing()
  const pendingActions = usePendingActions()
  const sendMessage = useSendMessage()
  const applyAction = useApplyAction()
  const cancelAction = useCancelAction()
  const inputValue = useChatStore((state) => state.inputValue)
  const clearChatHistory = useChatStore((state) => state.clearChatHistory)
  
  // Sync local input with store
  useEffect(() => {
    setInput(inputValue)
  }, [inputValue])
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])
  
  const handleSend = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isProcessing) return
    
    await sendMessage(trimmedInput)
    setInput('')
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history for this workbook?')) {
      clearChatHistory(workbookId)
    }
  }
  
  const handleTemplateClick = (template: PromptTemplate) => {
    setInput(template.prompt)
    setShowTemplates(false)
    inputRef.current?.focus()
  }
  
  const handleExport = () => {
    // TODO: Implement export functionality in Sprint 3
    console.log('Export chat history')
  }
  
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
                <p className="text-xs text-gray-500">
                  Context-aware • {messages.length} message{messages.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Export chat"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={handleClearChat}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Context Indicator */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-b border-gray-200">
        <ContextIndicator />
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
              <span className="text-2xl text-white font-bold">N</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-gray-600 mb-6 max-w-xs">
              Ask me to create tables, fill data, format cells, add formulas, or anything else!
            </p>
            
            {/* Quick Action Templates */}
            <div className="w-full max-w-sm space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <p className="text-xs font-medium text-gray-700">Quick Actions</p>
              </div>
              {PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="w-full text-left px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition flex items-center gap-2 group"
                >
                  <span className="text-lg">{template.icon}</span>
                  <span className="flex-1">{template.label}</span>
                  <Send className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Action Cards for pending actions */}
            {pendingActions.length > 0 && (
              <div className="space-y-3 mb-4">
                {pendingActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onApply={() => applyAction(action)}
                    onCancel={() => cancelAction(action)}
                  />
                ))}
              </div>
            )}
            
            {/* Messages */}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* Loading indicator */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
        {/* Show templates when there are no messages */}
        {messages.length === 0 && showTemplates && (
          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-900 mb-1">Try these prompts:</p>
                <div className="flex flex-wrap gap-1">
                  {PROMPT_TEMPLATES.slice(0, 3).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template)}
                      className="text-xs px-2 py-1 bg-white border border-purple-200 rounded-md hover:bg-purple-100 transition"
                    >
                      {template.icon} {template.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message or describe what you want to do..."
            rows={2}
            disabled={isProcessing}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
            maxLength={2000}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center"
            title="Send message (Enter)"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">
            {input.length}/2000 • Press Enter to send, Shift+Enter for new line
          </span>
          {pendingActions.length > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              {pendingActions.length} action{pendingActions.length !== 1 ? 's' : ''} pending
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
