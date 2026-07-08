import { AuditLogTable } from "@/components/audit/AuditLogTable";

export default function AuditPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Audit Log</h1>
      <AuditLogTable />
    </div>
  );
}
