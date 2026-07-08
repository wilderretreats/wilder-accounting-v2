import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ transactionIds: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ is_deleted_by_source: true })
    .in("id", parsed.data.transactionIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.bulk_deleted",
    entityType: "transaction",
    entityId: parsed.data.transactionIds[0],
    metadata: { transactionIds: parsed.data.transactionIds, count: parsed.data.transactionIds.length },
  });

  return NextResponse.json({ ok: true });
}
