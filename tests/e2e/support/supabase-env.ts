/** Local Supabase stack as seen by the e2e build (set by tests/e2e/global-setup.ts). */
export interface E2eSupabase {
  apiUrl: string;
  /** Browser-safe key; the e2e tests never use the secret key. */
  publishableKey: string;
  mailpitUrl: string;
}

/** Environment variable the global setup uses to hand the stack to the test workers. */
export const SUPABASE_ENV = 'TEAMPANEL_E2E_SUPABASE';

/** The stack, or undefined if the global setup found it unavailable (tests are skipped then). */
export function readE2eSupabase(): E2eSupabase | undefined {
  const raw = process.env[SUPABASE_ENV];
  if (raw === undefined || raw === '') return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const { apiUrl, publishableKey, mailpitUrl } = parsed as Partial<
    Record<keyof E2eSupabase, unknown>
  >;
  if (typeof apiUrl !== 'string' || typeof publishableKey !== 'string') return undefined;
  if (typeof mailpitUrl !== 'string') return undefined;
  return { apiUrl, publishableKey, mailpitUrl };
}
