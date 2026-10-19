import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';
import type { Database } from '@/types/database';

export type TeamPanelClient = SupabaseClient<Database>;

let client: TeamPanelClient | undefined;

/**
 * Browser Supabase client. Uses only the publishable key; every request is authorized by RLS
 * with the user's JWT. The service-role key must never reach the frontend.
 *
 * All auth e-mail links carry a `token_hash` that /auth/confirm verifies explicitly after a click
 * (protection against link scanners), so the client must not consume tokens from the URL itself.
 */
export function getSupabase(): TeamPanelClient {
  if (client === undefined) {
    const env = getEnv();
    client = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
