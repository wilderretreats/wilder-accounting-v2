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
  // 'cogs' (default) is the shared revenue/COGS workspace; 'overhead' is its
  // own separate list -- these never overlap, by construction of the filter.
  const scope = url.searchParams.get("scope") === "overhead" ? "overhead" : "cogs";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 1000);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const supabase = await createClient();

  // coded/uncoded filters on transactions.is_coded, a trigger-maintained
  // flag (migration 018) kept in sync with transaction_codings -- plain
  // indexed boolean, filterable directly and applied *before* .range() below
  // so pagination reflects the real filtered count. An earlier version of
  // this resolved matching transaction ids via a separate query and passed
  // them through .in()/.not("id","in",...); with enough coded transactions
  // that id list blew past the URL length Supabase-js's GET request can
  // carry and the whole request 400'd -- silently rendered by the client as
  // "no transactions match these filters." retreatId's id list stays small
  // (bounded by one retreat's transaction count) so it keeps the same
  // pre-.range() id-list approach.
  const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

  let query = supabase
    .from("transactions")
    .select(TRANSACTION_WITH_CODING_SELECT)
    .eq("is_deleted_by_source", false)
    .eq("is_overhead", scope === "overhead")
    .order("posted_date", { ascending: false });

  if (source) query = query.eq("source", source);
  if (account) query = query.eq("account_label", account);
  if (startDate) query = query.gte("posted_date", startDate);
  if (endDate) query = query.lte("posted_date", endDate);
  if (search) query = query.ilike("description", `%${search}%`);
  if (coded === "uncoded") query = query.eq("is_coded", false);
  if (coded === "coded") query = query.eq("is_coded", true);

  if (retreatId) {
    const { data, error } = await supabase
      .from("transaction_codings")
      .select("transaction_id")
      .eq("retreat_id", retreatId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const ids = Array.from(new Set((data ?? []).map((r) => r.transaction_id as string)));
    query = query.in("id", ids.length > 0 ? ids : [NO_MATCH_ID]);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const shaped = ((data ?? []) as RawTransactionWithCodings[]).map(shapeTransactionWithCoding);

  return NextResponse.json({ transactions: shaped });
}

const manualTransactionSchema = z.object({
  postedDate: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  accountLabel: z.string().optional(),
  pending: z.boolean().optional(),
  isOverhead: z.boolean().optional(),
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
      is_overhead: parsed.data.isOverhead ?? false,
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
