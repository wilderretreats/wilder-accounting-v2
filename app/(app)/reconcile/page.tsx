import { requireRole } from "@/lib/auth";
import { ReconcileClient } from "@/components/transactions/ReconcileClient";

export default async function ReconcilePage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Reconcile</h1>
      <ReconcileClient />
    </div>
  );
}
