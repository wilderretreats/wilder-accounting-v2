import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPlatformEnv } from "@/lib/env";

/**
 * Service-role client for the SEPARATE Wilder Retreats Platform Supabase
 * project (different database from this app's own). Used only for retreat
 * linking: reading/writing the platform's retreats.accounting_retreat_id
 * column, which is the single source of truth for the link — this app
 * never stores its own copy of it.
 */
export function createPlatformClient() {
  const env = getPlatformEnv();
  return createSupabaseClient(
    env.PLATFORM_SUPABASE_URL,
    env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
