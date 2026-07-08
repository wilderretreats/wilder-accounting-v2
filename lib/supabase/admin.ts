import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses RLS entirely. Use ONLY in contexts
 * with no user session to scope to: cron jobs, the Plaid webhook receiver,
 * and the one-time historical migration script. Never import this into a
 * route that runs on behalf of a logged-in user's request — use
 * lib/supabase/server.ts there so RLS stays in effect.
 */
export function createAdminClient() {
  const env = getEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
