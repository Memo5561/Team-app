import { describe, expect, it } from 'vitest';
import { getErrorMessageKey } from '@/lib/errors';

describe('getErrorMessageKey', () => {
  it.each([
    ['23505', 'errors.conflict'],
    ['23P01', 'errors.conflict'],
    ['23514', 'errors.invalidInput'],
    ['42501', 'errors.forbidden'],
    ['PGRST116', 'errors.notFound'],
    ['TP403', 'errors.forbidden'],
    ['TP422', 'errors.limitReached'],
  ])('maps code %s to %s', (code, key) => {
    expect(getErrorMessageKey({ code, message: 'technical details' })).toBe(key);
  });

  it('maps fetch failures to the network message', () => {
    expect(getErrorMessageKey(new TypeError('Failed to fetch'))).toBe('errors.network');
  });

  it.each([
    [undefined],
    [null],
    ['boom'],
    [new Error('boom')],
    [{ code: '' }],
    [{ code: 'XX000' }],
  ])('falls back to the generic message for %j', (error) => {
    expect(getErrorMessageKey(error)).toBe('errors.generic');
  });
});
