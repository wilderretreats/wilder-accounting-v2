import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(500),
  categoryId: z.string().uuid(),
  retreatId: z.string().uuid().nullable(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

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
  const { transactionIds, categoryId, retreatId, comment } = parsed.data;

  const supabase = await createClient();

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, type")
    .eq("id", categoryId)
    .single();
  if (categoryError || !category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (category.type === "overhead" && retreatId !== null) {
    return NextResponse.json(
      { error: "Overhead transactions cannot be coded to a retreat" },
      { status: 400 }
    );
  }
  if (category.type !== "overhead" && retreatId === null) {
    return NextResponse.json(
      { error: "Revenue/COGS transactions must be coded to a retreat" },
      { status: 400 }
    );
  }

  if (retreatId) {
    const { data: activeLock } = await supabase
      .from("retreat_locks")
      .select("id")
      .eq("retreat_id", retreatId)
      .is("unlocked_at", null)
      .maybeSingle();
    if (activeLock) {
      return NextResponse.json(
        { error: "This retreat is locked. Unlock it before coding transactions." },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("transaction_codings")
    .select("transaction_id, coded_by, coded_at")
    .in("transaction_id", transactionIds);
  const existingByTxn = new Map((existing ?? []).map((e) => [e.transaction_id, e]));

  const rows = transactionIds.map((transactionId) => {
    const prior = existingByTxn.get(transactionId);
    return {
      transaction_id: transactionId,
      category_id: categoryId,
      retreat_id: retreatId,
      comment: comment ?? null,
      coded_by: prior?.coded_by ?? authed.user.id,
      coded_at: prior?.coded_at ?? now,
      updated_by: authed.user.id,
      updated_at: now,
    };
  });

  const { data: updated, error } = await supabase
    .from("transaction_codings")
    .upsert(rows, { onConflict: "transaction_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.bulk_coded",
    entityType: "transaction",
    entityId: transactionIds[0],
    metadata: { transactionIds, categoryId, retreatId, count: transactionIds.length },
  });

  return NextResponse.json({ codings: updated });
}
