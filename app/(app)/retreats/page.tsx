import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRetreatSummaries } from "@/lib/reports/queries";
import { AddRetreatButton } from "./AddRetreatButton";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/utils";
import type { RetreatStatus } from "@/types";

const STATUS_TONE: Record<RetreatStatus, "neutral" | "blue" | "green" | "red"> = {
  upcoming: "neutral",
  in_progress: "blue",
  completed: "green",
  cancelled: "red",
};

export default async function RetreatsPage() {
  const supabase = await createClient();

  const [{ data: retreats }, summaries] = await Promise.all([
    supabase
      .from("retreats")
      .select("*, client:clients(name), ops_owner:ops_owners(name)")
      .order("retreat_month", { ascending: false }),
    getRetreatSummaries(supabase),
  ]);

  const summaryByRetreatId = new Map(summaries.map((s) => [s.retreat_id, s]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Retreats</h1>
        <AddRetreatButton />
      </div>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Retreat</th>
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4">Owner</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4 text-right">Revenue</th>
                <th className="pb-2 pr-4 text-right">Gross Profit</th>
                <th className="pb-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(retreats ?? []).map((r) => {
                const s = summaryByRetreatId.get(r.id);
                return (
                  <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="py-2 pr-4 text-zinc-600">{r.client?.name}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/retreats/${r.id}`} className="font-medium text-zinc-900 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{formatMonth(r.retreat_month)}</td>
                    <td className="py-2 pr-4 text-zinc-600">{r.ops_owner?.name ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={STATUS_TONE[r.status as RetreatStatus]}>{r.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(s?.revenue ?? 0)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(s?.gross_profit ?? 0)}</td>
                    <td className="py-2 text-right">{formatPercent(s?.margin ?? null)}</td>
                  </tr>
                );
              })}
              {(retreats ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-zinc-400">
                    No retreats yet.
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
