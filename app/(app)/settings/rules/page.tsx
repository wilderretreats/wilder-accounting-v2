import { RulesClient } from "./RulesClient";

export default function RulesSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Auto-Coding Rules</h1>
      <RulesClient />
    </div>
  );
}
