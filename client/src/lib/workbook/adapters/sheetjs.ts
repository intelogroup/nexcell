/**
 * SheetJS Export Adapter
 * Basic export/import using SheetJS (xlsx library)
 * Supports: formulas, basic styles, merges, column widths, row heights
 */

import type { ExportAdapter, WorkbookJSON, SheetJSON, Cell } from "../types";
import { createWorkbook, generateId, parseAddress, toAddress } from "../utils";

// Local narrow shapes to avoid using `any` for SheetJS runtime objects.
type SheetJSUtilsLike = { decode_range?: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } }; encode_range?: (r: unknown) => string };

// Lightweight gated debug logging. Use Vite env var VITE_DEBUG_ADAPTERS=true to enable.
const debugLog = (...args: unknown[]) => {
  try {
    if ((import.meta as any)?.env?.VITE_DEBUG_ADAPTERS === 'true') {
      // eslint-disable-next-line no-console
      console.debug(...args);
    }
  } catch {
    // import.meta may not exist in some test runtimes; swallow silently
  }
};

export class SheetJSAdapter implements ExportAdapter {
  readonly name = "SheetJS";
  readonly extension = "xlsx";
  readonly mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly features = {
    formulas: true,
    formulaCache: true, // We preserve computed values (v field)
    styles: false, // SheetJS has limited style support (requires paid version)
    merges: true,
    comments: false, // limited support
    dataValidations: false,
    conditionalFormats: false,
    charts: false,
    images: false,
  namedRanges: true, // Named ranges supported
    columnWidths: true,
    rowHeights: true,
  };

  async export(workbook: WorkbookJSON): Promise<ArrayBuffer> {
    // Dynamic import to avoid bundling if not used
    const XLSX = await import("xlsx");
    
    const wb = XLSX.utils.book_new();
    const warnings: string[] = [];
    
    // Collect unsupported features for export warnings
    this.collectUnsupportedFeatures(workbook, warnings);
    
    for (const sheet of workbook.sheets) {
      const ws = this.sheetToWorksheet(sheet, XLSX, warnings);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      
      // Set sheet visibility (hidden sheets are still exported but marked hidden)
      const sheetIndex = wb.SheetNames.length - 1;
      if (sheet.visible === false) {
        if (!wb.Workbook) wb.Workbook = {};
        if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
        wb.Workbook.Sheets[sheetIndex] = wb.Workbook.Sheets[sheetIndex] || {};
        // assign Hidden flag without using `any`
        (wb.Workbook.Sheets[sheetIndex] as Record<string, unknown>)['Hidden'] = 1;
      }
      // Freeze panes: map from sheet.freezePanes to sheet view info where possible
      if (sheet.freezePanes) {
        // Best-effort: attach to worksheet as !freeze so adapters can map to views
        (ws as Record<string, unknown>)['!freeze'] = {
          xSplit: sheet.freezePanes.col || 0,
          ySplit: sheet.freezePanes.row || 0,
          topLeftCell: undefined,
          activePane: 'bottomRight',
        } as Record<string, unknown>;
      }
    }

    // Set workbook view properties (activeTab)
    if (workbook.workbookProperties?.workbookView) {
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Views = wb.Workbook.Views || [{}];
      const v = wb.Workbook.Views[0] as Record<string, unknown> | undefined;
      if (v) v['activeTab'] = workbook.workbookProperties.workbookView.activeTab || 0;
    }

    // Honor workbook date system (1900 vs 1904) for Excel compatibility
    if (workbook.meta?.dateSystem) {
      wb.Workbook = wb.Workbook || {};
      // SheetJS expects WBProps.date1904 boolean flag
      (wb.Workbook as any).WBProps = (wb.Workbook as any).WBProps || {};
      (wb.Workbook as any).WBProps.date1904 = workbook.meta.dateSystem === '1904';
    }
    
    // Store warnings in workbook for persistence
    if (warnings.length > 0) {
      workbook.exportWarnings = workbook.exportWarnings || [];
      workbook.exportWarnings.push(...warnings.map(w => `[SheetJS] ${w}`));
      console.warn(`[SheetJSAdapter] Export warnings:\n${warnings.join('\n')}`);
    }

    // Named ranges: export workbook-scoped and sheet-scoped named ranges to wb.Workbook.Names
    try {
      const names: Array<Record<string, unknown>> = [];
      // Export special arrayRange markers as named ranges so they survive XLSX serialization.
      // Name format: __ARRAY__<sheetName>::<address> -> Ref: "<sheetName>!<range>"
      for (const sheet of workbook.sheets) {
        for (const [address, cell] of Object.entries(sheet.cells || {}) as [string, Cell][]) {
          if (cell.arrayRange) {
            const nm = `__ARRAY__${sheet.name}::${address}`;
            names.push({ Name: nm, Ref: `${sheet.name}!${cell.arrayRange}` });
          }
        }
      }

      if (workbook.namedRanges) {
        for (const [name, nr] of Object.entries(workbook.namedRanges)) {
          const ref = typeof nr === 'string' ? nr : (nr as any).ref;
          if (!ref) continue;
          const entry: Record<string, unknown> = { Name: name, Ref: ref };
          if (typeof nr !== 'string' && (nr as any).hidden) {
            // SheetJS name record supports a Hidden flag (1 = hidden)
            entry.Hidden = 1;
          }
          names.push(entry);
        }
      }
      // sheet-scoped named ranges
      for (const sheet of workbook.sheets) {
        if (!sheet.namedRanges) continue;
        for (const [name, nr] of Object.entries(sheet.namedRanges)) {
          const ref = typeof nr === 'string' ? nr : (nr as any).ref;
          if (!ref) continue;
          const entry: Record<string, unknown> = { Name: name, Ref: ref, Sheet: sheet.name };
          if (typeof nr !== 'string' && (nr as any).hidden) {
            entry.Hidden = 1;
          }
          names.push(entry);
        }
      }
      // Export freeze panes as a special named marker so it survives XLSX roundtrip
      for (const sheet of workbook.sheets) {
        if (sheet.freezePanes) {
          const nm = `__FREEZE__${sheet.name}::${sheet.freezePanes.col || 0},${sheet.freezePanes.row || 0}`;
          names.push({ Name: nm, Ref: `${sheet.name}!A1` });
        }
      }
      if (names.length > 0) {
        wb.Workbook = wb.Workbook || {};
        (wb.Workbook as any).Names = names;
      }
    } catch (e) {
      warnings.push(`Failed to export named ranges: ${e}`);
    }
    
    // Write workbook to array buffer with options to preserve formats
    const buffer = XLSX.write(wb, { 
      bookType: "xlsx", 
      type: "array",
      cellStyles: true, // Preserve cell styles
    });
    return buffer;
  }

  async import(data: Blob | ArrayBuffer): Promise<WorkbookJSON> {
    const XLSX = await import("xlsx");
    
    // Convert Blob to ArrayBuffer if needed
    const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
    
    // Read workbook with options to preserve formats and formulas
    const wb = XLSX.read(arrayBuffer, { 
      type: "array", 
      cellNF: true,      // Preserve number formats (z field)
      cellFormula: true, // Preserve formulas (f field)
      cellStyles: true,  // Preserve styles (s field, if available)
    });
  // Debug: log Names as parsed by SheetJS (gated)
  debugLog('[SheetJSAdapter] parsed Names:', (wb.Workbook as any)?.Names);
    
    // Create new workbook JSON
    const workbook = createWorkbook(wb.Props?.Title || "Workbook");
    workbook.sheets = []; // clear default sheet
    
    // Import workbook view properties (activeTab)
    if (wb.Workbook?.Views?.[0]) {
      if (workbook.workbookProperties) {
        workbook.workbookProperties.workbookView = workbook.workbookProperties.workbookView || {};
        const view = wb.Workbook.Views[0] as Record<string, unknown> | undefined;
        workbook.workbookProperties.workbookView.activeTab = (view && (view['activeTab'] as number)) || 0;
      }
    }
    
    // Import each sheet
    for (const sheetName of wb.SheetNames) {
      const ws = (wb.Sheets as Record<string, unknown> | undefined)?.[sheetName];
  try { debugLog('[SheetJSAdapter] importing worksheet keys:', sheetName, Object.keys(ws || {})); } catch {}
  try { debugLog('[SheetJSAdapter] worksheet !freeze:', sheetName, (ws as any)?.['!freeze']); } catch {}
      const sheet = this.worksheetToSheet(ws, sheetName, XLSX);
      
      // Set visibility based on workbook sheet properties
      const sheetIndex = wb.SheetNames.indexOf(sheetName);
      if (wb.Workbook?.Sheets?.[sheetIndex]) {
        const sheetProps = wb.Workbook.Sheets[sheetIndex] as any;
        sheet.visible = sheetProps.Hidden !== 1;
      }
      
      workbook.sheets.push(sheet);
    }
    // Import named ranges from wb.Workbook.Names (SheetJS representation)
    try {
      const names = (wb.Workbook as any)?.Names as Array<any> | undefined;
      if (Array.isArray(names) && names.length > 0) {
  // Debug: surface raw Names for diagnosis (gated)
  try { debugLog('[SheetJSAdapter] raw Names:', names); } catch {};
        workbook.namedRanges = workbook.namedRanges || {};
        for (const n of names) {
            const nm = n.Name as string | undefined;
            const ref = n.Ref as string | undefined;
            // SheetJS may store the Sheet field as a sheet name or a numeric sheet index.
            const sheetFieldRaw = (n as any).Sheet;
            let sheetNameScope: string | undefined;
            if (sheetFieldRaw !== undefined && sheetFieldRaw !== null) {
              if (typeof sheetFieldRaw === 'number') {
                // Resolve numeric sheet index to sheet name when possible (SheetJS uses 0-based indexes).
                if (Number.isFinite(sheetFieldRaw) && wb.SheetNames && (wb.SheetNames as string[])[sheetFieldRaw]) {
                  sheetNameScope = (wb.SheetNames as string[])[sheetFieldRaw];
                } else if (wb.SheetNames && (wb.SheetNames as string[]).length > 0) {
                  // Fallback: some SheetJS builds emit NaN for sheet-scoped names; assume first sheet
                  sheetNameScope = (wb.SheetNames as string[])[0];
                } else {
                  sheetNameScope = String(sheetFieldRaw);
                }
              } else {
                sheetNameScope = String(sheetFieldRaw);
              }
            }
            const hiddenFlag = n.Hidden !== undefined ? Boolean(n.Hidden) : undefined;
            if (!nm || !ref) continue;
            // Skip internal Excel names (like autofilter helper)
            if (nm.startsWith('_xlnm.')) continue;
            if (sheetNameScope) {
              try { debugLog('[SheetJSAdapter] name import:', { nm, sheetNameScope, ref, hiddenFlag }); } catch {}
              const s = workbook.sheets.find((sh) => sh.name === sheetNameScope);
              try { debugLog('[SheetJSAdapter] find sheet result:', { found: !!s, sheetName: s?.name }); } catch {}
              if (s) {
                s.namedRanges = s.namedRanges || {};
                // Handle special arrayRange markers exported as named ranges
                if (nm.startsWith('__ARRAY__')) {
                  const m = nm.match(/^__ARRAY__(.+)::(.+)$/);
                  if (m) {
                    const sheetName = m[1];
                    const addr = m[2];
                    const range = typeof ref === 'string' ? (ref.includes('!') ? ref.split('!')[1] : ref) : undefined;
                    debugLog(`[SheetJSAdapter] array marker parsed: name=${nm}, sheetName=${sheetName}, addr=${addr}, range=${range}, targetSheet=${s.name}`);
                    if (range && sheetName === s.name) {
                      s.cells = s.cells || {};
                      debugLog(`[SheetJSAdapter] before restore: s.cells[${addr}] exists=${s.cells[addr] !== undefined}`);
                      s.cells[addr] = s.cells[addr] || {} as any;
                      (s.cells[addr] as any).arrayRange = range;
                      (s.cells[addr] as any).arrayFormula = true;
                      debugLog(`[SheetJSAdapter] restored arrayRange on ${s.name}!${addr} -> ${range}`);
                      continue;
                    }
                  }
                }
                // Handle freeze pane markers
                if (nm.startsWith('__FREEZE__')) {
                  const fm = nm.match(/^__FREEZE__(.+)::(\d+),(\d+)$/);
                  if (fm) {
                    const sheetName = fm[1];
                    const col = Number(fm[2]);
                    const row = Number(fm[3]);
                    if (sheetName === s.name) {
                      s.freezePanes = { row, col } as any;
                      s.properties = s.properties || {};
                      (s.properties as any).freeze = true;
                      continue;
                    }
                  }
                }
                s.namedRanges[nm] = ref;
                if (hiddenFlag) {
                  // convert to NamedRange object to preserve hidden flag
                  s.namedRanges[nm] = { ref, name: nm, scope: s.id, hidden: true } as any;
                }
              } else {
                // fallback to workbook-scoped if sheet not found
                workbook.namedRanges[nm] = ref;
                if (hiddenFlag) workbook.namedRanges[nm] = { ref, name: nm, hidden: true } as any;
              }
            } else {
              // Try to parse sheet prefix from Ref (e.g., 'Sheet1!$A$1:$A$2')
              const match = typeof ref === 'string' ? ref.match(/^([^!]+)!/) : null;
                if (match) {
                  const maybeSheet = match[1];
                  const s = workbook.sheets.find((sh) => sh.name === maybeSheet);
                  if (s) {
                    s.namedRanges = s.namedRanges || {};
                    // If this is our special array marker, restore arrayRange on the anchor cell
                    if (nm.startsWith('__ARRAY__')) {
                      const m = nm.match(/^__ARRAY__(.+)::(.+)$/);
                      if (m) {
                        const sheetName = m[1];
                        const addr = m[2];
                        const range = typeof ref === 'string' ? (ref.includes('!') ? ref.split('!')[1] : ref) : undefined;
                        if (range && sheetName === s.name) {
                          s.cells = s.cells || {};
                          s.cells[addr] = s.cells[addr] || {} as any;
                          (s.cells[addr] as any).arrayRange = range;
                          (s.cells[addr] as any).arrayFormula = true;
                          continue;
                        }
                      }
                    }
                    // Handle freeze pane markers embedded in the Name when Ref had sheet prefix
                    if (nm.startsWith('__FREEZE__')) {
                      const fm = nm.match(/^__FREEZE__(.+)::(\d+),(\d+)$/);
                      if (fm) {
                        const sheetName = fm[1];
                        const col = Number(fm[2]);
                        const row = Number(fm[3]);
                        if (sheetName === s.name) {
                          s.freezePanes = { row, col } as any;
                          s.properties = s.properties || {};
                          (s.properties as any).freeze = true;
                          continue;
                        }
                      }
                    }
                    s.namedRanges[nm] = ref;
                    if (hiddenFlag) s.namedRanges[nm] = { ref, name: nm, scope: s.id, hidden: true } as any;
                    // Also mirror workbook-level namedRanges for accessibility
                    // NOTE: Sheet-scoped named ranges are mirrored into workbook.namedRanges
                    // for API convenience. If multiple sheets define the same name, the last
                    // sheet's definition wins. Consider namespacing (e.g., "Sheet1::MyRange")
                    // in Phase 2 if name collisions become an issue.
                    workbook.namedRanges = workbook.namedRanges || {};
                    workbook.namedRanges[nm] = typeof s.namedRanges[nm] === 'string' ? s.namedRanges[nm] : (s.namedRanges[nm] as any).ref || s.namedRanges[nm];
                    if (hiddenFlag) workbook.namedRanges[nm] = { ref, name: nm, hidden: true } as any;
                    continue;
                  }
              }
              // Otherwise treat as workbook-scoped
                workbook.namedRanges[nm] = ref;
                if (hiddenFlag) workbook.namedRanges[nm] = { ref, name: nm, hidden: true } as any;
            }
          }
      }
    } catch (e) {
      // non-critical
    }
      // Read workbook date system flag if present
      try {
        const wbProps = (wb.Workbook as any)?.WBProps as Record<string, unknown> | undefined;
        if (wbProps && wbProps.date1904 !== undefined) {
          workbook.meta.dateSystem = wbProps.date1904 ? '1904' : '1900';
        }
      } catch {
        // ignore
      }
    
    return workbook;
  }

  private sheetToWorksheet(sheet: SheetJSON, XLSX: unknown, warnings: string[]): Record<string, unknown> {
    const ws: Record<string, unknown> = {};
    
    // Add cells
    for (const [address, cell] of Object.entries(sheet.cells || {}) as [string, Cell][]) {
      const xlsxCell: Record<string, unknown> = {};
      
      // Handle formulas
      if (cell.formula) {
        // SheetJS stores formulas in the `f` field without a leading '=' in most cases.
        // Internally we keep formulas with a leading '=' for consistency, so strip it when
        // writing out to XLSX.
        xlsxCell.f = cell.formula.startsWith("=") ? cell.formula.substring(1) : cell.formula;
        
        // CRITICAL: Excel requires both f (formula) and v (cached value) for proper display
        // Always write v, even if undefined, to ensure Excel doesn't show #VALUE!
        if (cell.computed?.v !== undefined) {
          xlsxCell.v = cell.computed.v;
        } else {
          // Missing computed value - write error placeholder and warn
          xlsxCell.v = 0; // Default fallback (Excel will recalculate on open)
          warnings.push(
            `Sheet "${sheet.name}", Cell ${address}: Formula "${cell.formula}" missing computed value (computed.v). ` +
            `Excel will recalculate on open. Run recomputeAndPatchCache() before export.`
          );
        }
      } else {
        // Regular value
        xlsxCell.v = cell.raw ?? cell.computed?.v;
      }

      // Preserve arrayRange (custom field) so local roundtrip via SheetJS keeps anchor info.
      if (cell.arrayRange) {
        (xlsxCell as Record<string, unknown>)['__arrayRange'] = cell.arrayRange;
      }
      
      // Add number format
      if (cell.numFmt) {
        xlsxCell.z = cell.numFmt;
      }

      // Hyperlink
      if ((cell as any).hyperlink) {
        const link = (cell as any).hyperlink;
        xlsxCell.l = {
          Target: link.url || link.target,
          Tooltip: link.tooltip,
        } as Record<string, unknown>;
      }
      
      // Set cell type if known
      if (cell.computed?.t) {
        xlsxCell.t = cell.computed.t;
      } else if (cell.dataType) {
        // Map dataType to SheetJS type
        const typeMap: Record<string, string> = {
          string: "s",
          number: "n",
          boolean: "b",
          date: "d",
          error: "e",
        };
        xlsxCell.t = typeMap[cell.dataType] || "s";
      }
      
      ws[address] = xlsxCell;
    }
    
    // Add merges
      if (sheet.mergedRanges?.length) {
      const utils = (XLSX as unknown as { utils?: SheetJSUtilsLike }).utils;
      ws["!merges"] = sheet.mergedRanges.map((range: string) => utils?.decode_range ? utils.decode_range(range) : range);
    }
    
    // Add column widths - prefer sheet.columnWidths (new schema) else sheet.cols
    const colsArray: Array<Record<string, unknown>> = [];
  if (sheet.columnWidths && Object.keys(sheet.columnWidths).length > 0) {
      // Determine max column by converting letters to indices if needed; simple approach: use keys provided
      const entries = Object.entries(sheet.columnWidths);
      // Build sparse array keyed by column index (1-based)
      for (const [, width] of entries) {
        colsArray.push({ wch: width });
      }
      ws["!cols"] = colsArray;
    } else if (sheet.cols && Object.keys(sheet.cols).length > 0) {
      const maxCol = Math.max(...Object.keys(sheet.cols).map(Number));
      for (let c = 1; c <= maxCol; c++) {
        const colMeta = sheet.cols[c];
        if (colMeta) {
          colsArray.push({
            wch: colMeta.width ? colMeta.width / 7 : 10,
            hidden: colMeta.hidden || false,
          });
        } else {
          colsArray.push({ wch: 10 });
        }
      }
      ws["!cols"] = colsArray;
    }

    // Freeze panes (also set here so private sheetToWorksheet returns freeze info)
    if (sheet.freezePanes) {
      (ws as Record<string, unknown>)['!freeze'] = {
        xSplit: sheet.freezePanes.col || 0,
        ySplit: sheet.freezePanes.row || 0,
        topLeftCell: undefined,
        activePane: 'bottomRight',
      } as Record<string, unknown>;
    }
    
    // Add row heights - prefer sheet.rowHeights else sheet.rows
    const rowsArray: Array<Record<string, unknown>> = [];
    if (sheet.rowHeights && Object.keys(sheet.rowHeights).length > 0) {
      for (const [, height] of Object.entries(sheet.rowHeights)) {
        rowsArray.push({ hpx: height });
      }
      ws["!rows"] = rowsArray;
    } else if (sheet.rows && Object.keys(sheet.rows).length > 0) {
      const maxRow = Math.max(...Object.keys(sheet.rows).map(Number));
      for (let r = 1; r <= maxRow; r++) {
        const rowMeta = sheet.rows[r];
        if (rowMeta) {
          rowsArray.push({ hpt: rowMeta.height || 21, hidden: rowMeta.hidden || false });
        } else {
          rowsArray.push({ hpt: 21 });
        }
      }
      ws["!rows"] = rowsArray;
    }

    // AutoFilter
    if (sheet.autoFilter && sheet.autoFilter.range) {
      (ws as Record<string, unknown>)['!autofilter'] = { ref: sheet.autoFilter.range };
    }
    
    // Calculate range
    const addresses = Object.keys(sheet.cells || {});
    if (addresses.length > 0) {
      const coords = addresses.map(parseAddress);
      const maxRow = Math.max(...coords.map((c: { row: number }) => c.row));
      const maxCol = Math.max(...coords.map((c: { col: number }) => c.col));
      ws["!ref"] = `A1:${toAddress(maxRow, maxCol)}`;
    } else {
      ws["!ref"] = "A1";
    }
    
    return ws;
  }

  private worksheetToSheet(ws: unknown, name: string, XLSX: unknown): SheetJSON {
    const sheet: SheetJSON = {
      id: generateId(),
      name,
      visible: true,
      grid: { rowCount: 1000, colCount: 50 },
      rows: {},
      cols: {},
      cells: {},
      mergedRanges: [],
      dataValidations: [],
      conditionalFormats: [],
      namedRanges: {},
      charts: [],
      pivots: [],
      images: [],
      comments: {},
      properties: {
        defaultRowHeight: 21,
        defaultColWidth: 100,
        gridLines: true,
        showHeaders: true,
        zoom: 100,
      },
    };
    
    // Import cells
  const utils = (XLSX as unknown as { utils?: SheetJSUtilsLike }).utils;
  // Local helper to coerce SheetJS cell values to scalar. We avoid calling
  // the instance method via `this.coerceScalar` here to prevent potential
  // runtime binding issues when the method is invoked in certain test
  // environments where `this` isn't the class instance.
  const localCoerceScalar = (value: unknown): string | number | boolean | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };
  const range = utils?.decode_range ? utils.decode_range((ws as Record<string, unknown>)['!ref'] as string || "A1") : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const address = toAddress(R + 1, C + 1);
  const xlsxCell = (ws as Record<string, unknown>)[address] as Record<string, unknown> | undefined;
        
  if (!xlsxCell) continue;
        
        const cell: Cell = {};
        
        // Handle formula
  if (xlsxCell && (xlsxCell as Record<string, unknown>)['f']) {
          // SheetJS typically returns formula strings without a leading '='. Ensure our
          // internal representation always includes '=' so other code can rely on it.
          const f = typeof xlsxCell.f === 'string' ? xlsxCell.f : String(xlsxCell.f);
          cell.formula = f.startsWith('=') ? f : `=${f}`;
          cell.dataType = "formula";
          cell.computed = {
            v: localCoerceScalar((xlsxCell as Record<string, unknown>)['v']),
            t: (typeof (xlsxCell as Record<string, unknown>)['t'] === 'string' ? ((xlsxCell as Record<string, unknown>)['t'] as unknown as import('../types').SheetJSType) : undefined),
            ts: new Date().toISOString(),
          };
        } else {
          // Regular value
          cell.raw = localCoerceScalar((xlsxCell as Record<string, unknown>)['v']);

          // If the imported value is a string but looks like a number, coerce it back
          // to a numeric type — but only if the cell's number format isn't explicitly
          // a text format (usually represented by '@'). This preserves values like
          // '00123' when the format is text.
          const numFmt = (xlsxCell as Record<string, unknown>)['z'] as string | undefined;
          if (typeof cell.raw === 'string' && numFmt !== '@') {
            const s = (cell.raw as string).trim();
            if (/^-?\d+(?:\.\d+)?$/.test(s)) {
              const n = Number(s);
              if (!Number.isNaN(n)) cell.raw = n;
            }
          }

          // Determine data type
          if (xlsxCell.t === "n" || typeof cell.raw === 'number') cell.dataType = "number";
          else if (xlsxCell.t === "b" || typeof cell.raw === 'boolean') cell.dataType = "boolean";
          else if (xlsxCell.t === "d" || (typeof cell.raw === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(cell.raw))) cell.dataType = "date";
          else if (xlsxCell.t === "e") cell.dataType = "error";
          else cell.dataType = "string";
        }
        
        // Import number format
        if ((xlsxCell as Record<string, unknown>)['z']) {
          cell.numFmt = (xlsxCell as Record<string, unknown>)['z'] as string;
        }

        // Preserve arrayRange if present (custom field used during export)
        const arrRange = (xlsxCell as Record<string, unknown>)['__arrayRange'] as string | undefined;
        if (arrRange) {
          cell.arrayRange = arrRange;
          cell.arrayFormula = true;
        }
        // Hyperlink mapping
        const link = (xlsxCell as Record<string, unknown>)['l'] as Record<string, unknown> | undefined;
        if (link) {
          cell.hyperlink = {
            url: link['Target'] as string | undefined,
            tooltip: link['Tooltip'] as string | undefined,
          } as any;
        }
        
        sheet.cells![address] = cell;
      }
    }
    
    // Import merges
    if ((ws as Record<string, unknown>)["!merges"]) {
      const utils = (XLSX as unknown as { utils?: SheetJSUtilsLike }).utils;
      const merges = (ws as Record<string, unknown>)["!merges"] as unknown as Array<unknown>;
      sheet.mergedRanges = merges.map((merge) => utils?.encode_range ? utils.encode_range(merge) : String(merge));
    }
    
    // Import column widths
    if ((ws as Record<string, unknown>)["!cols"]) {
      const cols = (ws as Record<string, unknown>)["!cols"] as Array<Record<string, unknown>>;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        if (col) {
          sheet.cols![i + 1] = {
            width: (col['wch'] as number) ? (col['wch'] as number) * 7 : 100, // approximate conversion
            hidden: (col['hidden'] as boolean) || false,
          };
        }
      }
    }
    
    // Import row heights
    if ((ws as Record<string, unknown>)["!rows"]) {
      const rows = (ws as Record<string, unknown>)["!rows"] as Array<Record<string, unknown>>;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row) {
          sheet.rows![i + 1] = {
            height: (row['hpt'] as number) || 21,
            hidden: (row['hidden'] as boolean) || false,
          };
        }
      }
    }
  // Import freeze panes if present (set by exporter on !freeze)
    try {
      const freeze = (ws as Record<string, unknown>)['!freeze'] as Record<string, unknown> | undefined;
      if (freeze) {
        const xSplit = typeof freeze['xSplit'] === 'number' ? (freeze['xSplit'] as number) : undefined;
        const ySplit = typeof freeze['ySplit'] === 'number' ? (freeze['ySplit'] as number) : undefined;
        if (xSplit !== undefined || ySplit !== undefined) {
          sheet.freezePanes = { row: ySplit || 0, col: xSplit || 0 } as any;
        }
        // Also mirror to properties.freeze for backwards compatibility
        sheet.properties = sheet.properties || {};
        if (sheet.freezePanes) (sheet.properties as any).freeze = true;
      }
    } catch {
      // ignore
    }
    
    
    // Import autoFilter
    try {
      const af = (ws as Record<string, unknown>)['!autofilter'] as Record<string, unknown> | undefined;
      if (af && af['ref']) {
        sheet.autoFilter = { range: String(af['ref']) } as any;
      }
    } catch {
      // ignore
    }
    return sheet;
  }



  /**
   * Collect warnings for unsupported features in SheetJS export
   */
  private collectUnsupportedFeatures(workbook: WorkbookJSON, warnings: string[]): void {
    for (const sheet of workbook.sheets) {
      // Check for styles (SheetJS free version doesn't support styles)
      const cellsWithStyles = Object.entries(sheet.cells || {}).filter(([_, cell]) => cell.style);
      if (cellsWithStyles.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${cellsWithStyles.length} cell(s) with styles. ` +
          `SheetJS free version doesn't export cell styles (bold, colors, borders, etc.). ` +
          `Use ExcelJS adapter for full style support.`
        );
      }
      
      // Check for comments
      if (sheet.comments && Object.keys(sheet.comments).length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${Object.keys(sheet.comments).length} comment(s). ` +
          `SheetJS has limited comment support. Use ExcelJS adapter for full comment support.`
        );
      }
      
      // Check for data validations
      if (sheet.dataValidations && sheet.dataValidations.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.dataValidations.length} data validation(s) will not be exported. ` +
          `SheetJS doesn't support data validations.`
        );
      }
      
      // Check for conditional formats
      if (sheet.conditionalFormats && sheet.conditionalFormats.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.conditionalFormats.length} conditional format(s) will not be exported. ` +
          `SheetJS doesn't support conditional formatting.`
        );
      }
      
      // Check for charts
      if (sheet.charts && sheet.charts.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.charts.length} chart(s) will not be exported. ` +
          `SheetJS doesn't support charts.`
        );
      }
      
      // Check for images
      if (sheet.images && sheet.images.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.images.length} image(s) will not be exported. ` +
          `SheetJS doesn't support images.`
        );
      }
      
      // Check for pivot tables
      if (sheet.pivots && sheet.pivots.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.pivots.length} pivot table(s) will not be exported. ` +
          `SheetJS doesn't support pivot tables.`
        );
      }
    }
    
    // Named ranges are exported by this adapter (if present) and therefore no warning is necessary.
  }
}
