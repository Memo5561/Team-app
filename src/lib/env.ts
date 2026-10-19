import { parseEnv, type Env } from '@/lib/env-schema';

let cached: Env | undefined;

/** Validated frontend environment. Throws an EnvError on misconfiguration. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env);
  return cached;
}
