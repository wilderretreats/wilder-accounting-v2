import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TRANSACTION_WITH_CODING_SELECT = `
  *,
  coding:transaction_codings(
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
  if (startDate) query = query.gte("posted_date", startDate);
  if (endDate) query = query.lte("posted_date", endDate);
  if (search) query = query.ilike("description", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // coded/uncoded and retreatId filters applied post-query: the coding join
  // above is a to-one relationship represented as an array by supabase-js,
  // and filtering an outer-joined relationship's presence isn't expressible
  // through the query builder without a second round trip.
  let rows = data ?? [];
  if (coded === "uncoded") {
    rows = rows.filter((r) => !r.coding || r.coding.length === 0);
  } else if (coded === "coded") {
    rows = rows.filter((r) => r.coding && r.coding.length > 0);
  }
  if (retreatId) {
    rows = rows.filter((r) => r.coding?.[0]?.retreat_id === retreatId);
  }

  // TransactionWithCoding's contract puts category/retreat at the top level
  // (see types/index.ts) so list views don't need to reach through
  // coding?.category — flatten them here rather than leaving every consumer
  // to do it, which is how this silently broke: three different call sites
  // read t.category/t.retreat directly and all quietly got `undefined`.
  const shaped = rows.map((r) => {
    const coding = r.coding?.[0] ?? null;
    return {
      ...r,
      coding,
      category: coding?.category ?? null,
      retreat: coding?.retreat ?? null,
    };
  });

  return NextResponse.json({ transactions: shaped });
}

const manualTransactionSchema = z.object({
  postedDate: z.string(),
  description: z.string().min(1),
  amount: z.number(),
  accountLabel: z.string().optional(),
});

export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ transaction: data }, { status: 201 });
}
