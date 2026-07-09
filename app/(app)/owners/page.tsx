import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerSummaries } from "@/lib/reports/queries";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const YEARS = ["2025", "2026", "2027"];

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
                {YEARS.map((year) => (
                  <th key={`${year}-retreats`} className="pb-2 pr-4 text-right">
                    {year} Retreats
                  </th>
                ))}
                {YEARS.map((year) => (
                  <th key={`${year}-revenue`} className="pb-2 pr-4 text-right">
                    {year} Revenue
                  </th>
                ))}
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
                    {YEARS.map((year) => (
                      <td key={`${year}-retreats`} className="py-2 pr-4 text-right">
                        {s?.byYear[year]?.retreatCount ?? 0}
                      </td>
                    ))}
                    {YEARS.map((year) => (
                      <td key={`${year}-revenue`} className="py-2 pr-4 text-right">
                        {formatCurrency(s?.byYear[year]?.revenue ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {(owners ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-400">
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
