import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CategoryMonthlyAmount,
  CategoryType,
  ClientSummary,
  MonthlyPnl,
  OwnerSummary,
  PnlOverheadLine,
  PnlStatement,
  RetreatActuals,
  RetreatSummary,
} from "@/types";
import { getCategories } from "@/lib/categories";

/**
 * Derives gross profit/margin and the AllFly "ex-flights" view from the raw
 * revenue/cogs/flight_cogs sums in the retreat_actuals DB view. Revenue is
 * identical in both views — only the COGS side changes (Flights/Airfare
 * excluded) — per the confirmed AllFly behavior: Wilder collects flight
 * revenue from the client and pays the flight vendor, but margin on that
 * piece is thin, so leadership wants a "ground services only" margin too.
 */
function deriveRetreatSummary(actuals: RetreatActuals): RetreatSummary {
  const gross_profit = actuals.revenue - actuals.cogs;
  const margin = actuals.revenue !== 0 ? gross_profit / actuals.revenue : null;

  const cogs_ex_flights = actuals.cogs - actuals.flight_cogs;
  const gross_profit_ex_flights = actuals.revenue - cogs_ex_flights;
  const margin_ex_flights =
    actuals.revenue !== 0 ? gross_profit_ex_flights / actuals.revenue : null;

  return {
    ...actuals,
    gross_profit,
    margin,
    cogs_ex_flights,
    gross_profit_ex_flights,
    margin_ex_flights,
  };
}

export async function getRetreatSummary(
  supabase: SupabaseClient,
  retreatId: string
): Promise<RetreatSummary | null> {
  const { data, error } = await supabase
    .from("retreat_actuals")
    .select("*")
    .eq("retreat_id", retreatId)
    .maybeSingle();

  if (error) throw error;
  return data ? deriveRetreatSummary(data as RetreatActuals) : null;
}

export interface RetreatSummaryFilters {
  clientId?: string;
  startMonth?: string; // ISO date, inclusive
  endMonth?: string; // ISO date, inclusive
}

export async function getRetreatSummaries(
  supabase: SupabaseClient,
  filters: RetreatSummaryFilters = {}
): Promise<RetreatSummary[]> {
  let query = supabase.from("retreat_actuals").select("*");
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.startMonth) query = query.gte("retreat_month", filters.startMonth);
  if (filters.endMonth) query = query.lte("retreat_month", filters.endMonth);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => deriveRetreatSummary(row as RetreatActuals));
}

/** Rolls up all of a client's retreats into one row — cross-retreat view. */
export async function getClientSummaries(
  supabase: SupabaseClient,
  filters: { startMonth?: string; endMonth?: string } = {}
): Promise<ClientSummary[]> {
  const retreatSummaries = await getRetreatSummaries(supabase, filters);

  const { data: clients, error } = await supabase.from("clients").select("id, name");
  if (error) throw error;
  const nameById = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));

  const byClient = new Map<string, { revenue: number; cogs: number; retreatCount: number }>();
  for (const r of retreatSummaries) {
    const entry = byClient.get(r.client_id) ?? { revenue: 0, cogs: 0, retreatCount: 0 };
    entry.revenue += r.revenue;
    entry.cogs += r.cogs;
    entry.retreatCount += 1;
    byClient.set(r.client_id, entry);
  }

  return Array.from(byClient.entries())
    .map(([clientId, agg]) => {
      const gross_profit = agg.revenue - agg.cogs;
      return {
        client_id: clientId,
        client_name: nameById.get(clientId) ?? "Unknown",
        revenue: agg.revenue,
        cogs: agg.cogs,
        gross_profit,
        margin: agg.revenue !== 0 ? gross_profit / agg.revenue : null,
        retreat_count: agg.retreatCount,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Rolls up all of an ops owner's retreats into one row, broken out by the
 * retreat's own year (not posted-transaction date) -- matches how the
 * Owners page groups things, since a retreat's activity can span multiple
 * calendar years of actual bank postings but only belongs to one
 * retreat_month.
 */
export async function getOwnerSummaries(supabase: SupabaseClient): Promise<OwnerSummary[]> {
  const [retreatSummaries, retreatsResp, ownersResp] = await Promise.all([
    getRetreatSummaries(supabase),
    supabase.from("retreats").select("id, ops_owner_id, retreat_month"),
    supabase.from("ops_owners").select("id, name").eq("is_active", true),
  ]);

  const retreatMetaById = new Map(
    (retreatsResp.data ?? []).map((r) => [
      r.id as string,
      { ownerId: r.ops_owner_id as string | null, year: (r.retreat_month as string).slice(0, 4) },
    ])
  );
  const nameByOwnerId = new Map((ownersResp.data ?? []).map((o) => [o.id as string, o.name as string]));

  const byOwner = new Map<string, Map<string, { revenue: number; retreatCount: number }>>();
  for (const r of retreatSummaries) {
    const meta = retreatMetaById.get(r.retreat_id);
    if (!meta || !meta.ownerId) continue; // unassigned retreats aren't attributable to anyone
    const byYear = byOwner.get(meta.ownerId) ?? new Map();
    const entry = byYear.get(meta.year) ?? { revenue: 0, retreatCount: 0 };
    entry.revenue += r.revenue;
    entry.retreatCount += 1;
    byYear.set(meta.year, entry);
    byOwner.set(meta.ownerId, byYear);
  }

  return Array.from(byOwner.entries())
    .map(([ownerId, byYear]) => ({
      ops_owner_id: ownerId,
      owner_name: nameByOwnerId.get(ownerId) ?? "Unknown",
      byYear: Object.fromEntries(byYear),
    }))
    .sort((a, b) => a.owner_name.localeCompare(b.owner_name));
}

/**
 * Company-wide monthly P&L. Revenue/COGS roll up by `retreats.retreat_month`
 * (not the transaction's own posted date — see overhead_monthly_actuals'
 * comment in 006_views.sql for why). Overhead has no retreat to borrow a
 * month from, so it rolls up by its own posted_date month instead.
 */
export async function getMonthlyPnl(
  supabase: SupabaseClient,
  opts: { startMonth?: string; endMonth?: string } = {}
): Promise<MonthlyPnl[]> {
  let retreatQuery = supabase.from("retreat_actuals").select("retreat_month, revenue, cogs");
  if (opts.startMonth) retreatQuery = retreatQuery.gte("retreat_month", opts.startMonth);
  if (opts.endMonth) retreatQuery = retreatQuery.lte("retreat_month", opts.endMonth);
  const { data: retreatRows, error: retreatError } = await retreatQuery;
  if (retreatError) throw retreatError;

  let overheadQuery = supabase.from("overhead_monthly_actuals").select("month, amount");
  if (opts.startMonth) overheadQuery = overheadQuery.gte("month", opts.startMonth);
  if (opts.endMonth) overheadQuery = overheadQuery.lte("month", opts.endMonth);
  const { data: overheadRows, error: overheadError } = await overheadQuery;
  if (overheadError) throw overheadError;

  const byMonth = new Map<string, { revenue: number; cogs: number; overhead: number }>();

  for (const row of retreatRows ?? []) {
    const key = row.retreat_month as string;
    const entry = byMonth.get(key) ?? { revenue: 0, cogs: 0, overhead: 0 };
    entry.revenue += row.revenue as number;
    entry.cogs += row.cogs as number;
    byMonth.set(key, entry);
  }

  for (const row of overheadRows ?? []) {
    const key = row.month as string;
    const entry = byMonth.get(key) ?? { revenue: 0, cogs: 0, overhead: 0 };
    entry.overhead += row.amount as number;
    byMonth.set(key, entry);
  }

  return Array.from(byMonth.entries())
    .map(([month, agg]) => {
      const gross_profit = agg.revenue - agg.cogs;
      return {
        month,
        revenue: agg.revenue,
        cogs: agg.cogs,
        overhead: agg.overhead,
        gross_profit,
        net_income: gross_profit - agg.overhead,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Without generated Database types, supabase-js can't tell a to-one embed
 * from a to-many one and types every embedded resource as an array — but
 * PostgREST still returns a single object at runtime for a to-one FK. This
 * normalizes either shape to the object callers actually get.
 */
function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Company-wide revenue/COGS/overhead broken out by category *and* month —
 * the category-level drill-down under getMonthlyPnl's type-level totals.
 * Same month-attribution rule as getMonthlyPnl: revenue/cogs roll up by the
 * retreat's retreat_month, overhead by its own posted_date month (borrowed
 * from overhead_monthly_actuals, which already has this shape).
 */
export async function getCategoryMonthlyBreakdown(
  supabase: SupabaseClient,
  opts: { startMonth?: string; endMonth?: string } = {}
): Promise<CategoryMonthlyAmount[]> {
  let retreatQuery = supabase
    .from("transaction_codings")
    .select(
      "amount, category:categories!inner(id, name, type), retreat:retreats!inner(retreat_month), transaction:transactions!inner(is_deleted_by_source)"
    )
    .eq("transaction.is_deleted_by_source", false)
    .in("category.type", ["revenue", "cogs"]);
  if (opts.startMonth) retreatQuery = retreatQuery.gte("retreat.retreat_month", opts.startMonth);
  if (opts.endMonth) retreatQuery = retreatQuery.lte("retreat.retreat_month", opts.endMonth);
  const { data: retreatCodings, error: retreatError } = await retreatQuery;
  if (retreatError) throw retreatError;

  let overheadQuery = supabase
    .from("overhead_monthly_actuals")
    .select("month, category_id, amount");
  if (opts.startMonth) overheadQuery = overheadQuery.gte("month", opts.startMonth);
  if (opts.endMonth) overheadQuery = overheadQuery.lte("month", opts.endMonth);
  const { data: overheadRows, error: overheadError } = await overheadQuery;
  if (overheadError) throw overheadError;

  const overheadCategoryIds = Array.from(
    new Set((overheadRows ?? []).map((row) => row.category_id as string))
  );
  const { data: overheadCategories, error: overheadCategoriesError } = overheadCategoryIds.length
    ? await supabase.from("categories").select("id, name").in("id", overheadCategoryIds)
    : { data: [] as { id: string; name: string }[], error: null };
  if (overheadCategoriesError) throw overheadCategoriesError;
  const overheadCategoryNameById = new Map(
    (overheadCategories ?? []).map((c) => [c.id as string, c.name as string])
  );

  const byKey = new Map<string, CategoryMonthlyAmount>();
  function add(month: string, categoryId: string, categoryName: string, categoryType: CategoryType, delta: number) {
    const key = `${month}:${categoryId}`;
    const entry = byKey.get(key) ?? {
      category_id: categoryId,
      category_name: categoryName,
      category_type: categoryType,
      month,
      amount: 0,
    };
    entry.amount += delta;
    byKey.set(key, entry);
  }

  for (const row of retreatCodings ?? []) {
    const category = embedOne<{ id: string; name: string; type: CategoryType }>(row.category);
    const retreat = embedOne<{ retreat_month: string }>(row.retreat);
    if (!category || !retreat) continue;
    const sign = category.type === "revenue" ? 1 : -1;
    add(retreat.retreat_month, category.id, category.name, category.type, sign * (row.amount as number));
  }

  for (const row of overheadRows ?? []) {
    const categoryId = row.category_id as string;
    add(
      row.month as string,
      categoryId,
      overheadCategoryNameById.get(categoryId) ?? "Unknown",
      "overhead",
      row.amount as number
    );
  }

  return Array.from(byKey.values()).sort(
    (a, b) => a.month.localeCompare(b.month) || a.category_name.localeCompare(b.category_name)
  );
}

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

/** Every first-of-month ISO date from startMonth to endMonth, inclusive. */
function enumerateMonths(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  const cursor = new Date(startMonth + "T00:00:00Z");
  const end = new Date(endMonth + "T00:00:00Z");
  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

/**
 * Company-wide P&L statement across a range of months: Revenue - COGS =
 * Operating Profit up top, then every active overhead category (parent/child,
 * per `sort_order` -- a P&L's line items stay in a fixed order, not resorted
 * by size each period) subtracted down to Net Income, every row broken out
 * by month. Every active overhead category appears even at $0 for every
 * month, so a newly-added one shows up immediately.
 */
export async function getPnlStatement(
  supabase: SupabaseClient,
  opts: { startMonth: string; endMonth: string }
): Promise<PnlStatement> {
  const months = enumerateMonths(opts.startMonth, opts.endMonth);

  const [monthlyTotals, overheadCategories, overheadRowsResp] = await Promise.all([
    getMonthlyPnl(supabase, opts),
    getCategories(supabase, { type: "overhead" }),
    supabase
      .from("overhead_monthly_actuals")
      .select("month, category_id, amount")
      .gte("month", opts.startMonth)
      .lte("month", opts.endMonth),
  ]);
  if (overheadRowsResp.error) throw overheadRowsResp.error;

  const monthlyByMonth = new Map(monthlyTotals.map((m) => [m.month, m]));
  const revenueByMonth: Record<string, number> = {};
  const cogsByMonth: Record<string, number> = {};
  const operatingProfitByMonth: Record<string, number> = {};
  for (const month of months) {
    const m = monthlyByMonth.get(month);
    const rev = m?.revenue ?? 0;
    const cogsAmt = m?.cogs ?? 0;
    revenueByMonth[month] = rev;
    cogsByMonth[month] = cogsAmt;
    operatingProfitByMonth[month] = rev - cogsAmt;
  }
  const revenue = sumValues(revenueByMonth);
  const cogs = sumValues(cogsByMonth);
  const operating_profit = revenue - cogs;

  const amountByCategoryMonth = new Map<string, number>();
  for (const row of overheadRowsResp.data ?? []) {
    amountByCategoryMonth.set(`${row.category_id}:${row.month}`, row.amount as number);
  }
  function amountsFor(categoryId: string): Record<string, number> {
    const byMonth: Record<string, number> = {};
    for (const month of months) {
      byMonth[month] = amountByCategoryMonth.get(`${categoryId}:${month}`) ?? 0;
    }
    return byMonth;
  }
  function sumByMonth(rows: Record<string, number>[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const month of months) result[month] = rows.reduce((sum, r) => sum + r[month], 0);
    return result;
  }

  const childrenByParent = new Map<string, typeof overheadCategories>();
  for (const c of overheadCategories) {
    if (!c.parent_id) continue;
    if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
    childrenByParent.get(c.parent_id)!.push(c);
  }

  const overhead: PnlOverheadLine[] = overheadCategories
    .filter((c) => c.parent_id === null)
    .map((parent) => {
      const children = (childrenByParent.get(parent.id) ?? []).map((child) => {
        const byMonth = amountsFor(child.id);
        return { id: child.id, name: child.name, byMonth, total: sumValues(byMonth) };
      });
      // A transaction can be coded directly to the parent category itself.
      const ownByMonth = amountsFor(parent.id);
      const byMonth = sumByMonth([ownByMonth, ...children.map((c) => c.byMonth)]);
      return { id: parent.id, name: parent.name, byMonth, total: sumValues(byMonth), children };
    });

  const overheadTotalByMonth = sumByMonth(overhead.map((l) => l.byMonth));
  const overhead_total = sumValues(overheadTotalByMonth);

  const netIncomeByMonth: Record<string, number> = {};
  for (const month of months) {
    netIncomeByMonth[month] = operatingProfitByMonth[month] - overheadTotalByMonth[month];
  }
  const net_income = operating_profit - overhead_total;

  return {
    startMonth: opts.startMonth,
    endMonth: opts.endMonth,
    months,
    revenueByMonth,
    cogsByMonth,
    operatingProfitByMonth,
    revenue,
    cogs,
    operating_profit,
    overhead,
    overheadTotalByMonth,
    overhead_total,
    netIncomeByMonth,
    net_income,
  };
}
