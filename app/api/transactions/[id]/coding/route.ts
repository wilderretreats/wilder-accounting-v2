import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

const codingSchema = z.object({
  categoryId: z.string().uuid(),
  retreatId: z.string().uuid().nullable(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Sets or updates a transaction's coding. Explicit sub-resource rather than
 * a PATCH on the transaction row, since coding is a distinct decision layered
 * on top of the raw ledger fact (see transaction_codings' rationale in
 * 003_transactions_and_coding.sql).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: transactionId } = await params;
  const parsed = codingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { categoryId, retreatId, comment } = parsed.data;

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

  // Friendly pre-check ahead of the DB's own defense-in-depth trigger, so a
  // locked retreat surfaces as a clear 409 instead of a raw Postgres error.
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

  const { data: existingCoding } = await supabase
    .from("transaction_codings")
    .select("*")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data: updated, error: upsertError } = await supabase
    .from("transaction_codings")
    .upsert(
      {
        transaction_id: transactionId,
        category_id: categoryId,
        retreat_id: retreatId,
        comment: comment ?? null,
        coded_by: existingCoding?.coded_by ?? authed.user.id,
        coded_at: existingCoding?.coded_at ?? now,
        updated_by: authed.user.id,
        updated_at: now,
      },
      { onConflict: "transaction_id" }
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: authed.user.id,
    action: existingCoding ? "transaction.recoded" : "transaction.coded",
    entityType: "transaction",
    entityId: transactionId,
    before: existingCoding ?? null,
    after: updated,
  });

  return NextResponse.json({ coding: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: transactionId } = await params;
  const supabase = await createClient();

  const { data: existingCoding } = await supabase
    .from("transaction_codings")
    .select("*")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (!existingCoding) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("transaction_codings")
    .delete()
    .eq("transaction_id", transactionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.uncoded",
    entityType: "transaction",
    entityId: transactionId,
    before: existingCoding,
  });

  return NextResponse.json({ ok: true });
}
