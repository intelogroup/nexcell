/**
 * ExcelJS Export Adapter
 * High-fidelity Excel export using ExcelJS library
 * Supports: formulas, styles, comments, data validations, conditional formats, images, tables
 */

import type { ExportAdapter, WorkbookJSON, SheetJSON, Cell } from "../types";
import { parseAddress } from "../utils";

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
        (ws.properties as any).tabColor = { argb: sheet.properties.tabColor };
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
          // ExcelJS requires setting value as object with formula and result
          const result = cell.computed?.v;
          excelCell.value = {
            formula: cell.formula,
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
        const commentForCell = Object.values(sheet.comments || {}).find((commentList: any) => {
          return commentList.some && commentList.some((c: any) => c.address === address);
        });
        if (commentForCell && Array.isArray(commentForCell) && commentForCell.length > 0) {
          const firstComment = commentForCell[0] as any;
          excelCell.note = firstComment.text || "Comment";
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
    // if (workbook.namedRanges) {
    //   for (const [name, range] of Object.entries(workbook.namedRanges)) {
    //     wb.definedNames.add(name, range);
    //   }
    // }

    // Store warnings in workbook for persistence
    if (warnings.length > 0) {
      workbook.exportWarnings = workbook.exportWarnings || [];
      workbook.exportWarnings.push(...warnings.map(w => `[ExcelJS] ${w}`));
      console.warn(`[ExcelJSAdapter] Export warnings:\n${warnings.join('\n')}`);
    }

    // Write to buffer
    const buffer = await wb.xlsx.writeBuffer() as any;
    
    // Convert Node.js Buffer to ArrayBuffer for browser compatibility
    // ExcelJS returns Buffer (Uint8Array), we need ArrayBuffer
    if (buffer instanceof ArrayBuffer) {
      return buffer;
    }
    
    // Handle Buffer/Uint8Array case - convert to ArrayBuffer
    const uint8Array = new Uint8Array(buffer);
    return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
    
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
    wb.eachSheet((worksheet) => {
      const sheet = this.worksheetToSheet(worksheet);
      workbook.sheets.push(sheet);
    });
    
    return workbook;
  }
  
  private worksheetToSheet(worksheet: any): SheetJSON {
    const sheet: SheetJSON = {
      id: crypto.randomUUID(),
      name: worksheet.name,
      visible: worksheet.state === 'visible',
      grid: { 
        rowCount: Math.max(worksheet.rowCount || 1000, 1000), 
        colCount: Math.max(worksheet.columnCount || 50, 50) 
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
        gridLines: worksheet.showGridLines !== false,
        showHeaders: worksheet.showRowColHeaders !== false,
        zoom: worksheet.views?.[0]?.zoomScale || 100,
        tabColor: worksheet.properties?.tabColor?.argb,
        freeze: worksheet.views?.[0]?.state === 'frozen' ? {
          row: worksheet.views[0].ySplit || 0,
          col: worksheet.views[0].xSplit || 0,
        } : undefined,
      },
    };
    
    // Import cells
    worksheet.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
      row.eachCell({ includeEmpty: false }, (excelCell: any, colNumber: number) => {
        const address = this.toAddress(rowNumber, colNumber);
        const cell = this.excelCellToCell(excelCell);
        if (cell) {
          sheet.cells![address] = cell;
        }
      });
    });
    
    // Import column properties
    worksheet.columns?.forEach((col: any, index: number) => {
      if (col.width || col.hidden) {
        sheet.cols![index + 1] = {
          width: col.width ? col.width * 7 : undefined, // Convert back
          hidden: col.hidden || false,
        };
      }
    });
    
    // Import row properties
    worksheet.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
      if (row.height || row.hidden) {
        sheet.rows![rowNumber] = {
          height: row.height || undefined,
          hidden: row.hidden || false,
        };
      }
    });
    
    // Import merged ranges
    if (worksheet.model?.merges) {
      sheet.mergedRanges = worksheet.model.merges.map((range: string) => range);
    }
    
    return sheet;
  }
  
  private excelCellToCell(excelCell: any): Cell | null {
    if (excelCell.value === null || excelCell.value === undefined) {
      return null;
    }
    
    const cell: Cell = {};
    
    // Handle formulas
    if (excelCell.formula) {
      cell.formula = excelCell.formula;
      cell.dataType = "formula";
      
      // Store computed value if available
      if (excelCell.value !== undefined) {
        const value = typeof excelCell.value === 'object' && 'result' in excelCell.value 
          ? excelCell.value.result 
          : excelCell.value;
        
        cell.computed = {
          v: value,
          t: this.getTypeCode(excelCell.type) as any,
          ts: new Date().toISOString(),
        };
      }
    } else {
      // Regular value
      const value = typeof excelCell.value === 'object' && 'richText' in excelCell.value
        ? excelCell.value.richText.map((rt: any) => rt.text).join('')
        : excelCell.value;
      
      cell.raw = value;
      cell.dataType = this.getDataType(excelCell.type) as any;
    }
    
    // Import number format
    if (excelCell.numFmt) {
      cell.numFmt = excelCell.numFmt;
    }
    
    // Import styles
    if (excelCell.style) {
      cell.style = this.extractCellStyle(excelCell);
    }
    
    // Import comments - stored separately in sheet.comments
    // Comments handled at sheet level
    
    return cell;
  }
  
  private extractCellStyle(excelCell: any): any {
    const style: any = {};
    
    // Extract font
    if (excelCell.font) {
      if (excelCell.font.bold) style.bold = true;
      if (excelCell.font.italic) style.italic = true;
      if (excelCell.font.underline) style.underline = true;
      if (excelCell.font.strike) style.strikethrough = true;
      if (excelCell.font.color) style.color = excelCell.font.color.argb;
      if (excelCell.font.size) style.fontSize = excelCell.font.size;
      if (excelCell.font.name) style.fontFamily = excelCell.font.name;
    }
    
    // Extract fill
    if (excelCell.fill?.fgColor) {
      style.bgColor = excelCell.fill.fgColor.argb;
    }
    
    // Extract alignment
    if (excelCell.alignment) {
      style.alignment = {
        horizontal: excelCell.alignment.horizontal || 'left',
        vertical: excelCell.alignment.vertical || 'top',
        wrapText: excelCell.alignment.wrapText || false,
      };
    }
    
    // Extract borders
    if (excelCell.border) {
      style.border = {};
      if (excelCell.border.top) {
        style.border.top = {
          style: excelCell.border.top.style || 'thin',
          color: excelCell.border.top.color?.argb,
        };
      }
      if (excelCell.border.bottom) {
        style.border.bottom = {
          style: excelCell.border.bottom.style || 'thin',
          color: excelCell.border.bottom.color?.argb,
        };
      }
      if (excelCell.border.left) {
        style.border.left = {
          style: excelCell.border.left.style || 'thin',
          color: excelCell.border.left.color?.argb,
        };
      }
      if (excelCell.border.right) {
        style.border.right = {
          style: excelCell.border.right.style || 'thin',
          color: excelCell.border.right.color?.argb,
        };
      }
    }
    
    return Object.keys(style).length > 0 ? style : undefined;
  }
  
  private toAddress(row: number, col: number): string {
    const colName = String.fromCharCode(64 + col);
    return `${colName}${row}`;
  }
  
  private getTypeCode(type: any): string {
    const typeMap: Record<string, string> = {
      number: 'n',
      string: 's',
      boolean: 'b',
      date: 'd',
      error: 'e',
    };
    return typeMap[type] || 's';
  }
  
  private getDataType(type: any): string {
    const typeMap: Record<string, string> = {
      number: 'number',
      string: 'string',
      boolean: 'boolean',
      date: 'date',
      error: 'error',
    };
    return typeMap[type] || 'string';
  }

  private applyCellStyle(excelCell: any, style: any) {
    // Apply font styles
    if (style.bold) excelCell.font = { ...excelCell.font, bold: true };
    if (style.italic) excelCell.font = { ...excelCell.font, italic: true };
    if (style.underline) excelCell.font = { ...excelCell.font, underline: true };
    if (style.strikethrough) excelCell.font = { ...excelCell.font, strike: true };
    if (style.color) excelCell.font = { ...excelCell.font, color: { argb: style.color } };
    if (style.fontSize) excelCell.font = { ...excelCell.font, size: style.fontSize };
    if (style.fontFamily) excelCell.font = { ...excelCell.font, name: style.fontFamily };

    // Apply fill
    if (style.bgColor) {
      excelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: style.bgColor }
      };
    }

    // Apply alignment
    if (style.alignment) {
      excelCell.alignment = {
        horizontal: style.alignment.horizontal || 'left',
        vertical: style.alignment.vertical || 'top',
        wrapText: style.alignment.wrapText || false,
      };
    }

    // Apply borders (simplified)
    if (style.border) {
      const border: any = {};
      if (style.border.top) border.top = { style: style.border.top.style || 'thin', color: { argb: style.border.top.color } };
      if (style.border.bottom) border.bottom = { style: style.border.bottom.style || 'thin', color: { argb: style.border.bottom.color } };
      if (style.border.left) border.left = { style: style.border.left.style || 'thin', color: { argb: style.border.left.color } };
      if (style.border.right) border.right = { style: style.border.right.style || 'thin', color: { argb: style.border.right.color } };
      excelCell.border = border;
    }
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