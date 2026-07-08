"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CategoryType, RetreatWithClient, TransactionWithCoding } from "@/types";

interface CodingPanelProps {
  transaction: TransactionWithCoding;
  onClose: () => void;
  onSaved: (updated: TransactionWithCoding) => void;
}

export function CodingPanel({ transaction, onClose, onSaved }: CodingPanelProps) {
  const [categoryId, setCategoryId] = useState<string | null>(transaction.coding?.category_id ?? null);
  const [categoryType, setCategoryType] = useState<CategoryType | null>(
    transaction.category?.type ?? null
  );
  const [retreatId, setRetreatId] = useState<string | null>(transaction.coding?.retreat_id ?? null);
  const [comment, setComment] = useState(transaction.coding?.comment ?? "");
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
    const res = await fetch(`/api/transactions/${transaction.id}/coding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        retreatId: needsRetreat ? retreatId : null,
        comment: comment || null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to save coding.");
      return;
    }

    onSaved({
      ...transaction,
      coding: data.coding,
    });
  }

  async function handleUncode() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/transactions/${transaction.id}/coding`, { method: "DELETE" });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to remove coding.");
      return;
    }
    onSaved({ ...transaction, coding: null });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Code transaction</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>

        <div className="rounded-md bg-zinc-50 p-3 text-sm">
          <p className="font-medium text-zinc-900">{transaction.description}</p>
          <p className="mt-1 text-zinc-500">
            {formatDate(transaction.posted_date)} · {transaction.account_label ?? transaction.source}
          </p>
          <p
            className={`mt-1 text-base font-semibold ${
              transaction.amount < 0 ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {formatCurrency(transaction.amount)}
          </p>
        </div>

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
                  {r.client_name} — {r.name} ({new Date(r.retreat_month + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })})
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-zinc-400">
              Don&apos;t see the retreat? Create it first on the Retreats page.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Comment (optional)</label>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-auto flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Save coding"}
          </Button>
          {transaction.coding && (
            <Button variant="danger" onClick={handleUncode} disabled={saving}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
