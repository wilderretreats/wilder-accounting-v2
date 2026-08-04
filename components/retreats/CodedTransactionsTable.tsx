"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Category, Transaction } from "@/types";

export interface CodedTransactionRow {
  id: string;
  amount: number;
  category: Category | null;
  transaction: Transaction | null;
}

type SortKey = "date" | "description" | "category" | "amount";
type SortDir = "asc" | "desc";

export function CodedTransactionsTable({ rows }: { rows: CodedTransactionRow[] }) {
  const [categoryId, setCategoryId] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const categories = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) {
      if (r.category) byId.set(r.category.id, r.category.name);
    }
    return Array.from(byId.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(
    () => (categoryId === "all" ? rows : rows.filter((r) => r.category?.id === categoryId)),
    [rows, categoryId]
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "date":
          return dir * (a.transaction?.posted_date ?? "").localeCompare(b.transaction?.posted_date ?? "");
        case "description":
          return dir * (a.transaction?.description ?? "").localeCompare(b.transaction?.description ?? "");
        case "category":
          return dir * (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
        case "amount":
          return dir * (a.amount - b.amount);
      }
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Coded transactions</h2>
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-auto"
        >
          <option value="all">All categories</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <SortHeader label="Date" sortKey="date" active={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHeader
                label="Description"
                sortKey="description"
                active={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                label="Category"
                sortKey="category"
                active={sortKey}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortHeader
                label="Amount"
                sortKey="amount"
                active={sortKey}
                dir={sortDir}
                onSort={toggleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="py-2 pr-4 text-zinc-600">
                  {c.transaction && formatDate(c.transaction.posted_date)}
                </td>
                <td className="py-2 pr-4 text-zinc-900">
                  {c.transaction?.pending && (
                    <Badge tone="red" className="mr-1.5 align-middle">
                      Pending
                    </Badge>
                  )}
                  {c.transaction?.description}
                </td>
                <td className="py-2 pr-4">
                  <Badge tone="blue">{c.category?.name}</Badge>
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    c.amount < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(c.amount)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-400">
                  {rows.length === 0
                    ? "No transactions coded to this retreat yet."
                    : "No transactions match this category."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const isActive = active === sortKey;
  return (
    <th className={`pb-2 pr-4 ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-zinc-900 ${
          isActive ? "text-zinc-900" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{isActive ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
