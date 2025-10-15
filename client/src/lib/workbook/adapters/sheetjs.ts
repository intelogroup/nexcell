/**
 * SheetJS Export Adapter
 * Basic export/import using SheetJS (xlsx library)
 * Supports: formulas, basic styles, merges, column widths, row heights
 */

import type { ExportAdapter, WorkbookJSON, SheetJSON, Cell } from "../types";
import { createWorkbook, generateId, parseAddress, toAddress } from "../utils";

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
    namedRanges: false, // Not implemented yet
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
    }
    
    // Set workbook view properties (activeTab)
    if (workbook.workbookProperties?.workbookView) {
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Views = wb.Workbook.Views || [{}];
      (wb.Workbook.Views[0] as any).activeTab = workbook.workbookProperties.workbookView.activeTab || 0;
    }
    
    // Store warnings in workbook for persistence
    if (warnings.length > 0) {
      workbook.exportWarnings = workbook.exportWarnings || [];
      workbook.exportWarnings.push(...warnings.map(w => `[SheetJS] ${w}`));
      console.warn(`[SheetJSAdapter] Export warnings:\n${warnings.join('\n')}`);
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
    
    // Create new workbook JSON
    const workbook = createWorkbook(wb.Props?.Title || "Workbook");
    workbook.sheets = []; // clear default sheet
    
    // Import workbook view properties (activeTab)
    if (wb.Workbook?.Views?.[0]) {
      if (workbook.workbookProperties) {
        workbook.workbookProperties.workbookView = workbook.workbookProperties.workbookView || {};
        const view = wb.Workbook.Views[0] as any;
        workbook.workbookProperties.workbookView.activeTab = view.activeTab || 0;
      }
    }
    
    // Import each sheet
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const sheet = this.worksheetToSheet(ws, sheetName, XLSX);
      workbook.sheets.push(sheet);
    }
    
    return workbook;
  }

  private sheetToWorksheet(sheet: SheetJSON, XLSX: any, warnings: string[]): any {
    const ws: any = {};
    
    // Add cells
    for (const [address, cell] of Object.entries(sheet.cells || {}) as [string, Cell][]) {
      const xlsxCell: any = {};
      
      // Handle formulas
      if (cell.formula) {
        xlsxCell.f = cell.formula;
        
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
      
      // Add number format
      if (cell.numFmt) {
        xlsxCell.z = cell.numFmt;
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
      ws["!merges"] = sheet.mergedRanges.map((range: string) => XLSX.utils.decode_range(range));
    }
    
    // Add column widths
    if (sheet.cols && Object.keys(sheet.cols).length > 0) {
      const colsArray: any[] = [];
      const maxCol = Math.max(...Object.keys(sheet.cols).map(Number));
      
      for (let c = 1; c <= maxCol; c++) {
        const colMeta = sheet.cols[c];
        if (colMeta) {
          colsArray.push({
            wch: colMeta.width ? colMeta.width / 7 : 10, // approximate conversion
            hidden: colMeta.hidden || false,
          });
        } else {
          colsArray.push({ wch: 10 });
        }
      }
      
      ws["!cols"] = colsArray;
    }
    
    // Add row heights
    if (sheet.rows && Object.keys(sheet.rows).length > 0) {
      const rowsArray: any[] = [];
      const maxRow = Math.max(...Object.keys(sheet.rows).map(Number));
      
      for (let r = 1; r <= maxRow; r++) {
        const rowMeta = sheet.rows[r];
        if (rowMeta) {
          rowsArray.push({
            hpt: rowMeta.height || 21,
            hidden: rowMeta.hidden || false,
          });
        } else {
          rowsArray.push({ hpt: 21 });
        }
      }
      
      ws["!rows"] = rowsArray;
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

  private worksheetToSheet(ws: any, name: string, XLSX: any): SheetJSON {
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
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const address = toAddress(R + 1, C + 1);
        const xlsxCell = ws[address];
        
        if (!xlsxCell) continue;
        
        const cell: Cell = {};
        
        // Handle formula
        if (xlsxCell.f) {
          cell.formula = xlsxCell.f;
          cell.dataType = "formula";
          cell.computed = {
            v: xlsxCell.v,
            t: xlsxCell.t,
            ts: new Date().toISOString(),
          };
        } else {
          // Regular value
          cell.raw = xlsxCell.v;
          
          // Determine data type
          if (xlsxCell.t === "n") cell.dataType = "number";
          else if (xlsxCell.t === "b") cell.dataType = "boolean";
          else if (xlsxCell.t === "d") cell.dataType = "date";
          else if (xlsxCell.t === "e") cell.dataType = "error";
          else cell.dataType = "string";
        }
        
        // Import number format
        if (xlsxCell.z) {
          cell.numFmt = xlsxCell.z;
        }
        
        sheet.cells![address] = cell;
      }
    }
    
    // Import merges
    if (ws["!merges"]) {
      sheet.mergedRanges = ws["!merges"].map((merge: any) => XLSX.utils.encode_range(merge));
    }
    
    // Import column widths
    if (ws["!cols"]) {
      for (let i = 0; i < ws["!cols"].length; i++) {
        const col = ws["!cols"][i];
        if (col) {
          sheet.cols![i + 1] = {
            width: col.wch ? col.wch * 7 : 100, // approximate conversion
            hidden: col.hidden || false,
          };
        }
      }
    }
    
    // Import row heights
    if (ws["!rows"]) {
      for (let i = 0; i < ws["!rows"].length; i++) {
        const row = ws["!rows"][i];
        if (row) {
          sheet.rows![i + 1] = {
            height: row.hpt || 21,
            hidden: row.hidden || false,
          };
        }
      }
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
    
    // Check for named ranges
    if (workbook.namedRanges && Object.keys(workbook.namedRanges).length > 0) {
      warnings.push(
        `Workbook: ${Object.keys(workbook.namedRanges).length} named range(s) will not be exported. ` +
        `SheetJS named ranges not implemented yet.`
      );
    }
  }
}
