import { describe, expect, it, vi } from 'vitest';
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

  it.each([
    ['Chrome fetch TypeError', new TypeError('Failed to fetch')],
    ['Firefox fetch TypeError', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari fetch TypeError', new TypeError('Load failed')],
    [
      'postgrest-js result error',
      { message: 'TypeError: Failed to fetch', details: 'stack', hint: '', code: '' },
    ],
    [
      'auth-js retryable fetch error',
      Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }),
    ],
    [
      'functions-js fetch error',
      Object.assign(new Error('Failed to send a request'), { name: 'FunctionsFetchError' }),
    ],
  ])('maps a %s to the network message', (_shape, error) => {
    expect(getErrorMessageKey(error)).toBe('errors.network');
  });

  it('treats every error as a network error while the browser is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(getErrorMessageKey(new Error('boom'))).toBe('errors.network');
  });

  it('does not mistake unrelated TypeErrors for network failures', () => {
    expect(getErrorMessageKey(new TypeError('x is not a function'))).toBe('errors.generic');
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
