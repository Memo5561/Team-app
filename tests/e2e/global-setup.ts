import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { SUPABASE_ENV, type E2eSupabase } from './support/supabase-env';

/**
 * Decides whether the @supabase e2e tests can run. They need the local stack (`pnpm db:start`) and
 * an app build that talks to it, i.e. `.env.e2e.local` from `pnpm supabase:env --write-e2e`.
 * The values come from the same files `vite build --mode e2e` reads, so tests and app always agree.
 *
 * - CI: anything missing fails the whole run (the tests must never be skipped silently there).
 * - Locally: the @supabase tests are skipped with the reason; the smoke tests still run.
 */
const PLACEHOLDER_KEY = /^sb_publishable_0+$/;
const DEFAULT_MAILPIT_URL = 'http://127.0.0.1:54324';

async function answers(url: string, headers: Record<string, string> = {}): Promise<boolean> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function findProblem(env: E2eSupabase): Promise<string | undefined> {
  if (!(await answers(`${env.apiUrl}/auth/v1/health`, { apikey: env.publishableKey }))) {
    return `Supabase Auth is not reachable at ${env.apiUrl} (start it with \`pnpm db:start\`)`;
  }
  if (PLACEHOLDER_KEY.test(env.publishableKey)) {
    return 'the e2e build still uses the placeholder key from .env.e2e (run `pnpm supabase:env --write-e2e`)';
  }
  if (!(await answers(`${env.mailpitUrl}/api/v1/messages?limit=1`))) {
    return `Mailpit is not reachable at ${env.mailpitUrl}`;
  }
  return undefined;
}

export default async function globalSetup(): Promise<void> {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const files = loadEnv('e2e', root, ['VITE_', 'E2E_']);
  const env: E2eSupabase = {
    apiUrl: (files.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
    publishableKey: files.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    mailpitUrl: (files.E2E_MAILPIT_URL ?? DEFAULT_MAILPIT_URL).replace(/\/+$/, ''),
  };

  const problem = await findProblem(env);
  if (problem === undefined) {
    process.env[SUPABASE_ENV] = JSON.stringify(env);
    return;
  }
  if (process.env.CI) {
    throw new Error(`The @supabase e2e tests cannot run: ${problem}.`);
  }
  console.warn(`Skipping the @supabase e2e tests: ${problem}.`);
}
