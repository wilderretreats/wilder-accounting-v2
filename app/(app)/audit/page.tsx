import { requireRole } from "@/lib/auth";
import { AuditLogTable } from "@/components/audit/AuditLogTable";

export default async function AuditPage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Audit Log</h1>
      <AuditLogTable />
    </div>
  );
}
