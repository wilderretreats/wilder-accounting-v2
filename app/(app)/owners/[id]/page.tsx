import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRetreatSummaries } from "@/lib/reports/queries";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/utils";

export default async function OwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: owner }, { data: retreats }, allSummaries] = await Promise.all([
    supabase.from("ops_owners").select("*").eq("id", id).single(),
    supabase
      .from("retreats")
      .select("id, name, retreat_month, client:clients(name)")
      .eq("ops_owner_id", id)
      .order("retreat_month", { ascending: false }),
    getRetreatSummaries(supabase),
  ]);

  if (!owner) notFound();

  const summaryByRetreatId = new Map(allSummaries.map((s) => [s.retreat_id, s]));
  const rows = (retreats ?? []).map((r) => {
    // Supabase's loose typing for embedded-select strings infers this
    // particular query shape as an array even though it's a standard
    // to-one FK join (retreats.client_id -> clients.id) that returns a
    // plain object at runtime -- normalize defensively either way.
    const client = Array.isArray(r.client) ? r.client[0] : r.client;
    return {
      ...r,
      client,
      summary: summaryByRetreatId.get(r.id) ?? null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.summary?.revenue ?? 0),
      cogs: acc.cogs + (r.summary?.cogs ?? 0),
    }),
    { revenue: 0, cogs: 0 }
  );
  const grossProfit = totals.revenue - totals.cogs;
  const margin = totals.revenue !== 0 ? grossProfit / totals.revenue : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">{owner.name}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Retreats" value={String(rows.length)} />
        <StatCard label="Total Revenue" value={formatCurrency(totals.revenue)} />
        <StatCard label="Gross Profit" value={formatCurrency(grossProfit)} />
        <StatCard label="Margin" value={formatPercent(margin)} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Retreats managed</h2>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Retreat</th>
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Revenue</th>
                <th className="pb-2 pr-4 text-right">Gross Profit</th>
                <th className="pb-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 pr-4 text-zinc-600">{r.client?.name ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <Link href={`/retreats/${r.id}`} className="font-medium text-zinc-900 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-zinc-600">{formatMonth(r.retreat_month)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(r.summary?.revenue ?? 0)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(r.summary?.gross_profit ?? 0)}</td>
                  <td className="py-2 text-right">{formatPercent(r.summary?.margin ?? null)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-400">
                    No retreats assigned to this owner yet.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-200 font-semibold text-zinc-900">
                  <td className="py-2 pr-4" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(totals.revenue)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(grossProfit)}</td>
                  <td className="py-2 text-right">{formatPercent(margin)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
      </CardBody>
    </Card>
  );
}
