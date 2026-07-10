import { requireRole } from "@/lib/auth";
import { PlaidConnect } from "@/components/plaid/PlaidConnect";

export default async function BankSettingsPage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Bank Connections</h1>
      <PlaidConnect />
    </div>
  );
}
