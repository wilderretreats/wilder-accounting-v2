"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReconcileResult {
  matched: number;
  unmatchedStatementRows: { date: string; description: string; amount: number }[];
  unmatchedTransactions: { id: string; posted_date: string; description: string; amount: number }[];
}

export function ReconcileClient() {
  const [file, setFile] = useState<File | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconcileResult | null>(null);

  async function handleReconcile() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountLabel", accountLabel);

    const res = await fetch("/api/reconcile", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Reconciliation failed");
      return;
    }
    setResult(data);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Bank statement CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Account label (optional filter)
          </label>
          <Input
            placeholder="e.g. Chase Checking ••7308"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            className="w-64"
          />
        </div>
        <Button onClick={handleReconcile} disabled={!file || uploading}>
          {uploading ? "Matching…" : "Reconcile"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <>
          <p className="text-sm text-zinc-700">
            Matched and marked {result.matched} transaction{result.matched === 1 ? "" : "s"} as reconciled.
          </p>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">
              In the statement but not found in our records ({result.unmatchedStatementRows.length})
            </h2>
            <p className="mb-2 text-xs text-zinc-500">
              Usually means Plaid hasn&apos;t synced this yet, or it was coded with a different amount/date.
            </p>
            <ResultTable
              rows={result.unmatchedStatementRows.map((r) => ({
                date: r.date,
                description: r.description,
                amount: r.amount,
              }))}
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">
              In our records but not in the statement ({result.unmatchedTransactions.length})
            </h2>
            <p className="mb-2 text-xs text-zinc-500">
              Worth a look — could be a duplicate, or outside the statement&apos;s date range.
            </p>
            <ResultTable
              rows={result.unmatchedTransactions.map((r) => ({
                date: r.posted_date,
                description: r.description,
                amount: r.amount,
              }))}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ResultTable({ rows }: { rows: { date: string; description: string; amount: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400">None.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{formatDate(r.date)}</td>
              <td className="px-3 py-2 text-zinc-900">{r.description}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                {formatCurrency(r.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
