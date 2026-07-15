"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatPercent, formatMonth } from "@/lib/utils";
import type { RetreatStatus } from "@/types";

const STATUS_TONE: Record<RetreatStatus, "neutral" | "blue" | "green" | "red"> = {
  ongoing: "neutral",
  audited: "green",
};

export interface RetreatRow {
  id: string;
  name: string;
  retreat_month: string;
  status: RetreatStatus;
  client_name: string | null;
  owner_name: string | null;
  revenue: number;
  gross_profit: number;
  margin: number | null;
}

export function RetreatsTable({ rows }: { rows: RetreatRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search retreat name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-2 pr-4">Client</th>
              <th className="pb-2 pr-4">Retreat</th>
              <th className="pb-2 pr-4">Month</th>
              <th className="pb-2 pr-4">Owner</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4 text-right">Revenue</th>
              <th className="pb-2 pr-4 text-right">Gross Profit</th>
              <th className="pb-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="py-2 pr-4 text-zinc-600">{r.client_name}</td>
                <td className="py-2 pr-4">
                  <Link href={`/retreats/${r.id}`} className="font-medium text-zinc-900 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-zinc-600">{formatMonth(r.retreat_month)}</td>
                <td className="py-2 pr-4 text-zinc-600">{r.owner_name ?? "—"}</td>
                <td className="py-2 pr-4">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status === "audited" ? "Audited" : "Ongoing"}</Badge>
                </td>
                <td className="py-2 pr-4 text-right">{formatCurrency(r.revenue)}</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(r.gross_profit)}</td>
                <td className="py-2 text-right">{formatPercent(r.margin)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-zinc-400">
                  {rows.length === 0 ? "No retreats yet." : "No retreats match this search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
