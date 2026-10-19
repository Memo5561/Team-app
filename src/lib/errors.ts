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

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network/i.test(error.message);
}

export function getErrorMessageKey(error: unknown): ErrorMessageKey {
  const code = errorCode(error);
  const mapped = code === undefined ? undefined : ERROR_CODE_TO_MESSAGE_KEY.get(code);
  if (mapped !== undefined) return mapped;
  if (isNetworkError(error)) return 'errors.network';
  return 'errors.generic';
}
