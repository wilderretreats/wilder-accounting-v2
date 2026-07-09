"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OpsOwner } from "@/types";

interface OwnerControlProps {
  retreatId: string;
  currentOwnerName: string | null;
}

export function OwnerControl({ retreatId, currentOwnerName }: OwnerControlProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [opsOwners, setOpsOwners] = useState<OpsOwner[]>([]);
  const [name, setName] = useState(currentOwnerName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    fetch("/api/ops-owners")
      .then((r) => r.json())
      .then((d) => setOpsOwners(d.opsOwners ?? []));
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const trimmed = name.trim();
    let opsOwnerId: string | null = null;

    if (trimmed) {
      const ownerRes = await fetch("/api/ops-owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const ownerData = await ownerRes.json();
      if (!ownerRes.ok) {
        setSaving(false);
        setError(typeof ownerData.error === "string" ? ownerData.error : "Failed to save owner");
        return;
      }
      opsOwnerId = ownerData.opsOwner.id;
    }

    const res = await fetch(`/api/retreats/${retreatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opsOwnerId }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to save owner");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left text-sm text-zinc-500 hover:underline"
      >
        {currentOwnerName ? `Owner: ${currentOwnerName}` : "+ Add owner"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        list="ops-owner-options"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Owner name"
        className="w-48"
        autoFocus
      />
      <datalist id="ops-owner-options">
        {opsOwners.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setEditing(false);
          setName(currentOwnerName ?? "");
          setError(null);
        }}
      >
        Cancel
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
