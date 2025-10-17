import { v4 as uuidv4 } from 'uuid';
import type { WorkbookJSON, SheetJSON, Action } from './types';

/**
 * Basic runtime check to ensure no DOM objects or functions are placed in the model.
 * Throws if a non-JSON-serializable value (function, DOM Node) is detected.
 */
export function assertSerializable(obj: unknown, path = ''): void {
  const t = typeof obj;
  // Allow primitives, null, undefined and Dates (serialize via toISOString)
  if (obj === null || obj === undefined || t === 'string' || t === 'number' || t === 'boolean') return;
  if (obj instanceof Date) return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) assertSerializable(obj[i], `${path}[${i}]`);
    return;
  }
  if (t === 'object') {
    // DOM nodes often have nodeType or nodeName
    if (
      obj !== null &&
      typeof obj === 'object' &&
      ('nodeType' in obj || 'nodeName' in obj)
    ) {
      throw new Error(`Non-serializable DOM object at ${path}`);
    }
    for (const [k, v] of Object.entries(obj)) assertSerializable(v, path ? `${path}.${k}` : k);
    return;
  }
  // functions, symbols, undefined
  throw new Error(`Non-serializable value at ${path}: ${String(obj)}`);
}

export function makeSheet(name?: string, opts?: Partial<SheetJSON>): SheetJSON {
  const id = uuidv4();
  const sheetName = name ?? `Sheet${Date.now()}`;
  const sheet: SheetJSON = {
    id,
    name: sheetName,
    visible: true,
    grid: { rowCount: opts?.grid?.rowCount ?? 1000, colCount: opts?.grid?.colCount ?? 50 },
    rows: {},
    cols: {},
    cells: {},
    mergedRanges: [],
    namedRanges: {},
    comments: {},
    filters: {},
    sorts: [],
    dataValidations: [],
    conditionalFormats: [],
    charts: [],
    pivots: [],
    images: [],
    properties: {
      tabColor: undefined,
      freeze: undefined,
      zoom: 100,
      showGridLines: true,
      showHeaders: true,
    },
    ...opts,
  } as SheetJSON;

  // runtime sanity check
  assertSerializable(sheet);

  return sheet;
}

export function addSheet(workbook: WorkbookJSON, name?: string): SheetJSON {
  if (!workbook.sheets) workbook.sheets = [];
  const existingNames = new Set(workbook.sheets.map((s) => s.name));

  // If caller provided a name and it's unique, use it directly.
  // Otherwise, generate a unique name by appending a numeric suffix.
  let sheetName: string;
  if (name && !existingNames.has(name)) {
    sheetName = name;
  } else {
    const base = name ?? 'Sheet';
    let i = 1;
    let candidate = `${base}${i}`;
    while (existingNames.has(candidate)) {
      i++;
      candidate = `${base}${i}`;
    }
    sheetName = candidate;
  }

  const sheet = makeSheet(sheetName);
  workbook.sheets.push(sheet);
  if (!workbook.meta) {
    workbook.meta = {
      title: 'Untitled',
      author: '',
      company: '',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
  }
  workbook.meta.modifiedAt = new Date().toISOString();

  // Ensure workbookProperties exist and set activeTab to the newly added sheet index
  if (!workbook.workbookProperties) workbook.workbookProperties = {};
  if (!workbook.workbookProperties.workbookView) workbook.workbookProperties.workbookView = {};
  workbook.workbookProperties.workbookView.activeTab = workbook.sheets.length - 1;

  // Record action for undo/redo (simple add-sheet action)
  try {
    if (!workbook.actionLog) workbook.actionLog = [];
    const action: Action = {
      id: uuidv4(),
      type: 'addSheet',
      timestamp: new Date().toISOString(),
      sheetId: sheet.id,
      payload: { sheet },
      inverse: {
        id: uuidv4(),
        type: 'deleteSheet',
        timestamp: new Date().toISOString(),
        sheetId: sheet.id,
        payload: { sheetId: sheet.id },
      },
    };
    workbook.actionLog.push(action);
  } catch {
    // non-critical if logging fails
  }

  return sheet;
}
