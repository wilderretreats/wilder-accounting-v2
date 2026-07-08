import { PlaidConnect } from "@/components/plaid/PlaidConnect";

export default function BankSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Bank Connections</h1>
      <PlaidConnect />
    </div>
  );
}
