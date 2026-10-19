import { parseEnv, type Env } from '@/lib/env-schema';

let cached: Env | undefined;

/** Validated frontend environment. Throws an EnvError on misconfiguration. */
export function getEnv(): Env {
  // Read keys individually: passing `import.meta.env` as a whole makes Vite inline every VITE_*
  // variable into the bundle, including ones that were never meant for the browser.
  cached ??= parseEnv({
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
