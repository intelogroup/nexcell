/**
 * Custom hooks for chat functionality
 * Provides convenience hooks for common chat operations
 */

import { useEffect, useCallback } from 'react'
import { useChatStore } from '../stores/chat.store'
import { useWorkbookStore } from '../stores/workbook.store'
import type { ChatAction, SelectedRange, AIContext } from '../types/chat.types'

/**
 * Hook to automatically sync current workbook ID with chat store
 * This ensures chat context stays in sync with the active workbook
 * Loads chat history from backend on workbook open
 */
export function useSyncChatWithWorkbook() {
  const currentWorkbook = useWorkbookStore((state) => state.currentWorkbook)
  const setCurrentWorkbookId = useChatStore((state) => state.setCurrentWorkbookId)
  const markMessagesAsRead = useChatStore((state) => state.markMessagesAsRead)
  const loadChatHistory = useChatStore((state) => state.loadChatHistory)
  const chatsByWorkbook = useChatStore((state) => state.chatsByWorkbook)
  const addMessage = useChatStore((state) => state.addMessage)

  useEffect(() => {
    if (currentWorkbook?.id) {
      setCurrentWorkbookId(currentWorkbook.id)
      
      // Mark messages as read when workbook is opened
      markMessagesAsRead(currentWorkbook.id)

      // Load chat history from backend
      // Strategy: Use localStorage cache immediately, then sync with backend
      const loadHistory = async () => {
        try {
          // Check if we have cached data in localStorage
          const cachedChat = chatsByWorkbook[currentWorkbook.id]
          const cacheAge = cachedChat?.lastActivity 
            ? Date.now() - new Date(cachedChat.lastActivity).getTime()
            : Infinity
          
          // If cache is older than 5 minutes or doesn't exist, fetch from backend
          const shouldFetch = !cachedChat || cacheAge > 5 * 60 * 1000
          
          if (shouldFetch) {
            // Import dynamically to avoid circular dependencies
            const { syncChatHistory } = await import('../services/chat.api')
            
            console.log(`[Chat] Syncing history for workbook ${currentWorkbook.id}`)
            const backendChat = await syncChatHistory(currentWorkbook.id)
            
            // Merge backend data with local cache
            // Backend is source of truth, but preserve any pending local messages
            const localMessages = cachedChat?.messages || []
            const backendMessageIds = new Set(backendChat.messages.map(m => m.id))
            
            // Find messages that exist locally but not on backend (optimistic updates)
            const localOnlyMessages = localMessages.filter(
              msg => !backendMessageIds.has(msg.id)
            )
            
            // Merge: backend messages + local-only messages (sorted by timestamp)
            const mergedMessages = [
              ...backendChat.messages,
              ...localOnlyMessages,
            ].sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
            
            // Do the same for actions
            const localActions = cachedChat?.actions || []
            const backendActionIds = new Set(backendChat.actions.map(a => a.id))
            const localOnlyActions = localActions.filter(
              action => !backendActionIds.has(action.id)
            )
            
            const mergedActions = [
              ...backendChat.actions,
              ...localOnlyActions,
            ].sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
            
            // Update store with merged data
            loadChatHistory(currentWorkbook.id, {
              ...backendChat,
              messages: mergedMessages,
              actions: mergedActions,
              lastActivity: new Date(),
            })
            
            console.log(`[Chat] Loaded ${mergedMessages.length} messages and ${mergedActions.length} actions`)
          } else {
            console.log(`[Chat] Using cached history for workbook ${currentWorkbook.id}`)
          }
        } catch (error) {
          console.error('[Chat] Failed to load chat history:', error)
          
          // If backend fails, continue with localStorage cache
          // Show error message in chat
          if (currentWorkbook?.id) {
            addMessage(currentWorkbook.id, {
              role: 'system',
              content: 'Failed to sync chat history with server. Using local cache. Some messages may be missing.',
              metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            })
          }
        }
      }

      loadHistory()
    } else {
      setCurrentWorkbookId(null)
    }
  }, [currentWorkbook?.id, setCurrentWorkbookId, markMessagesAsRead, loadChatHistory, chatsByWorkbook, addMessage])
}

/**
 * Hook to automatically update selected range context
 * Syncs workbook selection with chat context for AI awareness
 */
export function useSyncSelectedRange() {
  const selectedCell = useWorkbookStore((state) => state.selectedCell)
  const setSelectedRange = useChatStore((state) => state.setSelectedRange)

  useEffect(() => {
    if (selectedCell) {
      // TODO: Calculate actual range if multiple cells are selected
      // For now, just use single cell
      const range: SelectedRange = {
        sheetName: selectedCell.sheetName,
        range: selectedCell.cellRef,
        cellCount: 1,
        rowCount: 1,
        colCount: 1,
      }
      setSelectedRange(range)
    } else {
      setSelectedRange(null)
    }
  }, [selectedCell, setSelectedRange])
}

/**
 * Hook for sending messages to AI
 * Implements optimistic updates with backend sync
 */
export function useSendMessage() {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const addMessage = useChatStore((state) => state.addMessage)
  const setInputValue = useChatStore((state) => state.setInputValue)
  const setIsProcessing = useChatStore((state) => state.setIsProcessing)
  const getContextForAI = useChatStore((state) => state.getContextForAI)

  return useCallback(
    async (content: string) => {
      if (!currentWorkbookId || !content.trim()) return

      // Optimistic update: Add user message immediately to local store
      const userMessageId = crypto.randomUUID()
      addMessage(currentWorkbookId, {
        role: 'user',
        content: content.trim(),
      })

      // Clear input and set processing state
      setInputValue('')
      setIsProcessing(true)

      try {
        // Import chat API
        const { sendMessage } = await import('../services/chat.api')
        
        // Get context for AI
        const context = getContextForAI()

        // Send message to backend
        // This will persist the message and eventually trigger AI response
        const savedMessage = await sendMessage(
          currentWorkbookId,
          content.trim(),
          {
            selectedRange: context.selectedRange,
            workbookName: context.workbookId,
          }
        )

        console.log('[Chat] Message saved to backend:', savedMessage.id)

        // TODO: Backend should trigger AI processing
        // For now, simulate AI response
        await new Promise((resolve) => setTimeout(resolve, 1000))
        
        // Add AI response
        addMessage(currentWorkbookId, {
          role: 'assistant',
          content: 'This is a simulated AI response. Integration with AI service pending.',
          metadata: {
            tokensUsed: 150,
            confidence: 0.95,
          },
        })
      } catch (error) {
        console.error('[Chat] Error sending message:', error)
        addMessage(currentWorkbookId, {
          role: 'system',
          content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}. Your message was saved locally.`,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      } finally {
        setIsProcessing(false)
      }
    },
    [currentWorkbookId, addMessage, setInputValue, setIsProcessing, getContextForAI]
  )
}

/**
 * Hook for applying an action
 * Implements optimistic updates with backend sync
 */
export function useApplyAction() {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const updateActionStatus = useChatStore((state) => state.updateActionStatus)
  const addMessage = useChatStore((state) => state.addMessage)
  // Access workbook store actions
  const updateCell = useWorkbookStore((state) => state.updateCell)

  return useCallback(
    async (action: ChatAction) => {
      if (!currentWorkbookId) return

      try {
        // Optimistic update: Update action status locally first
        updateActionStatus(currentWorkbookId, action.id, 'applied')

        // TODO: Apply the actual changes to the workbook
        // This will depend on the action type and preview data
        // For now, just log
        console.log('[Chat] Applying action:', action)

        // Sync with backend
        const { updateActionStatus: updateActionStatusAPI } = await import('../services/chat.api')
        await updateActionStatusAPI(
          currentWorkbookId,
          action.id,
          'applied',
          action.preview?.after // Send the applied data
        )

        console.log('[Chat] Action status synced to backend')

        // Add confirmation message
        addMessage(currentWorkbookId, {
          role: 'system',
          content: `Applied action: ${action.description}`,
          actionId: action.id,
        })
      } catch (error) {
        console.error('[Chat] Error applying action:', error)
        // Revert status on error
        updateActionStatus(currentWorkbookId, action.id, 'pending')
        
        addMessage(currentWorkbookId, {
          role: 'system',
          content: `Failed to apply action: ${error instanceof Error ? error.message : 'Unknown error'}. Changes were not saved.`,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    },
    [currentWorkbookId, updateActionStatus, addMessage, updateCell]
  )
}

/**
 * Hook for cancelling an action
 * Implements optimistic updates with backend sync
 */
export function useCancelAction() {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const updateActionStatus = useChatStore((state) => state.updateActionStatus)
  const addMessage = useChatStore((state) => state.addMessage)

  return useCallback(
    async (action: ChatAction) => {
      if (!currentWorkbookId) return

      try {
        // Optimistic update: Update action status locally first
        updateActionStatus(currentWorkbookId, action.id, 'cancelled')

        // Sync with backend
        const { updateActionStatus: updateActionStatusAPI } = await import('../services/chat.api')
        await updateActionStatusAPI(
          currentWorkbookId,
          action.id,
          'cancelled'
        )

        console.log('[Chat] Action cancellation synced to backend')
      } catch (error) {
        console.error('[Chat] Error cancelling action:', error)
        // Revert status on error
        updateActionStatus(currentWorkbookId, action.id, 'pending')
        
        addMessage(currentWorkbookId, {
          role: 'system',
          content: `Failed to cancel action: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    },
    [currentWorkbookId, updateActionStatus, addMessage]
  )
}

/**
 * Hook to get AI context including workbook metadata
 */
export function useAIContext(): AIContext {
  const getContextForAI = useChatStore((state) => state.getContextForAI)
  const currentWorkbook = useWorkbookStore((state) => state.currentWorkbook)
  const activeSheet = useWorkbookStore((state) => state.activeSheet)
  const workbookData = useWorkbookStore((state) => state.workbookData)

  const baseContext = getContextForAI()
  
  // Enhance context with workbook metadata
  const sheet = workbookData?.sheets.find((s) => s.name === activeSheet)
  
  return {
    ...baseContext,
    workbookName: currentWorkbook?.name,
    sheetMetadata: sheet
      ? {
          name: sheet.name,
          rowCount: Object.keys(sheet.cells).length, // Approximate
          colCount: Object.keys(sheet.cells).length, // Approximate
        }
      : undefined,
  }
}

/**
 * Hook for clearing chat history
 * Syncs deletion with backend
 */
export function useClearChat() {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const clearChatHistory = useChatStore((state) => state.clearChatHistory)
  const addMessage = useChatStore((state) => state.addMessage)

  return useCallback(async () => {
    if (!currentWorkbookId) return
    
    if (!confirm('Are you sure you want to clear the chat history for this workbook?')) {
      return
    }

    try {
      // Optimistic update: Clear locally first
      clearChatHistory(currentWorkbookId)
      
      // Sync with backend
      const { deleteMessages } = await import('../services/chat.api')
      await deleteMessages(currentWorkbookId)
      
      console.log('[Chat] Chat history cleared on backend')
      
      // Add system message confirming deletion
      addMessage(currentWorkbookId, {
        role: 'system',
        content: 'Chat history has been cleared.',
      })
    } catch (error) {
      console.error('[Chat] Error clearing chat history:', error)
      addMessage(currentWorkbookId, {
        role: 'system',
        content: `Failed to clear chat history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }, [currentWorkbookId, clearChatHistory, addMessage])
}

/**
 * Hook for exporting chat history
 */
export function useExportChat() {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const chatsByWorkbook = useChatStore((state) => state.chatsByWorkbook)
  const currentWorkbook = useWorkbookStore((state) => state.currentWorkbook)

  return useCallback(() => {
    if (!currentWorkbookId || !currentWorkbook) return

    const chat = chatsByWorkbook[currentWorkbookId]
    if (!chat) return

    // Create export data
    const exportData = {
      workbookName: currentWorkbook.name,
      workbookId: currentWorkbookId,
      exportDate: new Date(),
      messages: chat.messages,
      actions: chat.actions,
      summary: chat.summary,
    }

    // Convert to JSON and download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${currentWorkbook.name}-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)

    // TODO: Implement PDF export in Sprint 3
  }, [currentWorkbookId, currentWorkbook, chatsByWorkbook])
}

/**
 * Hook to get all workbooks with unread messages
 */
export function useWorkbooksWithUnreadMessages() {
  const chatsByWorkbook = useChatStore((state) => state.chatsByWorkbook)
  
  return Object.values(chatsByWorkbook).filter(
    (chat) => chat.hasUnreadMessages
  )
}

/**
 * Hook for background sync of chat history
 * Periodically syncs local chat state with backend
 */
export function useBackgroundChatSync(intervalMs: number = 60000) {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const loadChatHistory = useChatStore((state) => state.loadChatHistory)
  const chatsByWorkbook = useChatStore((state) => state.chatsByWorkbook)

  useEffect(() => {
    if (!currentWorkbookId) return

    const syncInterval = setInterval(async () => {
      try {
        const { syncChatHistory } = await import('../services/chat.api')
        
        console.log(`[Chat] Background sync for workbook ${currentWorkbookId}`)
        const backendChat = await syncChatHistory(currentWorkbookId)
        
        // Only update if backend has newer data
        const localChat = chatsByWorkbook[currentWorkbookId]
        if (!localChat || new Date(backendChat.lastActivity) > new Date(localChat.lastActivity)) {
          loadChatHistory(currentWorkbookId, backendChat)
          console.log('[Chat] Background sync: Updated from backend')
        } else {
          console.log('[Chat] Background sync: Local data is current')
        }
      } catch (error) {
        console.error('[Chat] Background sync failed:', error)
        // Fail silently - don't interrupt user experience
      }
    }, intervalMs)

    return () => clearInterval(syncInterval)
  }, [currentWorkbookId, loadChatHistory, chatsByWorkbook, intervalMs])
}
