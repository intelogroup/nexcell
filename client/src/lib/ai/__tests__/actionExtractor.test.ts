import { describe, it, expect } from 'vitest';
import extractActionsFromReply from '../actionExtractor';

describe('actionExtractor', () => {
  it('extracts actions from fenced json block', () => {
    const reply = 'Here are the actions:\n' +
      '```json\n' +
      JSON.stringify({ actions: [ { type: 'setCellValue', target: 'A1', value: 42 } ] }, null, 2) +
      '\n```\nDone.';
    const actions = extractActionsFromReply(reply);
    expect(actions).not.toBeNull();
    expect(actions![0].type).toBe('setCellValue');
    expect(actions![0].target).toBe('A1');
  });

  it('returns null for invalid json', () => {
    const reply = 'I will do this: { not valid json }';
    const actions = extractActionsFromReply(reply);
    expect(actions).toBeNull();
  });
});
