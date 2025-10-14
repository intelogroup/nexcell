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
} from "./types";
import { hfToAddress, addressToHf } from "./utils";

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
  useArrayArithmetic: true, // Support array formulas
  useColumnIndex: false, // Use A1 notation
  useStats: false, // Disable stats collection for performance
  smartRounding: true, // Round floating point precision
  precisionRounding: 14, // Excel-like precision
  dateFormats: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
  timeFormats: ["HH:mm", "HH:mm:ss"],
  functionArgSeparator: ",", // Use comma separator
  decimalSeparator: ".", // Use period for decimals
  thousandSeparator: "", // Empty string to avoid conflict with functionArgSeparator
  // nullYear is a two-digit pivot (0-100). Use 30 for Excel-like behavior
  // (treats years 00-30 as 2000-2030). A four-digit year like 1900 is invalid
  // for HyperFormula and will throw ConfigValueTooBigError (>100).
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

  // Defensive validation
  if (!workbook.sheets || workbook.sheets.length === 0) {
    throw new Error("hydrateHFFromWorkbook: workbook has no sheets");
  }

  // Initialize HF with empty instance (NO default sheets created)
  const hf = HyperFormula.buildEmpty(config);

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
          // Load cached computed value if available
          hfValue = cell.computed.v;
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

  return {
    hf,
    sheetMap,
    addressMap,
    warnings,
  };
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

  // Process all sheets
  for (const sheet of workbook.sheets) {
    const hfSheetId = sheetMap.get(sheet.id);
    if (hfSheetId === undefined) {
      warnings.push(`Sheet ${sheet.name} not found in HF mapping`);
      continue;
    }

    // Get sheet dimensions from HF
    const sheetSize = hf.getSheetDimensions(hfSheetId);
    const maxRow = sheetSize.height;
    const maxCol = sheetSize.width;

    // Iterate through cells with formulas
    for (const [address, cell] of Object.entries(sheet.cells || {})) {
      if (!cell.formula) continue; // Skip non-formula cells

      try {
        const { row, col } = addressToHf(address);

        // Skip if out of bounds
        if (row >= maxRow || col >= maxCol) continue;

        // Get computed value from HF
        const cellValue = hf.getCellValue({ sheet: hfSheetId, row, col });

        // Create computed value object
        const computed: ComputedValue = {
          v: null,
          ts: timestamp,
          hfVersion,
          computedBy,
        };

        // Handle different value types
        if (cellValue === null || cellValue === undefined) {
          computed.v = null;
          computed.t = "s"; // Empty string type
        } else if (typeof cellValue === "number") {
          computed.v = cellValue;
          computed.t = "n";
        } else if (typeof cellValue === "string") {
          computed.v = cellValue;
          computed.t = "s";
        } else if (typeof cellValue === "boolean") {
          computed.v = cellValue;
          computed.t = "b";
        } else if (
          typeof cellValue === "object" &&
          "type" in cellValue &&
          cellValue.type === "ERROR"
        ) {
          // Handle HF error
          computed.v = null;
          computed.t = "e";
          computed.error = `${cellValue.value}`;
          errors.push({
            address,
            sheetId: sheet.id,
            error: computed.error,
          });
        } else {
          // Unknown type
          computed.v = String(cellValue);
          computed.t = "s";
        }

        // Update cell computed cache
        cell.computed = computed;

        // Update workbook-level cache
        const fullAddress = `${sheet.name}!${address}`;
        workbook.computed.hfCache![fullAddress] = computed;

        updatedCells++;

        // Get cell dependencies (cells this formula depends on)
        try {
          const dependents = hf.getCellDependents({ sheet: hfSheetId, row, col });
          if (dependents && dependents.length > 0) {
            const deps = dependents.map((dep: any) => {
              const depSheetName = hf.getSheetName(dep.sheet);
              const depAddress = hfToAddress(dep.row, dep.col);
              return `${depSheetName}!${depAddress}`;
            });
            workbook.computed.dependencyGraph![fullAddress] = deps;
          }
        } catch (depError) {
          // Dependencies not critical, just log warning
          warnings.push(
            `Failed to get dependencies for ${fullAddress}: ${depError}`
          );
        }
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

  // Update workbook metadata
  workbook.meta.modifiedAt = timestamp;

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
  options: HydrationOptions & RecomputeOptions = {}
): {
  hydration: HydrationResult;
  recompute: RecomputeResult;
} {
  // Hydrate HF from workbook
  const hydration = hydrateHFFromWorkbook(workbook, options);

  // Recompute and patch cache
  const recompute = recomputeAndPatchCache(workbook, hydration, options);

  return { hydration, recompute };
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
    hf.destroy();
  } catch (error) {
    console.warn("Failed to dispose HF instance:", error);
  }
}

// Re-export HyperFormula class and type for external usage
export { HyperFormula };
export type { HyperFormulaInstance };
