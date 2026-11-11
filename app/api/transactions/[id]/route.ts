import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { shapeTransactionWithCoding, type RawTransactionWithCodings } from "@/lib/transactions/shape";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, codings:transaction_codings(*, category:categories(*), retreat:retreats(*))")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // transaction_codings.transaction_id is no longer that table's primary
  // key (see migration 014), so PostgREST returns `codings` as an array.
  return NextResponse.json({ transaction: shapeTransactionWithCoding(data as RawTransactionWithCodings) });
}

const patchSchema = z
  .object({
    description: z.string().min(1).optional(),
    accountLabel: z.string().trim().min(1).max(100).nullable().optional(),
    pending: z.boolean().optional(),
    /** Manual transactions only -- see edit_manual_transaction (migration 022). */
    postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    amount: z
      .number()
      .finite()
      .refine((n) => n !== 0, "Amount can't be zero")
      .optional(),
  })
  .refine(
    (v) =>
      v.description !== undefined ||
      v.accountLabel !== undefined ||
      v.pending !== undefined ||
      v.postedDate !== undefined ||
      v.amount !== undefined,
    { message: "Nothing to update" }
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops", "ops_manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();

  // Date/amount edits go through one RPC so a coded transaction's coding
  // amount moves with it atomically (codings must always sum to the
  // transaction amount). The RPC also enforces manual-only and the
  // locked-retreat rule.
  if (parsed.data.postedDate !== undefined || parsed.data.amount !== undefined) {
    if (parsed.data.accountLabel !== undefined || parsed.data.pending !== undefined) {
      return NextResponse.json(
        { error: "Edit date/amount separately from account or pending" },
        { status: 400 }
      );
    }

    const { data: before } = await supabase
      .from("transactions")
      .select("description, posted_date, amount")
      .eq("id", id)
      .single();

    const { data, error } = await supabase.rpc("edit_manual_transaction", {
      p_transaction_id: id,
      p_description: parsed.data.description ?? null,
      p_posted_date: parsed.data.postedDate ?? null,
      p_amount: parsed.data.amount !== undefined ? Math.round(parsed.data.amount * 100) / 100 : null,
      p_actor_id: authed.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await writeAuditLog({
      actorId: authed.user.id,
      action: "transaction.edited",
      entityType: "transaction",
      entityId: id,
      before,
      after: {
        description: data.description,
        posted_date: data.posted_date,
        amount: data.amount,
      },
    });

    return NextResponse.json({ transaction: data });
  }

  const { data: before } = await supabase
    .from("transactions")
    .select("description, account_label, pending")
    .eq("id", id)
    .single();

  const update: { description?: string; account_label?: string | null; pending?: boolean } = {};
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.accountLabel !== undefined) update.account_label = parsed.data.accountLabel;
  if (parsed.data.pending !== undefined) update.pending = parsed.data.pending;

  const { data, error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.edited",
    entityType: "transaction",
    entityId: id,
    before,
    after: update,
  });

  return NextResponse.json({ transaction: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops", "ops_manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // Ops/ops_manager can only delete transactions they (or a teammate)
  // entered by hand -- admin keeps unrestricted delete, including over real
  // bank-fed data.
  if (authed.profile.role === "ops" || authed.profile.role === "ops_manager") {
    const { data: existing } = await supabase
      .from("transactions")
      .select("source")
      .eq("id", id)
      .single();
    if (existing?.source !== "manual") {
      return NextResponse.json(
        { error: "Ops can only delete manually-entered transactions" },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({ is_deleted_by_source: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.deleted",
    entityType: "transaction",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
