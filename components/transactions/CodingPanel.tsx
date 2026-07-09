"use client";

import { useState } from "react";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { RetreatPicker } from "@/components/retreats/RetreatPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CategoryType, TransactionWithCoding } from "@/types";

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
  const [accountLabel, setAccountLabel] = useState(transaction.account_label ?? "");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(transaction.account_label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsRetreat = categoryType === "revenue" || categoryType === "cogs";
  const accountDirty = accountLabel.trim() !== (accountSaved ?? "");

  async function handleSaveAccount() {
    setError(null);
    setSavingAccount(true);
    const trimmed = accountLabel.trim();
    const res = await fetch(`/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountLabel: trimmed || null }),
    });
    const data = await res.json();
    setSavingAccount(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to save account.");
      return;
    }

    // Deliberately not calling onSaved here -- the parent's onSaved handler
    // closes this whole panel, which would be a jarring surprise for someone
    // who just fixed the account and still wants to code the category next.
    setAccountSaved(trimmed || null);
  }

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
      account_label: accountSaved,
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
          <p className="mt-1 text-zinc-500">{formatDate(transaction.posted_date)}</p>
          <p
            className={`mt-1 text-base font-semibold ${
              transaction.amount < 0 ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {formatCurrency(transaction.amount)}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Account</label>
          <div className="flex gap-2">
            <Input
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder="e.g. Checking or 1085"
              className="flex-1"
            />
            {accountDirty && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveAccount}
                disabled={savingAccount}
              >
                {savingAccount ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
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
            <RetreatPicker value={retreatId} onChange={setRetreatId} />
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
