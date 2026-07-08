"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { CategoryType, RetreatWithClient } from "@/types";

interface BulkCodeModalProps {
  transactionIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function BulkCodeModal({ transactionIds, onClose, onSaved }: BulkCodeModalProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryType, setCategoryType] = useState<CategoryType | null>(null);
  const [retreatId, setRetreatId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [retreats, setRetreats] = useState<RetreatWithClient[]>([]);
  const [retreatSearch, setRetreatSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/retreats")
      .then((r) => r.json())
      .then((data) => setRetreats(data.retreats ?? []));
  }, []);

  const filteredRetreats = useMemo(() => {
    const q = retreatSearch.trim().toLowerCase();
    if (!q) return retreats;
    return retreats.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r as RetreatWithClient & { client_name?: string }).client_name?.toLowerCase().includes(q)
    );
  }, [retreats, retreatSearch]);

  const needsRetreat = categoryType === "revenue" || categoryType === "cogs";

  async function handleSave() {
    setError(null);
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (needsRetreat && !retreatId) {
      setError("This category requires a retreat.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/transactions/bulk-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionIds,
        categoryId,
        retreatId: needsRetreat ? retreatId : null,
        comment: comment || null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to apply coding.");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900">
          Code {transactionIds.length} transaction{transactionIds.length === 1 ? "" : "s"}
        </h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Category</label>
          <CategoryPicker
            value={categoryId}
            onChange={(id, type) => {
              setCategoryId(id);
              setCategoryType(type);
              if (type === "overhead") setRetreatId(null);
            }}
          />
        </div>

        {needsRetreat && (
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Retreat</label>
            <Input
              placeholder="Search client or retreat…"
              value={retreatSearch}
              onChange={(e) => setRetreatSearch(e.target.value)}
              className="mb-2"
            />
            <Select value={retreatId ?? ""} onChange={(e) => setRetreatId(e.target.value || null)}>
              <option value="" disabled>
                Select a retreat
              </option>
              {filteredRetreats.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.client_name} — {r.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Comment (optional)</label>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving…" : `Apply to ${transactionIds.length}`}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
