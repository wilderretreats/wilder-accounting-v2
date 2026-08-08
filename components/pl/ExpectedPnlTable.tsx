"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMonth } from "@/lib/utils";
import type { ExpectedRetreatFinancials } from "@/types";

export function ExpectedPnlTable({ startMonth, endMonth }: { startMonth: string; endMonth: string }) {
  const [retreats, setRetreats] = useState<ExpectedRetreatFinancials[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ startMonth, endMonth });
    fetch(`/api/pl/expected?${params}`)
      .then((r) => r.json())
      .then((d) => setRetreats(d.retreats ?? []))
      .finally(() => setLoading(false));
  }, [startMonth, endMonth]);

  const totals = retreats.reduce(
    (acc, r) => ({
      contract_value: acc.contract_value + (r.contract_value ?? 0),
      contract_profit: acc.contract_profit + (r.contract_profit ?? 0),
      final_revenue: acc.final_revenue + r.final_revenue,
      final_profit: acc.final_profit + r.final_profit,
    }),
    { contract_value: 0, contract_profit: 0, final_revenue: 0, final_profit: 0 }
  );

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <p className="mb-3 text-xs text-zinc-500">
          Audited retreats show actual coded revenue/profit. Ongoing retreats show their contracted
          figures as a forecast.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-2 pr-4">Client</th>
              <th className="pb-2 pr-4">Retreat</th>
              <th className="pb-2 pr-4">Month</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4 text-right">Passengers</th>
              <th className="pb-2 pr-4 text-right">Revenue</th>
              <th className="pb-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {retreats.map((r) => (
              <tr key={r.retreat_id} className="border-t border-zinc-100">
                <td className="py-2 pr-4 text-zinc-700">{r.client_name}</td>
                <td className="py-2 pr-4">
                  <Link href={`/retreats/${r.retreat_id}`} className="text-zinc-900 hover:underline">
                    {r.retreat_name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-zinc-600">{formatMonth(r.retreat_month)}</td>
                <td className="py-2 pr-4">
                  <Badge tone={r.status === "audited" ? "green" : "neutral"}>
                    {r.status === "audited" ? "Audited" : "Ongoing"}
                  </Badge>
                </td>
                <td className="py-2 pr-4 text-right text-zinc-600">{r.passenger_count ?? "—"}</td>
                <td className="py-2 pr-4 text-right font-medium text-emerald-700">
                  {formatCurrency(r.final_revenue)}
                </td>
                <td className="py-2 text-right font-medium text-emerald-700">
                  {formatCurrency(r.final_profit)}
                </td>
              </tr>
            ))}
            {retreats.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-zinc-400">
                  No retreats in this period.
                </td>
              </tr>
            )}
          </tbody>
          {retreats.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 font-semibold text-zinc-900">
                <td colSpan={5} className="py-2 pr-4">
                  Total
                </td>
                <td className="py-2 pr-4 text-right">{formatCurrency(totals.final_revenue)}</td>
                <td className="py-2 text-right">{formatCurrency(totals.final_profit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </CardBody>
    </Card>
  );
}
