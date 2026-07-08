import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRetreatSummaries } from "@/lib/reports/queries";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clientRow } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!clientRow) notFound();

  const retreatSummaries = await getRetreatSummaries(supabase, { clientId: id });

  const totals = retreatSummaries.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, cogs: acc.cogs + r.cogs }),
    { revenue: 0, cogs: 0 }
  );
  const grossProfit = totals.revenue - totals.cogs;
  const margin = totals.revenue !== 0 ? grossProfit / totals.revenue : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">{clientRow.name}</h1>
        {clientRow.notes && <p className="mt-1 text-sm text-zinc-500">{clientRow.notes}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Retreats" value={String(retreatSummaries.length)} />
        <StatCard label="Total Revenue" value={formatCurrency(totals.revenue)} />
        <StatCard label="Gross Profit" value={formatCurrency(grossProfit)} />
        <StatCard label="Margin" value={formatPercent(margin)} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Retreats</h2>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Retreat</th>
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Revenue</th>
                <th className="pb-2 pr-4 text-right">Gross Profit</th>
                <th className="pb-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {retreatSummaries.map((r) => (
                <tr key={r.retreat_id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 pr-4">
                    <Link href={`/retreats/${r.retreat_id}`} className="font-medium text-zinc-900 hover:underline">
                      Retreat
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-zinc-600">{formatMonth(r.retreat_month)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(r.revenue)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(r.gross_profit)}</td>
                  <td className="py-2 text-right">{formatPercent(r.margin)}</td>
                </tr>
              ))}
              {retreatSummaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-400">
                    No retreats yet for this client. <Link href="/retreats" className="underline">Add one</Link>.
                  </td>
                </tr>
              )}
            </tbody>
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
