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
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

interface SplitRow {
  key: string;
  categoryId: string | null;
  categoryType: CategoryType | null;
  retreatId: string | null;
  amountInput: string;
  comment: string;
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

/** Parses a dollar-amount input to integer cents -- never floats, so the
 * "must be exactly $0.00 remaining" check can't get stuck off-zero from
 * float rounding. */
function toCents(input: string): number {
  const n = parseFloat(input);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function CodingPanel({ transaction, canDelete, onClose, onSaved, onDeleted }: CodingPanelProps) {
  const [splits, setSplits] = useState<SplitRow[]>(() => {
    if (transaction.codings.length === 0) {
      return [
        {
          key: newKey(),
          categoryId: null,
          categoryType: null,
          retreatId: null,
          amountInput: transaction.amount.toFixed(2),
          comment: "",
        },
      ];
    }
    return transaction.codings.map((c) => ({
      key: newKey(),
      categoryId: c.category_id,
      categoryType: c.category?.type ?? null,
      retreatId: c.retreat_id,
      amountInput: c.amount.toFixed(2),
      comment: c.comment ?? "",
    }));
  });
  const [accountLabel, setAccountLabel] = useState(transaction.account_label ?? "");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(transaction.account_label);
  const [pending, setPending] = useState(transaction.pending);
  const [savingPending, setSavingPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountDirty = accountLabel.trim() !== (accountSaved ?? "");

  const txnCents = Math.round(transaction.amount * 100);
  const splitCents = splits.map((s) => toCents(s.amountInput));
  const sumCents = splitCents.reduce((sum, c) => sum + c, 0);
  const remainingCents = txnCents - sumCents;

  const rowIssues = splits.map((s, i) => {
    if (!s.categoryId) return "Choose a category.";
    if ((s.categoryType === "revenue" || s.categoryType === "cogs") && !s.retreatId) {
      return "This category requires a retreat.";
    }
    if (splitCents[i] === 0) return "Amount can't be zero.";
    return null;
  });
  const canSave = remainingCents === 0 && rowIssues.every((issue) => issue === null);

  function updateRow(key: string, patch: Partial<SplitRow>) {
    setSplits((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addSplit() {
    setSplits((prev) => [
      ...prev,
      {
        key: newKey(),
        categoryId: null,
        categoryType: null,
        retreatId: null,
        amountInput: centsToInput(remainingCents),
        comment: "",
      },
    ]);
  }

  function removeSplit(key: string) {
    setSplits((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  }

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

  async function handleTogglePending(next: boolean) {
    setError(null);
    setSavingPending(true);
    const res = await fetch(`/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pending: next }),
    });
    const data = await res.json();
    setSavingPending(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to update pending flag.");
      return;
    }
    setPending(next);
  }

  async function handleSave() {
    setError(null);
    if (!canSave) {
      setError(rowIssues.find((issue) => issue !== null) ?? "Splits must add up to the transaction total.");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/transactions/${transaction.id}/coding`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        splits: splits.map((s) => ({
          categoryId: s.categoryId,
          retreatId: s.categoryType === "overhead" ? null : s.retreatId,
          amount: toCents(s.amountInput) / 100,
          comment: s.comment || null,
        })),
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to save coding.");
      return;
    }

    onSaved();
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
    onSaved();
  }

  async function handleDelete() {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to delete transaction.");
      return;
    }
    onDeleted();
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

        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={pending}
            disabled={savingPending}
            onChange={(e) => handleTogglePending(e.target.checked)}
          />
          <span>
            <span className="font-medium">Pending</span> — money expected but not received yet.
            Blocks this retreat from being locked until resolved.
          </span>
        </label>

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

        <div className="flex flex-col gap-3">
          {splits.map((split, i) => {
            const needsRetreat = split.categoryType === "revenue" || split.categoryType === "cogs";
            return (
              <div key={split.key} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3">
                {splits.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Split {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSplit(split.key)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Category</label>
                  <CategoryPicker
                    value={split.categoryId}
                    onChange={(id, type) =>
                      updateRow(split.key, {
                        categoryId: id,
                        categoryType: type,
                        retreatId: type === "overhead" ? null : split.retreatId,
                      })
                    }
                  />
                </div>

                {needsRetreat && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">Retreat</label>
                    <RetreatPicker
                      value={split.retreatId}
                      onChange={(id) => updateRow(split.key, { retreatId: id })}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={split.amountInput}
                    onChange={(e) => updateRow(split.key, { amountInput: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Comment (optional)</label>
                  <Input
                    value={split.comment}
                    onChange={(e) => updateRow(split.key, { comment: e.target.value })}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={addSplit}>
              + Add split
            </Button>
            <span
              className={`text-sm font-medium ${
                remainingCents === 0 ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              Remaining: {formatCurrency(remainingCents / 100)}
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-auto flex gap-2 pt-4">
          <Button onClick={handleSave} disabled={!canSave || saving || deleting} className="flex-1">
            {saving ? "Saving…" : "Save coding"}
          </Button>
          {transaction.codings.length > 0 && (
            <Button variant="danger" onClick={handleUncode} disabled={saving || deleting}>
              Remove
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-red-600 hover:bg-red-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
