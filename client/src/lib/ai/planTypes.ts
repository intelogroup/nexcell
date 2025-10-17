export interface Operation {
  type: string;
  sheetId?: string;
  address?: string;
  raw?: string | number | boolean | null;
  formula?: string;
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
  [k: string]: any;
}

export interface AIPlan {
  planId: string;
  operations: Operation[];
  reasoning?: string;
  warnings?: string[];
}

export interface PlanChange {
  opType: string;
  address?: string;
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
  raw?: string | number | boolean | null;
  formula?: string;
}
