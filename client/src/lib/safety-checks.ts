/**
 * Pre-Apply Safety Checks
 * 
 * CRITICAL: All checks MUST pass before applying AI-generated operations.
 * These safeguards prevent data corruption and user frustration.
 * 
 * Flow:
 * 1. Create backup snapshot
 * 2. Validate plan is not stale
 * 3. Run final dry-run
 * 4. Compare against expected diff
 * 5. Check user confirmation threshold
 * 6. Apply operations
 * 7. Create undo action
 */

import type { WorkbookJSON, Action } from "./workbook/types";
import { getFeatureFlags } from "./feature-flags";
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from "./workbook/hyperformula";
import { cloneWorkbook } from "./workbook/utils";

export interface SafetyCheckResult {
  safe: boolean;
  warnings: string[];
  errors: string[];
  requiresUserConfirmation: boolean;
  snapshot?: WorkbookJSON; // Backup snapshot
  dryRunDiff?: DryRunDiff;
}

export interface DryRunDiff {
  cellChanges: Array<{
    sheetId: string;
    address: string;
    before: any;
    after: any;
  }>;
  formulaChanges: Array<{
    sheetId: string;
    address: string;
    before: string;
    after: string;
  }>;
  structuralChanges: Array<{
    type: 'insert-row' | 'delete-row' | 'insert-col' | 'delete-col' | 'merge' | 'unmerge';
    sheetId: string;
    details: any;
  }>;
  totalAffectedCells: number;
}

export interface AIPlan {
  id: string;
  createdAt: string; // ISO timestamp
  snapshot: WorkbookJSON; // State when plan was created
  operations: Array<{
    type: string;
    sheetId: string;
    address?: string;
    value?: any;
    formula?: string;
    range?: string;
  }>;
  expectedDiff: DryRunDiff; // What AI predicted would change
}

/**
 * Run all pre-apply safety checks
 */
export async function runPreApplyChecks(
  currentWorkbook: WorkbookJSON,
  plan: AIPlan,
  userId?: string
): Promise<SafetyCheckResult> {
  const flags = getFeatureFlags();
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check 1: Create backup snapshot
  const snapshot = flags.backupBeforeApply.enabled
    ? cloneWorkbook(currentWorkbook)
    : undefined;
  
  if (!snapshot) {
    errors.push("Backup snapshot creation failed");
    return { safe: false, warnings, errors, requiresUserConfirmation: false };
  }
  
  // Check 2: Validate plan is not stale
  const staleCheck = checkPlanStale(currentWorkbook, plan);
  if (staleCheck.isStale) {
    errors.push(
      `Plan is stale: created ${plan.createdAt}, but workbook modified since then. ` +
      `Conflicts: ${staleCheck.conflicts.join(", ")}`
    );
    return { safe: false, warnings, errors, requiresUserConfirmation: false, snapshot };
  }
  
  if (staleCheck.warnings.length > 0) {
    warnings.push(...staleCheck.warnings);
  }
  
  // Check 3: Run final dry-run
  const dryRunResult = await runFinalDryRun(currentWorkbook, plan);
  
  if (!dryRunResult.success) {
    errors.push(`Dry-run failed: ${dryRunResult.error}`);
    return { safe: false, warnings, errors, requiresUserConfirmation: false, snapshot };
  }
  
  // Check 4: Compare against expected diff
  const diffComparison = compareDiffs(plan.expectedDiff, dryRunResult.actualDiff!);
  
  if (diffComparison.hasCriticalDifferences) {
    errors.push(
      `Dry-run diff differs from plan:\n${diffComparison.differences.join("\n")}`
    );
    return { safe: false, warnings, errors, requiresUserConfirmation: false, snapshot, dryRunDiff: dryRunResult.actualDiff };
  }
  
  if (diffComparison.warnings.length > 0) {
    warnings.push(...diffComparison.warnings);
  }
  
  // Check 5: User confirmation threshold
  const totalOps = dryRunResult.actualDiff!.totalAffectedCells;
  const requiresConfirmation = totalOps > flags.aiPlanAct.maxOpsWithoutConfirmation;
  
  if (requiresConfirmation) {
    warnings.push(
      `Plan affects ${totalOps} cells (threshold: ${flags.aiPlanAct.maxOpsWithoutConfirmation}). ` +
      `User must explicitly confirm.`
    );
  }
  
  // All checks passed
  return {
    safe: true,
    warnings,
    errors,
    requiresUserConfirmation: requiresConfirmation || flags.aiPlanAct.requireDryRunApproval,
    snapshot,
    dryRunDiff: dryRunResult.actualDiff,
  };
}

/**
 * Check if plan is stale (workbook changed since plan creation)
 */
function checkPlanStale(
  currentWorkbook: WorkbookJSON,
  plan: AIPlan
): { isStale: boolean; conflicts: string[]; warnings: string[] } {
  const conflicts: string[] = [];
  const warnings: string[] = [];
  
  // Compare last modified timestamps
  const planCreated = new Date(plan.createdAt);
  const workbookModified = new Date(currentWorkbook.meta.modifiedAt);
  
  if (workbookModified > planCreated) {
    // Workbook modified after plan created — check for conflicts
    
    // Compare affected cells
    for (const op of plan.operations) {
      if (!op.address) continue;
      
      const snapshotSheet = plan.snapshot.sheets.find(s => s.id === op.sheetId);
      const currentSheet = currentWorkbook.sheets.find(s => s.id === op.sheetId);
      
      if (!snapshotSheet || !currentSheet) {
        conflicts.push(`Sheet ${op.sheetId} not found`);
        continue;
      }
      
      const snapshotCell = snapshotSheet.cells?.[op.address];
      const currentCell = currentSheet.cells?.[op.address];
      
      // Check if cell changed
      if (JSON.stringify(snapshotCell) !== JSON.stringify(currentCell)) {
        conflicts.push(
          `Cell ${op.sheetId}!${op.address} changed: ` +
          `snapshot=${JSON.stringify(snapshotCell)}, current=${JSON.stringify(currentCell)}`
        );
      }
    }
  }
  
  // Check for sheet-level changes
  if (plan.snapshot.sheets.length !== currentWorkbook.sheets.length) {
    warnings.push("Sheet count changed since plan created");
  }
  
  return {
    isStale: conflicts.length > 0,
    conflicts,
    warnings,
  };
}

/**
 * Run final dry-run to compute actual diff
 */
async function runFinalDryRun(
  workbook: WorkbookJSON,
  plan: AIPlan
): Promise<{ success: boolean; error?: string; actualDiff?: DryRunDiff }> {
  try {
    // Clone workbook for dry-run
    const dryRunWorkbook = cloneWorkbook(workbook);
    
    // Apply operations
    const cellChanges: DryRunDiff['cellChanges'] = [];
    const formulaChanges: DryRunDiff['formulaChanges'] = [];
    const structuralChanges: DryRunDiff['structuralChanges'] = [];
    
    for (const op of plan.operations) {
      const sheet = dryRunWorkbook.sheets.find(s => s.id === op.sheetId);
      if (!sheet) {
        return { success: false, error: `Sheet ${op.sheetId} not found` };
      }
      
      if (op.address) {
        const before = sheet.cells?.[op.address];
        
        // Apply change
        if (op.type === 'setCellValue') {
          sheet.cells![op.address] = { raw: op.value, dataType: typeof op.value === 'number' ? 'number' : 'string' };
        } else if (op.type === 'setCellFormula') {
          sheet.cells![op.address] = { formula: op.formula, dataType: 'formula' };
          formulaChanges.push({
            sheetId: op.sheetId,
            address: op.address,
            before: before?.formula || '',
            after: op.formula!,
          });
        }
        
        const after = sheet.cells?.[op.address];
        
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          cellChanges.push({
            sheetId: op.sheetId,
            address: op.address,
            before,
            after,
          });
        }
      }
      
      // Track structural changes
      if (['insert-row', 'delete-row', 'insert-col', 'delete-col', 'merge', 'unmerge'].includes(op.type)) {
        structuralChanges.push({
          type: op.type as any,
          sheetId: op.sheetId,
          details: op,
        });
      }
    }
    
    // Recompute formulas
    const hydration = hydrateHFFromWorkbook(dryRunWorkbook);
    recomputeAndPatchCache(dryRunWorkbook, hydration);
    
    const actualDiff: DryRunDiff = {
      cellChanges,
      formulaChanges,
      structuralChanges,
      totalAffectedCells: cellChanges.length,
    };
    
    return { success: true, actualDiff };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Compare expected diff vs actual dry-run diff
 */
function compareDiffs(
  expected: DryRunDiff,
  actual: DryRunDiff
): { hasCriticalDifferences: boolean; differences: string[]; warnings: string[] } {
  const differences: string[] = [];
  const warnings: string[] = [];
  
  // Compare total affected cells (allow 10% tolerance for indirect formula effects)
  const expectedTotal = expected.totalAffectedCells;
  const actualTotal = actual.totalAffectedCells;
  const tolerance = Math.max(5, Math.floor(expectedTotal * 0.1));
  
  if (Math.abs(expectedTotal - actualTotal) > tolerance) {
    differences.push(
      `Total affected cells: expected ${expectedTotal}, got ${actualTotal} (tolerance: ±${tolerance})`
    );
  }
  
  // Compare cell changes
  for (const expectedChange of expected.cellChanges) {
    const actualChange = actual.cellChanges.find(
      c => c.sheetId === expectedChange.sheetId && c.address === expectedChange.address
    );
    
    if (!actualChange) {
      differences.push(
        `Cell ${expectedChange.sheetId}!${expectedChange.address} missing in actual diff`
      );
      continue;
    }
    
    if (JSON.stringify(expectedChange.after) !== JSON.stringify(actualChange.after)) {
      warnings.push(
        `Cell ${expectedChange.sheetId}!${expectedChange.address}: ` +
        `expected ${JSON.stringify(expectedChange.after)}, got ${JSON.stringify(actualChange.after)}`
      );
    }
  }
  
  // Compare formula changes
  for (const expectedFormula of expected.formulaChanges) {
    const actualFormula = actual.formulaChanges.find(
      f => f.sheetId === expectedFormula.sheetId && f.address === expectedFormula.address
    );
    
    if (!actualFormula) {
      differences.push(
        `Formula ${expectedFormula.sheetId}!${expectedFormula.address} missing in actual diff`
      );
      continue;
    }
    
    if (expectedFormula.after !== actualFormula.after) {
      differences.push(
        `Formula ${expectedFormula.sheetId}!${expectedFormula.address}: ` +
        `expected "${expectedFormula.after}", got "${actualFormula.after}"`
      );
    }
  }
  
  return {
    hasCriticalDifferences: differences.length > 0,
    differences,
    warnings,
  };
}

/**
 * Create undo action after successful apply
 */
export function createUndoAction(
  planId: string,
  snapshot: WorkbookJSON,
  appliedDiff: DryRunDiff,
  userId?: string
): Action {
  return {
    id: `undo-${planId}`,
    type: 'setRange', // Batch operation
    timestamp: new Date().toISOString(),
    user: userId,
    sheetId: snapshot.sheets[0].id, // Primary sheet (expand for multi-sheet)
    payload: {
      snapshot, // Store full snapshot for rollback
      diff: appliedDiff,
    },
    inverse: {
      id: `redo-${planId}`,
      type: 'setRange',
      timestamp: new Date().toISOString(),
      user: userId,
      sheetId: snapshot.sheets[0].id,
      payload: {
        // Inverse is the forward operation
      },
    },
  };
}
