import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type {
  ChatMessage,
  ChatAction,
  WorkbookChat,
  SelectedRange,
  ChatUIState,
} from '../types/chat.types'

// Re-export types for convenience
export type { ChatMessage, ChatAction, WorkbookChat, SelectedRange, ChatUIState } from '../types/chat.types'

/**
 * Chat store state interface
 */
interface ChatState {
  // Per-workbook chat history
  chatsByWorkbook: Record<string, WorkbookChat>
  
  // Current context
  currentWorkbookId: string | null
  selectedRange: SelectedRange | null
  
  // UI state
  uiState: ChatUIState
  
  // Pending action being previewed
  previewingAction: ChatAction | null
  
  // Input state
  inputValue: string
  isProcessing: boolean
  
  // Actions - Chat Management
  setCurrentWorkbookId: (workbookId: string | null) => void
  getChatHistory: (workbookId: string) => ChatMessage[]
  addMessage: (workbookId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearChatHistory: (workbookId: string) => void
  markMessagesAsRead: (workbookId: string) => void
  
  // Actions - Action Management
  addAction: (workbookId: string, action: Omit<ChatAction, 'id' | 'timestamp'>) => void
  updateActionStatus: (workbookId: string, actionId: string, status: ChatAction['status']) => void
  getActions: (workbookId: string) => ChatAction[]
  getPendingActions: (workbookId: string) => ChatAction[]
  
  // Actions - Context Management
  setSelectedRange: (range: SelectedRange | null) => void
  getContextForAI: () => {
    workbookId: string | null
    selectedRange: SelectedRange | null
    recentMessages: ChatMessage[]
  }
  
  // Actions - UI State
  toggleChatCollapsed: () => void
  toggleActionTimeline: () => void
  toggleSplitView: () => void
  setCommandPaletteOpen: (open: boolean) => void
  setPreviewingAction: (action: ChatAction | null) => void
  
  // Actions - Input Management
  setInputValue: (value: string) => void
  setIsProcessing: (isProcessing: boolean) => void
  
  // Actions - Initialization
  loadChatHistory: (workbookId: string, chat: WorkbookChat) => void
  initializeWorkbookChat: (workbookId: string) => void
}

/**
 * Chat store using Zustand with persistence
 */
export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        chatsByWorkbook: {},
        currentWorkbookId: null,
        selectedRange: null,
        uiState: {
          isCollapsed: false,
          showActionTimeline: false,
          showPreview: false,
          splitViewEnabled: false,
          commandPaletteOpen: false,
        },
        previewingAction: null,
        inputValue: '',
        isProcessing: false,

        // Chat Management
        setCurrentWorkbookId: (workbookId) => {
          set({ currentWorkbookId: workbookId })
          
          // Initialize chat if it doesn't exist
          if (workbookId && !get().chatsByWorkbook[workbookId]) {
            get().initializeWorkbookChat(workbookId)
          }
        },

        getChatHistory: (workbookId) => {
          const chat = get().chatsByWorkbook[workbookId]
          return chat?.messages || []
        },

        addMessage: (workbookId, message) => {
          const newMessage: ChatMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          }

          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: {
                ...state.chatsByWorkbook[workbookId],
                messages: [
                  ...(state.chatsByWorkbook[workbookId]?.messages || []),
                  newMessage,
                ],
                lastActivity: new Date(),
                // Mark as unread if message is from assistant and workbook is not current
                hasUnreadMessages: 
                  message.role === 'assistant' && state.currentWorkbookId !== workbookId
                    ? true
                    : state.chatsByWorkbook[workbookId]?.hasUnreadMessages,
              },
            },
          }))
        },

        clearChatHistory: (workbookId) => {
          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: {
                ...state.chatsByWorkbook[workbookId],
                messages: [],
                actions: [],
                lastActivity: new Date(),
              },
            },
          }))
        },

        markMessagesAsRead: (workbookId) => {
          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: {
                ...state.chatsByWorkbook[workbookId],
                hasUnreadMessages: false,
              },
            },
          }))
        },

        // Action Management
        addAction: (workbookId, action) => {
          const newAction: ChatAction = {
            ...action,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          }

          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: {
                ...state.chatsByWorkbook[workbookId],
                actions: [
                  ...(state.chatsByWorkbook[workbookId]?.actions || []),
                  newAction,
                ],
                lastActivity: new Date(),
              },
            },
          }))

          return newAction.id
        },

        updateActionStatus: (workbookId, actionId, status) => {
          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: {
                ...state.chatsByWorkbook[workbookId],
                actions: state.chatsByWorkbook[workbookId]?.actions.map((action) =>
                  action.id === actionId ? { ...action, status } : action
                ) || [],
                lastActivity: new Date(),
              },
            },
          }))
        },

        getActions: (workbookId) => {
          const chat = get().chatsByWorkbook[workbookId]
          return chat?.actions || []
        },

        getPendingActions: (workbookId) => {
          const chat = get().chatsByWorkbook[workbookId]
          return chat?.actions.filter((action) => action.status === 'pending') || []
        },

        // Context Management
        setSelectedRange: (range) => {
          set({ selectedRange: range })
        },

        getContextForAI: () => {
          const state = get()
          const workbookId = state.currentWorkbookId
          const recentMessages = workbookId 
            ? state.getChatHistory(workbookId).slice(-10) // Last 10 messages
            : []

          return {
            workbookId,
            selectedRange: state.selectedRange,
            recentMessages,
          }
        },

        // UI State
        toggleChatCollapsed: () => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              isCollapsed: !state.uiState.isCollapsed,
            },
          }))
        },

        toggleActionTimeline: () => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              showActionTimeline: !state.uiState.showActionTimeline,
            },
          }))
        },

        toggleSplitView: () => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              splitViewEnabled: !state.uiState.splitViewEnabled,
            },
          }))
        },

        setCommandPaletteOpen: (open) => {
          set((state) => ({
            uiState: {
              ...state.uiState,
              commandPaletteOpen: open,
            },
          }))
        },

        setPreviewingAction: (action) => {
          set({ previewingAction: action })
        },

        // Input Management
        setInputValue: (value) => {
          set({ inputValue: value })
        },

        setIsProcessing: (isProcessing) => {
          set({ isProcessing })
        },

        // Initialization
        loadChatHistory: (workbookId, chat) => {
          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: chat,
            },
          }))
        },

        initializeWorkbookChat: (workbookId) => {
          const existingChat = get().chatsByWorkbook[workbookId]
          if (existingChat) return

          set((state) => ({
            chatsByWorkbook: {
              ...state.chatsByWorkbook,
              [workbookId]: {
                workbookId,
                messages: [],
                actions: [],
                lastActivity: new Date(),
                hasUnreadMessages: false,
              },
            },
          }))
        },
      }),
      {
        name: 'chat-store',
        // Only persist chat history, not UI state
        partialize: (state) => ({
          chatsByWorkbook: state.chatsByWorkbook,
        }),
      }
    ),
    {
      name: 'ChatStore',
      enabled: import.meta.env.DEV,
    }
  )
)

// Selectors for common queries
export const useCurrentWorkbookChat = () => {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const chatsByWorkbook = useChatStore((state) => state.chatsByWorkbook)
  
  return currentWorkbookId ? chatsByWorkbook[currentWorkbookId] : null
}

export const useChatMessages = () => {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const getChatHistory = useChatStore((state) => state.getChatHistory)
  
  return currentWorkbookId ? getChatHistory(currentWorkbookId) : []
}

export const usePendingActions = () => {
  const currentWorkbookId = useChatStore((state) => state.currentWorkbookId)
  const getPendingActions = useChatStore((state) => state.getPendingActions)
  
  return currentWorkbookId ? getPendingActions(currentWorkbookId) : []
}

export const useSelectedRange = () => useChatStore((state) => state.selectedRange)

export const useChatUIState = () => useChatStore((state) => state.uiState)

export const useIsProcessing = () => useChatStore((state) => state.isProcessing)
