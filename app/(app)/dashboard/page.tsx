import { createClient } from "@/lib/supabase/server";
import { getMonthlyPnl } from "@/lib/reports/queries";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const monthlyPnl = await getMonthlyPnl(supabase, { startMonth: yearStart });

  const ytd = monthlyPnl.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cogs: acc.cogs + m.cogs,
      overhead: acc.overhead + m.overhead,
      net_income: acc.net_income + m.net_income,
    }),
    { revenue: 0, cogs: 0, overhead: 0, net_income: 0 }
  );
  const grossProfit = ytd.revenue - ytd.cogs;
  const margin = ytd.revenue !== 0 ? grossProfit / ytd.revenue : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Revenue YTD" value={formatCurrency(ytd.revenue)} />
        <StatCard label="Gross Profit YTD" value={formatCurrency(grossProfit)} />
        <StatCard label="Margin YTD" value={formatPercent(margin)} />
        <StatCard label="Net Income YTD" value={formatCurrency(ytd.net_income)} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Monthly trend</h2>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Revenue</th>
                <th className="pb-2 pr-4 text-right">COGS</th>
                <th className="pb-2 pr-4 text-right">Gross Profit</th>
                <th className="pb-2 pr-4 text-right">Overhead</th>
                <th className="pb-2 text-right">Net Income</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPnl.map((m) => (
                <tr key={m.month} className="border-t border-zinc-100">
                  <td className="py-2 pr-4">{formatMonth(m.month)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(m.revenue)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(m.cogs)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(m.gross_profit)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(m.overhead)}</td>
                  <td className="py-2 text-right">{formatCurrency(m.net_income)}</td>
                </tr>
              ))}
              {monthlyPnl.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-400">
                    No coded transactions yet this year.
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
