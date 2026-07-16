import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { shapeTransactionWithCoding, type RawTransactionWithCodings } from "@/lib/transactions/shape";

const TRANSACTION_WITH_CODING_SELECT = `
  *,
  codings:transaction_codings(
    *,
    category:categories(*),
    retreat:retreats(*, client:clients(name), ops_owner:ops_owners(name))
  )
`;

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const coded = url.searchParams.get("coded"); // 'coded' | 'uncoded' | null (all)
  const source = url.searchParams.get("source");
  const account = url.searchParams.get("account");
  const retreatId = url.searchParams.get("retreatId");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const search = url.searchParams.get("search");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select(TRANSACTION_WITH_CODING_SELECT)
    .eq("is_deleted_by_source", false)
    .order("posted_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (source) query = query.eq("source", source);
  if (account) query = query.eq("account_label", account);
  if (startDate) query = query.gte("posted_date", startDate);
  if (endDate) query = query.lte("posted_date", endDate);
  if (search) query = query.ilike("description", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // coded/uncoded and retreatId filters applied post-query: filtering an
  // outer-joined relationship's presence isn't expressible through the query
  // builder without a second round trip.
  //
  // transaction_codings.transaction_id is no longer that table's primary key
  // (see migration 014 -- a transaction can be split across multiple coding
  // rows), so PostgREST returns `codings` as an array. A transaction split
  // across two retreats matches the retreatId filter under either retreat,
  // which is the correct behavior -- each split row is an independent fact.
  let rows = (data ?? []) as RawTransactionWithCodings[];
  if (coded === "uncoded") {
    rows = rows.filter((r) => (r.codings ?? []).length === 0);
  } else if (coded === "coded") {
    rows = rows.filter((r) => (r.codings ?? []).length > 0);
  }
  if (retreatId) {
    rows = rows.filter((r) => (r.codings ?? []).some((c) => c.retreat_id === retreatId));
  }

  const shaped = rows.map(shapeTransactionWithCoding);

  return NextResponse.json({ transactions: shaped });
}

const manualTransactionSchema = z.object({
  postedDate: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  accountLabel: z.string().optional(),
  pending: z.boolean().optional(),
});

export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = manualTransactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      source: "manual",
      posted_date: parsed.data.postedDate,
      description: parsed.data.description,
      amount: parsed.data.amount,
      account_label: parsed.data.accountLabel ?? null,
      pending: parsed.data.pending ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.created",
    entityType: "transaction",
    entityId: data.id,
    after: data,
  });

  return NextResponse.json({ transaction: data }, { status: 201 });
}
