import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerSummaries } from "@/lib/reports/queries";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function OwnersPage() {
  const supabase = await createClient();

  const [{ data: owners }, summaries] = await Promise.all([
    supabase.from("ops_owners").select("*").eq("is_active", true).order("name"),
    getOwnerSummaries(supabase),
  ]);

  const summaryByOwnerId = new Map(summaries.map((s) => [s.ops_owner_id, s]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Owners</h1>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Owner</th>
                <th className="pb-2 pr-4 text-right">Retreats</th>
                <th className="pb-2 pr-4 text-right">Revenue (all-time)</th>
                <th className="pb-2 pr-4 text-right">Gross Profit</th>
                <th className="pb-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(owners ?? []).map((o) => {
                const s = summaryByOwnerId.get(o.id);
                return (
                  <tr key={o.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="py-2 pr-4">
                      <Link href={`/owners/${o.id}`} className="font-medium text-zinc-900 hover:underline">
                        {o.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right">{s?.retreat_count ?? 0}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(s?.revenue ?? 0)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(s?.gross_profit ?? 0)}</td>
                    <td className="py-2 text-right">{formatPercent(s?.margin ?? null)}</td>
                  </tr>
                );
              })}
              {(owners ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-400">
                    No owners yet — assign one from a retreat&apos;s detail page.
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
