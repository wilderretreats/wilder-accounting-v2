"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { AddOverheadCategoryForm } from "./AddOverheadCategoryForm";
import { ExpectedPnlTable } from "./ExpectedPnlTable";
import { PnlStatementTable } from "./PnlStatementTable";
import type { PnlStatement } from "@/types";

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

type Tab = "monthly" | "expected";

export function PnlClient() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [year, setYear] = useState(currentYear);
  const [statement, setStatement] = useState<PnlStatement | null>(null);
  const [loading, setLoading] = useState(true);

  const startMonth = `${year}-01-01`;
  const endMonth = `${year}-12-31`;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ startMonth, endMonth });
    fetch(`/api/pl?${params}`)
      .then((r) => r.json())
      .then((d) => setStatement(d.statement ?? null))
      .finally(() => setLoading(false));
  }, [startMonth, endMonth]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const params = new URLSearchParams({ startMonth, endMonth });
    window.location.href = `/api/pl/export?${params}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex gap-1 rounded-md bg-zinc-100 p-1">
          {(["monthly", "expected"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              }`}
            >
              {t === "monthly" ? "Monthly P&L" : "Expected P&L"}
            </button>
          ))}
        </div>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        {tab === "monthly" && (
          <>
            <AddOverheadCategoryForm
              parents={(statement?.overhead ?? []).map((l) => ({ id: l.id, name: l.name }))}
              onAdded={load}
            />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={exportCsv}>
                Export CSV
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                Print / Save as PDF
              </Button>
            </div>
          </>
        )}
      </div>

      <p className="hidden text-sm text-zinc-500 print:block">
        {year} — Wilder Retreats Profit &amp; Loss, by month
      </p>

      {tab === "expected" ? (
        <ExpectedPnlTable startMonth={startMonth} endMonth={endMonth} />
      ) : loading || !statement ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <PnlStatementTable statement={statement} title={`${year}, by month`} />
      )}
    </div>
  );
}
