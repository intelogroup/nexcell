import { describe, it, expect } from 'vitest';
import { createWorkbook } from '../utils';
import { applyOperations } from '../operations';
import { workbookToCellArray } from '../converters';
import { parseAICommand } from '../../ai/aiService';
import { extractActionsFromReply } from '../../ai/actionExtractor';
import { hydrateHFFromWorkbook, recomputeAndPatchCache } from '../hyperformula';

/**
 * Comprehensive integration tests for AI -> convert -> applyOperations -> recompute -> UI mapping
 * Covers the full pipeline from AI-generated actions to UI display of computed values
 */

describe('AI Formula Integration Pipeline', () => {
  describe('Single Cell Formulas', () => {
    it('should handle basic arithmetic formulas', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // AI command: "set A1 to 10 and B1 to =A1*2"
      const actions = [
        { type: 'setCellValue', sheetId: sheet.id, address: 'A1', value: 10 },
        { type: 'setCellFormula', sheetId: sheet.id, address: 'B1', formula: '=A1*2' }
      ];

      // Convert AI actions to operations
      const operations = actions.map(action => {
        if (action.type === 'setCellValue') {
          return {
            type: 'editCell',
            sheetId: action.sheetId,
            address: action.address,
            cell: { raw: action.value }
          };
        } else if (action.type === 'setCellFormula') {
          return {
            type: 'editCell',
            sheetId: action.sheetId,
            address: action.address,
            cell: { formula: action.formula }
          };
        }
        return null;
      }).filter(Boolean);

      // Apply operations
      const result = applyOperations(wb, operations as any, { hydration: undefined });
      expect(result.success).toBe(true);

      // Manually hydrate and recompute
      const hydration = hydrateHFFromWorkbook(wb);
      const recompute = recomputeAndPatchCache(wb, hydration);
      expect(recompute.errors.length).toBe(0);

      // Check computed values
      const b1 = sheet.cells?.['B1'];
      expect(b1?.computed?.v).toBe(20);

      // Check UI mapping
      const cells = workbookToCellArray(wb, sheet.id, 5, 5);
      expect(cells[0][1].value).toBe(20); // B1 (0-based indices)
      expect(cells[0][1].formula).toBe('=A1*2');
    });

    it('should handle string concatenation', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'A1',
          cell: { raw: 'Hello' }
        },
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'B1',
          cell: { raw: 'World' }
        },
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'C1',
          cell: { formula: '=A1&" "&B1' }
        }
      ];

  applyOperations(wb, operations as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const c1 = sheet.cells?.['C1'];
  expect(c1?.computed?.v).toBe('Hello World');

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cells[0][2].value).toBe('Hello World');
    });
  });

  describe('Ranged Formulas', () => {
    it('should handle SUM range formulas', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // Set up data range A1:A5 with values 1,2,3,4,5
      const setupOps = [];
      for (let i = 1; i <= 5; i++) {
        setupOps.push({
          type: 'editCell',
          sheetId: sheet.id,
          address: `A${i}`,
          cell: { raw: i }
        });
      }

      // Add SUM formula
      setupOps.push({
        type: 'editCell',
        sheetId: sheet.id,
        address: 'B1',
        cell: { formula: '=SUM(A1:A5)' }
      });

  applyOperations(wb, setupOps as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const b1 = sheet.cells?.['B1'];
  expect(b1?.computed?.v).toBe(15); // 1+2+3+4+5

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cells[0][1].value).toBe(15);
    });

    it('should handle AVERAGE with range', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { raw: 10 } },
        { type: 'editCell', sheetId: sheet.id, address: 'A2', cell: { raw: 20 } },
        { type: 'editCell', sheetId: sheet.id, address: 'A3', cell: { raw: 30 } },
        { type: 'editCell', sheetId: sheet.id, address: 'B1', cell: { formula: '=AVERAGE(A1:A3)' } }
      ];

  applyOperations(wb, operations, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const b1 = sheet.cells?.['B1'];
  expect(b1?.computed?.v).toBe(20); // (10+20+30)/3

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cells[0][1].value).toBe(20);
    });
  });

  describe('Cross-Sheet References', () => {
    it('should handle references between sheets', () => {
      const wb = createWorkbook('Test');
      wb.sheets.push({
        id: 'sheet2',
        name: 'Sheet2',
        visible: true,
        grid: { rowCount: 1000, colCount: 50 },
        cells: {},
      });

      const sheet1 = wb.sheets[0];
      const sheet2 = wb.sheets[1];

      const operations = [
        { type: 'editCell', sheetId: sheet1.id, address: 'A1', cell: { raw: 42 } },
        { type: 'editCell', sheetId: sheet2.id, address: 'A1', cell: { formula: '=Sheet1!A1*2' } }
      ];

  applyOperations(wb, operations, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const sheet2A1 = sheet2.cells?.['A1'];
  expect(sheet2A1?.computed?.v).toBe(84); // 42*2

  const cells = workbookToCellArray(wb, sheet2.id, 5, 5);
  expect(cells[0][0].value).toBe(84);
    });
  });

  describe('Named Ranges', () => {
    it('should handle workbook-scoped named ranges', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // First create the named range
      wb.namedRanges = {
        'MyData': 'A1:A3'
      };

      const operations = [
        { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { raw: 10 } },
        { type: 'editCell', sheetId: sheet.id, address: 'A2', cell: { raw: 20 } },
        { type: 'editCell', sheetId: sheet.id, address: 'A3', cell: { raw: 30 } },
        { type: 'editCell', sheetId: sheet.id, address: 'B1', cell: { formula: '=SUM(MyData)' } }
      ];

  applyOperations(wb, operations, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const b1 = sheet.cells?.['B1'];
  expect(b1?.computed?.v).toBe(60); // 10+20+30

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cells[0][1].value).toBe(60);
    });
  });

  describe('Volatile Functions', () => {
    it('should handle NOW() volatile function', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'A1',
          cell: { formula: '=NOW()' }
        }
      ];

        applyOperations(wb, operations, { hydration: undefined });
        const hydration = hydrateHFFromWorkbook(wb);
        const recompute = recomputeAndPatchCache(wb, hydration);
        expect(recompute.errors.length).toBe(0);

        const a1 = sheet.cells?.['A1'];
        expect(a1?.computed?.v).toBeDefined();
        // Accept ISO string or Date
        const v = a1?.computed?.v;
        expect(typeof v === 'string' || v instanceof Date).toBe(true);

        const cells = workbookToCellArray(wb, sheet.id, 5, 5);
        expect(cells[0][0].value).toBeDefined();
        // Accept ISO string or Date
        expect(typeof cells[0][0].value === 'string' || cells[0][0].value instanceof Date).toBe(true);
    });

    it('should handle RAND() volatile function', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'A1',
          cell: { formula: '=RAND()' }
        }
      ];

        applyOperations(wb, operations, { hydration: undefined });
        const hydration = hydrateHFFromWorkbook(wb);
        const recompute = recomputeAndPatchCache(wb, hydration);
        expect(recompute.errors.length).toBe(0);

        const a1 = sheet.cells?.['A1'];
        expect(a1?.computed?.v).toBeDefined();
        expect(typeof a1?.computed?.v === 'number' || typeof a1?.computed?.v === 'string').toBe(true);
        if (typeof a1?.computed?.v === 'number') {
          expect(a1?.computed?.v).toBeGreaterThanOrEqual(0);
          expect(a1?.computed?.v).toBeLessThan(1);
        }

        const cells = workbookToCellArray(wb, sheet.id, 5, 5);
        expect(typeof cells[0][0].value === 'number' || typeof cells[0][0].value === 'string').toBe(true);
        if (typeof cells[0][0].value === 'number') {
          expect(cells[0][0].value).toBeGreaterThanOrEqual(0);
          expect(cells[0][0].value).toBeLessThan(1);
        }
    });
  });

  describe('Circular References', () => {
    it('should detect and handle circular references gracefully', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'A1',
          cell: { formula: '=A2+1' }
        },
        {
          type: 'editCell',
          sheetId: sheet.id,
          address: 'A2',
          cell: { formula: '=A1+1' }
        }
      ];

  applyOperations(wb, operations as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBeGreaterThan(0);

  // Circular references should result in error values
  const a1 = sheet.cells?.['A1'];
  const a2 = sheet.cells?.['A2'];

  // One or both should have error values
  const hasError = (a1?.computed?.v?.toString().startsWith('#') ||
           a2?.computed?.v?.toString().startsWith('#'));
  expect(hasError).toBe(true);

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  // UI should still display the error values
  expect(cells[0][0].value).toBeDefined();
  expect(cells[1][0].value).toBeDefined();
    });
  });

  describe('AI Action Extraction Integration', () => {
    it('should extract and apply actions from AI reply', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // Simulate AI reply with JSON actions
      const aiReply = `I'll set up a simple calculation for you.

\`\`\`json
{
  "actions": [
    {
      "type": "setCellValue",
      "sheetId": "${sheet.id}",
      "address": "A1",
      "value": 100
    },
    {
      "type": "setCellFormula",
      "sheetId": "${sheet.id}",
      "address": "B1",
      "formula": "=A1*1.1"
    }
  ]
}
\`\`\`

This will calculate 10% more than the value in A1.`;

      // Extract actions from AI reply
      const extractedActions = extractActionsFromReply(aiReply);
      expect(extractedActions).not.toBeNull();
      expect(extractedActions!.length).toBe(2);

      // Convert to operations
      const operations = extractedActions!.map(action => {
        if (action.type === 'setCellValue') {
          return {
            type: 'editCell',
            sheetId: action.sheetId,
            address: action.address,
            cell: { raw: action.value }
          };
        } else if (action.type === 'setCellFormula') {
          return {
            type: 'editCell',
            sheetId: action.sheetId,
            address: action.address,
            cell: { formula: action.formula }
          };
        }
        return null;
      }).filter(Boolean);

      // Apply operations
  applyOperations(wb, operations as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  // Verify results
  const b1 = sheet.cells?.['B1'];
  expect(b1?.computed?.v).toBe(110); // 100 * 1.1

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cells[0][0].value).toBe(100);
  expect(cells[0][1].value).toBe(110);
    });
  });

  describe('AI Command Parsing Integration', () => {
    it('should parse AI commands and apply resulting operations', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // Parse AI command
      const result = parseAICommand('set A1 to 50 and B1 to =A1*2', sheet.id);

      expect(result.actions.length).toBeGreaterThan(0);

      // Convert actions to operations
      const operations = result.actions.map(action => {
        if (action.type === 'setCellValue') {
          return {
            type: 'editCell',
            sheetId: action.sheetId,
            address: action.address,
            cell: { raw: action.value }
          };
        } else if (action.type === 'setCellFormula') {
          return {
            type: 'editCell',
            sheetId: action.sheetId,
            address: action.address,
            cell: { formula: action.formula }
          };
        }
        return null;
      }).filter(Boolean);

      // Apply operations
  const applyResult = applyOperations(wb, operations as any, { hydration: undefined });
  expect(applyResult.success).toBe(true);
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  // Verify computation
  const b1 = sheet.cells?.['B1'];
  expect(b1?.computed?.v).toBe(100); // 50 * 2

  const cells = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cells[0][1].value).toBe(100);
    });
  });

  describe('UI Rendering Integration', () => {
    it('should render computed values in CanvasRenderer', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // Set up AI actions that create formulas
      const operations = [
        { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { raw: 10 } },
        { type: 'editCell', sheetId: sheet.id, address: 'B1', cell: { formula: '=A1*2' } },
        { type: 'editCell', sheetId: sheet.id, address: 'C1', cell: { formula: '=SUM(A1:B1)' } }
      ];

      // Apply operations with sync to ensure computation
    applyOperations(wb, operations as any, { hydration: undefined });
    const hydration = hydrateHFFromWorkbook(wb);
    const recompute = recomputeAndPatchCache(wb, hydration);
    expect(recompute.errors.length).toBe(0);

    // Convert to cell array format used by UI
    const cellArray = workbookToCellArray(wb, sheet.id, 5, 5);

    // Verify the cell array contains computed values
    expect(cellArray[0][0].value).toBe(10); // A1 raw value
    expect(cellArray[0][1].value).toBe(20); // B1 computed value (10*2)
    expect(cellArray[0][2].value).toBe(30); // C1 computed value (10+20)

    // Verify formulas are preserved
    expect(cellArray[0][1].formula).toBe('=A1*2');
    expect(cellArray[0][2].formula).toBe('=SUM(A1:B1)');
    });

    it('should handle volatile functions in UI rendering', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { formula: '=NOW()' } },
        { type: 'editCell', sheetId: sheet.id, address: 'B1', cell: { formula: '=RAND()' } }
      ];

      applyOperations(wb, operations as any, { hydration: undefined });
      const hydration = hydrateHFFromWorkbook(wb);
      const recompute = recomputeAndPatchCache(wb, hydration);
      expect(recompute.errors.length).toBe(0);

      const cellArray = workbookToCellArray(wb, sheet.id, 5, 5);

  // NOW() should return a Date object or ISO string
  expect(typeof cellArray[0][0].value === 'string' || typeof cellArray[0][0].value === 'object').toBe(true);

      // RAND() should return a number between 0 and 1
      expect(typeof cellArray[0][1].value === 'number' || typeof cellArray[0][1].value === 'string').toBe(true);
      if (typeof cellArray[0][1].value === 'number') {
        expect(cellArray[0][1].value).toBeGreaterThanOrEqual(0);
        expect(cellArray[0][1].value).toBeLessThan(1);
      }
    });

    it('should display error values for circular references', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      const operations = [
        { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { formula: '=A2+1' } },
        { type: 'editCell', sheetId: sheet.id, address: 'A2', cell: { formula: '=A1+1' } }
      ];

  applyOperations(wb, operations as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBeGreaterThan(0);

  const cellArray = workbookToCellArray(wb, sheet.id, 5, 5);

  // Circular references should result in error values (strings starting with #)
  const a1Value = String(cellArray[0][0].value);
  const a2Value = String(cellArray[0][1].value);

  const hasError = a1Value.startsWith('#') || a2Value.startsWith('#');
  expect(hasError).toBe(true);
    });

    it('should handle cross-sheet references in UI', () => {
      const wb = createWorkbook('Test');
      wb.sheets.push({
        id: 'sheet2',
        name: 'Sheet2',
        visible: true,
        grid: { rowCount: 1000, colCount: 50 },
        cells: {},
      });

      const sheet1 = wb.sheets[0];
      const sheet2 = wb.sheets[1];

      const operations = [
        { type: 'editCell', sheetId: sheet1.id, address: 'A1', cell: { raw: 42 } },
        { type: 'editCell', sheetId: sheet2.id, address: 'A1', cell: { formula: '=Sheet1!A1*2' } }
      ];

  applyOperations(wb, operations as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const cellArray = workbookToCellArray(wb, sheet2.id, 5, 5);
  expect(cellArray[0][0].value).toBe(84); // 42*2
  expect(cellArray[0][0].formula).toBe('=Sheet1!A1*2');
    });

    it('should handle named ranges in UI', () => {
      const wb = createWorkbook('Test');
      const sheet = wb.sheets[0];

      // Create named range
      wb.namedRanges = {
        'MyData': 'A1:A3'
      };

      const operations = [
        { type: 'editCell', sheetId: sheet.id, address: 'A1', cell: { raw: 10 } },
        { type: 'editCell', sheetId: sheet.id, address: 'A2', cell: { raw: 20 } },
        { type: 'editCell', sheetId: sheet.id, address: 'A3', cell: { raw: 30 } },
        { type: 'editCell', sheetId: sheet.id, address: 'B1', cell: { formula: '=SUM(MyData)' } }
      ];

  applyOperations(wb, operations as any, { hydration: undefined });
  const hydration = hydrateHFFromWorkbook(wb);
  const recompute = recomputeAndPatchCache(wb, hydration);
  expect(recompute.errors.length).toBe(0);

  const cellArray = workbookToCellArray(wb, sheet.id, 5, 5);
  expect(cellArray[0][1].value).toBe(60); // SUM of MyData (10+20+30)
  expect(cellArray[0][1].formula).toBe('=SUM(MyData)');
    });
  });
});