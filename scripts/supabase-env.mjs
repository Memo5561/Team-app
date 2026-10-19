// Reads the connection details of the local Supabase stack (`pnpm db:start`) from
// `supabase status -o json` (Supabase CLI 2.121: API_URL, PUBLISHABLE_KEY, SECRET_KEY, MAILPIT_URL).
//
// Used by the integration tests (tests/integration/global-setup.ts) and, as a CLI, by CI and
// developers before the e2e tests:
//   node scripts/supabase-env.mjs              check the stack and print a summary (no key values)
//   node scripts/supabase-env.mjs --write-e2e  also write .env.e2e.local for `vite build --mode e2e`
//
// Only local values are handled here. The secret key is never written to a file and never printed;
// .env.e2e.local only receives browser-safe values (publishable key) and stays gitignored.
import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const E2E_ENV_FILE = join(ROOT, '.env.e2e.local');

/**
 * @typedef {object} LocalSupabase
 * @property {string} apiUrl API gateway, e.g. http://127.0.0.1:54321
 * @property {string} publishableKey browser-safe key (sb_publishable_…)
 * @property {string} secretKey server-only key (sb_secret_…); tests and scripts only, never VITE_*
 * @property {string} mailpitUrl Mailpit web/API, e.g. http://127.0.0.1:54324
 */

/** Keys of `supabase status -o json` this project needs, with the expected value shape. */
const REQUIRED = /** @type {const} */ ({
  API_URL: /^https?:\/\/\S+$/,
  PUBLISHABLE_KEY: /^sb_publishable_[A-Za-z0-9_-]{16,}$/,
  SECRET_KEY: /^sb_secret_[A-Za-z0-9_-]{16,}$/,
  MAILPIT_URL: /^https?:\/\/\S+$/,
});

/** The project's pinned CLI (node_modules/.bin), so local runs and CI use the same version. */
function supabaseBinary() {
  const local = join(ROOT, 'node_modules', '.bin', 'supabase');
  return existsSync(local) ? local : 'supabase';
}

/**
 * Parses the JSON printed by `supabase status -o json`. Exported for tests.
 * @param {string} stdout
 * @returns {LocalSupabase}
 */
export function parseStatus(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  /** @type {unknown} */
  let parsed;
  try {
    parsed = start === -1 || end < start ? undefined : JSON.parse(stdout.slice(start, end + 1));
  } catch {
    parsed = undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('`supabase status -o json` did not print a JSON object.');
  }
  const status = /** @type {Record<string, unknown>} */ (parsed);

  const problems = Object.entries(REQUIRED).flatMap(([name, pattern]) => {
    const value = status[name];
    if (typeof value !== 'string' || value === '') return [`${name} is missing`];
    // Never echo the value: it may be a key.
    return pattern.test(value) ? [] : [`${name} has an unexpected format`];
  });
  if (problems.length > 0) {
    const available = Object.keys(status).sort().join(', ') || 'none';
    throw new Error(
      `\`supabase status -o json\` is incomplete: ${problems.join('; ')}. ` +
        `Available variables: ${available}. Was Mailpit or Auth excluded with -x?`,
    );
  }
  const value = (/** @type {keyof typeof REQUIRED} */ name) => String(status[name]);
  return {
    apiUrl: value('API_URL').replace(/\/+$/, ''),
    publishableKey: value('PUBLISHABLE_KEY'),
    secretKey: value('SECRET_KEY'),
    mailpitUrl: value('MAILPIT_URL').replace(/\/+$/, ''),
  };
}

/**
 * Connection details of the running local stack. Throws with a readable message if the stack is
 * not running or the CLI output lacks a required value.
 * @returns {Promise<LocalSupabase>}
 */
export async function readLocalSupabase() {
  let stdout;
  try {
    ({ stdout } = await promisify(execFile)(supabaseBinary(), ['status', '-o', 'json'], {
      cwd: ROOT,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    }));
  } catch (error) {
    const stderr =
      typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : '';
    const firstLine = stderr.trim().split('\n')[0] ?? '';
    const reason = firstLine === '' ? String(error) : firstLine;
    throw new Error(
      `Local Supabase is not running or not reachable (\`supabase status\` failed: ${reason}). ` +
        'Start it with `pnpm db:start`.',
    );
  }
  return parseStatus(stdout);
}

/**
 * Fails unless `${url}` answers with a 2xx status within a few seconds.
 * @param {string} name
 * @param {string} url
 * @param {Record<string, string>} [headers]
 */
export async function assertReachable(name, url, headers = {}) {
  let status;
  try {
    status = (await fetch(url, { headers, signal: AbortSignal.timeout(5_000) })).status;
  } catch (error) {
    throw new Error(`${name} is not reachable at ${url} (${String(error)}).`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`${name} at ${url} answered with HTTP ${status}.`);
  }
}

/**
 * Checks Auth (via the API gateway) and Mailpit of a local stack.
 * @param {LocalSupabase} env
 */
export async function assertStackHealthy(env) {
  await assertReachable('Supabase Auth', `${env.apiUrl}/auth/v1/health`, {
    apikey: env.publishableKey,
  });
  await assertReachable('Mailpit', `${env.mailpitUrl}/api/v1/messages?limit=1`);
}

/**
 * Contents of .env.e2e.local: overrides the placeholders of .env.e2e for `vite build --mode e2e`
 * (browser-safe values only) and tells the Playwright setup where Mailpit is.
 * @param {LocalSupabase} env
 */
export function e2eEnvFile(env) {
  return [
    '# Written by `pnpm supabase:env --write-e2e` from `supabase status` (local stack only).',
    '# Gitignored. Browser-safe values only: never put the secret key into a VITE_* variable.',
    'VITE_APP_ENV=e2e',
    `VITE_SUPABASE_URL=${env.apiUrl}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${env.publishableKey}`,
    `E2E_MAILPIT_URL=${env.mailpitUrl}`,
    '',
  ].join('\n');
}

async function main() {
  const writeE2e = process.argv.includes('--write-e2e');
  const env = await readLocalSupabase();
  // GitHub Actions: hide the (local, but still secret-shaped) key should anything print it later.
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${env.secretKey}`);
  await assertStackHealthy(env);

  console.log(`Supabase API: ${env.apiUrl} (Auth healthy)`);
  console.log(`Mailpit:      ${env.mailpitUrl}`);
  console.log('Keys:         publishable and secret key found (values not shown)');
  if (writeE2e) {
    writeFileSync(E2E_ENV_FILE, e2eEnvFile(env), { mode: 0o600 });
    console.log('Wrote .env.e2e.local (used by `vite build --mode e2e` and the Playwright setup).');
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((/** @type {unknown} */ error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
