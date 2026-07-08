import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientSummaries } from "@/lib/reports/queries";
import { AddClientButton } from "./AddClientButton";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: clients }, summaries] = await Promise.all([
    supabase.from("clients").select("*").eq("is_active", true).order("name"),
    getClientSummaries(supabase),
  ]);

  const summaryByClientId = new Map(summaries.map((s) => [s.client_id, s]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Clients</h1>
        <AddClientButton />
      </div>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4 text-right">Retreats</th>
                <th className="pb-2 pr-4 text-right">Revenue (all-time)</th>
                <th className="pb-2 pr-4 text-right">Gross Profit</th>
                <th className="pb-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((c) => {
                const s = summaryByClientId.get(c.id);
                return (
                  <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="py-2 pr-4">
                      <Link href={`/clients/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right">{s?.retreat_count ?? 0}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(s?.revenue ?? 0)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(s?.gross_profit ?? 0)}</td>
                    <td className="py-2 text-right">{formatPercent(s?.margin ?? null)}</td>
                  </tr>
                );
              })}
              {(clients ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-400">
                    No clients yet.
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
