import { ReportsClient } from "@/components/reports/ReportsClient";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Reports</h1>
      <ReportsClient />
    </div>
  );
}
