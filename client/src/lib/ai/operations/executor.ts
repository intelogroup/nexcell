/**
 * WorkbookOperationExecutor
 * 
 * Executes AI-generated WorkbookOperation sequences against workbooks.
 * 
 * Design Principles:
 * - Stateless: Each execute() call is independent
 * - Type-safe: All operations validated at runtime
 * - Error-resilient: Failed operations don't crash execution
 * - Non-destructive: Original workbook can be preserved via deep clone
 * 
 * Architecture:
 * 1. Takes array of WorkbookOperation objects from AI
 * 2. Executes them in sequence using existing workbook utils
 * 3. Returns updated workbook + execution results
 * 
 * References:
 * - operations/types.ts: Operation type definitions
 * - workbook/utils.ts: createWorkbook, addSheet, setCell functions
 * - workbook/hyperformula.ts: hydrateHFFromWorkbook, recomputeAndPatchCache
 */

import type {
  WorkbookOperation,
  OperationExecutionResult,
  OperationError,
  CreateWorkbookOperation,
  AddSheetOperation,
  RemoveSheetOperation,
  RenameSheetOperation,
  SetCellsOperation,
  SetFormulaOperation,
  ApplyFormatOperation,
  MergeCellsOperation,
  DefineNamedRangeOperation,
  ComputeOperation,
  ImportXLSXOperation,
  ExportXLSXOperation,
} from './types';

import type { WorkbookJSON, SheetJSON } from '../../workbook/types';
import { 
  createWorkbook, 
  addSheet, 
  deleteSheet, 
  getSheet, 
  getSheetByName, 
  setCell, 
  getCell, 
  parseAddress, 
  parseRange, 
  getCellsInRange,
  normalizeFormula,
  getErrorMessage,
} from '../../workbook/utils';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../../workbook/hyperformula';

/**
 * Options for operation execution
 */
export interface ExecutorOptions {
  /** Stop execution on first error (default: false) */
  stopOnError?: boolean;
  /** Deep clone workbook before executing (default: true for safety) */
  cloneWorkbook?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Current chat mode - operations are blocked in 'plan' mode (default: 'act') */
  mode?: 'plan' | 'act';
}

/**
 * Internal execution context
 * Tracks state during operation execution
 */
interface ExecutionContext {
  /** Current workbook being modified */
  workbook: WorkbookJSON | null;
  /** Errors encountered during execution */
  errors: OperationError[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
  /** Number of operations executed successfully */
  successCount: number;
  /** HyperFormula hydration (created on first compute, destroyed on cleanup) */
  hfHydration: any | null;
}

/**
 * WorkbookOperationExecutor
 * 
 * Main execution engine for AI-generated workbook operations.
 * 
 * Example usage:
 * ```typescript
 * const executor = new WorkbookOperationExecutor();
 * const operations = [
 *   { type: 'createWorkbook', params: { name: 'Budget' } },
 *   { type: 'setCells', params: { sheet: 'Sheet1', cells: { A1: { value: 'Total', dataType: 'string' } } } },
 *   { type: 'compute', params: {} }
 * ];
 * 
 * const result = await executor.execute(operations);
 * if (result.success) {
 *   console.log('Workbook created:', result.workbook);
 * }
 * ```
 */
export class WorkbookOperationExecutor {
  private options: ExecutorOptions;

  constructor(options: ExecutorOptions = {}) {
    this.options = {
      stopOnError: false,
      cloneWorkbook: true,
      debug: false,
      mode: 'act', // Default to 'act' mode - operations execute immediately
      ...options,
    };
  }

  /**
   * Execute a sequence of operations
   * 
   * @param operations - Array of WorkbookOperation objects to execute
   * @param existingWorkbook - Optional existing workbook to modify (if null, first operation must be createWorkbook)
   * @returns Execution result with workbook and errors
   */
  async execute(
    operations: WorkbookOperation[],
    existingWorkbook: WorkbookJSON | null = null
  ): Promise<OperationExecutionResult> {
    this.log('Starting execution of', operations.length, 'operations');

    // Plan mode check: Block execution if in plan mode
    if (this.options.mode === 'plan') {
      this.log('⚠️ Execution blocked: Chat is in PLAN mode. Switch to ACT mode to execute operations.');
      return {
        success: false,
        workbook: existingWorkbook || undefined,
        errors: [
          {
            operationIndex: -1,
            operation: { type: 'mode_check', params: {} } as any,
            message: 'Cannot execute operations in PLAN mode. Plan mode is for brainstorming and discussion only. Switch to ACT mode to execute commands.',
            code: 'PLAN_MODE_BLOCKED',
          },
        ],
        warnings: [
          'Execution blocked by plan mode. The AI should be discussing and planning, not executing operations.',
          'If you want to execute this plan, switch to ACT mode first.',
        ],
        operationsExecuted: 0,
        operationsTotal: operations.length,
      };
    }

    // Initialize execution context
    const ctx: ExecutionContext = {
      workbook: existingWorkbook ? this.cloneIfNeeded(existingWorkbook) : null,
      errors: [],
      warnings: [],
      successCount: 0,
      hfHydration: null,
    };

    try {
      // Execute each operation in sequence
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        this.log(`Executing operation ${i + 1}/${operations.length}:`, operation.type);

        try {
          await this.executeOne(ctx, operation, i);
          ctx.successCount++;
        } catch (err) {
          const error: OperationError = {
            operationIndex: i,
            operation,
            message: getErrorMessage(err),
            code: 'EXECUTION_ERROR',
          };
          ctx.errors.push(error);

          this.log(`Error executing operation ${i}:`, error.message);

          // Stop on error if requested
          if (this.options.stopOnError) {
            this.log('Stopping execution due to error (stopOnError=true)');
            break;
          }
        }
      }

      // Cleanup: destroy HyperFormula instance if it was created
      this.cleanup(ctx);

      // Build result
      const result: OperationExecutionResult = {
        success: ctx.errors.length === 0,
        workbook: ctx.workbook || undefined,
        errors: ctx.errors,
        warnings: ctx.warnings,
        operationsExecuted: ctx.successCount,
        operationsTotal: operations.length,
      };

      this.log('Execution complete:', {
        success: result.success,
        executed: result.operationsExecuted,
        total: result.operationsTotal,
        errors: result.errors.length,
        warnings: result.warnings?.length || 0,
      });

      return result;
    } catch (err) {
      // Catch-all for unexpected errors during execution loop
      this.cleanup(ctx);
      
      return {
        success: false,
        workbook: ctx.workbook || undefined,
        errors: [
          ...ctx.errors,
          {
            operationIndex: -1,
            operation: { type: 'unknown', params: {} } as any,
            message: `Unexpected execution error: ${getErrorMessage(err)}`,
            code: 'UNEXPECTED_ERROR',
          },
        ],
        warnings: ctx.warnings,
        operationsExecuted: ctx.successCount,
        operationsTotal: operations.length,
      };
    }
  }

  /**
   * Execute a single operation
   * 
   * @param ctx - Execution context
   * @param operation - Operation to execute
   * @param _index - Operation index (for error reporting)
   */
  private async executeOne(
    ctx: ExecutionContext,
    operation: WorkbookOperation,
    _index: number
  ): Promise<void> {
    // Dispatch to operation-specific handler
    switch (operation.type) {
      case 'createWorkbook':
        this.executeCreateWorkbook(ctx, operation);
        break;
      case 'addSheet':
        this.executeAddSheet(ctx, operation);
        break;
      case 'removeSheet':
        this.executeRemoveSheet(ctx, operation);
        break;
      case 'renameSheet':
        this.executeRenameSheet(ctx, operation);
        break;
      case 'setCells':
        this.executeSetCells(ctx, operation);
        break;
      case 'setFormula':
        this.executeSetFormula(ctx, operation);
        break;
      case 'applyFormat':
        this.executeApplyFormat(ctx, operation);
        break;
      case 'mergeCells':
        this.executeMergeCells(ctx, operation);
        break;
      case 'defineNamedRange':
        this.executeDefineNamedRange(ctx, operation);
        break;
      case 'compute':
        this.executeCompute(ctx, operation);
        break;
      case 'importXLSX':
        this.executeImportXLSX(ctx, operation);
        break;
      case 'exportXLSX':
        this.executeExportXLSX(ctx, operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  /**
   * Cleanup resources (e.g., destroy HyperFormula instance)
   * 
   * @param ctx - Execution context
   */
  private cleanup(ctx: ExecutionContext): void {
    if (ctx.hfHydration && ctx.hfHydration.hf) {
      this.log('Destroying HyperFormula instance');
      try {
        ctx.hfHydration.hf.destroy();
      } catch (err) {
        this.log('Warning: Failed to destroy HF instance:', err);
      }
      ctx.hfHydration = null;
    }
  }

  /**
   * Resolve sheet by ID or name
   * 
   * Attempts to find a sheet by ID first, then by name if not found.
   * This is a convenience helper to support both sheet identifiers.
   * 
   * @param workbook - Workbook to search in
   * @param sheetIdentifier - Sheet ID or name
   * @returns Sheet object
   * @throws Error if sheet is not found
   */
  private resolveSheet(workbook: WorkbookJSON, sheetIdentifier: string): SheetJSON {
    // Try to find by ID first
    const maybeById = getSheet(workbook, sheetIdentifier);
    if (maybeById) {
      return maybeById;
    }
    
    // Try to find by name
    const maybeByName = getSheetByName(workbook, sheetIdentifier);
    if (maybeByName) {
      return maybeByName;
    }
    
    // Not found
    throw new Error(`Sheet not found: ${sheetIdentifier}`);
  }

  // ============================================================================
  // Operation Handlers
  // ============================================================================

  /**
   * Execute createWorkbook operation
   * 
   * Creates a new workbook with the specified name and optional initial sheets.
   * If initialSheets are provided, removes the default Sheet1 and creates the requested sheets.
   * 
   * Validation:
   * - Workbook must not already exist in context
   * - Name must not be empty
   * - If initialSheets provided, each name must be unique
   */
  private executeCreateWorkbook(ctx: ExecutionContext, op: CreateWorkbookOperation): void {
    this.log('Creating workbook:', op.params.name);

    // Validation: ensure no workbook exists yet
    if (ctx.workbook !== null) {
      throw new Error('Workbook already exists. Cannot create multiple workbooks in one execution.');
    }

    // Validation: ensure name is provided and not empty
    const name = op.params.name?.trim();
    if (!name) {
      throw new Error('Workbook name is required and cannot be empty');
    }

    // Create base workbook using existing utility
    const workbook = createWorkbook(name);

    // Handle initial sheets if provided
    if (op.params.initialSheets && op.params.initialSheets.length > 0) {
      this.log('Creating initial sheets:', op.params.initialSheets);

      // Validate all sheet names are non-empty and unique
      const sheetNames = op.params.initialSheets.map(s => s.trim()).filter(s => s.length > 0);
      const uniqueNames = new Set(sheetNames);
      
      if (sheetNames.length === 0) {
        ctx.warnings.push('initialSheets contained only empty names, keeping default Sheet1');
      } else if (sheetNames.length !== uniqueNames.size) {
        throw new Error('initialSheets contains duplicate names');
      } else {
        // Remove the default Sheet1 created by createWorkbook()
        workbook.sheets = [];

        // Add each requested sheet
        for (const sheetName of sheetNames) {
          addSheet(workbook, sheetName);
        }

        this.log(`Created ${sheetNames.length} initial sheets`);
      }
    } else {
      // No initial sheets specified, keep default Sheet1
      this.log('Using default Sheet1');
    }

    // Set workbook in context
    ctx.workbook = workbook;
    this.log('Workbook created successfully with', workbook.sheets.length, 'sheet(s)');
  }

  /**
   * Execute addSheet operation
   * 
   * Adds a new sheet to the workbook with the specified name.
   * Uses existing addSheet() utility which handles name uniqueness automatically.
   * 
   * Validation:
   * - Workbook must exist
   * - Sheet name must not be empty
   * - If position specified, must be valid (0 to sheets.length)
   */
  private executeAddSheet(ctx: ExecutionContext, op: AddSheetOperation): void {
    this.log('Adding sheet:', op.params.name);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure name is provided and not empty
    const name = op.params.name?.trim();
    if (!name) {
      throw new Error('Sheet name is required and cannot be empty');
    }

    // Add sheet using existing utility (handles name uniqueness)
    const sheet = addSheet(ctx.workbook, name);

    // Handle position if specified
    if (op.params.position !== undefined) {
      const position = op.params.position;
      const maxPosition = ctx.workbook.sheets.length - 1;

      // Validation: position must be valid
      if (position < 0 || position > maxPosition) {
        throw new Error(`Invalid position ${position}. Must be between 0 and ${maxPosition}`);
      }

      // Move sheet to requested position (only if not already there)
      const currentIndex = ctx.workbook.sheets.findIndex(s => s.id === sheet.id);
      if (currentIndex !== position && currentIndex !== -1) {
        // Remove from current position
        ctx.workbook.sheets.splice(currentIndex, 1);
        // Insert at requested position
        ctx.workbook.sheets.splice(position, 0, sheet);
        this.log(`Moved sheet to position ${position}`);
      }
    }

    // Set sheet ID if provided in operation params
    if (op.params.id) {
      sheet.id = op.params.id;
      this.log('Set sheet ID to', op.params.id);
    }

    this.log('Sheet added successfully:', sheet.name, `(ID: ${sheet.id})`);
  }

  /**
   * Execute removeSheet operation
   * 
   * Removes a sheet from the workbook by ID.
   * Uses existing deleteSheet() utility which prevents deleting the last sheet.
   * 
   * Validation:
   * - Workbook must exist
   * - sheetId must be provided
   * - Sheet must exist
   * - Cannot delete last remaining sheet
   */
  private executeRemoveSheet(ctx: ExecutionContext, op: RemoveSheetOperation): void {
    this.log('Removing sheet:', op.params.sheetId);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure sheetId is provided
    const sheetId = op.params.sheetId?.trim();
    if (!sheetId) {
      throw new Error('sheetId is required and cannot be empty');
    }

    // Find sheet to get name for logging
    const sheet = getSheet(ctx.workbook, sheetId);
    if (!sheet) {
      throw new Error(`Sheet with ID "${sheetId}" not found`);
    }

    const sheetName = sheet.name;

    // Delete sheet using existing utility (prevents deleting last sheet)
    const deleted = deleteSheet(ctx.workbook, sheetId);

    if (!deleted) {
      // deleteSheet returns false if it's the last sheet
      throw new Error(`Cannot delete sheet "${sheetName}". At least one sheet must remain.`);
    }

    this.log('Sheet removed successfully:', sheetName);
  }

  /**
   * Execute renameSheet operation
   * 
   * Renames an existing sheet.
   * Ensures new name is unique within the workbook.
   * 
   * Validation:
   * - Workbook must exist
   * - sheetId must be provided
   * - Sheet must exist
   * - New name must not be empty
   * - New name must be unique (not used by another sheet)
   */
  private executeRenameSheet(ctx: ExecutionContext, op: RenameSheetOperation): void {
    this.log('Renaming sheet:', op.params.sheetId, 'to', op.params.newName);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure sheetId is provided
    const sheetId = op.params.sheetId?.trim();
    if (!sheetId) {
      throw new Error('sheetId is required and cannot be empty');
    }

    // Validation: ensure new name is provided and not empty
    const newName = op.params.newName?.trim();
    if (!newName) {
      throw new Error('newName is required and cannot be empty');
    }

    // Find sheet to rename
    const sheet = getSheet(ctx.workbook, sheetId);
    if (!sheet) {
      throw new Error(`Sheet with ID "${sheetId}" not found`);
    }

    const oldName = sheet.name;

    // Check if new name is already used by another sheet
    const existingSheet = getSheetByName(ctx.workbook, newName);
    if (existingSheet && existingSheet.id !== sheetId) {
      throw new Error(`Sheet name "${newName}" is already used by another sheet`);
    }

    // Rename sheet
    sheet.name = newName;
    ctx.workbook.meta.modifiedAt = new Date().toISOString();

    this.log('Sheet renamed successfully:', oldName, '→', newName);
  }

  private executeSetCells(_ctx: ExecutionContext, _op: SetCellsOperation): void {
    const ctx = _ctx;
    const op = _op;

    this.log('Executing setCells on sheet:', op.params.sheet);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Resolve sheet: allow either sheet ID or sheet name
    const targetSheet = this.resolveSheet(ctx.workbook, op.params.sheet);
    const targetSheetId = targetSheet.id;

    const cells = op.params.cells || {};
    if (Object.keys(cells).length === 0) {
      throw new Error('No cells provided for setCells operation');
    }

    // Iterate and set each cell
    for (const address of Object.keys(cells)) {
      const cv = cells[address];

      // Basic address validation
      try {
        parseAddress(address);
      } catch (err) {
        throw new Error(`Invalid cell address: ${address}`);
      }

      // Build Cell object
      const cell: any = {};

      // Data type
      if (cv.dataType) cell.dataType = cv.dataType;

      // Formula handling: allow formula with or without leading '='
      if (cv.formula) {
        cell.formula = normalizeFormula(String(cv.formula));
        cell.dataType = 'formula';
      } else if (cv.value !== undefined) {
        cell.raw = cv.value as any;
      } else {
        // explicit null or missing value -> set as null raw
        cell.raw = null;
      }

      if (cv.numFmt) cell.numFmt = cv.numFmt;
      if (cv.style) cell.style = cv.style;

      // Use helper to set cell in workbook (updates modifiedAt)
      setCell(ctx.workbook, targetSheetId, address, cell);
      this.log(`Set cell ${address} on sheet ${targetSheetId}`);
    }

    this.log('setCells operation completed for', Object.keys(cells).length, 'cells');
  }

  /**
   * Execute setFormula operation
   * 
   * Sets a single formula cell in the specified sheet.
   * Formulas are validated and normalized (leading = added if missing).
   * 
   * Validation:
   * - Workbook must exist
   * - Sheet must exist (by ID or name)
   * - Cell address must be valid
   * - Formula must not be empty
   * 
   * Note: This is a convenience operation. For bulk formula setting,
   * prefer setCells operation which is more efficient.
   */
  private executeSetFormula(_ctx: ExecutionContext, _op: SetFormulaOperation): void {
    const ctx = _ctx;
    const op = _op;

    this.log('Executing setFormula on sheet:', op.params.sheet, 'cell:', op.params.cell);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure formula is provided and not empty
    const formula = op.params.formula?.trim();
    if (!formula) {
      throw new Error('Formula is required and cannot be empty');
    }

    // Resolve sheet: allow either sheet ID or sheet name
    const targetSheet = this.resolveSheet(ctx.workbook, op.params.sheet);
    const targetSheetId = targetSheet.id;

    // Validation: ensure cell address is valid
    const cellAddress = op.params.cell?.trim();
    if (!cellAddress) {
      throw new Error('Cell address is required and cannot be empty');
    }

    try {
      parseAddress(cellAddress);
    } catch (err) {
      throw new Error(`Invalid cell address: ${cellAddress}`);
    }

    // Normalize formula: add leading '=' if missing
    const normalizedFormula = normalizeFormula(formula);

    // Build Cell object with formula
    // Pattern from test files: { formula: '=A1*2', dataType: 'formula' } as any
    const cell: any = {
      formula: normalizedFormula,
      dataType: 'formula',
    };

    // Use helper to set cell in workbook (updates modifiedAt)
    setCell(ctx.workbook, targetSheetId, cellAddress, cell);
    
    this.log(`Set formula ${normalizedFormula} at ${cellAddress} on sheet ${targetSheetId}`);
  }

  /**
   * Execute applyFormat operation
   * 
   * Applies formatting (style, numFmt, borders) to cells or ranges.
   * Merges formatting with existing cell properties to preserve data.
   * 
   * Validation:
   * - Workbook must exist
   * - Sheet must exist (by ID or name)
   * - Range must be valid (single cell or range like A1:D10)
   * - At least one format property must be provided
   * 
   * Format properties:
   * - style: CellStyle (bold, italic, colors, alignment, etc.)
   * - numFmt: Number format code
   * - borders: Border specification (top, bottom, left, right, all)
   * 
   * Note: For ranges, applies formatting to all cells in the range.
   * If a cell doesn't exist, creates it with formatting only.
   */
  private executeApplyFormat(ctx: ExecutionContext, op: ApplyFormatOperation): void {
    this.log('Executing applyFormat on sheet:', op.params.sheet, 'range:', op.params.range);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure format is provided
    const format = op.params.format;
    if (!format || (!format.style && !format.numFmt && !format.borders)) {
      throw new Error('Format specification is required. Must provide at least one of: style, numFmt, or borders');
    }

    // Resolve sheet: allow either sheet ID or sheet name
    const targetSheet = this.resolveSheet(ctx.workbook, op.params.sheet);
    const targetSheetId = targetSheet.id;

    // Parse range to get all cell addresses
    let cellAddresses: string[];
    try {
      // Check if it's a range (contains ':') or single cell
      if (op.params.range.includes(':')) {
        // Parse as range and expand to all cells
        cellAddresses = getCellsInRange(op.params.range);
        this.log(`Expanding range ${op.params.range} to ${cellAddresses.length} cells`);
      } else {
        // Single cell
        parseAddress(op.params.range); // validate
        cellAddresses = [op.params.range];
      }
    } catch (err) {
      throw new Error(`Invalid cell range: ${op.params.range}`);
    }

    if (cellAddresses.length === 0) {
      throw new Error(`Range ${op.params.range} contains no cells`);
    }

    // Apply formatting to each cell in the range
    for (const address of cellAddresses) {
      // Get existing cell or create new one
      let cell = getCell(ctx.workbook, targetSheetId, address);
      
      if (!cell) {
        // Create empty cell if it doesn't exist
        cell = {};
        this.log(`Creating new cell at ${address} for formatting`);
      } else {
        // Clone existing cell to avoid mutation issues
        cell = { ...cell };
      }

      // Apply style formatting
      if (format.style) {
        // Merge with existing style (preserve existing properties not being set)
        cell.style = {
          ...(cell.style || {}),
          ...format.style,
        };
        this.log(`Applied style to ${address}:`, format.style);
      }

      // Apply number format
      if (format.numFmt) {
        cell.numFmt = format.numFmt;
        this.log(`Applied numFmt to ${address}:`, format.numFmt);
      }

      // Apply borders
      if (format.borders) {
        // Initialize border object if not exists
        if (!cell.style) {
          cell.style = {};
        }
        if (!cell.style.border) {
          cell.style.border = {};
        }

        // Handle 'all' border shorthand
        if (format.borders.all) {
          cell.style.border.top = { style: 'thin' };
          cell.style.border.bottom = { style: 'thin' };
          cell.style.border.left = { style: 'thin' };
          cell.style.border.right = { style: 'thin' };
          this.log(`Applied all borders to ${address}`);
        } else {
          // Apply individual borders
          if (format.borders.top) {
            cell.style.border.top = { style: 'thin' };
          }
          if (format.borders.bottom) {
            cell.style.border.bottom = { style: 'thin' };
          }
          if (format.borders.left) {
            cell.style.border.left = { style: 'thin' };
          }
          if (format.borders.right) {
            cell.style.border.right = { style: 'thin' };
          }
          this.log(`Applied individual borders to ${address}:`, format.borders);
        }
      }

      // Save cell back to workbook
      setCell(ctx.workbook, targetSheetId, address, cell);
    }

    this.log(`applyFormat operation completed for ${cellAddresses.length} cells`);
  }

  /**
   * Execute mergeCells operation
   * 
   * Merges all cells in the specified range into a single merged cell.
   * The top-left cell's value and formatting are preserved.
   * All other cells in the range become part of the merged area.
   * 
   * Validation:
   * - Workbook must exist
   * - Sheet must exist (by ID or name)
   * - Range must be valid and contain at least 2 cells
   * - Range must not overlap with existing merged ranges
   * 
   * Note: Stores merge range in sheet.mergedRanges array as a string (e.g., "A1:D1")
   * The actual merge rendering is handled by the UI/export layer.
   */
  private executeMergeCells(ctx: ExecutionContext, op: MergeCellsOperation): void {
    this.log('Executing mergeCells on sheet:', op.params.sheet, 'range:', op.params.range);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Resolve sheet: allow either sheet ID or sheet name
    const targetSheet = this.resolveSheet(ctx.workbook, op.params.sheet);

    // Validation: ensure range is valid
    const range = op.params.range?.trim();
    if (!range) {
      throw new Error('Merge range is required and cannot be empty');
    }

    // Validate range format and ensure it has at least 2 cells
    let cellAddresses: string[];
    try {
      if (!range.includes(':')) {
        throw new Error('Merge range must contain at least 2 cells (e.g., A1:B1)');
      }
      
      const { start, end } = parseRange(range);
      parseAddress(start); // validate start
      parseAddress(end); // validate end
      
      cellAddresses = getCellsInRange(range);
      
      if (cellAddresses.length < 2) {
        throw new Error(`Merge range ${range} must contain at least 2 cells`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('must contain')) {
        throw err; // re-throw our custom error
      }
      throw new Error(`Invalid merge range: ${range}`);
    }

    // Initialize mergedRanges array if it doesn't exist
    if (!targetSheet.mergedRanges) {
      targetSheet.mergedRanges = [];
    }

    // Check if range is already merged (exact match) - do this BEFORE overlap check
    if (targetSheet.mergedRanges.includes(range)) {
      this.log(`Range ${range} is already merged, skipping`);
      ctx.warnings.push(`Range ${range} is already merged`);
      return;
    }

    // Check for overlaps with existing merged ranges
    for (const existingRange of targetSheet.mergedRanges) {
      const existingCells = getCellsInRange(existingRange);
      const newCells = new Set(cellAddresses);
      
      // Check if any cell from the existing range is in the new range
      const hasOverlap = existingCells.some(cell => newCells.has(cell));
      
      if (hasOverlap) {
        throw new Error(
          `Merge range ${range} overlaps with existing merged range ${existingRange}. ` +
          `Unmerge the existing range first or choose a different range.`
        );
      }
    }

    // Add the merged range
    targetSheet.mergedRanges.push(range);
    ctx.workbook.meta.modifiedAt = new Date().toISOString();

    this.log(`Merged range ${range} added to sheet ${targetSheet.name} (${cellAddresses.length} cells)`);
  }

  /**
   * Execute defineNamedRange operation
   * 
   * Creates a named range that can be used in formulas for better readability.
   * Named ranges are stored at workbook level (workbook.namedRanges) or sheet level (sheet.namedRanges).
   * 
   * Validation:
   * - Workbook must exist
   * - Sheet must exist (by ID or name)
   * - Range must be valid
   * - Name must be valid (no spaces, not Excel reserved words, not cell reference)
   * - Name must be unique within its scope
   * 
   * Pattern from test files:
   * ```typescript
   * wb.namedRanges = wb.namedRanges || {};
   * wb.namedRanges['Ledger_Debit'] = 'Ledger!C2:C1000';
   * // OR as rich object:
   * wb.namedRanges['HiddenRange'] = { 
   *   name: 'HiddenRange', 
   *   ref: 'Sheet1!$A$1:$A$3', 
   *   hidden: true,
   *   scope: 'workbook'
   * };
   * ```
   * 
   * Note: Named ranges make formulas more readable:
   * - Before: =SUM(Sales!A2:A100)
   * - After: =SUM(SalesData)
   */
  private executeDefineNamedRange(ctx: ExecutionContext, op: DefineNamedRangeOperation): void {
    this.log('Executing defineNamedRange:', op.params.name, 'for range:', op.params.range);

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure name is provided and not empty
    const name = op.params.name?.trim();
    if (!name) {
      throw new Error('Named range name is required and cannot be empty');
    }

    // Validation: ensure range is provided and not empty
    const range = op.params.range?.trim();
    if (!range) {
      throw new Error('Named range reference is required and cannot be empty');
    }

    // Validate name format (HyperFormula requirements):
    // - Must start with letter or underscore
    // - Can contain letters, numbers, underscores, dots
    // - Cannot be a cell reference (e.g., A1, R1C1)
    // - Cannot be Excel reserved words (TRUE, FALSE, etc.)
    const namePattern = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;
    if (!namePattern.test(name)) {
      throw new Error(
        `Invalid named range name "${name}". ` +
        `Must start with letter or underscore, and contain only letters, numbers, underscores, and dots.`
      );
    }

    // Check for cell reference pattern (A1, AA1, etc.)
    const cellRefPattern = /^[A-Z]+\d+$/i;
    if (cellRefPattern.test(name)) {
      throw new Error(
        `Invalid named range name "${name}". ` +
        `Name cannot be a cell reference (e.g., A1, B2).`
      );
    }

    // Check for Excel reserved words
    const reservedWords = ['TRUE', 'FALSE', 'NULL'];
    if (reservedWords.includes(name.toUpperCase())) {
      throw new Error(
        `Invalid named range name "${name}". ` +
        `Name cannot be an Excel reserved word (${reservedWords.join(', ')}).`
      );
    }

    // Resolve sheet: allow either sheet ID or sheet name
    const targetSheet = this.resolveSheet(ctx.workbook, op.params.sheet);

    // Validate range format
    // Strip $ signs for validation (absolute references like $A$1)
    const stripAbsolute = (ref: string): string => ref.replace(/\$/g, '');
    
    try {
      // Single cell (A1 or $A$1) or range (A1:B10 or $A$1:$B$10)
      if (range.includes(':')) {
        const { start, end } = parseRange(range);
        parseAddress(stripAbsolute(start)); // Validate start cell
        parseAddress(stripAbsolute(end));   // Validate end cell
      } else {
        parseAddress(stripAbsolute(range));
      }
    } catch (err) {
      throw new Error(`Invalid range reference: ${range}`);
    }

    // Determine scope (workbook or sheet)
    const scope = op.params.scope || 'workbook';

    // Build fully qualified reference with sheet name
    // Pattern: SheetName!Range or SheetName!$A$1:$B$10
    // Convert to absolute reference ($A$1) for HyperFormula compatibility
    const absoluteRange = this.makeAbsoluteReference(range);
    const qualifiedRef = `${targetSheet.name}!${absoluteRange}`;

    if (scope === 'workbook') {
      // Workbook-scoped named range
      // Initialize namedRanges if not exists
      if (!ctx.workbook.namedRanges) {
        ctx.workbook.namedRanges = {};
      }

      // Check for duplicate name at workbook level
      if (ctx.workbook.namedRanges[name]) {
        throw new Error(
          `Named range "${name}" already exists at workbook scope. ` +
          `Use a different name or remove the existing named range first.`
        );
      }

      // Store as rich object for better metadata
      ctx.workbook.namedRanges[name] = {
        name,
        ref: qualifiedRef,
        scope: 'workbook',
      };

      this.log(`Created workbook-scoped named range "${name}" = ${qualifiedRef}`);
    } else if (scope === 'sheet') {
      // Sheet-scoped named range
      // Initialize namedRanges if not exists
      if (!targetSheet.namedRanges) {
        targetSheet.namedRanges = {};
      }

      // Check for duplicate name at sheet level
      if (targetSheet.namedRanges[name]) {
        throw new Error(
          `Named range "${name}" already exists in sheet "${targetSheet.name}". ` +
          `Use a different name or remove the existing named range first.`
        );
      }

      // For sheet-scoped ranges, can use relative reference within sheet
      // or fully qualified reference
      targetSheet.namedRanges[name] = {
        name,
        ref: qualifiedRef,
        scope: targetSheet.id,
      };

      this.log(`Created sheet-scoped named range "${name}" = ${qualifiedRef} (sheet: ${targetSheet.name})`);
    } else {
      throw new Error(`Invalid scope "${scope}". Must be "workbook" or "sheet".`);
    }

    // Update workbook modified timestamp
    ctx.workbook.meta.modifiedAt = new Date().toISOString();

    this.log(`defineNamedRange operation completed successfully`);
  }

  /**
   * Convert a range reference to absolute form (with $ signs)
   * E.g., A1 → $A$1, A1:B10 → $A$1:$B$10
   * 
   * HyperFormula requires absolute references for named ranges.
   */
  private makeAbsoluteReference(range: string): string {
    // Helper to convert single cell address to absolute
    const makeAbsoluteCell = (cell: string): string => {
      // Already absolute
      if (cell.includes('$')) {
        return cell;
      }

      // Parse cell address (e.g., A1 → { col: A, row: 1 })
      const match = cell.match(/^([A-Z]+)(\d+)$/i);
      if (!match) {
        // Not a standard cell reference, return as-is
        return cell;
      }

      const [, col, row] = match;
      return `$${col.toUpperCase()}$${row}`;
    };

    // Handle range (A1:B10)
    if (range.includes(':')) {
      const [start, end] = range.split(':');
      return `${makeAbsoluteCell(start.trim())}:${makeAbsoluteCell(end.trim())}`;
    }

    // Single cell
    return makeAbsoluteCell(range);
  }

  /**
   * Execute compute operation
   * 
   * Hydrates HyperFormula from workbook and recomputes all formulas.
   * Destroys previous HF instance if it exists to prevent memory leaks.
   * 
   * Pattern from test files:
   * ```typescript
   * const hydration = hydrateHFFromWorkbook(workbook);
   * recomputeAndPatchCache(workbook, hydration);
   * hydration.hf.destroy(); // cleanup
   * ```
   * 
   * Validation:
   * - Workbook must exist
   * - Workbook must have at least one sheet
   * 
   * Side effects:
   * - Updates workbook.computed.hfCache with computed values
   * - Updates workbook.meta.modifiedAt
   * - Stores HF hydration in context for cleanup
   */
  private executeCompute(ctx: ExecutionContext, _op: ComputeOperation): void {
    this.log('Executing compute operation');

    // Validation: ensure workbook exists
    if (!ctx.workbook) {
      throw new Error('No workbook exists. Create a workbook first with createWorkbook operation.');
    }

    // Validation: ensure workbook has sheets
    if (!ctx.workbook.sheets || ctx.workbook.sheets.length === 0) {
      throw new Error('Workbook has no sheets. Cannot compute formulas.');
    }

    // Destroy previous HF instance if it exists (prevent memory leaks)
    if (ctx.hfHydration && ctx.hfHydration.hf) {
      this.log('Destroying previous HF instance before creating new one');
      try {
        ctx.hfHydration.hf.destroy();
      } catch (err) {
        const warning = `Failed to destroy previous HF instance: ${getErrorMessage(err)}`;
        ctx.warnings.push(warning);
        this.log('Warning:', warning);
      }
      ctx.hfHydration = null;
    }

    try {
      // Hydrate HyperFormula from workbook
      this.log('Hydrating HyperFormula from workbook...');
      const hydration = hydrateHFFromWorkbook(ctx.workbook);
      
      // Log warnings from hydration
      if (hydration.warnings && hydration.warnings.length > 0) {
        this.log('Hydration warnings:', hydration.warnings);
        ctx.warnings.push(...hydration.warnings);
      }

      // Recompute all formulas and patch computed cache
      this.log('Recomputing formulas and patching cache...');
      const recomputeResult = recomputeAndPatchCache(ctx.workbook, hydration);

      // Log recompute results
      this.log('Recompute complete:', {
        updatedCells: recomputeResult.updatedCells,
        errors: recomputeResult.errors?.length || 0,
        warnings: recomputeResult.warnings?.length || 0,
      });

      // Store warnings from recompute
      if (recomputeResult.warnings && recomputeResult.warnings.length > 0) {
        ctx.warnings.push(...recomputeResult.warnings);
      }

      // Store errors from recompute (but don't throw - formulas may have #DIV/0!, #REF! etc)
      if (recomputeResult.errors && recomputeResult.errors.length > 0) {
        const errorMessages = recomputeResult.errors.map(
          e => `Cell ${e.sheetId}!${e.address}: ${e.error}`
        );
        ctx.warnings.push(...errorMessages.map(msg => `Formula error: ${msg}`));
        this.log('Formula errors found (non-fatal):', errorMessages);
      }

      // Store hydration in context for cleanup in cleanup() method
      ctx.hfHydration = hydration;

      this.log('Compute operation completed successfully');
    } catch (err) {
      // If HF hydration/recompute fails catastrophically, throw error
      const errorMessage = getErrorMessage(err);
      this.log('Compute operation failed:', errorMessage);
      throw new Error(`Compute operation failed: ${errorMessage}`);
    }
  }

  private executeImportXLSX(_ctx: ExecutionContext, _op: ImportXLSXOperation): void {
    // Implementation in Phase 9.2
    throw new Error('importXLSX operation not yet implemented');
  }

  private executeExportXLSX(_ctx: ExecutionContext, _op: ExportXLSXOperation): void {
    // Implementation in Phase 9.1
    throw new Error('exportXLSX operation not yet implemented');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Deep clone workbook if cloneWorkbook option is enabled
   */
  private cloneIfNeeded(workbook: WorkbookJSON): WorkbookJSON {
    if (!this.options.cloneWorkbook) {
      return workbook;
    }
    // Deep clone using structured clone (available in modern browsers and Node 17+)
    // Falls back to JSON parse/stringify for compatibility
    try {
      return structuredClone(workbook);
    } catch {
      return JSON.parse(JSON.stringify(workbook));
    }
  }

  /**
   * Debug logging helper
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[WorkbookOperationExecutor]', ...args);
    }
  }
}

/**
 * Convenience function to execute operations without creating an executor instance
 * 
 * @param operations - Operations to execute
 * @param existingWorkbook - Optional existing workbook
 * @param options - Execution options
 * @returns Execution result
 */
export async function executeOperations(
  operations: WorkbookOperation[],
  existingWorkbook: WorkbookJSON | null = null,
  options: ExecutorOptions = {}
): Promise<OperationExecutionResult> {
  const executor = new WorkbookOperationExecutor(options);
  return executor.execute(operations, existingWorkbook);
}
