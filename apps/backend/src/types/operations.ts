import { z } from 'zod'

/**
 * Cell reference in A1 notation (e.g., "A1", "B2", "AA100")
 */
export const CellRefSchema = z.string().regex(/^[A-Z]+[0-9]+$/, {
  message: 'Invalid cell reference. Must be in A1 notation (e.g., A1, B2, AA100)',
})

export type CellRef = z.infer<typeof CellRefSchema>

/**
 * Range reference in A1 notation (e.g., "A1:B10", "C5:C5")
 */
export const RangeRefSchema = z.string().regex(/^[A-Z]+[0-9]+:[A-Z]+[0-9]+$/, {
  message: 'Invalid range reference. Must be in A1:A1 notation (e.g., A1:B10)',
})

export type RangeRef = z.infer<typeof RangeRefSchema>

/**
 * Cell value type - can be string, number, boolean, or null
 */
export const CellValueTypeSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

export type CellValueType = z.infer<typeof CellValueTypeSchema>

/**
 * Cell format options
 */
export const CellFormatSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: z.string().optional(), // CSS color string
  backgroundColor: z.string().optional(), // CSS color string
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  numberFormat: z.string().optional(), // e.g., "0.00", "$#,##0.00", "0%"
})

export type CellFormat = z.infer<typeof CellFormatSchema>

/**
 * Operation: Set cell value or formula
 */
export const SetCellOpSchema = z.object({
  kind: z.literal('set_cell'),
  sheet: z.string(), // Sheet name
  cell: CellRefSchema,
  value: CellValueTypeSchema.optional(),
  formula: z.string().optional(), // Should start with '='
  format: CellFormatSchema.optional(),
})

export type SetCellOp = z.infer<typeof SetCellOpSchema>

/**
 * Operation: Fill a range with a value or formula
 */
export const FillRangeOpSchema = z.object({
  kind: z.literal('fill_range'),
  sheet: z.string(),
  range: RangeRefSchema,
  value: CellValueTypeSchema.optional(),
  formula: z.string().optional(),
  format: CellFormatSchema.optional(),
})

export type FillRangeOp = z.infer<typeof FillRangeOpSchema>

/**
 * Operation: Insert rows
 */
export const InsertRowsOpSchema = z.object({
  kind: z.literal('insert_rows'),
  sheet: z.string(),
  startRow: z.number().int().positive(),
  count: z.number().int().positive().default(1),
})

export type InsertRowsOp = z.infer<typeof InsertRowsOpSchema>

/**
 * Operation: Insert columns
 */
export const InsertColsOpSchema = z.object({
  kind: z.literal('insert_cols'),
  sheet: z.string(),
  startCol: z.number().int().positive(),
  count: z.number().int().positive().default(1),
})

export type InsertColsOp = z.infer<typeof InsertColsOpSchema>

/**
 * Operation: Delete rows
 */
export const DeleteRowsOpSchema = z.object({
  kind: z.literal('delete_rows'),
  sheet: z.string(),
  startRow: z.number().int().positive(),
  count: z.number().int().positive().default(1),
})

export type DeleteRowsOp = z.infer<typeof DeleteRowsOpSchema>

/**
 * Operation: Delete columns
 */
export const DeleteColsOpSchema = z.object({
  kind: z.literal('delete_cols'),
  sheet: z.string(),
  startCol: z.number().int().positive(),
  count: z.number().int().positive().default(1),
})

export type DeleteColsOp = z.infer<typeof DeleteColsOpSchema>

/**
 * Operation: Add a new sheet
 */
export const AddSheetOpSchema = z.object({
  kind: z.literal('add_sheet'),
  name: z.string().min(1).max(100),
})

export type AddSheetOp = z.infer<typeof AddSheetOpSchema>

/**
 * Operation: Rename a sheet
 */
export const RenameSheetOpSchema = z.object({
  kind: z.literal('rename_sheet'),
  oldName: z.string(),
  newName: z.string().min(1).max(100),
})

export type RenameSheetOp = z.infer<typeof RenameSheetOpSchema>

/**
 * Operation: Delete a sheet
 */
export const DeleteSheetOpSchema = z.object({
  kind: z.literal('delete_sheet'),
  name: z.string(),
})

export type DeleteSheetOp = z.infer<typeof DeleteSheetOpSchema>

/**
 * Operation: Format a range
 */
export const FormatRangeOpSchema = z.object({
  kind: z.literal('format_range'),
  sheet: z.string(),
  range: RangeRefSchema,
  format: CellFormatSchema,
})

export type FormatRangeOp = z.infer<typeof FormatRangeOpSchema>

/**
 * Union of all operation types
 */
export const OperationSchema = z.discriminatedUnion('kind', [
  SetCellOpSchema,
  FillRangeOpSchema,
  InsertRowsOpSchema,
  InsertColsOpSchema,
  DeleteRowsOpSchema,
  DeleteColsOpSchema,
  AddSheetOpSchema,
  RenameSheetOpSchema,
  DeleteSheetOpSchema,
  FormatRangeOpSchema,
])

export type Operation = z.infer<typeof OperationSchema>

/**
 * Array of operations
 */
export const OperationsSchema = z.array(OperationSchema)

export type Operations = z.infer<typeof OperationsSchema>

/**
 * AI Plan structure - returned by AI service
 */
export const AiPlanSchema = z.object({
  id: z.string().optional(), // Plan ID if stored
  instructions: z.string(), // Original user instructions
  reasoning: z.string().optional(), // AI's explanation of the plan
  operations: OperationsSchema,
  confidence: z.number().min(0).max(1).optional(), // AI confidence in the plan
  warnings: z.array(z.string()).optional(), // Any warnings about the plan
  estimatedCost: z.number().optional(), // Credit cost estimate
})

export type AiPlan = z.infer<typeof AiPlanSchema>

/**
 * Result of applying operations
 */
export const ApplyResultSchema = z.object({
  success: z.boolean(),
  appliedOps: z.number(), // Number of operations successfully applied
  errors: z.array(
    z.object({
      opIndex: z.number(),
      operation: OperationSchema,
      error: z.string(),
    })
  ),
  newVersion: z.number().optional(), // New workbook version after applying ops
  actionId: z.string().optional(), // ID of the Action record created
})

export type ApplyResult = z.infer<typeof ApplyResultSchema>

/**
 * Operation validation error
 */
export interface OpValidationError {
  opIndex: number
  operation: Operation
  error: string
}

/**
 * Workbook data snapshot for operations
 */
export interface WorkbookSnapshot {
  sheets: Array<{
    name: string
    cells: Record<string, CellData>
  }>
}

/**
 * Cell data in workbook
 */
export interface CellData {
  value?: string | number | boolean | null
  formula?: string
  format?: CellFormat
}
