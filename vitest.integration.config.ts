import { defineConfig } from 'vitest/config';
import { assertStackHealthy, readLocalSupabase } from './scripts/supabase-env.mjs';

// Integration tests against the local Supabase stack (`pnpm db:start`): Auth, PostgREST and the
// database together. Separate from vitest.config.ts so `pnpm test` / `pnpm check` need no Docker.
// Run with `pnpm test:integration`.
export default defineConfig(async () => {
  // URLs and keys come from `supabase status`. Without a running stack this fails right here with
  // a readable message ("Start it with `pnpm db:start`") instead of letting every test time out.
  const supabase = await readLocalSupabase();
  await assertStackHealthy(supabase);

  return {
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
      // Read in the tests with inject('supabase') (tests/integration/support/supabase.ts).
      provide: { supabase },
      // One shared stack with per-IP rate limits: run the files one after another.
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 60_000,
    },
  };
});
