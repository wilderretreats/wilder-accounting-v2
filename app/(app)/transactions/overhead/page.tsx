import { requireProfile } from "@/lib/auth";
import { TransactionsClient } from "@/components/transactions/TransactionsClient";

export default async function OverheadTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ coded?: string }>;
}) {
  const { coded } = await searchParams;
  const initialCoded = coded === "uncoded" || coded === "coded" ? coded : "all";
  const { profile } = await requireProfile();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Overhead Transactions</h1>
        <p className="text-sm text-zinc-500">
          Kept separate from revenue/COGS transactions — imports and manual entries here never
          mix with the main Transactions list.
        </p>
      </div>
      <TransactionsClient initialCoded={initialCoded} role={profile.role} scope="overhead" />
    </div>
  );
}
