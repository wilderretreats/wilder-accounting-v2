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

  // Bulk-code always applies one category/retreat at 100% of each
  // transaction's own amount -- replace_transaction_codings_bulk resets each
  // target transaction (including any that were previously split) back to a
  // single coding row, preserving each one's original coded_by/coded_at.
  const { data: updated, error } = await supabase.rpc("replace_transaction_codings_bulk", {
    p_transaction_ids: transactionIds,
    p_category_id: categoryId,
    p_retreat_id: retreatId,
    p_comment: comment ?? null,
    p_actor_id: authed.user.id,
  });

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
