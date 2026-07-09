"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Client, RetreatWithClient } from "@/types";

const ADD_NEW_VALUE = "__add_new__";

function formatRetreatMonth(retreatMonth: string): string {
  return new Date(retreatMonth + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

interface RetreatPickerProps {
  value: string | null;
  onChange: (retreatId: string) => void;
  disabled?: boolean;
}

export function RetreatPicker({ value, onChange, disabled }: RetreatPickerProps) {
  const [retreats, setRetreats] = useState<RetreatWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newMonth, setNewMonth] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRetreats() {
    setLoading(true);
    const res = await fetch("/api/retreats");
    const data = await res.json();
    setRetreats(data.retreats ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRetreats();
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRetreats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return retreats;
    return retreats.filter(
      (r) => r.name.toLowerCase().includes(q) || r.client_name.toLowerCase().includes(q)
    );
  }, [retreats, search]);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_NEW_VALUE) {
      setShowAddForm(true);
      return;
    }
    onChange(e.target.value);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/retreats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: newClientId, name: newName, retreatMonth: newMonth }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to create retreat");
      return;
    }

    await loadRetreats();
    onChange(data.retreat.id);
    setShowAddForm(false);
    setNewClientId("");
    setNewName("");
    setNewMonth("");
  }

  if (showAddForm) {
    return (
      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-md border border-zinc-300 p-3">
        <Select value={newClientId} onChange={(e) => setNewClientId(e.target.value)} required>
          <option value="" disabled>
            Select a client
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Retreat name (e.g. FMX 1)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          autoFocus
        />
        <Input
          type="month"
          value={newMonth}
          onChange={(e) => setNewMonth(e.target.value)}
          required
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add retreat"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <Input
        placeholder="Search client or retreat…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2"
        disabled={disabled}
      />
      <Select value={value ?? ""} onChange={handleSelectChange} disabled={disabled || loading}>
        <option value="" disabled>
          {loading ? "Loading retreats…" : "Select a retreat"}
        </option>
        {filteredRetreats.map((r) => (
          <option key={r.id} value={r.id}>
            {r.client_name} — {r.name} ({formatRetreatMonth(r.retreat_month)})
          </option>
        ))}
        <option value={ADD_NEW_VALUE}>+ Add new retreat…</option>
      </Select>
    </div>
  );
}
