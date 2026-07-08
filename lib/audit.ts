import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEvent {
  actorId: string | null;
  action: string; // e.g. 'transaction.coded', 'retreat.locked' — see audit_log.action comment in the schema
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

/**
 * Writes one audit_log row. audit_log has no INSERT policy for the
 * `authenticated` role (service-role only, by design — see
 * 007_rls_policies.sql), so this always uses the admin client regardless of
 * which client the caller used for the actual mutation.
 *
 * Call this at every mutation point in application code (API routes), not
 * from a DB trigger — triggers can't cleanly capture "which user" under
 * Supabase's RLS/JWT auth model, and a semantic action name here is more
 * useful later than a raw column diff would be.
 */
export async function writeAuditLog(event: AuditEvent): Promise<void> {
  const supabase: SupabaseClient = createAdminClient();
  const { error } = await supabase.from("audit_log").insert({
    actor_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId,
    before: event.before ?? null,
    after: event.after ?? null,
    metadata: event.metadata ?? null,
  });

  if (error) {
    // An audit-log write failure should never roll back or mask the
    // mutation it's describing — surface it loudly in server logs instead.
    console.error("audit_log insert failed", {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      error: error.message,
    });
  }
}
