"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { formatCurrency, formatMonth, formatPercent } from "@/lib/utils";
import type { ClientSummary, MonthlyPnl, RetreatSummary } from "@/types";

type Tab = "summary" | "by-client" | "by-retreat" | "by-month";

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export function ReportsClient() {
  const [tab, setTab] = useState<Tab>("summary");
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<MonthlyPnl[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [retreats, setRetreats] = useState<(RetreatSummary & { client_name: string; retreat_name: string })[]>([]);

  const startMonth = `${year}-01-01`;
  const endMonth = `${year}-12-31`;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ startMonth, endMonth });

    if (tab === "summary" || tab === "by-month") {
      fetch(`/api/reports/summary?${params}`)
        .then((r) => r.json())
        .then((d) => setMonths(d.months ?? []))
        .finally(() => setLoading(false));
    } else if (tab === "by-client") {
      fetch(`/api/reports/by-client?${params}`)
        .then((r) => r.json())
        .then((d) => setClients(d.clients ?? []))
        .finally(() => setLoading(false));
    } else if (tab === "by-retreat") {
      fetch(`/api/reports/by-retreat?${params}`)
        .then((r) => r.json())
        .then((d) => setRetreats(d.retreats ?? []))
        .finally(() => setLoading(false));
    }
  }, [tab, startMonth, endMonth]);

  const totals = months.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cogs: acc.cogs + m.cogs,
      overhead: acc.overhead + m.overhead,
      gross_profit: acc.gross_profit + m.gross_profit,
      net_income: acc.net_income + m.net_income,
    }),
    { revenue: 0, cogs: 0, overhead: 0, gross_profit: 0, net_income: 0 }
  );

  function exportCsv(type: "by-client" | "by-retreat" | "by-month") {
    const params = new URLSearchParams({ type, startMonth, endMonth });
    window.location.href = `/api/reports/export?${params}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md bg-zinc-100 p-1">
          {(["summary", "by-client", "by-retreat", "by-month"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              }`}
            >
              {t === "summary" ? "Summary" : t === "by-client" ? "By Client" : t === "by-retreat" ? "By Retreat" : "By Month"}
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
        {tab !== "summary" && (
          <Button variant="secondary" className="ml-auto" onClick={() => exportCsv(tab)}>
            Export CSV
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : tab === "summary" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Revenue" value={formatCurrency(totals.revenue)} />
          <Stat label="COGS" value={formatCurrency(totals.cogs)} />
          <Stat label="Gross Profit" value={formatCurrency(totals.gross_profit)} />
          <Stat label="Overhead" value={formatCurrency(totals.overhead)} />
          <Stat label="Net Income" value={formatCurrency(totals.net_income)} />
        </div>
      ) : tab === "by-client" ? (
        <Table
          columns={["Client", "Retreats", "Revenue", "Gross Profit", "Margin"]}
          rows={clients.map((c) => [
            c.client_name,
            String(c.retreat_count),
            formatCurrency(c.revenue),
            formatCurrency(c.gross_profit),
            formatPercent(c.margin),
          ])}
        />
      ) : tab === "by-retreat" ? (
        <Table
          columns={["Client", "Retreat", "Month", "Revenue", "Gross Profit", "Margin"]}
          rows={retreats.map((r) => [
            r.client_name,
            r.retreat_name,
            formatMonth(r.retreat_month),
            formatCurrency(r.revenue),
            formatCurrency(r.gross_profit),
            formatPercent(r.margin),
          ])}
        />
      ) : (
        <Table
          columns={["Month", "Revenue", "COGS", "Gross Profit", "Overhead", "Net Income"]}
          rows={months.map((m) => [
            formatMonth(m.month),
            formatCurrency(m.revenue),
            formatCurrency(m.cogs),
            formatCurrency(m.gross_profit),
            formatCurrency(m.overhead),
            formatCurrency(m.net_income),
          ])}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
      </CardBody>
    </Card>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              {columns.map((c, i) => (
                <th key={c} className={`pb-2 pr-4 ${i > 1 ? "text-right" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-100">
                {row.map((cell, j) => (
                  <td key={j} className={`py-2 pr-4 ${j > 1 ? "text-right" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-zinc-400">
                  No data for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
