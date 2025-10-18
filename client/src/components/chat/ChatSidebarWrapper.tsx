import { useState, useCallback } from 'react';
import { ChatInterface } from './ChatInterface';
import type { Message } from '@/lib/types';
import { getSystemPrompt } from '@/lib/ai/systemPrompt';
import { chatWithAI } from '@/lib/ai/aiService';

/**
 * Production-ready chat sidebar wrapper that integrates with AI service
 * and manages conversation state with proper error handling
 */
export default function ChatSidebarWrapper() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome-1',
      role: 'system',
      content: '👋 Welcome to Nexcell! I\'m your AI spreadsheet assistant. I can help you with:\n\n• Setting cell values and formulas\n• Data analysis and calculations\n• Formatting and styling\n• Creating charts and visualizations\n\nThe canvas is read-only, so all changes go through me. Try asking: "Set A1 to 100" or "Create a SUM formula"',
      timestamp: new Date(),
    },
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<'plan' | 'act'>('act');
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);

  /**
   * Send a message to the AI and handle the response
   */
  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Update conversation history for AI context
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content },
    ];
    setConversationHistory(updatedHistory);

    // Start loading
    setIsLoading(true);

    try {
      // Get system prompt based on current mode
      const systemPrompt = getSystemPrompt(currentMode);

      // Call AI service
      const aiResponse = await chatWithAI(
        content,
        updatedHistory,
        systemPrompt
      );

      // Add AI response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        // TODO: Parse AI response for structured actions to attach here
        // This would allow undo functionality for actual workbook operations
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationHistory([
        ...updatedHistory,
        { role: 'assistant', content: aiResponse },
      ]);

    } catch (error) {
      console.error('AI chat error:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `⚠️ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or check your API configuration in Settings.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationHistory, currentMode]);

  /**
   * Handle undo action for a message
   * TODO: Implement actual workbook operation reversal
   */
  const handleUndoMessage = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || !msg.action) return;

    // Add system notification
    const undoNotification: Message = {
      id: `undo-${Date.now()}`,
      role: 'system',
      content: `🔄 Undo requested for: "${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}"`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, undoNotification]);

    // TODO: Implement actual undo logic by reversing the workbook action
    // This would involve calling workbook APIs to reverse the operation
    console.log('Undo action:', msg.action);
  }, [messages]);

  /**
   * Handle mode change between Plan and Act
   */
  const handleModeChange = useCallback((mode: 'plan' | 'act') => {
    setCurrentMode(mode);
    
    // Notify user of mode change with helpful context
    const modeDescription = mode === 'plan' 
      ? 'Plan mode: I\'ll outline my approach and wait for your approval before making changes.'
      : 'Act mode: I\'ll execute your commands immediately with confirmation.';

    const modeNotification: Message = {
      id: `mode-${Date.now()}`,
      role: 'system',
      content: `🔄 Switched to ${mode.toUpperCase()} mode\n${modeDescription}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, modeNotification]);
  }, []);

  /**
   * Clear chat history (useful for starting fresh)
   */
  const clearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome-1',
        role: 'system',
        content: '👋 Chat cleared. How can I help you with your spreadsheet?',
        timestamp: new Date(),
      },
    ]);
    setConversationHistory([]);
  }, []);

  return (
    <div className="h-full relative">
      <ChatInterface
        messages={messages}
        onSendMessage={sendMessage}
        onUndoMessage={handleUndoMessage}
        initialMode={currentMode}
        onModeChange={handleModeChange}
        isLoading={isLoading}
      />
      
      {/* Optional: Add a clear chat button in the corner */}
      <button
        onClick={clearChat}
        className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-600 transition-colors z-10"
        title="Clear chat history"
        aria-label="Clear chat history"
      >
        Clear
      </button>
    </div>
  );
}
