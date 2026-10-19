import { z } from 'zod';

/**
 * Environment contract of the frontend. Everything here ends up in the public JS bundle,
 * so only browser-safe values are allowed; the schema actively rejects secret keys.
 */

const APP_ENVIRONMENTS = ['local', 'e2e', 'staging', 'production'] as const;

/** Returns the `role` claim of a JWT-shaped string, or undefined if it is not a JWT. */
function jwtRole(token: string): string | undefined {
  const payload = token.split('.')[1];
  if (token.split('.').length !== 3 || payload === undefined) return undefined;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    if (typeof decoded === 'object' && decoded !== null && 'role' in decoded) {
      return typeof decoded.role === 'string' ? decoded.role : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

const publishableKey = z
  .string()
  .trim()
  .min(20, 'must be a Supabase publishable (or legacy anon) key')
  .refine((key) => !key.startsWith('sb_secret_'), {
    message: 'is a secret key; only the publishable key may be used in the browser',
  })
  .refine((key) => jwtRole(key) !== 'service_role', {
    message: 'is a service_role key; only the publishable/anon key may be used in the browser',
  });

export const envSchema = z
  .object({
    VITE_APP_ENV: z.enum(APP_ENVIRONMENTS),
    VITE_SUPABASE_URL: z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }),
    VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  })
  .superRefine((env, ctx) => {
    const deployed = env.VITE_APP_ENV === 'staging' || env.VITE_APP_ENV === 'production';
    if (deployed && !env.VITE_SUPABASE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['VITE_SUPABASE_URL'],
        message: 'must use https in staging and production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'EnvError';
    this.issues = issues;
  }
}

/** Validates raw environment variables; throws an {@link EnvError} listing every problem. */
export function parseEnv(raw: Readonly<Record<string, unknown>>): Env {
  const result = envSchema.safeParse(raw);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const key = issue.path.map(String).join('.');
    const value = raw[key];
    if (value === undefined || value === '') return `${key} is missing (see .env.example)`;
    return `${key} ${issue.message}`;
  });
  throw new EnvError(issues);
}
