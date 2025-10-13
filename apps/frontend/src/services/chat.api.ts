import type {
  ChatMessage,
  ChatAction,
  WorkbookChat,
  ActionStatus,
} from '../types/chat.types'

// API base URL - defaults to backend running on port 3001
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ============================================
// API Response Types
// ============================================

interface PaginationMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

interface MessagesResponse {
  success: boolean
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    metadata?: Record<string, any>
    createdAt: string
  }>
  pagination: PaginationMeta
}

interface ActionsResponse {
  success: boolean
  actions: Array<{
    id: string
    description: string
    affectedRange: string
    status: ActionStatus
    timestamp: string
    preview?: {
      before: Record<string, any>
      after: Record<string, any>
    }
    metadata?: {
      confidence?: number
      tokensUsed?: number
      estimatedCells?: number
    }
  }>
  pagination: PaginationMeta
}

// ============================================
// Chat Message API
// ============================================

/**
 * Fetch conversation history for a workbook
 */
export async function fetchMessages(
  workbookId: string,
  options?: {
    limit?: number
    offset?: number
  }
): Promise<ChatMessage[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())

  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/conversations?${params}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch messages' }))
    throw new Error(error.message || 'Failed to fetch messages')
  }

  const data: MessagesResponse = await response.json()

  // Transform API response to ChatMessage format
  return data.messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.createdAt),
    metadata: msg.metadata,
  }))
}

/**
 * Send a new message and receive AI response
 */
export async function sendMessage(
  workbookId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<ChatMessage> {
  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/conversations`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'user',
        content,
        metadata,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to send message' }))
    throw new Error(error.message || 'Failed to send message')
  }

  const data = await response.json()

  // Return user message (AI response will come via SSE or separate endpoint)
  return {
    id: data.message.id,
    role: 'user',
    content,
    timestamp: new Date(data.message.createdAt),
    metadata,
  }
}

/**
 * Delete conversation history for a workbook
 */
export async function deleteMessages(workbookId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/conversations`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete messages' }))
    throw new Error(error.message || 'Failed to delete messages')
  }
}

// ============================================
// Actions API
// ============================================

/**
 * Fetch actions for a workbook
 */
export async function fetchActions(
  workbookId: string,
  options?: {
    limit?: number
    offset?: number
    status?: ActionStatus
  }
): Promise<ChatAction[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  if (options?.status) params.append('status', options.status)

  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/actions?${params}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch actions' }))
    throw new Error(error.message || 'Failed to fetch actions')
  }

  const data: ActionsResponse = await response.json()

  // Transform API response to ChatAction format
  return data.actions.map((action) => ({
    id: action.id,
    description: action.description,
    affectedRange: action.affectedRange,
    status: action.status,
    timestamp: new Date(action.timestamp),
    preview: action.preview,
    metadata: {
      confidence: action.metadata?.confidence,
      tokensUsed: action.metadata?.tokensUsed,
      estimatedCells: action.metadata?.estimatedCells,
    },
  }))
}

/**
 * Create a new action
 */
export async function createAction(
  workbookId: string,
  action: {
    type: string
    description: string
    affectedRange: string
    data: Record<string, any>
    preview?: {
      before: Record<string, any>
      after: Record<string, any>
    }
    metadata?: {
      confidence?: number
      tokensUsed?: number
      estimatedCells?: number
    }
  }
): Promise<ChatAction> {
  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/actions`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create action' }))
    throw new Error(error.message || 'Failed to create action')
  }

  const data = await response.json()

  return {
    id: data.action.id,
    description: action.description,
    affectedRange: action.affectedRange,
    status: 'pending',
    timestamp: new Date(data.action.timestamp),
    preview: action.preview,
    metadata: {
      confidence: action.metadata?.confidence,
      tokensUsed: action.metadata?.tokensUsed,
      estimatedCells: action.metadata?.estimatedCells,
    },
  }
}

/**
 * Update action status (apply or cancel)
 */
export async function updateActionStatus(
  workbookId: string,
  actionId: string,
  status: 'applied' | 'cancelled',
  appliedData?: Record<string, any>
): Promise<ChatAction> {
  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/actions/${actionId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        appliedData,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update action' }))
    throw new Error(error.message || 'Failed to update action')
  }

  const data = await response.json()

  return {
    id: data.action.id,
    description: data.action.description,
    affectedRange: data.action.affectedRange,
    status: data.action.status,
    timestamp: new Date(data.action.timestamp),
    preview: data.action.preview,
    metadata: {
      confidence: data.action.metadata?.confidence,
      tokensUsed: data.action.metadata?.tokensUsed,
      estimatedCells: data.action.metadata?.estimatedCells,
    },
  }
}

/**
 * Delete an action
 */
export async function deleteAction(
  workbookId: string,
  actionId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/workbooks/${workbookId}/actions/${actionId}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete action' }))
    throw new Error(error.message || 'Failed to delete action')
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Sync local chat state with backend (used on workbook open)
 */
export async function syncChatHistory(workbookId: string): Promise<WorkbookChat> {
  const [messages, actions] = await Promise.all([
    fetchMessages(workbookId, { limit: 100 }),
    fetchActions(workbookId, { limit: 50 }),
  ])

  return {
    workbookId,
    messages,
    actions,
    lastActivity: new Date(),
  }
}
