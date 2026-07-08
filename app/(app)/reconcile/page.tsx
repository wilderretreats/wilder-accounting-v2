import { ReconcileClient } from "@/components/transactions/ReconcileClient";

export default function ReconcilePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Reconcile</h1>
      <ReconcileClient />
    </div>
  );
}
