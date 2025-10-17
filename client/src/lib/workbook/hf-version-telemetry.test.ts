import { describe, it, expect, vi } from 'vitest';
import { hydrateHFFromWorkbook } from './hyperformula';
import * as telemetry from '../telemetry';
import type { WorkbookJSON } from './types';

describe('HF version telemetry', () => {
  it('emits telemetry when cached computed values have mismatched hfVersion', () => {
    // Spy on telemetry
    const spy = vi.spyOn(telemetry, 'trackHFVersionMismatch');

    // Build a minimal workbook with one sheet and one cached computed value with old hfVersion
    const workbook: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-1',
      meta: { title: 't', author: 'a', createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() },
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          cells: {
            A1: {
              computed: { v: 42, ts: new Date().toISOString(), hfVersion: '0.0.0', computedBy: 'hf-0.0.0' }
            }
          }
        }
      ],
    } as unknown as WorkbookJSON;

    // Run hydration
  hydrateHFFromWorkbook(workbook, {});

    // Expect telemetry called once with workbookId and staleCount >= 1
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0];
    expect(call[0]).toBe('wb-1');
    expect(call[1]).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });
});
