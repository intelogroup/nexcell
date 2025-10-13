import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../lib/api'

/**
 * AI Plan interface matching backend response
 */
export interface AiPlan {
  id: string
  workbookId: string
  instructions: string
  operations: Operation[]
  reasoning?: string
  estimatedChanges?: string
  warnings?: string[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdAt: string
}

/**
 * Operation types from backend
 */
export type Operation =
  | SetCellOp
  | FillRangeOp
  | InsertRowsOp
  | InsertColsOp
  | DeleteRowsOp
  | DeleteColsOp
  | AddSheetOp
  | RenameSheetOp
  | DeleteSheetOp
  | FormatRangeOp

export interface SetCellOp {
  kind: 'set_cell'
  sheet: string
  cell: string
  value?: string | number | boolean | null
  formula?: string
  format?: CellFormat
}

export interface FillRangeOp {
  kind: 'fill_range'
  sheet: string
  range: string
  value?: string | number | boolean | null
  formula?: string
  format?: CellFormat
}

export interface InsertRowsOp {
  kind: 'insert_rows'
  sheet: string
  startRow: number
  count: number
}

export interface InsertColsOp {
  kind: 'insert_cols'
  sheet: string
  startCol: number
  count: number
}

export interface DeleteRowsOp {
  kind: 'delete_rows'
  sheet: string
  startRow: number
  count: number
}

export interface DeleteColsOp {
  kind: 'delete_cols'
  sheet: string
  startCol: number
  count: number
}

export interface AddSheetOp {
  kind: 'add_sheet'
  name: string
}

export interface RenameSheetOp {
  kind: 'rename_sheet'
  oldName: string
  newName: string
}

export interface DeleteSheetOp {
  kind: 'delete_sheet'
  name: string
}

export interface FormatRangeOp {
  kind: 'format_range'
  sheet: string
  range: string
  format: CellFormat
}

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  backgroundColor?: string
  fontSize?: number
  fontFamily?: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  numberFormat?: string
}

/**
 * Plan request/response types
 */
export interface GeneratePlanRequest {
  workbookId: string
  instructions: string
}

export interface GeneratePlanResponse {
  success: boolean
  plan: AiPlan
}

/**
 * Apply request/response types
 */
export interface ApplyPlanRequest {
  workbookId: string
  planId?: string
  operations?: Operation[]
}

export interface ApplyPlanResponse {
  success: boolean
  workbook: {
    id: string
    version: number
  }
  result: {
    appliedOps: number
    errors: Array<{
      opIndex: number
      operation: Operation
      error: string
    }>
  }
  planId?: string
}

/**
 * Conversation message type
 */
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
  createdAt: string
}

/**
 * Hook to fetch conversation history for a workbook
 */
export function useConversationHistory(workbookId: string) {
  const api = useApi()

  return useQuery({
    queryKey: ['conversations', workbookId],
    queryFn: async () => {
      const response = await api.get<{
        success: boolean
        messages: ConversationMessage[]
        pagination: {
          total: number
          limit: number
          offset: number
          hasMore: boolean
        }
      }>(`/api/workbooks/${workbookId}/conversations?limit=50`)
      return response
    },
    enabled: !!workbookId,
  })
}

/**
 * Hook to generate an AI plan from natural language instructions
 * Costs 5 credits
 */
export function useGenerateAiPlan() {
  const api = useApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: GeneratePlanRequest) => {
      const response = await api.post<GeneratePlanResponse>(
        '/api/ai/plan',
        request
      )
      return response
    },
    onSuccess: (_, variables) => {
      // Invalidate conversation history to refetch
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.workbookId] })
    },
  })
}

/**
 * Hook to apply an AI plan or operations to a workbook
 * Costs 10 credits
 */
export function useApplyAiPlan() {
  const api = useApi()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: ApplyPlanRequest) => {
      const response = await api.post<ApplyPlanResponse>(
        '/api/ai/apply',
        request
      )
      return response
    },
    onSuccess: (data) => {
      // Invalidate workbook queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['workbook', data.workbook.id] })
    },
  })
}

/**
 * Format operation for display
 */
export function formatOperation(op: Operation): string {
  switch (op.kind) {
    case 'set_cell':
      return `Set ${op.sheet}!${op.cell} to ${op.formula || op.value || 'empty'}`
    case 'fill_range':
      return `Fill ${op.sheet}!${op.range} with ${op.formula || op.value || 'empty'}`
    case 'insert_rows':
      return `Insert ${op.count} row(s) at row ${op.startRow} in ${op.sheet}`
    case 'insert_cols':
      return `Insert ${op.count} column(s) at column ${op.startCol} in ${op.sheet}`
    case 'delete_rows':
      return `Delete ${op.count} row(s) starting at row ${op.startRow} in ${op.sheet}`
    case 'delete_cols':
      return `Delete ${op.count} column(s) starting at column ${op.startCol} in ${op.sheet}`
    case 'add_sheet':
      return `Add sheet "${op.name}"`
    case 'rename_sheet':
      return `Rename sheet "${op.oldName}" to "${op.newName}"`
    case 'delete_sheet':
      return `Delete sheet "${op.name}"`
    case 'format_range':
      return `Format ${op.sheet}!${op.range}`
    default:
      return 'Unknown operation'
  }
}
