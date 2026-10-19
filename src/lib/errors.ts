import { isAuthError, isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';
import type de from '@/i18n/de.json';

/**
 * Maps technical errors (Postgres SQLSTATE, PostgREST, TeamPanel RPC codes, Supabase Auth error
 * codes) to user-facing translation keys (spec §61). Raw error details must only go to logging,
 * never to the UI.
 */

export type ErrorMessageKey = `errors.${keyof typeof de.errors}`;

const ERROR_CODE_TO_MESSAGE_KEY = new Map<string, ErrorMessageKey>([
  // PostgreSQL
  ['23505', 'errors.conflict'], // unique_violation
  ['23503', 'errors.conflict'], // foreign_key_violation
  ['23P01', 'errors.conflict'], // exclusion_violation (e.g. overlapping shifts)
  ['23514', 'errors.invalidInput'], // check_violation
  ['42501', 'errors.forbidden'], // insufficient_privilege, incl. RLS write violations
  // PostgREST
  ['PGRST116', 'errors.notFound'], // single row requested, none returned
  // TeamPanel RPC errors (RAISE ... USING ERRCODE)
  ['TP403', 'errors.forbidden'],
  ['TP409', 'errors.conflict'],
  ['TP422', 'errors.limitReached'],
]);

/**
 * Supabase Auth (GoTrue) error codes. Only consulted for auth-js errors, and only by `code`: the
 * English `message` is never inspected or shown. `current_password_*` and
 * `pkce_code_verifier_not_found` are real codes that auth-js' `ErrorCode` union does not list.
 */
const AUTH_CODE_TO_MESSAGE_KEY = new Map<string, ErrorMessageKey>([
  ['invalid_credentials', 'errors.invalidCredentials'],
  ['email_not_confirmed', 'errors.emailNotConfirmed'],
  ['over_request_rate_limit', 'errors.rateLimited'],
  ['over_email_send_rate_limit', 'errors.emailRateLimited'],
  ['weak_password', 'errors.weakPassword'],
  ['same_password', 'errors.samePassword'],
  ['validation_failed', 'errors.invalidInput'],
  ['email_address_invalid', 'errors.invalidEmail'],
  // Staging sends through Supabase's built-in SMTP, which only delivers to team addresses.
  ['email_address_not_authorized', 'errors.emailNotAuthorized'],
  // E-mail links (token_hash) and PKCE flow state.
  ['otp_expired', 'errors.linkInvalid'],
  ['otp_disabled', 'errors.linkInvalid'],
  ['flow_state_not_found', 'errors.linkInvalid'],
  ['flow_state_expired', 'errors.linkInvalid'],
  ['flow_state_already_used', 'errors.linkInvalid'],
  ['bad_code_verifier', 'errors.linkInvalid'],
  ['pkce_code_verifier_not_found', 'errors.linkInvalid'],
  // Session gone or expired (signed out elsewhere, refresh token revoked or reused).
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
]);

/** auth-js errors that are raised client-side without a server code. */
const AUTH_ERROR_NAME_TO_MESSAGE_KEY = new Map<string, ErrorMessageKey>([
  ['AuthSessionMissingError', 'errors.sessionExpired'],
  ['AuthPKCECodeVerifierMissingError', 'errors.linkInvalid'],
  ['AuthWeakPasswordError', 'errors.weakPassword'],
]);

function hasPwnedReason(error: AuthError): boolean {
  const reasons = 'reasons' in error ? error.reasons : undefined;
  return Array.isArray(reasons) && reasons.includes('pwned');
}

function authErrorMessageKey(error: AuthError): ErrorMessageKey | undefined {
  const code = typeof error.code === 'string' && error.code !== '' ? error.code : undefined;
  const key =
    (code === undefined ? undefined : AUTH_CODE_TO_MESSAGE_KEY.get(code)) ??
    AUTH_ERROR_NAME_TO_MESSAGE_KEY.get(error.name);
  if (key === 'errors.weakPassword' && hasPwnedReason(error)) return 'errors.pwnedPassword';
  if (key !== undefined) return key;
  if (error.status === 429) return 'errors.rateLimited';
  return undefined;
}

/**
 * The Supabase Auth error code of an auth-js error (e.g. `email_not_confirmed`), for flows that
 * branch on specific outcomes. Undefined for every other error and for auth errors without a code.
 */
export function getAuthErrorCode(error: unknown): string | undefined {
  if (!isAuthError(error)) return undefined;
  return typeof error.code === 'string' && error.code !== '' ? error.code : undefined;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    return typeof code === 'string' && code !== '' ? code : undefined;
  }
  return undefined;
}

// Browsers phrase fetch failures differently: Chrome "Failed to fetch", Firefox "NetworkError when
// attempting to fetch resource.", Safari/iOS "Load failed".
const FETCH_FAILURE_MESSAGE = /failed to fetch|networkerror|network request failed|load failed/i;

/**
 * Detects connectivity failures in the shapes supabase-js actually produces:
 * - raw fetch TypeError (any browser),
 * - postgrest-js result error `{ message: 'TypeError: Failed to fetch', code: '' }` (status 0),
 * - auth-js `AuthRetryableFetchError` with status 0 (it also carries 5xx server errors, which are
 *   not connectivity problems), functions-js `FunctionsFetchError`,
 * - storage-js `StorageUnknownError` wrapping a fetch failure.
 */
function isNetworkError(error: unknown): boolean {
  // `navigator.onLine` is undefined outside browsers (e.g. Node), so compare explicitly.
  const online =
    typeof navigator === 'undefined' ? undefined : (navigator as Partial<Navigator>).onLine;
  if (online === false) return true;
  if (error instanceof TypeError) return FETCH_FAILURE_MESSAGE.test(error.message);
  if (typeof error !== 'object' || error === null) return false;

  const name = 'name' in error ? error.name : undefined;
  if (name === 'AuthRetryableFetchError') return 'status' in error && error.status === 0;
  if (name === 'FunctionsFetchError') return true;

  const message = 'message' in error ? error.message : undefined;
  if (name === 'StorageUnknownError') {
    const cause = 'originalError' in error ? error.originalError : undefined;
    return (
      (cause instanceof TypeError && FETCH_FAILURE_MESSAGE.test(cause.message)) ||
      (typeof message === 'string' && FETCH_FAILURE_MESSAGE.test(message))
    );
  }

  const code = 'code' in error ? error.code : undefined;
  return (
    (code === '' || code === undefined) &&
    typeof message === 'string' &&
    /^(TypeError|FetchError):/.test(message) &&
    FETCH_FAILURE_MESSAGE.test(message)
  );
}

export function getErrorMessageKey(error: unknown): ErrorMessageKey {
  if (isAuthError(error)) {
    const authKey = authErrorMessageKey(error);
    if (authKey !== undefined) return authKey;
    if (isNetworkError(error)) return 'errors.network';
    // 5xx from Supabase Auth (auth-js reports them as AuthRetryableFetchError), e.g. mail delivery
    // or database failures: the device is online, the service is not.
    if (isAuthRetryableFetchError(error) && error.status >= 500) {
      return 'errors.serviceUnavailable';
    }
    return 'errors.generic';
  }
  const code = errorCode(error);
  const mapped = code === undefined ? undefined : ERROR_CODE_TO_MESSAGE_KEY.get(code);
  if (mapped !== undefined) return mapped;
  if (isNetworkError(error)) return 'errors.network';
  return 'errors.generic';
}
