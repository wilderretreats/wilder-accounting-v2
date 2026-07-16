"use client";

import { useCallback, useEffect, useState } from "react";
import { CodingPanel } from "./CodingPanel";
import { BulkCodeModal } from "./BulkCodeModal";
import { ImportModal } from "./ImportModal";
import { AddTransactionModal } from "./AddTransactionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Role, TransactionWithCoding } from "@/types";

type CodedFilter = "all" | "coded" | "uncoded";

const PAGE_SIZE = 200;

/** Ops can delete transactions only when they entered them by hand -- admin can delete any. */
function canDeleteTransaction(role: Role, transaction: TransactionWithCoding): boolean {
  if (role === "admin") return true;
  if (role === "ops") return transaction.source === "manual";
  return false;
}

export function TransactionsClient({
  initialCoded,
  role,
}: {
  initialCoded?: CodedFilter;
  role: Role;
}) {
  const canBulkDelete = role === "admin";
  const [transactions, setTransactions] = useState<TransactionWithCoding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [coded, setCoded] = useState<CodedFilter>(initialCoded ?? "all");
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("");
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTransaction, setActiveTransaction] = useState<TransactionWithCoding | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [autocoding, setAutocoding] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchPage = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams();
      if (coded !== "all") params.set("coded", coded);
      if (search) params.set("search", search);
      if (account) params.set("account", account);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      const page: TransactionWithCoding[] = data.transactions ?? [];
      setHasMore(page.length === PAGE_SIZE);
      return page;
    },
    [coded, search, account]
  );

  // Resets to the first page whenever filters change -- a separate effect
  // (rather than folding into loadMore) so "Load more" clicks don't get
  // wiped out by this running again with a stale offset of 0.
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const page = await fetchPage(0);
    setTransactions(page);
    setLoading(false);
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    const page = await fetchPage(transactions.length);
    setTransactions((prev) => [...prev, ...page]);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    fetch("/api/transactions/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts ?? []));
  }, []);

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

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selected.size} selected transaction${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }
    setBulkDeleting(true);
    const res = await fetch("/api/transactions/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds: Array.from(selected) }),
    });
    setBulkDeleting(false);
    if (res.ok) {
      setSelected(new Set());
      await loadTransactions();
    }
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
        <Select value={account} onChange={(e) => setAccount(e.target.value)} className="w-44">
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <div className="ml-auto flex gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
                Code {selected.size} selected
              </Button>
              {canBulkDelete && (
                <Button variant="danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  {bulkDeleting ? "Deleting…" : `Delete ${selected.size} selected`}
                </Button>
              )}
            </>
          )}
          <Button variant="secondary" onClick={handleAutocode} disabled={autocoding}>
            {autocoding ? "Auto-coding…" : "Auto-code overhead"}
          </Button>
          <Button variant="secondary" onClick={() => setShowAddModal(true)}>
            Add transaction
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
                <td className="max-w-xs truncate px-3 py-2 text-zinc-900">
                  {t.pending && (
                    <Badge tone="red" className="mr-1.5 align-middle">
                      Pending
                    </Badge>
                  )}
                  {t.description}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                    t.amount < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(t.amount)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {t.isSplit ? (
                    <Badge tone="blue">Split ({t.codings.length})</Badge>
                  ) : t.codings.length > 0 ? (
                    <Badge tone="blue">{t.category?.name ?? "—"}</Badge>
                  ) : (
                    <Badge tone="amber">Uncoded</Badge>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                  {t.isSplit
                    ? "Multiple"
                    : t.retreat
                      ? `${t.retreat.client_name ?? ""} — ${t.retreat.name}`
                      : "—"}
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

      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : `Load ${PAGE_SIZE} more`}
          </Button>
        </div>
      )}

      {activeTransaction && (
        <CodingPanel
          transaction={activeTransaction}
          canDelete={canDeleteTransaction(role, activeTransaction)}
          onClose={() => setActiveTransaction(null)}
          onSaved={() => {
            setActiveTransaction(null);
            loadTransactions();
          }}
          onDeleted={() => {
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

      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}
