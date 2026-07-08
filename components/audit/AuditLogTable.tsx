"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: unknown;
  created_at: string;
  actor: { full_name: string | null; email: string | null } | null;
}

const ACTION_TONE: Record<string, "neutral" | "blue" | "green" | "red" | "amber"> = {
  "transaction.coded": "blue",
  "transaction.recoded": "blue",
  "transaction.bulk_coded": "blue",
  "transaction.autocoded": "blue",
  "transaction.uncoded": "amber",
  "transaction.deleted": "red",
  "transaction.bulk_deleted": "red",
  "retreat.locked": "green",
  "retreat.unlocked": "amber",
};

export function AuditLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, [entityType]);

  return (
    <div className="flex flex-col gap-4">
      <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-48">
        <option value="">All entity types</option>
        <option value="transaction">Transactions</option>
        <option value="retreat">Retreats</option>
        <option value="client">Clients</option>
        <option value="category">Categories</option>
      </Select>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">When</th>
                <th className="pb-2 pr-4">Who</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Entity</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100">
                  <td className="whitespace-nowrap py-2 pr-4 text-zinc-500">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-zinc-700">
                    {e.actor?.full_name ?? e.actor?.email ?? "System"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    <Badge tone={ACTION_TONE[e.action] ?? "neutral"}>{e.action}</Badge>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                    {e.entity_type}/{e.entity_id.slice(0, 8)}
                  </td>
                </tr>
              ))}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-zinc-400">
                    No audit events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
