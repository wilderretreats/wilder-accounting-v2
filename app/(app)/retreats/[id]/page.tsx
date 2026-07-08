import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRetreatSummary } from "@/lib/reports/queries";
import { RetreatSummaryCard } from "@/components/retreats/RetreatSummaryCard";
import { LockControl } from "@/components/retreats/LockControl";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatMonth } from "@/lib/utils";

export default async function RetreatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { profile } = await requireProfile();

  const [{ data: retreat }, summary, { data: activeLock }, { data: codedTransactions }] =
    await Promise.all([
      supabase
        .from("retreats")
        .select("*, client:clients(*), ops_owner:ops_owners(*)")
        .eq("id", id)
        .single(),
      getRetreatSummary(supabase, id),
      supabase
        .from("retreat_locks")
        .select("*, locked_by_profile:profiles!retreat_locks_locked_by_fkey(full_name, email)")
        .eq("retreat_id", id)
        .is("unlocked_at", null)
        .maybeSingle(),
      supabase
        .from("transaction_codings")
        .select("*, transaction:transactions(*), category:categories(*)")
        .eq("retreat_id", id),
    ]);

  if (!retreat) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href={`/clients/${retreat.client_id}`} className="hover:underline">
              {retreat.client?.name}
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-zinc-900">{retreat.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatMonth(retreat.retreat_month)}
            {retreat.ops_owner?.name && ` · Owner: ${retreat.ops_owner.name}`}
          </p>
        </div>
        <Badge tone="neutral">{retreat.status.replace("_", " ")}</Badge>
      </div>

      <LockControl retreatId={id} activeLock={activeLock} canUnlock={profile.role === "admin"} />

      {summary && <RetreatSummaryCard summary={summary} />}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Coded transactions</h2>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Description</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(codedTransactions ?? []).map((c) => (
                <tr key={c.transaction_id} className="border-t border-zinc-100">
                  <td className="py-2 pr-4 text-zinc-600">
                    {c.transaction && formatDate(c.transaction.posted_date)}
                  </td>
                  <td className="py-2 pr-4 text-zinc-900">{c.transaction?.description}</td>
                  <td className="py-2 pr-4">
                    <Badge tone="blue">{c.category?.name}</Badge>
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${
                      (c.transaction?.amount ?? 0) < 0 ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {c.transaction && formatCurrency(c.transaction.amount)}
                  </td>
                </tr>
              ))}
              {(codedTransactions ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-zinc-400">
                    No transactions coded to this retreat yet.
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
