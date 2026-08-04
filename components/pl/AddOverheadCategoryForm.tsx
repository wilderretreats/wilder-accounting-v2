"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function AddOverheadCategoryForm({
  parents,
  onAdded,
}: {
  parents: Array<{ id: string; name: string }>;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "overhead", name, parentId: parentId || null }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : "Failed to add category");
      return;
    }

    setName("");
    setParentId("");
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="print:hidden">
        + Add category
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-2 print:hidden">
      <Select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-56">
        <option value="">No parent (top-level section)</option>
        {parents.map((p) => (
          <option key={p.id} value={p.id}>
            Under: {p.name}
          </option>
        ))}
      </Select>
      <Input
        placeholder="New category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
        className="w-56"
      />
      <Button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
