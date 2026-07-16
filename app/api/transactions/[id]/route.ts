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
  })
  .refine(
    (v) => v.description !== undefined || v.accountLabel !== undefined || v.pending !== undefined,
    { message: "Nothing to update" }
  );

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

  const supabase = await createClient();
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
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // Ops can only delete transactions they (or a teammate) entered by hand --
  // admin keeps unrestricted delete, including over real bank-fed data.
  if (authed.profile.role === "ops") {
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
