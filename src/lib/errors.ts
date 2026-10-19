import type de from '@/i18n/de.json';

/**
 * Maps technical errors (Postgres SQLSTATE, PostgREST, TeamPanel RPC codes) to user-facing
 * translation keys (spec §61). Raw error details must only go to logging, never to the UI.
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
 * - auth-js `AuthRetryableFetchError` / functions-js `FunctionsFetchError`.
 */
function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (error instanceof TypeError) return FETCH_FAILURE_MESSAGE.test(error.message);
  if (typeof error !== 'object' || error === null) return false;

  const name = 'name' in error ? error.name : undefined;
  if (name === 'AuthRetryableFetchError' || name === 'FunctionsFetchError') return true;

  const message = 'message' in error ? error.message : undefined;
  const code = 'code' in error ? error.code : undefined;
  return (
    (code === '' || code === undefined) &&
    typeof message === 'string' &&
    /^(TypeError|FetchError):/.test(message) &&
    FETCH_FAILURE_MESSAGE.test(message)
  );
}

export function getErrorMessageKey(error: unknown): ErrorMessageKey {
  const code = errorCode(error);
  const mapped = code === undefined ? undefined : ERROR_CODE_TO_MESSAGE_KEY.get(code);
  if (mapped !== undefined) return mapped;
  if (isNetworkError(error)) return 'errors.network';
  return 'errors.generic';
}
