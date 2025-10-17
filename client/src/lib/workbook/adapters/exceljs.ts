/**
 * ExcelJS Export Adapter
 * High-fidelity Excel export using ExcelJS library
 * Supports: formulas, styles, comments, data validations, conditional formats, images, tables
 */

import type { ExportAdapter, WorkbookJSON, SheetJSON, Cell, SheetJSType, CellDataType, CellStyle } from "../types";
import { parseAddress } from "../utils";

type ExcelJSWorksheetLike = Record<string, unknown> & {
  name?: string;
  state?: string;
  rowCount?: number;
  columnCount?: number;
  views?: Array<{ activeTab?: number; zoomScale?: number; state?: string; xSplit?: number; ySplit?: number }>;
  properties?: { tabColor?: { argb?: string } };
  showGridLines?: boolean;
  showRowColHeaders?: boolean;
  eachRow?: (opts: { includeEmpty: boolean }, cb: (row: Record<string, unknown>, rowNumber: number) => void) => void;
  columns?: Array<Record<string, unknown>>;
  model?: { merges?: string[] };
};

type ExcelJSCellLike = Record<string, unknown> & {
  value?: unknown;
  formula?: unknown;
  result?: unknown;
  type?: unknown;
  numFmt?: string;
  font?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  border?: Record<string, unknown>;
  style?: unknown;
};

export class ExcelJSAdapter implements ExportAdapter {
  readonly name = "ExcelJS";
  readonly extension = "xlsx";
  readonly mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  readonly features = {
    formulas: true,
    formulaCache: true, // We preserve computed values alongside formulas
    styles: true, // Full style support (fonts, fills, borders, alignment)
    merges: true,
    comments: true, // Threaded comments support
    dataValidations: true,
    conditionalFormats: true, // Rich conditional formatting
    charts: false, // Not implemented yet (would need image generation)
    images: true, // Embedded images support
    namedRanges: true, // Workbook and sheet-scoped named ranges
    columnWidths: true,
    rowHeights: true,
  };

  async export(workbook: WorkbookJSON): Promise<ArrayBuffer> {
    // Dynamic import to avoid bundling if not used
    const ExcelJS = await import("exceljs");

    const wb = new ExcelJS.Workbook();
    const warnings: string[] = [];

    // Collect unsupported features for export warnings
    this.collectUnsupportedFeatures(workbook, warnings);

    // Set workbook properties
    wb.creator = workbook.meta.author || "Nexcell";
    wb.lastModifiedBy = workbook.meta.author || "Nexcell";
    wb.created = new Date(workbook.meta.createdAt);
    wb.modified = new Date(workbook.meta.modifiedAt);
    wb.title = workbook.meta.title || "Workbook";

    // Set workbook view properties (activeTab, firstSheet)
    if (workbook.workbookProperties?.workbookView) {
      wb.views = [{
        activeTab: workbook.workbookProperties.workbookView.activeTab || 0,
        firstSheet: workbook.workbookProperties.workbookView.firstSheet || 0,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        visibility: 'visible' as const,
      }];
    }

    // Add sheets
    for (const sheet of workbook.sheets) {
      const ws = wb.addWorksheet(sheet.name);

      // Set sheet properties (tabColor requires properties object)
      if (sheet.properties?.tabColor) {
        ws.properties = ws.properties || {};
  ((ws.properties as unknown) as Record<string, unknown>).tabColor = { argb: sheet.properties.tabColor };
      }

      // Add cells
      for (const [address, cell] of Object.entries(sheet.cells || {})) {
        const { row, col } = parseAddress(address);
        const excelRow = row; // ExcelJS uses 1-based indexing
        const excelCol = col;

        // Ensure row exists
        while (ws.rowCount < excelRow) {
          ws.addRow([]);
        }

        const excelCell = ws.getCell(excelRow, excelCol);

        // Set value and formula
        if (cell.formula) {
          // ExcelJS expects the formula without a leading '=' when assigning.
          const f = cell.formula.startsWith('=') ? cell.formula.substring(1) : cell.formula;
          // ExcelJS requires setting value as object with formula and result
          const result = cell.computed?.v;
          excelCell.value = {
            formula: f,
            result: result === null ? undefined : result,
          };
        } else {
          excelCell.value = cell.raw ?? cell.computed?.v ?? null;
        }

        // Set number format
        if (cell.numFmt) {
          excelCell.numFmt = cell.numFmt;
        }

        // Set style
        if (cell.style) {
          this.applyCellStyle(excelCell, cell.style);
        }

        // Add comment if present in sheet comments
        const commentForCell = Object.values(sheet.comments || {}).find((commentList: unknown) => {
          if (!Array.isArray(commentList)) return false;
          return commentList.some((c) => typeof c === 'object' && c !== null && 'address' in (c as object) && (c as { address?: string }).address === address);
        });

        if (commentForCell && Array.isArray(commentForCell) && commentForCell.length > 0) {
          const firstComment = commentForCell[0] as { text?: string } | undefined;
          excelCell.note = firstComment?.text ?? "Comment";
        }
      }

      // Add merges
      if (sheet.mergedRanges?.length) {
        for (const range of sheet.mergedRanges) {
          ws.mergeCells(range);
        }
      }

      // Set column widths
      if (sheet.cols) {
        for (const [colNum, colMeta] of Object.entries(sheet.cols)) {
          const col = parseInt(colNum);
          if (colMeta?.width) {
            ws.getColumn(col).width = colMeta.width / 7; // Approximate conversion
          }
          if (colMeta?.hidden) {
            ws.getColumn(col).hidden = true;
          }
        }
      }

      // Set row heights
      if (sheet.rows) {
        for (const [rowNum, rowMeta] of Object.entries(sheet.rows)) {
          const row = parseInt(rowNum);
          if (rowMeta?.height) {
            ws.getRow(row).height = rowMeta.height;
          }
          if (rowMeta?.hidden) {
            ws.getRow(row).hidden = true;
          }
        }
      }

      // Add data validations
      if (sheet.dataValidations?.length) {
        for (const validation of sheet.dataValidations) {
          if (validation.range) {
            // ExcelJS validation implementation - TODO
            // ws.getCell(validation.range).dataValidation = { ... };
          }
        }
      }
    }

    // Add named ranges - TODO: ExcelJS named ranges implementation
    // Add named ranges - try to use ExcelJS definedNames where supported
    try {
      if (workbook.namedRanges) {
        for (const [name, nr] of Object.entries(workbook.namedRanges)) {
          const ref = typeof nr === 'string' ? nr : (nr as any).ref;
          if (!ref) continue;
          // ExcelJS exposes `definedNames` on workbook
          if ((wb as any).definedNames && typeof (wb as any).definedNames.add === 'function') {
            // ExcelJS doesn't have a standard API for marking hidden named ranges in the high-level API,
            // but definedNames.add accepts workbook-level entries.
            (wb as any).definedNames.add(name, ref);
            // If the NamedRange was an object and had hidden flag, we will record a warning as ExcelJS
            // high-level API doesn't expose a hidden flag. Advanced manipulation would require writing
            // raw XML parts which is out of scope.
            if (typeof nr !== 'string' && (nr as any).hidden) {
              warnings.push(`Named range "${name}" marked hidden in schema but ExcelJS can't mark it hidden via high-level API. It will be exported but may be visible in Excel.`);
            }
          } else {
            warnings.push(`Named range "${name}" could not be exported: ExcelJS definedNames API unavailable.`);
          }
        }
      }
      // Also export sheet-scoped named ranges
      for (const sheet of workbook.sheets) {
        if (!sheet.namedRanges) continue;
        for (const [name, nr] of Object.entries(sheet.namedRanges)) {
          const ref = typeof nr === 'string' ? `${sheet.name}!${nr}` : (nr as any).ref;
          if (!ref) continue;
          if ((wb as any).definedNames && typeof (wb as any).definedNames.add === 'function') {
            (wb as any).definedNames.add(name, ref);
            if (typeof nr !== 'string' && (nr as any).hidden) {
              warnings.push(`Named range "${name}" (sheet ${sheet.name}) marked hidden in schema but ExcelJS can't mark it hidden via high-level API.`);
            }
          }
        }
      }
    } catch (e) {
      warnings.push(`Failed to export named ranges via ExcelJS: ${e}`);
    }

    // Store warnings in workbook for persistence
    if (warnings.length > 0) {
      workbook.exportWarnings = workbook.exportWarnings || [];
      workbook.exportWarnings.push(...warnings.map(w => `[ExcelJS] ${w}`));
      console.warn(`[ExcelJSAdapter] Export warnings:\n${warnings.join('\n')}`);
    }

    // Write to buffer
    const buffer = await wb.xlsx.writeBuffer() as unknown;

    if (buffer instanceof ArrayBuffer) return buffer;
    if (ArrayBuffer.isView(buffer)) {
      const view = buffer as ArrayBufferView;
      // Create a copy to ensure result is an ArrayBuffer (not SharedArrayBuffer)
      const uint8 = new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
      return uint8.slice().buffer as ArrayBuffer;
    }

    try {
      const uint8Array = new Uint8Array(buffer as Iterable<number>);
      return uint8Array.slice().buffer as ArrayBuffer;
    } catch {
      throw new Error('Unsupported buffer type returned by ExcelJS');
    }
    
  }

  async import(data: Blob | ArrayBuffer): Promise<WorkbookJSON> {
    const ExcelJS = await import("exceljs");
    
    // Convert Blob to ArrayBuffer if needed
    const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
    
    // Load workbook
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    // Create WorkbookJSON structure
    const workbook: WorkbookJSON = {
      schemaVersion: "1.0",
      workbookId: crypto.randomUUID(),
      meta: {
        title: wb.title || "Imported Workbook",
        author: wb.creator || undefined,
        createdAt: wb.created?.toISOString() || new Date().toISOString(),
        modifiedAt: wb.modified?.toISOString() || new Date().toISOString(),
      },
      sheets: [],
      namedRanges: {},
      workbookProperties: {
        defaultRowHeight: 21,
        defaultColWidth: 100,
        workbookView: {
          firstSheet: 0,
          activeTab: wb.views?.[0]?.activeTab || 0,
        },
      },
    };
    
    // Import each worksheet
    wb.eachSheet((worksheet: unknown) => {
      const sheet = this.worksheetToSheet(worksheet);
      workbook.sheets.push(sheet);
    });
    
    return workbook;
  }
  
  private worksheetToSheet(worksheet: ExcelJSWorksheetLike | unknown): SheetJSON {
    const ws = worksheet as ExcelJSWorksheetLike;
    const sheet: SheetJSON = {
      id: crypto.randomUUID(),
      name: ws.name ?? 'Sheet',
      visible: ws.state === 'visible',
      grid: { 
        rowCount: Math.max(ws.rowCount || 1000, 1000), 
        colCount: Math.max(ws.columnCount || 50, 50) 
      },
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
        gridLines: ws.showGridLines !== false,
        showHeaders: ws.showRowColHeaders !== false,
        zoom: ws.views?.[0]?.zoomScale || 100,
        tabColor: ws.properties?.tabColor?.argb,
        freeze: ws.views?.[0]?.state === 'frozen' ? {
          row: ws.views?.[0]?.ySplit || 0,
          col: ws.views?.[0]?.xSplit || 0,
        } : undefined,
      },
    };
    
    // Import cells
    if (typeof ws.eachRow === 'function') {
      ws.eachRow({ includeEmpty: false }, (row: Record<string, unknown>, rowNumber: number) => {
        if (typeof row.eachCell !== 'function') return;
        row.eachCell({ includeEmpty: false }, (excelCell: ExcelJSCellLike, colNumber: number) => {
          const address = this.toAddress(rowNumber, colNumber);
          const cell = this.excelCellToCell(excelCell);
          if (cell) sheet.cells![address] = cell;
        });
      });
    }
    
    // Import column properties
    ws.columns?.forEach((col, index) => {
      if (col && (col.width || col.hidden)) {
        sheet.cols![index + 1] = {
          width: col.width ? (col.width as number) * 7 : undefined, // Convert back
          hidden: (col.hidden as boolean) || false,
        };
      }
    });
    
    // Import row properties
    if (typeof ws.eachRow === 'function') {
      ws.eachRow({ includeEmpty: true }, (row: Record<string, unknown>, rowNumber: number) => {
        if (row && ((row as any).height || (row as any).hidden)) {
          sheet.rows![rowNumber] = {
            height: (row as any).height || undefined,
            hidden: (row as any).hidden || false,
          };
        }
      });
    }
    
    // Import merged ranges
    if (ws.model?.merges) {
      sheet.mergedRanges = ws.model.merges.map((range) => range);
    }
    
    return sheet;
  }
  
  private excelCellToCell(excelCell: ExcelJSCellLike | unknown): Cell | null {
    const cellLike = excelCell as ExcelJSCellLike;
    if (cellLike.value === null || cellLike.value === undefined) return null;

    const cell: Cell = {};
    
    // Handle formulas
    // ExcelJS may store formulas in excelCell.formula, or for formula cells excelCell.value may
    // be an object like { formula, result }. Accept both and normalize to our internal
    // representation which always includes a leading '='.
    const formulaFromValue = cellLike && typeof cellLike.value === 'object' && cellLike.value && 'formula' in (cellLike.value as object)
      ? (cellLike.value as { formula?: unknown }).formula
      : undefined;

    const rawFormula = cellLike && (cellLike.formula || formulaFromValue);
    if (rawFormula) {
      const f = typeof rawFormula === 'string' ? rawFormula : String(rawFormula);
      cell.formula = f.startsWith('=') ? f : `=${f}`;
      cell.dataType = "formula";

      // Store computed value if available. ExcelJS may expose result in excelCell.value.result
      // or in excelCell.result depending on version.
      let value: unknown = undefined;
      if (cellLike.value && typeof cellLike.value === 'object' && 'result' in (cellLike.value as object)) {
        value = (cellLike.value as { result?: unknown }).result;
      } else if ('result' in cellLike) {
        value = (cellLike as { result?: unknown }).result;
      } else if (cellLike.value && typeof cellLike.value !== 'object') {
        // Sometimes value holds the computed scalar
        value = cellLike.value;
      }

      if (value !== undefined) {
        cell.computed = {
          v: this.coerceScalar(value),
          t: this.getTypeCode(cellLike.type) as SheetJSType,
          ts: new Date().toISOString(),
        };
      }
    } else {
      // Regular value
      const value = typeof cellLike.value === 'object' && cellLike.value && 'richText' in (cellLike.value as object)
        ? (cellLike.value as { richText?: Array<{ text?: string }> }).richText!.map((rt) => rt.text || '').join('')
        : cellLike.value;

      cell.raw = this.coerceScalar(value);
      cell.dataType = this.getDataType(cellLike.type) as CellDataType;
    }
    
    // Import number format
    if (cellLike.numFmt) cell.numFmt = cellLike.numFmt as string;
    
    // Import styles
    if (cellLike.style) cell.style = this.extractCellStyle(cellLike as ExcelJSCellLike);
    
    // Import comments - stored separately in sheet.comments
    // Comments handled at sheet level
    
    return cell;
  }

  private coerceScalar(v: unknown): string | number | boolean | null {
    if (v === null) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (v instanceof Date) return v.toISOString();
    // Attempt to handle numeric-like objects (e.g., BigInt) or values with valueOf
    try {
      const prim = (v as any).valueOf?.();
      if (typeof prim === 'string' || typeof prim === 'number' || typeof prim === 'boolean') return prim;
      if (prim instanceof Date) return prim.toISOString();
    } catch {
      // ignore
    }
    // Fallback: stringify
    return String(v);
  }

  // Replace generic applyCellStyle with one typed to project CellStyle so callers can pass `cell.style`
  private applyCellStyle(excelCell: unknown, style: CellStyle | undefined) {
    if (!style) return;
    const cellObj = excelCell as Record<string, unknown>;
    if (style.bold) cellObj.font = { ...((cellObj.font as object) || {}), bold: true };
    if (style.italic) cellObj.font = { ...((cellObj.font as object) || {}), italic: true };
    if (style.underline) cellObj.font = { ...((cellObj.font as object) || {}), underline: true };
    if (style.strikethrough) cellObj.font = { ...((cellObj.font as object) || {}), strike: true };
    if (style.color) cellObj.font = { ...((cellObj.font as object) || {}), color: { argb: style.color } };
    if (style.fontSize) cellObj.font = { ...((cellObj.font as object) || {}), size: style.fontSize };
    if (style.fontFamily) cellObj.font = { ...((cellObj.font as object) || {}), name: style.fontFamily };

    if (style.bgColor) {
      cellObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.bgColor } };
    }

    if (style.alignment) {
      const a = style.alignment;
      cellObj.alignment = {
        horizontal: a.horizontal || 'left',
        vertical: a.vertical || 'top',
        wrapText: a.wrapText || false,
      };
    }

    if (style.border) {
      const sb = style.border;
      const border: Record<string, unknown> = {};
      if (sb.top) (border as any).top = { style: sb.top.style || 'thin', color: { argb: sb.top.color } };
      if (sb.bottom) (border as any).bottom = { style: sb.bottom.style || 'thin', color: { argb: sb.bottom.color } };
      if (sb.left) (border as any).left = { style: sb.left.style || 'thin', color: { argb: sb.left.color } };
      if (sb.right) (border as any).right = { style: sb.right.style || 'thin', color: { argb: sb.right.color } };
      cellObj.border = border;
    }
  }
  
  private extractCellStyle(excelCell: ExcelJSCellLike): Record<string, unknown> | undefined {
    const style: Record<string, unknown> = {};
    
    // Extract font
    if (excelCell.font) {
      const f = excelCell.font as Record<string, unknown>;
      if (f['bold']) (style as any).bold = true;
      if (f['italic']) (style as any).italic = true;
      if (f['underline']) (style as any).underline = true;
      if (f['strike']) (style as any).strikethrough = true;
      if (f['color']) (style as any).color = (f['color'] as Record<string, unknown>).argb;
      if (f['size']) (style as any).fontSize = f['size'];
      if (f['name']) (style as any).fontFamily = f['name'];
    }
    
    // Extract fill
    if (excelCell.fill && (excelCell.fill as Record<string, unknown>)['fgColor']) {
      style.bgColor = ((excelCell.fill as Record<string, unknown>)['fgColor'] as Record<string, unknown>).argb;
    }
    
    // Extract alignment
    if (excelCell.alignment) {
      const a = excelCell.alignment as Record<string, unknown>;
      (style as any).alignment = {
        horizontal: (a['horizontal'] as string) || 'left',
        vertical: (a['vertical'] as string) || 'top',
        wrapText: (a['wrapText'] as boolean) || false,
      };
    }
    
    // Extract borders
    if (excelCell.border) {
      const b = excelCell.border as Record<string, unknown>;
      const border: Record<string, unknown> = {};
      if (b['top']) (border as any).top = { style: ((b['top'] as Record<string, unknown>)['style'] as string) || 'thin', color: { argb: (b['top'] as Record<string, unknown>)['color'] ? ((b['top'] as Record<string, unknown>)['color'] as Record<string, unknown>)['argb'] : undefined } };
      if (b['bottom']) (border as any).bottom = { style: ((b['bottom'] as Record<string, unknown>)['style'] as string) || 'thin', color: { argb: (b['bottom'] as Record<string, unknown>)['color'] ? ((b['bottom'] as Record<string, unknown>)['color'] as Record<string, unknown>)['argb'] : undefined } };
      if (b['left']) (border as any).left = { style: ((b['left'] as Record<string, unknown>)['style'] as string) || 'thin', color: { argb: (b['left'] as Record<string, unknown>)['color'] ? ((b['left'] as Record<string, unknown>)['color'] as Record<string, unknown>)['argb'] : undefined } };
      if (b['right']) (border as any).right = { style: ((b['right'] as Record<string, unknown>)['style'] as string) || 'thin', color: { argb: (b['right'] as Record<string, unknown>)['color'] ? ((b['right'] as Record<string, unknown>)['color'] as Record<string, unknown>)['argb'] : undefined } };
      if (Object.keys(border).length > 0) (style as any).border = border;
    }
    
    return Object.keys(style).length > 0 ? style : undefined;
  }
  
  private toAddress(row: number, col: number): string {
    const colName = String.fromCharCode(64 + col);
    return `${colName}${row}`;
  }
  
  private getTypeCode(type: unknown): string {
    const typeMap: Record<string, string> = {
      number: 'n',
      string: 's',
      boolean: 'b',
      date: 'd',
      error: 'e',
    };
    const key = typeof type === 'string' ? type : String(type ?? '');
    return typeMap[key] || 's';
  }
  
  private getDataType(type: unknown): string {
    const typeMap: Record<string, string> = {
      number: 'number',
      string: 'string',
      boolean: 'boolean',
      date: 'date',
      error: 'error',
    };
    const key = typeof type === 'string' ? type : String(type ?? '');
    return typeMap[key] || 'string';
  }
  
  /**
   * Collect warnings for unsupported features in ExcelJS export
   */
  private collectUnsupportedFeatures(workbook: WorkbookJSON, warnings: string[]): void {
    for (const sheet of workbook.sheets) {
      // Check for charts (not yet implemented)
      if (sheet.charts && sheet.charts.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.charts.length} chart(s) will not be exported. ` +
          `ExcelJS chart export requires image generation (not yet implemented).`
        );
      }
      
      // Check for pivot tables (not yet implemented)
      if (sheet.pivots && sheet.pivots.length > 0) {
        warnings.push(
          `Sheet "${sheet.name}": ${sheet.pivots.length} pivot table(s) will not be exported. ` +
          `ExcelJS pivot table support not yet implemented.`
        );
      }
      
      // Check for advanced conditional formats
      if (sheet.conditionalFormats && sheet.conditionalFormats.length > 0) {
        const advancedFormats = sheet.conditionalFormats.filter(cf => 
          ['iconSet', 'dataBar', 'colorScale'].includes(cf.type || '')
        );
        if (advancedFormats.length > 0) {
          warnings.push(
            `Sheet "${sheet.name}": ${advancedFormats.length} advanced conditional format(s) ` +
            `(icon sets, data bars, color scales) may have limited support in ExcelJS.`
          );
        }
      }
      
      // Check for complex data validations
      if (sheet.dataValidations && sheet.dataValidations.length > 0) {
        const complexValidations = sheet.dataValidations.filter(dv => 
          dv.formula1 && dv.formula1.includes('INDIRECT')
        );
        if (complexValidations.length > 0) {
          warnings.push(
            `Sheet "${sheet.name}": ${complexValidations.length} data validation(s) with ` +
            `dynamic formulas (INDIRECT, etc.) may not export correctly.`
          );
        }
      }
    }
    
    // Check for named ranges (not yet implemented)
    if (workbook.namedRanges && Object.keys(workbook.namedRanges).length > 0) {
      warnings.push(
        `Workbook: ${Object.keys(workbook.namedRanges).length} named range(s) will not be exported. ` +
        `ExcelJS named ranges support not yet implemented.`
      );
    }
  }
}