/**
 * MessageBubble Component
 * 
 * Displays a single chat message with Cursor-style rounded bubbles.
 * - User messages: right-aligned, blue background
 * - AI messages: left-aligned, gray background with avatar
 * - System messages: centered, smaller text
 * 
 * Features:
 * - Copy message content
 * - Markdown-style formatting (bold, italic, code)
 * - Link detection and formatting
 * - Smooth fade-in animation
 * - Timestamp display
 * - Metadata badges (confidence, tokens, range)
 */

import { useState } from 'react'
import type { ChatMessage } from '../../types/chat.types'
import { MessageSquare, Copy, Check, AlertCircle, Sparkles } from 'lucide-react'

interface MessageBubbleProps {
  message: ChatMessage
  onCopy?: (content: string) => void
}

// Helper to detect and format links
function formatLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

// Helper to format markdown-style text (basic)
function formatText(text: string) {
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>')
  
  // Italic: *text* or _text_
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
  text = text.replace(/_(.+?)_/g, '<em>$1</em>')
  
  // Inline code: `code`
  text = text.replace(/`(.+?)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
  
  return text
}

export function MessageBubble({ message, onCopy }: MessageBubbleProps) {
  const { role, content, timestamp, metadata } = message
  const [copied, setCopied] = useState(false)
  
  // Format timestamp
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  
  // Handle copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      onCopy?.(content)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }
  
  // Check if it's an error message
  const isError = metadata?.error !== undefined
  
  // System messages (centered)
  if (role === 'system') {
    return (
      <div className="flex justify-center my-2 animate-fadeIn">
        <div className={`rounded-full px-4 py-1 flex items-center gap-2 ${
          isError 
            ? 'bg-red-100 dark:bg-red-900/20 border border-red-200' 
            : 'bg-gray-100 dark:bg-gray-800'
        }`}>
          {isError && <AlertCircle className="w-3 h-3 text-red-600" />}
          <p className={`text-xs ${isError ? 'text-red-700' : 'text-gray-600'}`}>
            {content}
          </p>
        </div>
      </div>
    )
  }
  
  // User messages (right-aligned, blue)
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4 animate-fadeIn group">
        <div className="max-w-[80%] relative">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="absolute -left-8 top-2 p-1.5 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-gray-100"
            title="Copy message"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          
          <div className="bg-blue-500 text-white rounded-2xl px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-75" />
              <div className="text-sm whitespace-pre-wrap break-words">
                {formatLinks(content)}
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs text-gray-500">{timeStr}</span>
          </div>
        </div>
      </div>
    )
  }
  
  // AI messages (left-aligned, gray with avatar)
  return (
    <div className="flex justify-start mb-4 animate-fadeIn group">
      <div className="max-w-[80%] relative">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            {/* AI Avatar */}
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 shadow-sm">
              N
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Content with formatting */}
              <div 
                className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: formatText(content) }}
              />
              
              {/* Metadata badges */}
              {metadata && Object.keys(metadata).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {metadata.confidence !== undefined && (
                    <div className="flex items-center gap-1 text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span className="font-medium">{Math.round(metadata.confidence * 100)}%</span>
                    </div>
                  )}
                  {metadata.affectedRange && (
                    <span className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                      📍 {metadata.affectedRange}
                    </span>
                  )}
                  {metadata.tokensUsed && (
                    <span className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                      🔤 {metadata.tokensUsed} tokens
                    </span>
                  )}
                  {metadata.model && (
                    <span className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600">
                      🤖 {metadata.model}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        
        <div className="flex justify-start mt-1 ml-9">
          <span className="text-xs text-gray-500">{timeStr}</span>
        </div>
      </div>
    </div>
  )
}
