import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

/** Admin-only: unlocking a reviewed period is an explicit override, not a routine ops action. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Only admins can unlock a retreat" }, { status: 403 });
  }

  const { id: retreatId } = await params;
  const supabase = await createClient();

  const { data: existingLock } = await supabase
    .from("retreat_locks")
    .select("id")
    .eq("retreat_id", retreatId)
    .is("unlocked_at", null)
    .maybeSingle();

  if (!existingLock) {
    return NextResponse.json({ error: "Retreat is not currently locked" }, { status: 409 });
  }

  const { data: lock, error } = await supabase
    .from("retreat_locks")
    .update({ unlocked_by: authed.user.id, unlocked_at: new Date().toISOString() })
    .eq("id", existingLock.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "retreat.unlocked",
    entityType: "retreat",
    entityId: retreatId,
    after: lock,
  });

  return NextResponse.json({ lock });
}
