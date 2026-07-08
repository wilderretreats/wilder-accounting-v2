"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { Client, OpsOwner } from "@/types";

export function AddRetreatButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [opsOwners, setOpsOwners] = useState<OpsOwner[]>([]);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [retreatMonth, setRetreatMonth] = useState("");
  const [opsOwnerName, setOpsOwnerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients ?? []));
    fetch("/api/ops-owners").then((r) => r.json()).then((d) => setOpsOwners(d.opsOwners ?? []));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let opsOwnerId: string | null = null;
    if (opsOwnerName.trim()) {
      const ownerRes = await fetch("/api/ops-owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: opsOwnerName.trim() }),
      });
      const ownerData = await ownerRes.json();
      if (ownerRes.ok) opsOwnerId = ownerData.opsOwner.id;
    }

    const res = await fetch("/api/retreats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, name, retreatMonth, opsOwnerId }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to create retreat");
      return;
    }

    setOpen(false);
    setClientId("");
    setName("");
    setRetreatMonth("");
    setOpsOwnerName("");
    router.refresh();
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add retreat</Button>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Client</label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Retreat name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FMX 1" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Retreat month</label>
          <Input
            type="month"
            value={retreatMonth}
            onChange={(e) => setRetreatMonth(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Ops owner</label>
          <Input
            list="ops-owner-options"
            value={opsOwnerName}
            onChange={(e) => setOpsOwnerName(e.target.value)}
            placeholder="Optional"
          />
          <datalist id="ops-owner-options">
            {opsOwners.map((o) => (
              <option key={o.id} value={o.name} />
            ))}
          </datalist>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save retreat"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
