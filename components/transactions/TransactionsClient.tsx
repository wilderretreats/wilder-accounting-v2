"use client";

import { useCallback, useEffect, useState } from "react";
import { CodingPanel } from "./CodingPanel";
import { BulkCodeModal } from "./BulkCodeModal";
import { ImportModal } from "./ImportModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { TransactionWithCoding } from "@/types";

type CodedFilter = "all" | "coded" | "uncoded";

export function TransactionsClient({ initialCoded }: { initialCoded?: CodedFilter }) {
  const [transactions, setTransactions] = useState<TransactionWithCoding[]>([]);
  const [loading, setLoading] = useState(true);
  const [coded, setCoded] = useState<CodedFilter>(initialCoded ?? "all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTransaction, setActiveTransaction] = useState<TransactionWithCoding | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [autocoding, setAutocoding] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (coded !== "all") params.set("coded", coded);
    if (search) params.set("search", search);
    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    setTransactions(data.transactions ?? []);
    setLoading(false);
  }, [coded, search]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === transactions.length ? new Set() : new Set(transactions.map((t) => t.id))
    );
  }

  async function handleAutocode() {
    setAutocoding(true);
    const res = await fetch("/api/transactions/autocode", { method: "POST" });
    const data = await res.json();
    setAutocoding(false);
    if (res.ok) {
      await loadTransactions();
      alert(`Auto-coded ${data.coded} transaction${data.coded === 1 ? "" : "s"}.`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={coded} onChange={(e) => setCoded(e.target.value as CodedFilter)} className="w-40">
          <option value="all">All transactions</option>
          <option value="uncoded">Uncoded</option>
          <option value="coded">Coded</option>
        </Select>
        <Input
          placeholder="Search description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <div className="ml-auto flex gap-2">
          {selected.size > 0 && (
            <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
              Code {selected.size} selected
            </Button>
          )}
          <Button variant="secondary" onClick={handleAutocode} disabled={autocoding}>
            {autocoding ? "Auto-coding…" : "Auto-code overhead"}
          </Button>
          <Button onClick={() => setShowImportModal(true)}>Import CSV</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500">
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={transactions.length > 0 && selected.size === transactions.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Retreat</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr
                key={t.id}
                className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                onClick={() => setActiveTransaction(t)}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleSelected(t.id)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{formatDate(t.posted_date)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{t.account_label ?? "—"}</td>
                <td className="max-w-xs truncate px-3 py-2 text-zinc-900">{t.description}</td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                    t.amount < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(t.amount)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {t.coding ? (
                    <Badge tone="blue">{t.category?.name ?? "—"}</Badge>
                  ) : (
                    <Badge tone="amber">Uncoded</Badge>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                  {t.retreat ? `${t.retreat.client_name ?? ""} — ${t.retreat.name}` : "—"}
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-400">
                  No transactions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activeTransaction && (
        <CodingPanel
          transaction={activeTransaction}
          onClose={() => setActiveTransaction(null)}
          onSaved={() => {
            setActiveTransaction(null);
            loadTransactions();
          }}
        />
      )}

      {showBulkModal && (
        <BulkCodeModal
          transactionIds={Array.from(selected)}
          onClose={() => setShowBulkModal(false)}
          onSaved={() => {
            setShowBulkModal(false);
            setSelected(new Set());
            loadTransactions();
          }}
        />
      )}

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onImported={loadTransactions} />
      )}
    </div>
  );
}
