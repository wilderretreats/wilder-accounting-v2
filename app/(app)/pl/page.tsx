import { requireOwner } from "@/lib/auth";
import { PnlClient } from "@/components/pl/PnlClient";

export default async function ProfitAndLossPage() {
  await requireOwner();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900 print:hidden">Profit &amp; Loss</h1>
      <PnlClient />
    </div>
  );
}
