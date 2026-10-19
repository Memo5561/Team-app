import {
  AuthApiError,
  AuthPKCECodeVerifierMissingError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import de from '@/i18n/de.json';
import { getAuthErrorCode, getErrorMessageKey } from '@/lib/errors';

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
    [
      'storage-js unknown error wrapping a fetch failure',
      Object.assign(new Error('Failed to fetch'), {
        name: 'StorageUnknownError',
        originalError: new TypeError('Failed to fetch'),
      }),
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

describe('getErrorMessageKey for Supabase Auth errors', () => {
  const apiError = (code: string | undefined, status = 400) =>
    new AuthApiError('English server message', status, code);

  it.each([
    ['invalid_credentials', 'errors.invalidCredentials'],
    ['email_not_confirmed', 'errors.emailNotConfirmed'],
    ['over_request_rate_limit', 'errors.rateLimited'],
    ['over_email_send_rate_limit', 'errors.emailRateLimited'],
    ['weak_password', 'errors.weakPassword'],
    ['same_password', 'errors.samePassword'],
    ['validation_failed', 'errors.invalidInput'],
    ['email_address_invalid', 'errors.invalidEmail'],
    ['email_address_not_authorized', 'errors.emailNotAuthorized'],
    ['otp_expired', 'errors.linkInvalid'],
    ['otp_disabled', 'errors.linkInvalid'],
    ['flow_state_not_found', 'errors.linkInvalid'],
    ['flow_state_expired', 'errors.linkInvalid'],
    ['flow_state_already_used', 'errors.linkInvalid'],
    ['bad_code_verifier', 'errors.linkInvalid'],
    ['session_not_found', 'errors.sessionExpired'],
    ['session_expired', 'errors.sessionExpired'],
    ['refresh_token_not_found', 'errors.sessionExpired'],
    ['refresh_token_already_used', 'errors.sessionExpired'],
    ['reauthentication_needed', 'errors.newLinkRequired'],
    ['reauthentication_not_valid', 'errors.newLinkRequired'],
    ['current_password_required', 'errors.newLinkRequired'],
    ['current_password_invalid', 'errors.newLinkRequired'],
    ['user_banned', 'errors.userBanned'],
    ['signup_disabled', 'errors.signupDisabled'],
  ])('maps auth code %s to %s', (code, key) => {
    expect(getErrorMessageKey(apiError(code))).toBe(key);
  });

  it('maps every auth key to an existing German text', () => {
    const keys = [
      'invalidCredentials',
      'emailNotConfirmed',
      'rateLimited',
      'emailRateLimited',
      'weakPassword',
      'pwnedPassword',
      'samePassword',
      'invalidEmail',
      'emailNotAuthorized',
      'linkInvalid',
      'sessionExpired',
      'newLinkRequired',
      'userBanned',
      'signupDisabled',
      'serviceUnavailable',
    ] as const;
    for (const key of keys) expect(de.errors[key]).toMatch(/\S/);
  });

  it('maps HTTP 429 without a known code to the rate-limit message', () => {
    expect(getErrorMessageKey(apiError(undefined, 429))).toBe('errors.rateLimited');
    expect(getErrorMessageKey(apiError('something_new', 429))).toBe('errors.rateLimited');
  });

  it('tells leaked passwords apart from merely weak ones', () => {
    expect(getErrorMessageKey(new AuthWeakPasswordError('weak', 422, ['length']))).toBe(
      'errors.weakPassword',
    );
    expect(getErrorMessageKey(new AuthWeakPasswordError('pwned', 422, ['pwned']))).toBe(
      'errors.pwnedPassword',
    );
  });

  it.each([
    ['AuthSessionMissingError', new AuthSessionMissingError(), 'errors.sessionExpired'],
    [
      'AuthPKCECodeVerifierMissingError',
      new AuthPKCECodeVerifierMissingError(),
      'errors.linkInvalid',
    ],
    [
      'AuthRetryableFetchError',
      new AuthRetryableFetchError('Failed to fetch', 0),
      'errors.network',
    ],
  ])('maps client-side %s', (_name, error, key) => {
    expect(getErrorMessageKey(error)).toBe(key);
  });

  it('never consults the database code table for auth errors', () => {
    expect(getErrorMessageKey(apiError('23505'))).toBe('errors.generic');
    expect(getErrorMessageKey(apiError('unexpected_failure', 500))).toBe('errors.generic');
  });

  // auth-js turns every 5xx (e.g. GoTrue failing to send a mail) into AuthRetryableFetchError: the
  // device is online, so "check your connection" would be wrong advice.
  it.each([500, 502, 503, 504, 522])(
    'maps a %i server error to "service unavailable"',
    (status) => {
      expect(getErrorMessageKey(new AuthRetryableFetchError('Internal Server Error', status))).toBe(
        'errors.serviceUnavailable',
      );
    },
  );

  it('does not look at the English message', () => {
    expect(getErrorMessageKey(new AuthApiError('Invalid login credentials', 400, undefined))).toBe(
      'errors.generic',
    );
  });
});

describe('getAuthErrorCode', () => {
  it('returns the code of auth errors only', () => {
    expect(getAuthErrorCode(new AuthApiError('x', 400, 'email_not_confirmed'))).toBe(
      'email_not_confirmed',
    );
    expect(getAuthErrorCode(new AuthApiError('x', 400, undefined))).toBeUndefined();
    expect(getAuthErrorCode({ code: 'email_not_confirmed' })).toBeUndefined();
    expect(getAuthErrorCode(new Error('x'))).toBeUndefined();
  });
});
