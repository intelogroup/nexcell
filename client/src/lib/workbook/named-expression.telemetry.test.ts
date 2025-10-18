import { describe, it, expect, vi } from 'vitest';
import { hydrateHFFromWorkbook } from './hyperformula';
import * as telemetry from '../telemetry';
import type { WorkbookJSON } from './types';

describe('Named expression telemetry', () => {
  it('tracks named expression registration failures', () => {
    const spy = vi.spyOn(telemetry, 'trackNamedExpressionFailure');

    // Create workbook with a named range that references a nonexistent sheet
    const workbook: WorkbookJSON = {
      schemaVersion: '1.0',
      workbookId: 'wb-ne-1',
      meta: { title: 't', author: 'a', createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() },
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          cells: {},
        }
      ],
      namedRanges: {
        BadRange: 'NonexistentSheet!A1:A10',
      }
    } as unknown as WorkbookJSON;

    // Hydrate which will attempt to add the named expression and should fail
    hydrateHFFromWorkbook(workbook, {});

    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0];
    expect(call[0]).toBe('wb-ne-1');
    expect(call[1]).toBe('BadRange');

    spy.mockRestore();
  });
});
