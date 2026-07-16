import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

const splitSchema = z.object({
  categoryId: z.string().uuid(),
  retreatId: z.string().uuid().nullable(),
  amount: z.number().refine((n) => n !== 0, "Amount must be non-zero"),
  comment: z.string().trim().max(2000).nullable().optional(),
});

const codingSchema = z.object({
  splits: z.array(splitSchema).min(1).max(20),
});

/** Integer-cents helper so float rounding never blocks a true-zero sum check. */
function toCents(n: number): number {
  return Math.round(n * 100);
}

/**
 * Sets or replaces a transaction's coding -- one or more splits, each with
 * its own category/retreat/amount, that together must sum exactly to the
 * transaction's total amount (see migration 014's deferred sum-check
 * trigger, which backs this endpoint's own pre-check as defense-in-depth).
 * Explicit sub-resource rather than a PATCH on the transaction row, since
 * coding is a distinct decision layered on top of the raw ledger fact (see
 * transaction_codings' rationale in 003_transactions_and_coding.sql).
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
  const { splits } = parsed.data;

  const supabase = await createClient();

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id, amount")
    .eq("id", transactionId)
    .single();
  if (transactionError || !transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const categoryIds = [...new Set(splits.map((s) => s.categoryId))];
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, type")
    .in("id", categoryIds);
  if (categoriesError) {
    return NextResponse.json({ error: categoriesError.message }, { status: 400 });
  }
  const categoryTypeById = new Map((categories ?? []).map((c) => [c.id, c.type]));

  // Per-split, since a single transaction can legitimately have one overhead
  // split and one revenue/cogs split at once -- this is never one top-level
  // check, the DB trigger it mirrors only ever validated a single row.
  for (const split of splits) {
    const type = categoryTypeById.get(split.categoryId);
    if (!type) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (type === "overhead" && split.retreatId !== null) {
      return NextResponse.json(
        { error: "Overhead splits cannot be coded to a retreat" },
        { status: 400 }
      );
    }
    if (type !== "overhead" && split.retreatId === null) {
      return NextResponse.json(
        { error: "Revenue/COGS splits must be coded to a retreat" },
        { status: 400 }
      );
    }
  }

  const splitCents = splits.reduce((sum, s) => sum + toCents(s.amount), 0);
  if (splitCents !== toCents(transaction.amount)) {
    return NextResponse.json(
      {
        error: `Splits sum to $${(splitCents / 100).toFixed(2)} but the transaction total is $${transaction.amount.toFixed(2)}`,
      },
      { status: 400 }
    );
  }

  // Friendly pre-check ahead of the DB's own defense-in-depth trigger, so a
  // locked retreat surfaces as a clear 409 instead of a raw Postgres error.
  const retreatIds = [...new Set(splits.map((s) => s.retreatId).filter((id): id is string => !!id))];
  if (retreatIds.length > 0) {
    const { data: activeLocks } = await supabase
      .from("retreat_locks")
      .select("retreat_id")
      .in("retreat_id", retreatIds)
      .is("unlocked_at", null);
    if (activeLocks && activeLocks.length > 0) {
      const { data: lockedRetreats } = await supabase
        .from("retreats")
        .select("name")
        .in("id", activeLocks.map((l) => l.retreat_id));
      const names = (lockedRetreats ?? []).map((r) => r.name).join(", ");
      return NextResponse.json(
        { error: `These retreats are locked: ${names}. Unlock them before coding transactions.` },
        { status: 409 }
      );
    }
  }

  const { data: existingCodings } = await supabase
    .from("transaction_codings")
    .select("*")
    .eq("transaction_id", transactionId);

  const { data: updated, error: rpcError } = await supabase.rpc("replace_transaction_codings", {
    p_transaction_id: transactionId,
    p_splits: splits.map((s) => ({
      category_id: s.categoryId,
      retreat_id: s.retreatId,
      amount: s.amount,
      comment: s.comment ?? null,
    })),
    p_actor_id: authed.user.id,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: authed.user.id,
    action: existingCodings && existingCodings.length > 0 ? "transaction.recoded" : "transaction.coded",
    entityType: "transaction",
    entityId: transactionId,
    before: existingCodings && existingCodings.length > 0 ? existingCodings : null,
    after: updated,
    metadata: { splitCount: splits.length },
  });

  return NextResponse.json({ codings: updated });
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

  const { data: existingCodings } = await supabase
    .from("transaction_codings")
    .select("*")
    .eq("transaction_id", transactionId);

  if (!existingCodings || existingCodings.length === 0) {
    return NextResponse.json({ ok: true });
  }

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
    before: existingCodings,
  });

  return NextResponse.json({ ok: true });
}
