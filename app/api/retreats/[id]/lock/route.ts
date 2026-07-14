import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: retreatId } = await params;
  const supabase = await createClient();

  const { data: existingLock } = await supabase
    .from("retreat_locks")
    .select("id")
    .eq("retreat_id", retreatId)
    .is("unlocked_at", null)
    .maybeSingle();

  if (existingLock) {
    return NextResponse.json({ error: "Retreat is already locked" }, { status: 409 });
  }

  const { data: pendingCodings } = await supabase
    .from("transaction_codings")
    .select("transaction:transactions!inner(pending, is_deleted_by_source)")
    .eq("retreat_id", retreatId)
    .eq("transaction.pending", true)
    .eq("transaction.is_deleted_by_source", false);

  if (pendingCodings && pendingCodings.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot lock: ${pendingCodings.length} pending transaction${
          pendingCodings.length === 1 ? "" : "s"
        } still coded to this retreat. Resolve them before locking.`,
      },
      { status: 409 }
    );
  }

  const { data: lock, error } = await supabase
    .from("retreat_locks")
    .insert({ retreat_id: retreatId, locked_by: authed.user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "retreat.locked",
    entityType: "retreat",
    entityId: retreatId,
    after: lock,
  });

  return NextResponse.json({ lock });
}
