import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRetreatSummary } from "@/lib/reports/queries";
import { RetreatSummaryCard } from "@/components/retreats/RetreatSummaryCard";
import { LockControl } from "@/components/retreats/LockControl";
import { OwnerControl } from "@/components/retreats/OwnerControl";
import { CodedTransactionsTable, type CodedTransactionRow } from "@/components/retreats/CodedTransactionsTable";
import { CategoryBreakdownReport } from "@/components/retreats/CategoryBreakdownReport";
import { Badge } from "@/components/ui/badge";
import { formatMonth } from "@/lib/utils";

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
        .select("*, transaction:transactions!inner(*), category:categories(*)")
        .eq("retreat_id", id)
        .eq("transaction.is_deleted_by_source", false),
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
          <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
            <span>{formatMonth(retreat.retreat_month)}</span>
            <span>·</span>
            <OwnerControl retreatId={id} currentOwnerName={retreat.ops_owner?.name ?? null} />
          </div>
        </div>
        <Badge tone={retreat.status === "audited" ? "green" : "neutral"}>
          {retreat.status === "audited" ? "Audited" : "Ongoing"}
        </Badge>
      </div>

      <LockControl retreatId={id} activeLock={activeLock} canUnlock={profile.role === "admin"} />

      {summary && <RetreatSummaryCard summary={summary} />}

      <CategoryBreakdownReport rows={(codedTransactions ?? []) as unknown as CodedTransactionRow[]} />

      <CodedTransactionsTable rows={(codedTransactions ?? []) as unknown as CodedTransactionRow[]} />
    </div>
  );
}
