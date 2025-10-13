/**
 * Chat-related type definitions
 * Shared types for chat messages, actions, and AI interactions
 */

/**
 * Role of the message sender
 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * Status of an AI-proposed action
 */
export type ActionStatus = 'pending' | 'applied' | 'cancelled'

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  actionId?: string // Link to action if this message proposed an action
  metadata?: ChatMessageMetadata
}

/**
 * Metadata for chat messages
 */
export interface ChatMessageMetadata {
  tokensUsed?: number
  confidence?: number
  affectedRange?: string
  model?: string
  error?: string
  [key: string]: any // Allow additional metadata fields
}

/**
 * Action structure for AI-proposed changes
 */
export interface ChatAction {
  id: string
  description: string
  affectedRange: string
  status: ActionStatus
  timestamp: Date
  preview?: ActionPreview
  metadata?: ActionMetadata
}

/**
 * Preview of changes before/after applying an action
 */
export interface ActionPreview {
  before: Record<string, any>
  after: Record<string, any>
}

/**
 * Metadata for actions
 */
export interface ActionMetadata {
  tokensUsed?: number
  confidence?: number
  estimatedCells?: number
}

/**
 * Per-workbook chat context
 */
export interface WorkbookChat {
  workbookId: string
  messages: ChatMessage[]
  actions: ChatAction[]
  summary?: string // Summary of older messages for context window management
  lastActivity: Date
  hasUnreadMessages?: boolean
}

/**
 * Selected range context for AI awareness
 */
export interface SelectedRange {
  sheetName: string
  range: string // e.g., "A1:C10"
  cellCount: number
  rowCount: number
  colCount: number
}

/**
 * UI state for chat panel
 */
export interface ChatUIState {
  isCollapsed: boolean
  showActionTimeline: boolean
  showPreview: boolean
  splitViewEnabled: boolean
  commandPaletteOpen: boolean
}

/**
 * Context provided to AI for generating responses
 */
export interface AIContext {
  workbookId: string | null
  workbookName?: string
  selectedRange: SelectedRange | null
  recentMessages: ChatMessage[]
  visibleCells?: Record<string, any>
  sheetMetadata?: {
    name: string
    rowCount: number
    colCount: number
  }
}

/**
 * AI response structure
 */
export interface AIResponse {
  message: string
  action?: Omit<ChatAction, 'id' | 'timestamp'>
  suggestions?: string[]
  confidence?: number
}

/**
 * Prompt template structure
 */
export interface PromptTemplate {
  id: string
  icon: string
  label: string
  prompt: string
  category?: 'create' | 'format' | 'analyze' | 'transform'
}

/**
 * Smart suggestion structure
 */
export interface SmartSuggestion {
  id: string
  icon: string
  title: string
  description: string
  prompt: string
  confidence: number
}

/**
 * Chat export format
 */
export interface ChatExport {
  workbookName: string
  workbookId: string
  exportDate: Date
  messages: ChatMessage[]
  actions: ChatAction[]
  summary?: string
}

/**
 * Command palette command
 */
export interface Command {
  id: string
  label: string
  description?: string
  icon?: string
  shortcut?: string
  action: () => void
  category?: 'workbook' | 'chat' | 'view' | 'export'
}
