import { createClient } from "@/lib/supabase/server";
import { getRetreatSummaries } from "@/lib/reports/queries";
import { AddRetreatButton } from "./AddRetreatButton";
import { Card, CardBody } from "@/components/ui/card";
import { RetreatsTable, type RetreatRow } from "@/components/retreats/RetreatsTable";

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

  const rows: RetreatRow[] = (retreats ?? []).map((r) => {
    const s = summaryByRetreatId.get(r.id);
    return {
      id: r.id,
      name: r.name,
      retreat_month: r.retreat_month,
      status: r.status,
      client_name: r.client?.name ?? null,
      owner_name: r.ops_owner?.name ?? null,
      revenue: s?.revenue ?? 0,
      gross_profit: s?.gross_profit ?? 0,
      margin: s?.margin ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Retreats</h1>
        <AddRetreatButton />
      </div>

      <Card>
        <CardBody>
          <RetreatsTable rows={rows} />
        </CardBody>
      </Card>
    </div>
  );
}
