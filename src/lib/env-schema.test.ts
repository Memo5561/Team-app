import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from '@/lib/env-schema';

const valid = {
  VITE_APP_ENV: 'local',
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'0'.repeat(24)}`,
};

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function issuesOf(raw: Record<string, unknown>): readonly string[] {
  try {
    parseEnv(raw);
  } catch (error) {
    if (error instanceof EnvError) return error.issues;
    throw error;
  }
  throw new Error('expected parseEnv to throw');
}

describe('parseEnv', () => {
  it('accepts a valid local configuration', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('accepts a legacy anon JWT', () => {
    const anonKey = fakeJwt({ role: 'anon', iss: 'supabase' });
    expect(
      parseEnv({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey }).VITE_SUPABASE_PUBLISHABLE_KEY,
    ).toBe(anonKey);
  });

  it('reports missing variables with a pointer to .env.example', () => {
    const { VITE_SUPABASE_URL: _omitted, ...withoutUrl } = valid;
    expect(issuesOf(withoutUrl)).toEqual(['VITE_SUPABASE_URL is missing (see .env.example)']);
    expect(issuesOf({ ...valid, VITE_SUPABASE_URL: '' })).toEqual([
      'VITE_SUPABASE_URL is missing (see .env.example)',
    ]);
  });

  it('lists every problem at once', () => {
    expect(issuesOf({})).toHaveLength(3);
  });

  it('rejects a Supabase secret key', () => {
    const [issue] = issuesOf({
      ...valid,
      VITE_SUPABASE_PUBLISHABLE_KEY: `sb_secret_${'0'.repeat(24)}`,
    });
    expect(issue).toMatch(/secret key/);
  });

  it('rejects a service_role JWT', () => {
    const serviceRoleKey = fakeJwt({ role: 'service_role', iss: 'supabase' });
    const [issue] = issuesOf({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: serviceRoleKey });
    expect(issue).toMatch(/service_role/);
  });

  it('rejects non-http URLs and unknown environments', () => {
    expect(issuesOf({ ...valid, VITE_SUPABASE_URL: 'ftp://example.com' })[0]).toMatch(
      /^VITE_SUPABASE_URL/,
    );
    expect(issuesOf({ ...valid, VITE_APP_ENV: 'prod' })[0]).toMatch(/^VITE_APP_ENV/);
  });

  it('requires https outside local development', () => {
    expect(issuesOf({ ...valid, VITE_APP_ENV: 'production' })).toEqual([
      'VITE_SUPABASE_URL must use https in staging and production',
    ]);
    expect(
      parseEnv({ ...valid, VITE_APP_ENV: 'staging', VITE_SUPABASE_URL: 'https://abc.supabase.co' }),
    ).toMatchObject({ VITE_APP_ENV: 'staging' });
  });
});
