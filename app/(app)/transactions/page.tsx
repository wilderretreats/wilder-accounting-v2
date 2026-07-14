import { requireProfile } from "@/lib/auth";
import { TransactionsClient } from "@/components/transactions/TransactionsClient";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ coded?: string }>;
}) {
  const { coded } = await searchParams;
  const initialCoded = coded === "uncoded" || coded === "coded" ? coded : "all";
  const { profile } = await requireProfile();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Transactions</h1>
      <TransactionsClient initialCoded={initialCoded} role={profile.role} />
    </div>
  );
}
