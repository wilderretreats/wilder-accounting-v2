import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRetreatSummary } from "@/lib/reports/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: retreat, error }, summary, { data: activeLock }] = await Promise.all([
    supabase
      .from("retreats")
      .select("*, client:clients(*), ops_owner:ops_owners(*)")
      .eq("id", id)
      .single(),
    getRetreatSummary(supabase, id),
    supabase
      .from("retreat_locks")
      .select("*, locked_by_profile:profiles!retreat_locks_locked_by_fkey(full_name, email)")
      .eq("retreat_id", id)
      .is("unlocked_at", null)
      .maybeSingle(),
  ]);

  if (error || !retreat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ retreat, summary, activeLock: activeLock ?? null });
}

// status is intentionally not patchable here -- it's trigger-derived from
// retreat_locks (see migration 011), changed only via the lock/unlock
// endpoints, so it can never drift from the actual lock state.
const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  opsOwnerId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.startDate !== undefined) updates.start_date = d.startDate;
  if (d.endDate !== undefined) updates.end_date = d.endDate;
  if (d.opsOwnerId !== undefined) updates.ops_owner_id = d.opsOwnerId;
  if (d.notes !== undefined) updates.notes = d.notes;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retreats")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ retreat: data });
}
