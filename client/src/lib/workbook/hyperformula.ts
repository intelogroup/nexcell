/**
 * HyperFormula Integration Module
 * 
 * This module bridges WorkbookJSON with HyperFormula for formula computation.
 * 
 * Key responsibilities:
 * 1. Hydrate HF instance from WorkbookJSON
 * 2. Compute formulas and cache results back to workbook
 * 3. Maintain bidirectional mapping between Excel addresses and HF coordinates
 * 4. Track dependencies for incremental updates
 * 
 * Design principles:
 * - Keep HF instance isolated (don't expose internals to UI)
 * - Cache computed values in workbook.computed for persistence
 * - Use HF's batch operations for performance
 * - Handle errors gracefully (mark cells with error values)
 */

import HyperFormulaNamespace, { type ConfigParams } from "hyperformula";
import type {
  WorkbookJSON,
  ComputedValue,
  SheetJSON,
} from "./types";
import { hfToAddress, addressToHf } from "./utils";
import { trackHFVersionMismatch, trackNamedExpressionFailure } from "../telemetry";

// Re-export utilities for external use
export { addressToHf, hfToAddress };
import { 
  detectCircularReferences, 
  withComputationTimeout, 
  createCircularReferenceError,
  formatCircularReferenceError,
  DEFAULT_CIRCULAR_CONFIG,
  type CircularReferenceConfig 
} from "./circular-reference-guard";

// Extract HyperFormula class from the namespace
const { HyperFormula } = HyperFormulaNamespace;

// Type for HyperFormula instance
type HyperFormulaInstance = ReturnType<typeof HyperFormula.buildEmpty>;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default HyperFormula configuration
 * Optimized for Excel compatibility and performance
 */
export const DEFAULT_HF_CONFIG: Partial<ConfigParams> = {
  licenseKey: "gpl-v3", // Use GPL v3 license
  useArrayArithmetic: true, // Support array formulas (Excel-like)
  useColumnIndex: false, // Use A1 notation
  useStats: false, // Disable stats collection for performance
  smartRounding: true, // Round floating point precision
  precisionRounding: 14, // Excel-like precision
  precisionEpsilon: 1e-13,
  dateFormats: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
  timeFormats: ["HH:mm", "HH:mm:ss"],
  functionArgSeparator: ",", // Use comma separator (closest to en-US Excel)
  decimalSeparator: ".", // Use period for decimals
  thousandSeparator: "", // Empty string to avoid conflict with functionArgSeparator
  // Array separators
  arrayColumnSeparator: ",",
  arrayRowSeparator: ";",
  // Localization / comparison
  caseSensitive: false,
  accentSensitive: true,
  ignorePunctuation: false,
  localeLang: "en-US",
  // Criteria / matching
  useWildcards: true,
  useRegularExpressions: false,
  matchWholeCell: true,
  // Formula parsing behavior
  ignoreWhiteSpace: "any",
  evaluateNullToZero: true,
  // nullYear is a two-digit pivot (0-100). Use 30 for Excel-like behavior
  nullYear: 30,
  leapYear1900: true, // Excel leap year bug compatibility
};

// ============================================================================
// Types
// ============================================================================

/**
 * Result of hydration operation
 */
export interface HydrationResult {
  hf: HyperFormulaInstance;
  sheetMap: Map<string, number>; // sheetId -> HF sheet index (0-based)
  addressMap: Map<string, string>; // "Sheet1!A1" -> cell address for lookups
  warnings: string[];
  workbookId?: string;
  lastModified?: string;
}

// Simple in-memory hydration cache keyed by workbookId
const hydrationCache = new Map<string, HydrationResult>();

/**
 * Return cached hydration for workbook if up-to-date, otherwise create a new one.
 */
export function getOrCreateHydration(
  workbook: WorkbookJSON,
  options: HydrationOptions = {}
): HydrationResult {
  const id = workbook.workbookId || '__local__';
  const cached = hydrationCache.get(id);
  const modifiedAt = workbook.meta?.modifiedAt;

  if (cached && cached.lastModified && modifiedAt && cached.lastModified === modifiedAt) {
    return cached;
  }

  const hydration = hydrateHFFromWorkbook(workbook, options);
  hydration.workbookId = id;
  hydration.lastModified = modifiedAt;
  hydrationCache.set(id, hydration);
  return hydration;
}

/**
 * Patch helper to add a single sheet to an existing HF instance and load its cells.
 * Does NOT rebuild the entire HF instance. Updates the provided sheetMap and addressMap.
 * Returns warnings encountered while patching.
 */
export function hydrateHFFromWorkbookPatch(
  hydration: HydrationResult,
  sheet: SheetJSON
): string[] {
  const warnings: string[] = [];
  const { hf, sheetMap, addressMap } = hydration;

  // Defensive: ensure sheet isn't already mapped
  if (sheetMap.has(sheet.id)) {
    warnings.push(`Sheet with id ${sheet.id} already exists in HF mapping`);
    return warnings;
  }

  // Determine a safe sheet name (HF requires unique names)
  let baseName = sheet.name || `Sheet${sheetMap.size + 1}`;
  let newName = baseName;
  let suffix = 1;
  while (hf.getSheetId(newName) !== undefined) {
    newName = `${baseName}_${suffix++}`;
  }

  try {
    const added = hf.addSheet(newName);
    const hfSheetId = hf.getSheetId(added);
    if (hfSheetId === undefined) {
      throw new Error('HF returned undefined sheet id after addSheet');
    }
    // register mapping
    sheetMap.set(sheet.id, hfSheetId);

    // Load cells for the new sheet
    const cells = sheet.cells || {};
    for (const [address, cell] of Object.entries(cells)) {
      try {
        const { row, col } = addressToHf(address);

        let hfValue: any;
        if (cell.formula) {
          hfValue = cell.formula.startsWith('=') ? cell.formula : `=${cell.formula}`;
        } else if (cell.raw !== undefined && cell.raw !== null) {
          hfValue = cell.raw;
        } else if (cell.computed?.v !== undefined) {
          // Only use cached computed values if the HF version matches the one that produced the cache
          const cacheHFVersion = cell.computed.hfVersion;
          const currentHFVersion = HyperFormula.version;
          if (cacheHFVersion && cacheHFVersion !== currentHFVersion) {
            // Mark cached value as stale so callers (AI planner) can reason about trust
            if (!cell.computed) {
              cell.computed = { v: null, ts: new Date().toISOString(), hfVersion: cacheHFVersion } as any;
            }
            cell.computed = { ...cell.computed, stale: true } as any;
            warnings.push(
              `Skipping cached computed value for ${sheet.name}!${address} due to hfVersion mismatch (cache: ${cacheHFVersion}, current: ${currentHFVersion})`
            );
          } else {
            hfValue = cell.computed.v;
          }
        } else {
          continue;
        }

        hf.setCellContents({ sheet: hfSheetId, row, col }, hfValue);

        // update hfInternal on the workbook model for quicker rehydration later
        if (!cell.hfInternal) {
          cell.hfInternal = { sheetId: hfSheetId, row, col } as any;
        } else {
          cell.hfInternal.sheetId = hfSheetId;
          cell.hfInternal.row = row;
          cell.hfInternal.col = col;
        }

        // address map
        const fullAddress = `${sheet.name}!${address}`;
        addressMap.set(fullAddress, address);
      } catch (err) {
        warnings.push(`Failed to load cell ${address} for sheet ${sheet.name}: ${err}`);
      }
    }
  } catch (err) {
    warnings.push(`Failed to add sheet to HF: ${err}`);
  }

  return warnings;
}

/**
 * Result of recompute operation
 */
export interface RecomputeResult {
  updatedCells: number;
  errors: Array<{ address: string; sheetId: string; error: string }>;
  warnings: string[];
}

/**
 * Options for hydration
 */
export interface HydrationOptions {
  config?: Partial<ConfigParams>;
  validateFormulas?: boolean; // Default: true
  skipCache?: boolean; // Skip loading cached computed values (default: false)
  circularReferenceConfig?: Partial<CircularReferenceConfig>; // Circular reference protection settings
}

/**
 * Options for recompute
 */
export interface RecomputeOptions {
  affectedRanges?: Array<{ sheetId: string; range: string }>; // Specific ranges to recompute
  fullRecompute?: boolean; // Force full recompute (ignore dependencies)
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create HyperFormula instance from WorkbookJSON
 * 
 * This is the main entry point for formula computation.
 * Loads all sheets and formulas into HF engine.
 * 
 * @param workbook - Source workbook
 * @param options - Hydration options
 * @returns HydrationResult with HF instance and mappings
 */
export function hydrateHFFromWorkbook(
  workbook: WorkbookJSON,
  options: HydrationOptions = {}
): HydrationResult {
  const warnings: string[] = [];
  const config = { ...DEFAULT_HF_CONFIG, ...options.config };

  // Track number of skipped cached values due to hfVersion mismatch
  let hfStaleCount = 0;

  // Defensive validation
  if (!workbook.sheets || workbook.sheets.length === 0) {
    throw new Error("hydrateHFFromWorkbook: workbook has no sheets");
  }

  // Initialize HF with empty instance (NO default sheets created)
  const hf = HyperFormula.buildEmpty(config);

  // For Excel compatibility, define TRUE and FALSE as named expressions and
  // (Named expressions will be registered after sheets are created so that
  // sheet-scoped references resolve correctly.)

  // Create sheet mapping (sheetId -> HF sheet index)
  const sheetMap = new Map<string, number>();
  const addressMap = new Map<string, string>();

  // Add all sheets to HF first (HF.buildEmpty() creates NO sheets by default)
  // Build mapping: workbook.sheet.id -> HF internal sheet ID (0-based index)
  for (let i = 0; i < workbook.sheets.length; i++) {
    const sheet = workbook.sheets[i];
    const sheetName = sheet.name || `Sheet${i + 1}`;

    try {
      // Add sheet to HF - this returns the sheet name (string)
      const addedSheetName = hf.addSheet(sheetName);
      
      // Get the numeric sheet ID from HyperFormula
      const hfSheetId = hf.getSheetId(addedSheetName);
      
      // Defensive check: ensure HF sheet ID is valid
      if (hfSheetId === undefined || hfSheetId === null) {
        throw new Error(`HF.getSheetId returned invalid ID for sheet "${addedSheetName}"`);
      }
      
      // Store bidirectional mapping (sheet.id is string, hfSheetId is number)
      sheetMap.set(sheet.id, hfSheetId);
      
      // Verify we can access the sheet we just created
      const hfSheetName = hf.getSheetName(hfSheetId);
      if (hfSheetName === undefined) {
        throw new Error(`Cannot access HF sheet with ID ${hfSheetId} after creation`);
      }
      
    } catch (error) {
      const errorMsg = `Failed to add sheet "${sheetName}" (id: ${sheet.id}) to HyperFormula at index ${i}: ${error}`;
      warnings.push(errorMsg);
      throw new Error(errorMsg);
    }
  }
  
  // Defensive check: verify all sheets were mapped
  if (sheetMap.size !== workbook.sheets.length) {
    const errorMsg = `Sheet mapping incomplete: expected ${workbook.sheets.length} sheets, got ${sheetMap.size}`;
    warnings.push(errorMsg);
    throw new Error(errorMsg);
  }

  // Load cell data into HF using the established mapping
  for (const sheet of workbook.sheets) {
    const hfSheetId = sheetMap.get(sheet.id);
    
    // Critical: this should never happen due to earlier defensive check
    if (hfSheetId === undefined) {
      const errorMsg = `CRITICAL: Sheet ${sheet.name} (id: ${sheet.id}) not found in HF mapping. This indicates a bug in sheet creation logic.`;
      warnings.push(errorMsg);
      throw new Error(errorMsg);
    }
    
    // Defensive: verify HF sheet still exists before loading cells
    try {
      const hfSheetName = hf.getSheetName(hfSheetId);
      if (hfSheetName === undefined) {
        throw new Error(`HF sheet with ID ${hfSheetId} does not exist`);
      }
    } catch (error) {
      const errorMsg = `Cannot access HF sheet ${hfSheetId} for workbook sheet ${sheet.name}: ${error}`;
      warnings.push(errorMsg);
      throw new Error(errorMsg);
    }

    // Convert cells to HF format
    const cellsToAdd: Array<[number, number, any]> = [];
    const cells = sheet.cells || {};

    for (const [address, cell] of Object.entries(cells)) {
      try {
        const { row, col } = addressToHf(address);

        // Store address mapping for lookups
        const fullAddress = `${sheet.name}!${address}`;
        addressMap.set(fullAddress, address);

        // Determine cell value for HF
        let hfValue: any;

        if (cell.formula) {
          // Load formula (HF expects formulas with = prefix)
          hfValue = cell.formula.startsWith("=")
            ? cell.formula
            : `=${cell.formula}`;
        } else if (cell.raw !== undefined && cell.raw !== null) {
          // Load raw value
          hfValue = cell.raw;
        } else if (!options.skipCache && cell.computed?.v !== undefined) {
          // Load cached computed value only if produced by the same HF version
          const cacheHFVersion = cell.computed.hfVersion;
          const currentHFVersion = HyperFormula.version;
          if (cacheHFVersion && cacheHFVersion !== currentHFVersion) {
            // Mark cached computed value as stale so AI can avoid trusting it
            if (!cell.computed) {
              cell.computed = { v: null, ts: new Date().toISOString(), hfVersion: cacheHFVersion } as any;
            }
            cell.computed = { ...cell.computed, stale: true } as any;
            warnings.push(
              `Skipping cached computed value for ${sheet.name}!${address} due to hfVersion mismatch (cache: ${cacheHFVersion}, current: ${currentHFVersion})`
            );
            // Count stale cached entries for telemetry
            hfStaleCount++;
            // Do not set hfValue here; HF will see the cell as empty and compute from formula/raw as needed
            continue;
          } else {
            // Load cached computed value
            hfValue = cell.computed.v;
          }
        } else {
          // Empty cell
          continue;
        }

        cellsToAdd.push([row, col, hfValue]);

        // Update hfInternal mapping
        if (!cell.hfInternal) {
          cell.hfInternal = {
            sheetId: hfSheetId,
            row,
            col,
          };
        }
      } catch (error) {
        warnings.push(
          `Failed to parse address ${address} in sheet ${sheet.name}: ${error}`
        );
      }
    }

    // Batch load cells into HF for performance
    if (cellsToAdd.length > 0) {
      try {
        for (const [row, col, value] of cellsToAdd) {
          hf.setCellContents({ sheet: hfSheetId, row, col }, value);
        }
      } catch (error) {
        warnings.push(
          `Failed to load cells for sheet ${sheet.name}: ${error}`
        );
      }
    }
  }

  // Validate formulas if requested
  if (options.validateFormulas !== false) {
    for (const sheet of workbook.sheets) {
      const hfSheetId = sheetMap.get(sheet.id);
      if (hfSheetId === undefined) continue;

      for (const [address, cell] of Object.entries(sheet.cells || {})) {
        if (!cell.formula) continue;

        try {
          const { row, col } = addressToHf(address);
          const cellValue = hf.getCellValue({ sheet: hfSheetId, row, col });

          // Check for errors
          if (
            cellValue &&
            typeof cellValue === "object" &&
            "type" in cellValue &&
            cellValue.type === "ERROR"
          ) {
            warnings.push(
              `Formula error in ${sheet.name}!${address}: ${cellValue.value}`
            );
          }
        } catch (error) {
          warnings.push(
            `Failed to validate formula at ${sheet.name}!${address}: ${error}`
          );
        }
      }
    }
  }

  // Emit aggregated telemetry if we skipped any stale cached computed values
  try {
    maybeEmitHFVersionTelemetry(workbook, hfStaleCount);
  } catch (err) {
    // swallow telemetry errors
  }

  // Register named expressions AFTER all sheets are created so sheet names
  // resolve to valid HF sheet IDs when the named expression is parsed.
  try {
    if (typeof hf.addNamedExpression === 'function') {
      hf.addNamedExpression('TRUE', '=TRUE()');
      hf.addNamedExpression('FALSE', '=FALSE()');

      if (workbook.namedRanges) {
        for (const [name, nr] of Object.entries(workbook.namedRanges)) {
          try {
            const ref = typeof nr === 'string' ? nr : (nr as any).ref;
            if (!ref) {
              warnings.push(`NamedRange ${name} has no ref; skipping`);
              continue;
            }

            // Heuristic: if the ref includes a sheet-scoped reference like 'Sheet1!A1'
            // and the referenced sheet name doesn't exist in the workbook, emit
            // telemetry and skip adding the named expression. HyperFormula may not
            // throw on registration for such refs, so we proactively detect it.
            if (typeof ref === 'string' && ref.includes('!')) {
              const sheetCandidate = ref.split('!')[0].replace(/^'+|'+$/g, '');
              const found = (workbook.sheets || []).some(s => s.name === sheetCandidate);
              if (!found) {
                const errMsg = `Referenced sheet ${sheetCandidate} not found`;
                warnings.push(`Failed to add named range ${name}: ${errMsg}`);
                try { trackNamedExpressionFailure(workbook.workbookId || 'unknown', name, String(nr), errMsg); } catch {}
                continue;
              }
            }

            const expr = ref.startsWith('=') ? ref : `=${ref}`;
            hf.addNamedExpression(name, expr);
          } catch (err) {
            const errMsg = String(err);
            warnings.push(`Failed to add named range ${name}: ${errMsg}`);
            try { trackNamedExpressionFailure(workbook.workbookId || 'unknown', name, String(nr), errMsg); } catch {} // best-effort
          }
        }
      }

      for (const sheet of workbook.sheets || []) {
        if (sheet.namedRanges) {
          for (const [name, nr] of Object.entries(sheet.namedRanges)) {
            try {
              const ref = typeof nr === 'string' ? nr : (nr as any).ref;
              if (!ref) {
                warnings.push(`Sheet-scoped NamedRange ${name} on ${sheet.name} has no ref; skipping`);
                continue;
              }

              // For sheet-scoped named ranges, also check if the ref references a
              // sheet that doesn't exist (defensive). If so, emit telemetry.
              if (typeof ref === 'string' && ref.includes('!')) {
                const sheetCandidate = ref.split('!')[0].replace(/^'+|'+$/g, '');
                const found = (workbook.sheets || []).some(s => s.name === sheetCandidate);
                if (!found) {
                  const errMsg = `Referenced sheet ${sheetCandidate} not found`;
                  warnings.push(`Failed to add sheet-scoped named range ${name} on ${sheet.name}: ${errMsg}`);
                  try { trackNamedExpressionFailure(workbook.workbookId || 'unknown', name, String(nr), errMsg); } catch {}
                  continue;
                }
              }

              const expr = ref.startsWith('=') ? ref : `=${ref}`;
              hf.addNamedExpression(name, expr);
            } catch (err) {
              const errMsg = String(err);
              warnings.push(`Failed to add sheet-scoped named range ${name} on ${sheet.name}: ${errMsg}`);
              try { trackNamedExpressionFailure(workbook.workbookId || 'unknown', name, String(nr), errMsg); } catch {} // best-effort
            }
          }
        }
      }
    }
  } catch (err) {
    warnings.push(`Failed to register named expressions: ${err}`);
  }

  // Attach hydration to workbook for reuse by consumers
  try {
    // Attach runtime hydration as a non-enumerable property to avoid
    // leaking HF internals (which contain circular references) into
    // JSON.stringify() and logs. This keeps the runtime slot available
    // to in-process consumers while remaining invisible to serialization.
    Object.defineProperty(workbook, 'hf', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: {
        hf,
        sheetMap,
        addressMap,
        warnings,
      },
    });
  } catch {
    // ignore assignment failures in read-only contexts
  }

  return {
    hf,
    sheetMap,
    addressMap,
    warnings,
  };
}

// Emit telemetry if we detected any hf-version stale cache entries during hydration
// Note: we intentionally keep telemetry emission outside the main loop to avoid
// spamming events for each cell; emit a single aggregated event per hydration.
// We rely on safe metadata only (counts and versions) — no workbook contents.
function maybeEmitHFVersionTelemetry(workbook: WorkbookJSON, staleCount: number) {
  try {
    if (staleCount > 0) {
      const cacheVersion = undefined; // not tracking a single cache version here
      const currentVersion = HyperFormula.version;
      const sheetCount = workbook.sheets ? workbook.sheets.length : undefined;
      // workbook.id may not exist for all formats; guard accordingly
  const workbookId = workbook.workbookId || 'unknown';
      trackHFVersionMismatch(workbookId, staleCount, cacheVersion, currentVersion, sheetCount);
    }
  } catch (err) {
    // Telemetry should not throw; log and continue
    console.warn('Failed to emit HF version telemetry:', err);
  }
}

/**
 * Recompute formulas and patch results back to workbook
 * 
 * This function:
 * 1. Triggers HF computation (if needed)
 * 2. Extracts computed values from HF
 * 3. Updates cell.computed cache
 * 4. Updates workbook.computed.hfCache
 * 5. Tracks dependencies in workbook.computed.dependencyGraph
 * 
 * @param workbook - Target workbook (modified in place)
 * @param hydration - Result from hydrateHFFromWorkbook
 * @param options - Recompute options
 * @returns RecomputeResult with stats and errors
 */
export function recomputeAndPatchCache(
  workbook: WorkbookJSON,
  hydration: HydrationResult,
  _options: RecomputeOptions = {}
): RecomputeResult {
  console.log('[HF-recompute] 🔄 Starting recompute...');
  const { hf, sheetMap } = hydration;
  const warnings: string[] = [];
  const errors: Array<{ address: string; sheetId: string; error: string }> = [];
  let updatedCells = 0;

  // Initialize computed cache if not present
  if (!workbook.computed) {
    workbook.computed = {
      hfCache: {},
      dependencyGraph: {},
    };
  }

  const hfVersion = HyperFormula.version;
  const computedBy = `hf-${hfVersion}`;
  const timestamp = new Date().toISOString();
  
  console.log('[HF-recompute] HF version:', hfVersion);
  console.log('[HF-recompute] Sheet count:', workbook.sheets.length);

  // Process all sheets
  for (const sheet of workbook.sheets) {
    const hfSheetId = sheetMap.get(sheet.id);
    if (hfSheetId === undefined) {
      warnings.push(`Sheet ${sheet.name} not found in HF mapping`);
      continue;
    }

    // Get sheet dimensions from HF (defensive: HF instance or mapping may be invalid)
    let maxRow = 0;
    let maxCol = 0;
    try {
      if (typeof hf.getSheetDimensions !== 'function') {
        warnings.push(`HF instance does not support getSheetDimensions; skipping sheet ${sheet.name}`);
        continue;
      }

      // Defensive: ensure hfSheetId is a valid value
      if (hfSheetId === undefined || hfSheetId === null) {
        warnings.push(`HF sheet id missing for sheet ${sheet.name}; skipping`);
        continue;
      }

      const sheetSize = hf.getSheetDimensions(hfSheetId);
      if (!sheetSize || typeof sheetSize.height !== 'number' || typeof sheetSize.width !== 'number') {
        warnings.push(`HF returned invalid dimensions for sheet ${sheet.name}; skipping`);
        continue;
      }

      maxRow = sheetSize.height;
      maxCol = sheetSize.width;
    } catch (err) {
      warnings.push(`Failed to get HF sheet dimensions for ${sheet.name}: ${String(err)}`);
      continue;
    }

    // Iterate through cells with formulas
    for (const [address, cell] of Object.entries(sheet.cells || {})) {
      if (!cell.formula) continue; // Skip non-formula cells

      console.log(`[HF-recompute] 📊 Processing ${sheet.name}!${address} formula: ${cell.formula}`);

      try {
        const { row, col } = addressToHf(address);

        // Skip if out of bounds
        if (row >= maxRow || col >= maxCol) continue;

        // Get computed value from HF
        const cellValue = hf.getCellValue({ sheet: hfSheetId, row, col });
        console.log(`[HF-recompute]   └─ HF returned value:`, cellValue, `(type: ${typeof cellValue})`);

        // Create computed value object
        const computed: ComputedValue = {
          v: null,
          ts: timestamp,
          hfVersion,
          computedBy,
        };

  // Handle different value shapes from HyperFormula. HF can return:
        // - primitive values (number, string, boolean)
        // - Date objects in some configurations
        // - error objects like { type: 'ERROR', value: '#DIV/0!' }
        // - or sometimes plain error strings like '#DIV/0!'

        // Null/undefined -> treat as empty
        if (cellValue === null || cellValue === undefined) {
          computed.v = null;
          computed.t = "s"; // empty

        // Detect errors in several shapes:
        // - { type: 'ERROR', value: '#DIV/0!' }
        // - { value: '#DIV/0!' } or { error: '#DIV/0!' }
        // - '#DIV/0!'
        } else {
          // Try to detect an error string inside the cellValue
          let detectedError: string | undefined;

          if (typeof cellValue === 'object' && cellValue !== null) {
            const anyVal: any = cellValue;
            if ('type' in anyVal && anyVal.type === 'ERROR') {
              detectedError = anyVal.value || anyVal.error || JSON.stringify(anyVal.value || anyVal.error || anyVal);
            } else if (typeof anyVal.value === 'string' && anyVal.value.startsWith('#')) {
              detectedError = anyVal.value;
            } else if (typeof anyVal.error === 'string' && anyVal.error.startsWith('#')) {
              detectedError = anyVal.error;
            }
          } else if (typeof cellValue === 'string' && cellValue.startsWith('#')) {
            detectedError = cellValue;
          }

          if (detectedError) {
            computed.v = detectedError;
            computed.t = 'e';
            computed.error = formatHFError(detectedError);
            errors.push({ address, sheetId: sheet.id, error: String(computed.error) });
          } else if (typeof cellValue === "number") {
            computed.v = cellValue;
            computed.t = "n";
          } else if (typeof cellValue === "boolean") {
            computed.v = cellValue;
            computed.t = "b";
          } else if (cellValue instanceof Date) {
            // Serialize dates as ISO strings for safe JSON storage and comparison.
            computed.v = cellValue.toISOString();
            computed.t = "d";
          } else {
            // Fallback - convert to string
            computed.v = String(cellValue);
            computed.t = "s";
          }

        }

        // Update cell computed cache
        // Merge with existing computed metadata and clear stale flag since we've recomputed
        if (!cell.computed) {
          cell.computed = computed;
        } else {
          cell.computed = { ...cell.computed, ...computed, stale: false } as any;
        }
        
        console.log(`[HF-recompute]   └─ ✓ Wrote computed:`, { v: computed.v, t: computed.t });

        // Update workbook-level cache
        const fullAddress = `${sheet.name}!${address}`;
        workbook.computed.hfCache![fullAddress] = computed;

        updatedCells++;

        // We'll compute dependencyGraph in a single pass after all cells are processed
        // to avoid per-cell parsing overhead. This is done below.
      } catch (error) {
        errors.push({
          address,
          sheetId: sheet.id,
          error: String(error),
        });
        warnings.push(
          `Failed to compute ${sheet.name}!${address}: ${error}`
        );
      }
    }
  }

  // Build dependency graph by inverting HF dependents to get precedents for each formula cell.
  try {
    const depGraph: Record<string, string[]> = {};
    for (const sheet of workbook.sheets) {
      const hfSheetId = sheetMap.get(sheet.id);
      if (hfSheetId === undefined) continue;

      for (const address of Object.keys(sheet.cells || {})) {
        // For each cell, get who depends on it and invert mapping
        try {
          const { row, col } = addressToHf(address);
          const dependents = typeof (hf as any).getCellDependents === 'function'
            ? (hf as any).getCellDependents({ sheet: hfSheetId, row, col })
            : [];

          if (dependents && dependents.length > 0) {
            const srcAddress = `${sheet.name}!${address}`;
            for (const dep of dependents) {
              const depSheetName = hf.getSheetName(dep.sheet);
              const depAddr = hfToAddress(dep.row, dep.col);
              const depFull = `${depSheetName}!${depAddr}`;
              // depFull depends on srcAddress, so add srcAddress to its precedents list
              if (!depGraph[depFull]) depGraph[depFull] = [];
              depGraph[depFull].push(srcAddress);
            }
          }
        } catch (e) {
          // best-effort; continue
        }
      }
    }

    // Assign to workbook computed dependency graph (overwrite with fresh mapping)
    workbook.computed.dependencyGraph = depGraph;
  } catch (e) {
    warnings.push(`Failed to build dependency graph: ${e}`);
  }

  // Update workbook metadata
  workbook.meta.modifiedAt = timestamp;

  console.log(`[HF-recompute] ✅ Recompute complete: ${updatedCells} cells updated, ${errors.length} errors, ${warnings.length} warnings`);

  return {
    updatedCells,
    errors,
    warnings,
  };
}

/**
 * Create HF instance and perform full computation pipeline
 * 
 * Convenience function that combines hydration + recompute.
 * Use this for initial load or full refresh.
 * 
 * @param workbook - Source workbook (modified in place)
 * @param options - Combined hydration + recompute options
 * @returns Combined result with HF instance and computation stats
 */
export function computeWorkbook(
  workbook: WorkbookJSON,
  options: HydrationOptions & RecomputeOptions & { forceNewHydration?: boolean } = {}
): {
  hydration: HydrationResult;
  recompute: RecomputeResult;
} {
  const circularConfig = { ...DEFAULT_CIRCULAR_CONFIG, ...options.circularReferenceConfig };
  
  // Pre-computation circular reference detection
  if (circularConfig.enablePreDetection) {
    const circularDetection = detectCircularReferences(workbook, circularConfig);
    
    if (circularDetection.hasCircularReferences) {
      // For MVP, we'll add warnings but allow computation to proceed with timeout protection
      const warnings: string[] = [];
      
      for (const chain of circularDetection.circularChains) {
        const error = createCircularReferenceError(chain, { operation: 'Formula computation' });
        warnings.push(formatCircularReferenceError(error));
        
        // Log high-severity circular references
        if (chain.severity === 'high') {
          console.warn(`🚨 High-severity circular reference detected: ${chain.cells.join(' → ')}`);
        }
      }
      
      // Add warnings to any existing hydration warnings
      if (warnings.length > 0) {
        console.warn(`⚠️ Detected ${circularDetection.circularChains.length} circular reference(s). Computation will proceed with timeout protection.`);
      }
    }
  }

  // Wrap computation with timeout protection
  try {
    const computation = () => {
      // Hydrate HF from workbook (reuse cached hydration when possible)
      const hydration = options.forceNewHydration ? hydrateHFFromWorkbook(workbook, options) : getOrCreateHydration(workbook, options);

      // Recompute and patch cache
      const recompute = recomputeAndPatchCache(workbook, hydration, options);

      return { hydration, recompute };
    };

    // Use synchronous timeout wrapper for now (can be made async later if needed).
    // We disable worker offload for the full computeWorkbook flow because the
    // computation closure references non-serializable HF instances and many
    // local functions. Running on the main thread uses a best-effort timing
    // check while still providing a fallback result on timeout.
    return withComputationTimeout(
      computation,
      circularConfig.computationTimeoutMs,
      'Formula computation',
      { useWorker: false, circularDetection: detectCircularReferences(workbook, circularConfig) }
    ) as { hydration: HydrationResult; recompute: RecomputeResult };
    
  } catch (error) {
    // If computation times out or fails, return safe fallback
    const fallbackHydration = hydrateHFFromWorkbook(workbook, { ...options, skipCache: true });
    
    // Attach fallback hydration to workbook for reuse
    try {
      (workbook as any).hf = fallbackHydration;
    } catch {
      // ignore assignment failures in read-only contexts
    }
    
    const fallbackRecompute: RecomputeResult = {
      updatedCells: 0,
      errors: [{
        address: 'SYSTEM',
        sheetId: 'SYSTEM',
        error: `Computation failed: ${error instanceof Error ? error.message : String(error)}`
      }],
      warnings: ['Formula computation was interrupted due to timeout or circular reference. Some formulas may not be computed.']
    };
    
    return { hydration: fallbackHydration, recompute: fallbackRecompute };
  }
}

/**
 * Update specific cells in HF and recompute affected formulas
 * 
 * Use this for incremental updates (e.g., user edits a cell).
 * More efficient than full recompute.
 * 
 * @param workbook - Target workbook
 * @param hydration - Existing HF instance
 * @param updates - Array of cell updates { sheetId, address, value }
 * @returns RecomputeResult with affected cells
 */
export function updateCellsAndRecompute(
  workbook: WorkbookJSON,
  hydration: HydrationResult,
  updates: Array<{ sheetId: string; address: string; value: any }>
): RecomputeResult {
  const { hf, sheetMap } = hydration;
  const warnings: string[] = [];

  // Apply updates to HF
  for (const update of updates) {
    const hfSheetId = sheetMap.get(update.sheetId);
    if (hfSheetId === undefined) {
      warnings.push(`Sheet ID ${update.sheetId} not found in HF mapping`);
      continue;
    }

    try {
      const { row, col } = addressToHf(update.address);
      hf.setCellContents({ sheet: hfSheetId, row, col }, update.value);
    } catch (error) {
      warnings.push(
        `Failed to update cell ${update.address}: ${error}`
      );
    }
  }

  // Recompute affected cells
  return recomputeAndPatchCache(workbook, hydration);
}

/**
 * Get cell value from HF instance
 * 
 * Utility for reading computed values without patching workbook.
 * 
 * @param hf - HyperFormula instance
 * @param sheetId - HF sheet ID (0-based)
 * @param address - Cell address (e.g., "A1")
 * @returns Computed value or null
 */
export function getCellValueFromHF(
  hf: HyperFormulaInstance,
  sheetId: number,
  address: string
): any {
  try {
    const { row, col } = addressToHf(address);
    return hf.getCellValue({ sheet: sheetId, row, col });
  } catch (error) {
    return null;
  }
}

/**
 * Check if cell contains formula in HF
 * 
 * @param hf - HyperFormula instance
 * @param sheetId - HF sheet ID (0-based)
 * @param address - Cell address (e.g., "A1")
 * @returns True if cell has formula
 */
export function isCellFormula(
  hf: HyperFormulaInstance,
  sheetId: number,
  address: string
): boolean {
  try {
    const { row, col } = addressToHf(address);
    const formula = hf.getCellFormula({ sheet: sheetId, row, col });
    return formula !== undefined && formula !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get formula string from HF
 * 
 * @param hf - HyperFormula instance
 * @param sheetId - HF sheet ID (0-based)
 * @param address - Cell address (e.g., "A1")
 * @returns Formula string (without = prefix) or null
 */
export function getCellFormulaFromHF(
  hf: HyperFormulaInstance,
  sheetId: number,
  address: string
): string | null {
  try {
    const { row, col } = addressToHf(address);
    const formula = hf.getCellFormula({ sheet: sheetId, row, col });
    return formula || null;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert HF error to user-friendly message
 */
export function formatHFError(error: any): string {
  if (!error || typeof error !== "object") return String(error);

  // Handle circular reference errors
  if ("type" in error && error.type === "CIRCULAR_REFERENCE") {
    return formatCircularReferenceError(error);
  }

  if ("type" in error && error.type === "ERROR") {
    const errorValue = error.value || "UNKNOWN_ERROR";
    switch (errorValue) {
      case "#DIV/0!":
        return "Division by zero";
      case "#N/A":
        return "Value not available";
      case "#NAME?":
        return "Invalid formula name";
      case "#NULL!":
        return "Invalid range intersection";
      case "#NUM!":
        return "Invalid numeric value";
      case "#REF!":
        return "Invalid cell reference";
      case "#VALUE!":
        return "Invalid value type";
      case "#CIRCULAR!":
        return "Circular reference detected";
      default:
        return errorValue;
    }
  }

  return String(error);
}

/**
 * Get HF statistics for debugging
 */
export function getHFStats(hf: HyperFormulaInstance): {
  sheets: number;
  namedExpressions: number;
  cells: number;
} {
  return {
    sheets: hf.getSheetNames().length,
    namedExpressions: hf.listNamedExpressions().length,
    cells: hf.getSheetNames().reduce((total, sheetName) => {
      const sheetId = hf.getSheetId(sheetName);
      if (sheetId === undefined) return total;
      const dimensions = hf.getSheetDimensions(sheetId);
      return total + dimensions.width * dimensions.height;
    }, 0),
  };
}

/**
 * Dispose HF instance and cleanup resources
 * 
 * Call this when workbook is closed or component unmounts.
 */
export function disposeHF(hf: HyperFormulaInstance): void {
  try {
    // Remove any cached hydration that references this HF instance
    for (const [id, hydration] of hydrationCache.entries()) {
      if (hydration.hf === hf) {
        hydrationCache.delete(id);
      }
    }
    hf.destroy();
  } catch (error) {
    console.warn("Failed to dispose HF instance:", error);
  }
}

// Re-export HyperFormula class and type for external usage
export { HyperFormula };
export type { HyperFormulaInstance };

// Note: maybeEmitHFVersionTelemetry is internal and not exported.
