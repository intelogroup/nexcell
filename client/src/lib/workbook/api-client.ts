/**
 * API Client for lazy loading workbook data from backend
 */

import type { CellData } from '@/lib/types';

const API_BASE = 'http://localhost:5000';

export interface CellRange {
  sheetId: string;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export interface CellResponse {
  cells: Array<{
    row: number;
    col: number;
    value: string | number | boolean | null;
    formula?: string;
  }>;
}

/**
 * Fetch cell data for a specific range from the backend
 */
export async function fetchCellRange(range: CellRange): Promise<CellData[][]> {
  const params = new URLSearchParams({
    sheetId: range.sheetId,
    rowStart: range.rowStart.toString(),
    rowEnd: range.rowEnd.toString(),
    colStart: range.colStart.toString(),
    colEnd: range.colEnd.toString(),
  });

  const response = await fetch(`${API_BASE}/cells?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch cells: ${response.statusText}`);
  }

  const data: CellResponse = await response.json();
  
  // Convert backend response to CellData[][] format
  const rows = range.rowEnd - range.rowStart + 1;
  const cols = range.colEnd - range.colStart + 1;
  
  // Initialize empty grid
  const grid: CellData[][] = Array(rows).fill(null).map(() => 
    Array(cols).fill(null).map(() => ({
      value: '',
      formatting: {},
    }))
  );
  
  // Fill in the fetched cells
  data.cells.forEach(cell => {
    const localRow = cell.row - range.rowStart;
    const localCol = cell.col - range.colStart;
    
    if (localRow >= 0 && localRow < rows && localCol >= 0 && localCol < cols) {
      grid[localRow][localCol] = {
        value: cell.value ?? '',
        formula: cell.formula,
        formatting: {},
      };
    }
  });
  
  return grid;
}

/**
 * Seed demo data (for testing)
 */
export async function seedDemoData(): Promise<{ workbookId: string; sheetId: string }> {
  const response = await fetch(`${API_BASE}/seed-demo`, { method: 'POST' });
  
  if (!response.ok) {
    throw new Error(`Failed to seed demo data: ${response.statusText}`);
  }
  
  return await response.json();
}



/**
 * Simple in-memory cache for fetched ranges
 */
class CellRangeCache {
  private cache = new Map<string, { data: CellData[][], timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): CellData[][] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(key: string, data: CellData[][]): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateRange(range: CellRange): void {
    // Remove overlapping ranges from cache
    const keysToRemove: string[] = [];
    
    for (const [key] of this.cache.entries()) {
      const cachedRange = JSON.parse(key) as CellRange;
      if (this.rangesOverlap(cachedRange, range)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => this.cache.delete(key));
  }

  private rangesOverlap(a: CellRange, b: CellRange): boolean {
    return a.sheetId === b.sheetId &&
           !(a.rowEnd < b.rowStart || b.rowEnd < a.rowStart) &&
           !(a.colEnd < b.colStart || b.colEnd < a.colStart);
  }
}

export const cellRangeCache = new CellRangeCache();