import type { WorkbookJSON } from './types';
import type { CircularReferenceError, CircularChain } from './circular-reference-guard';

/**
 * Recovery actions for circular references
 */
export type CircularReferenceRecoveryAction = 'break' | 'ignore' | 'undo';

/**
 * Result of a recovery action
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  updatedWorkbook?: WorkbookJSON;
  cellsModified?: string[];
}

/**
 * Service for handling circular reference UI interactions and recovery
 */
export class CircularReferenceUIService {
  private static instance: CircularReferenceUIService;
  private pendingAlerts: Map<string, CircularReferenceError> = new Map();
  private recoveryCallbacks: Map<string, (action: CircularReferenceRecoveryAction) => Promise<RecoveryResult>> = new Map();

  static getInstance(): CircularReferenceUIService {
    if (!CircularReferenceUIService.instance) {
      CircularReferenceUIService.instance = new CircularReferenceUIService();
    }
    return CircularReferenceUIService.instance;
  }

  /**
   * Register a circular reference alert for display
   */
  registerAlert(
    alertId: string, 
    error: CircularReferenceError, 
    onRecover: (action: CircularReferenceRecoveryAction) => Promise<RecoveryResult>
  ): void {
    this.pendingAlerts.set(alertId, error);
    this.recoveryCallbacks.set(alertId, onRecover);
  }

  /**
   * Get pending alerts
   */
  getPendingAlerts(): Array<{ id: string; error: CircularReferenceError }> {
    return Array.from(this.pendingAlerts.entries()).map(([id, error]) => ({ id, error }));
  }

  /**
   * Resolve a circular reference alert
   */
  async resolveAlert(alertId: string, action: CircularReferenceRecoveryAction): Promise<RecoveryResult> {
    const callback = this.recoveryCallbacks.get(alertId);
    if (!callback) {
      return {
        success: false,
        message: 'Recovery callback not found'
      };
    }

    try {
      const result = await callback(action);
      
      // Clean up if successful
      if (result.success) {
        this.pendingAlerts.delete(alertId);
        this.recoveryCallbacks.delete(alertId);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Dismiss an alert without taking action
   */
  dismissAlert(alertId: string): void {
    this.pendingAlerts.delete(alertId);
    this.recoveryCallbacks.delete(alertId);
  }

  /**
   * Clear all pending alerts
   */
  clearAllAlerts(): void {
    this.pendingAlerts.clear();
    this.recoveryCallbacks.clear();
  }

  /**
   * Check if there are any high-severity alerts
   */
  hasHighSeverityAlerts(): boolean {
    return Array.from(this.pendingAlerts.values()).some(
      (error: any) => error.severity === 'error' || error.severity === 'high' || (error.chain && error.chain.severity === 'high')
    );
  }

  /**
   * Get count of pending alerts by severity
   */
  getAlertCounts(): { high: number; medium: number; low: number; total: number } {
    const alerts = Array.from(this.pendingAlerts.values());
    return {
      high: alerts.filter((a: any) => a.severity === 'error' || a.severity === 'high' || (a.chain && a.chain.severity === 'high')).length,
      medium: alerts.filter((a: any) => a.severity === 'warning' || a.severity === 'medium' || (a.chain && a.chain.severity === 'medium')).length,
      low: alerts.filter((a: any) => a.severity === 'low' || (a.chain && a.chain.severity === 'low')).length,
      total: alerts.length,
    };
  }
}

/**
 * Recovery action implementations
 */
export class CircularReferenceRecovery {
  /**
   * Break a circular reference by clearing one of the formulas in the chain
   */
  static breakCircularReference(
    workbook: WorkbookJSON, 
    chain: CircularChain
  ): RecoveryResult {
    try {
      // Find the best cell to clear (usually the last one in the chain)
      const targetCell = chain.cells[chain.cells.length - 1];
      const [sheetId, address] = targetCell.includes('!') 
        ? targetCell.split('!') 
        : ['Sheet1', targetCell];

      // Find the sheet
      const sheet = workbook.sheets.find(s => s.id === sheetId);
      if (!sheet) {
        return {
          success: false,
          message: `Sheet ${sheetId} not found`
        };
      }

      // Find and clear the cell
      if (!sheet.cells) {
        return {
          success: false,
          message: `Cell ${targetCell} not found`
        };
      }
      const cell = sheet.cells[address];
      if (!cell) {
        return {
          success: false,
          message: `Cell ${targetCell} not found`
        };
      }

      // Clear the formula but keep the value if it exists
      const originalFormula = cell.formula;
      delete cell.formula;
      
      // If the cell had no raw value, set it to empty
      if (cell.raw === undefined) {
        cell.raw = '';
      }

      return {
        success: true,
        message: `Cleared formula in ${targetCell}. Original formula: ${originalFormula}`,
        updatedWorkbook: workbook,
        cellsModified: [targetCell]
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to break circular reference: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a recovery result for ignoring the circular reference
   */
  static ignoreCircularReference(chain: CircularChain): RecoveryResult {
    return {
      success: true,
      message: `Continuing with timeout protection. Circular reference in: ${chain.cells.join(' → ')}`,
      cellsModified: []
    };
  }

  /**
   * Create a recovery result for undoing (to be implemented by the calling code)
   */
  static createUndoRecovery(): RecoveryResult {
    return {
      success: true,
      message: 'Undo operation requested. The calling code should handle the actual undo.',
      cellsModified: []
    };
  }
}

// Export singleton instance
export const circularReferenceUI = CircularReferenceUIService.getInstance();