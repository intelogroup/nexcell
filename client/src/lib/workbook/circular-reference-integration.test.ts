import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeWorkbook, hydrateHFFromWorkbook } from './hyperformula';
import { CircularReferenceRecovery, circularReferenceUI } from './circular-reference-ui';
import type { WorkbookJSON } from './types';

describe('Circular Reference Integration Tests', () => {
  let mockWorkbook: WorkbookJSON;

  beforeEach(() => {
    mockWorkbook = {
      schemaVersion: '1.0',
      workbookId: 'test-workbook',
      meta: {
        title: 'Test Workbook',
        author: 'test',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      },
      sheets: [
        {
          id: 'Sheet1',
          name: 'Sheet 1',
          visible: true,
          grid: { rowCount: 100, colCount: 50 },
          cells: {},
          mergedRanges: [],
          properties: {}
        }
      ],
      namedRanges: {}
    };

    // Clear any pending alerts
    circularReferenceUI.clearAllAlerts();
  });

  describe('computeWorkbook with circular references', () => {
    it('should detect and warn about circular references during computation', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' }
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = computeWorkbook(mockWorkbook, {
        circularReferenceConfig: { enablePreDetection: true }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detected 1 circular reference(s)')
      );
      expect(result.hydration).toBeDefined();
      expect(result.recompute).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should handle computation timeout for circular references', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' }
      };

      const result = computeWorkbook(mockWorkbook, {
        circularReferenceConfig: { 
          enablePreDetection: true,
          computationTimeoutMs: 50 // Very short timeout
        }
      });

      // Should complete without throwing, even with timeout
      expect(result.hydration).toBeDefined();
      expect(result.recompute).toBeDefined();
      
      // Check if timeout protection was triggered
      if (result.recompute.errors.length > 0) {
        expect(result.recompute.errors.some(e => 
          e.error.includes('timeout') || e.error.includes('interrupted')
        )).toBe(true);
      }
    });

    it('should disable circular detection when configured', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' }
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = computeWorkbook(mockWorkbook, {
        circularReferenceConfig: { enablePreDetection: false }
      });

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('circular reference')
      );
      expect(result.hydration).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should handle high-severity circular references with appropriate warnings', () => {
      // Create a long circular chain
      const cells = {};
      for (let i = 0; i < 15; i++) {
        const current = String.fromCharCode(65 + i) + '1';
        const next = i === 14 ? 'A1' : String.fromCharCode(65 + i + 1) + '1';
        cells[current] = { formula: `=${next}`, dataType: 'formula' };
      }
      mockWorkbook.sheets[0].cells = cells;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = computeWorkbook(mockWorkbook, {
        circularReferenceConfig: { enablePreDetection: true }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('High-severity circular reference detected')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('CircularReferenceRecovery', () => {
    it('should break circular reference by clearing formula', () => {
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1', value: 10, dataType: 'formula' },
        'B1': { formula: '=A1', value: 20, dataType: 'formula' }
      };

      const chain = {
        cells: ['A1', 'B1', 'A1'],
        severity: 'medium' as const
      };

      const result = CircularReferenceRecovery.breakCircularReference(mockWorkbook, chain);

      expect(result.success).toBe(true);
      expect(result.cellsModified).toEqual(['A1']);
      
      // Check that the formula was cleared from the last cell in the chain
      const modifiedCell = mockWorkbook.sheets[0].cells['A1'];
      expect(modifiedCell?.formula).toBeUndefined();
      expect(modifiedCell?.value).toBeDefined(); // Value should be preserved
    });

    it('should handle cross-sheet circular references', () => {
      mockWorkbook.sheets.push({
        id: 'Sheet2',
        name: 'Sheet 2',
        visible: true,
        grid: { rowCount: 100, colCount: 50 },
        cells: {
          'A1': { formula: '=Sheet1!A1', dataType: 'formula' }
        },
        mergedRanges: [],
        properties: {}
      });

      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=Sheet2!A1', dataType: 'formula' }
      };

      const chain = {
        cells: ['Sheet1!A1', 'Sheet2!A1', 'Sheet1!A1'],
        severity: 'medium' as const
      };

      const result = CircularReferenceRecovery.breakCircularReference(mockWorkbook, chain);

      expect(result.success).toBe(true);
      expect(result.cellsModified).toEqual(['Sheet1!A1']);
    });

    it('should handle missing sheet gracefully', () => {
      const chain = {
        cells: ['NonExistentSheet!A1', 'Sheet1!A1', 'NonExistentSheet!A1'],
        severity: 'medium' as const
      };

      const result = CircularReferenceRecovery.breakCircularReference(mockWorkbook, chain);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Sheet NonExistentSheet not found');
    });

    it('should handle missing cell gracefully', () => {
      const chain = {
        cells: ['A1', 'B1', 'A1'],
        severity: 'medium' as const
      };

      const result = CircularReferenceRecovery.breakCircularReference(mockWorkbook, chain);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cell A1 not found');
    });

    it('should create ignore recovery result', () => {
      const chain = {
        cells: ['A1', 'B1', 'A1'],
        severity: 'medium' as const
      };

      const result = CircularReferenceRecovery.ignoreCircularReference(chain);

      expect(result.success).toBe(true);
      expect(result.message).toContain('timeout protection');
      expect(result.cellsModified).toEqual([]);
    });

    it('should create undo recovery result', () => {
      const result = CircularReferenceRecovery.createUndoRecovery();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Undo operation requested');
      expect(result.cellsModified).toEqual([]);
    });
  });

  describe('CircularReferenceUIService', () => {
    it('should register and retrieve alerts', () => {
      const error = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'medium' as const },
        context: { operation: 'test' },
        message: 'Test circular reference',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore']
      };

      const mockCallback = vi.fn();
      circularReferenceUI.registerAlert('test-alert', error, mockCallback);

      const alerts = circularReferenceUI.getPendingAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('test-alert');
      expect(alerts[0].error).toEqual(error);
    });

    it('should resolve alerts with recovery actions', async () => {
      const error = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'medium' as const },
        context: { operation: 'test' },
        message: 'Test circular reference',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore']
      };

      const mockCallback = vi.fn().mockResolvedValue({
        success: true,
        message: 'Recovery successful'
      });

      circularReferenceUI.registerAlert('test-alert', error, mockCallback);

      const result = await circularReferenceUI.resolveAlert('test-alert', 'break');

      expect(result.success).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith('break');
      
      // Alert should be removed after successful resolution
      const alerts = circularReferenceUI.getPendingAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should handle failed recovery gracefully', async () => {
      const error = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'medium' as const },
        context: { operation: 'test' },
        message: 'Test circular reference',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore']
      };

      const mockCallback = vi.fn().mockRejectedValue(new Error('Recovery failed'));

      circularReferenceUI.registerAlert('test-alert', error, mockCallback);

      const result = await circularReferenceUI.resolveAlert('test-alert', 'break');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Recovery failed');
      
      // Alert should remain after failed resolution
      const alerts = circularReferenceUI.getPendingAlerts();
      expect(alerts).toHaveLength(1);
    });

    it('should dismiss alerts', () => {
      const error = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'medium' as const },
        context: { operation: 'test' },
        message: 'Test circular reference',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore']
      };

      circularReferenceUI.registerAlert('test-alert', error, vi.fn());
      circularReferenceUI.dismissAlert('test-alert');

      const alerts = circularReferenceUI.getPendingAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should detect high-severity alerts', () => {
      const highSeverityError = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'high' as const },
        context: { operation: 'test' },
        message: 'High severity circular reference',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'undo']
      };

      const mediumSeverityError = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['C1', 'D1', 'C1'], severity: 'medium' as const },
        context: { operation: 'test' },
        message: 'Medium severity circular reference',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore']
      };

      circularReferenceUI.registerAlert('high-alert', highSeverityError, vi.fn());
      circularReferenceUI.registerAlert('medium-alert', mediumSeverityError, vi.fn());

      expect(circularReferenceUI.hasHighSeverityAlerts()).toBe(true);

      const counts = circularReferenceUI.getAlertCounts();
      expect(counts.high).toBe(1);
      expect(counts.medium).toBe(1);
      expect(counts.low).toBe(0);
      expect(counts.total).toBe(2);
    });

    it('should clear all alerts', () => {
      const error1 = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'medium' as const },
        context: { operation: 'test' },
        message: 'Test circular reference 1',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore']
      };

      const error2 = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['C1', 'D1', 'C1'], severity: 'high' as const },
        context: { operation: 'test' },
        message: 'Test circular reference 2',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'undo']
      };

      circularReferenceUI.registerAlert('alert1', error1, vi.fn());
      circularReferenceUI.registerAlert('alert2', error2, vi.fn());

      expect(circularReferenceUI.getPendingAlerts()).toHaveLength(2);

      circularReferenceUI.clearAllAlerts();

      expect(circularReferenceUI.getPendingAlerts()).toHaveLength(0);
      expect(circularReferenceUI.hasHighSeverityAlerts()).toBe(false);
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete circular reference workflow', async () => {
      // Setup workbook with circular reference
      mockWorkbook.sheets[0].cells = {
        'A1': { formula: '=B1+1', value: 0, dataType: 'formula' },
        'B1': { formula: '=A1+1', value: 0, dataType: 'formula' }
      };

      // Compute workbook (should detect circular reference)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const computeResult = computeWorkbook(mockWorkbook, {
        circularReferenceConfig: { enablePreDetection: true }
      });

      expect(consoleSpy).toHaveBeenCalled();
      
      // Simulate UI alert registration
      const error = {
        type: 'CIRCULAR_REFERENCE' as const,
        chain: { cells: ['A1', 'B1', 'A1'], severity: 'medium' as const },
        context: { operation: 'Formula computation' },
        message: 'Circular reference detected during computation',
        timestamp: new Date(),
        recoverySuggestions: ['break', 'ignore', 'undo']
      };

      const recoveryCallback = async (action: 'break' | 'ignore' | 'undo') => {
        switch (action) {
          case 'break':
            return CircularReferenceRecovery.breakCircularReference(mockWorkbook, error.chain);
          case 'ignore':
            return CircularReferenceRecovery.ignoreCircularReference(error.chain);
          case 'undo':
            return CircularReferenceRecovery.createUndoRecovery();
          default:
            return { success: false, message: 'Unknown action' };
        }
      };

      circularReferenceUI.registerAlert('workflow-test', error, recoveryCallback);

      // Resolve with break action
      const recoveryResult = await circularReferenceUI.resolveAlert('workflow-test', 'break');

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.cellsModified).toContain('A1');
      
      // Verify the circular reference was broken
      const modifiedCell = mockWorkbook.sheets[0].cells['A1'];
      expect(modifiedCell?.formula).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('should handle multiple concurrent circular references', () => {
      mockWorkbook.sheets[0].cells = {
        // First circular reference
        'A1': { formula: '=B1', dataType: 'formula' },
        'B1': { formula: '=A1', dataType: 'formula' },
        // Second circular reference
        'C1': { formula: '=D1', dataType: 'formula' },
        'D1': { formula: '=C1', dataType: 'formula' },
        // Valid reference
        'E1': { formula: '=10', dataType: 'formula' }
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = computeWorkbook(mockWorkbook, {
        circularReferenceConfig: { enablePreDetection: true }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detected 2 circular reference(s)')
      );

      consoleSpy.mockRestore();
    });
  });
});