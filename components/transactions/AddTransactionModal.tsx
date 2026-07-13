"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddTransactionModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function AddTransactionModal({ onClose, onAdded }: AddTransactionModalProps) {
  const [postedDate, setPostedDate] = useState(today());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount)) {
      setError("Enter a valid amount.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postedDate,
        description: description.trim(),
        amount: parsedAmount,
        accountLabel: accountLabel.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to add transaction.");
      return;
    }
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900">Add transaction</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Date</label>
          <Input
            type="date"
            value={postedDate}
            onChange={(e) => setPostedDate(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
          <Input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Wire transfer to venue"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Amount</label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="-150.00"
          />
          <p className="mt-1 text-xs text-zinc-400">Negative for money out, positive for money in.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Account (optional)</label>
          <Input
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            placeholder="e.g. Checking or 1085"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Add transaction"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
