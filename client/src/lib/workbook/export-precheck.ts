import type { WorkbookJSON } from './types';

export interface ExportPrecheckWarning {
  workbookId?: string;
  sheetId?: string;
  sheetName?: string;
  address?: string;
  message: string;
}

/**
 * Scan a workbook for cells with computed objects missing a `v` value.
 * Returns a list of warnings suitable for showing to users before export.
 * This is intentionally non-destructive and does not trigger recompute.
 */
export function precheckWorkbookForExport(workbook: WorkbookJSON): ExportPrecheckWarning[] {
  const warnings: ExportPrecheckWarning[] = [];
  const wbId = workbook.workbookId;

  if (!workbook.sheets) return warnings;

  for (const sheet of workbook.sheets) {
    const cells = sheet.cells || {};
    for (const [addr, cell] of Object.entries(cells)) {
      if (cell.computed) {
        // Missing computed.v indicates we didn't materialize the value and
        // Excel may recalc on open. Surface a warning so callers can run recompute.
        if (cell.computed.v === undefined || cell.computed.v === null) {
          warnings.push({
            workbookId: wbId,
            sheetId: sheet.id,
            sheetName: sheet.name,
            address: addr,
            message: `Formula at ${sheet.name}!${addr} missing computed value; Excel will recalculate on open. Run recomputeAndPatchCache() before export.`,
          });
        }
      }
    }
  }

  return warnings;
}

export default precheckWorkbookForExport;
