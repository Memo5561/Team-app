// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getErrorMessageKey } from '@/lib/errors';

// Node has a `navigator` without `onLine`; that must not be mistaken for "offline".
describe('getErrorMessageKey outside the browser', () => {
  it('keeps unmapped errors generic', () => {
    expect(getErrorMessageKey(new Error('boom'))).toBe('errors.generic');
    expect(getErrorMessageKey({ code: 'P0001', message: 'x' })).toBe('errors.generic');
  });
});
