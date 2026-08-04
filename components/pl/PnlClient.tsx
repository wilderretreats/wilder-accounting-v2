"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { AddOverheadCategoryForm } from "./AddOverheadCategoryForm";
import { formatCurrency, formatMonthShort } from "@/lib/utils";
import type { PnlStatement } from "@/types";

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export function PnlClient() {
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
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
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
      </div>

      <p className="hidden text-sm text-zinc-500 print:block">
        {year} — Wilder Retreats Profit &amp; Loss, by month
      </p>

      {loading || !statement ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <Card>
          <CardHeader className="print:hidden">
            <h2 className="text-sm font-semibold text-zinc-900">{year}, by month</h2>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-2 pr-4">Category</th>
                  {statement.months.map((m) => (
                    <th key={m} className="pb-2 pr-4 text-right">
                      {formatMonthShort(m)}
                    </th>
                  ))}
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                <Row
                  label="Revenue"
                  months={statement.months}
                  byMonth={statement.revenueByMonth}
                  total={statement.revenue}
                  tone="revenue"
                />
                <Row
                  label="COGS"
                  months={statement.months}
                  byMonth={statement.cogsByMonth}
                  total={statement.cogs}
                  tone="expense"
                />
                <Row
                  label="Operating Profit"
                  months={statement.months}
                  byMonth={statement.operatingProfitByMonth}
                  total={statement.operating_profit}
                  bold
                  border
                />
              </tbody>

              <tbody>
                <tr>
                  <td
                    colSpan={statement.months.length + 2}
                    className="pt-5 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    Overhead
                  </td>
                </tr>
                {statement.overhead.map((line) => (
                  <OverheadSection key={line.id} line={line} months={statement.months} />
                ))}
                <Row
                  label="Total Overhead"
                  months={statement.months}
                  byMonth={statement.overheadTotalByMonth}
                  total={statement.overhead_total}
                  tone="expense"
                  bold
                  border
                />
              </tbody>

              <tbody>
                <Row
                  label="Net Income"
                  months={statement.months}
                  byMonth={statement.netIncomeByMonth}
                  total={statement.net_income}
                  bold
                  border
                  big
                />
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function OverheadSection({
  line,
  months,
}: {
  line: PnlStatement["overhead"][number];
  months: string[];
}) {
  return (
    <>
      <Row label={line.name} months={months} byMonth={line.byMonth} total={line.total} tone="expense" semibold />
      {line.children.map((child) => (
        <Row
          key={child.id}
          label={child.name}
          months={months}
          byMonth={child.byMonth}
          total={child.total}
          tone="expense"
          indent
        />
      ))}
    </>
  );
}

function Row({
  label,
  months,
  byMonth,
  total,
  tone,
  bold,
  semibold,
  border,
  big,
  indent,
}: {
  label: string;
  months: string[];
  byMonth: Record<string, number>;
  total: number;
  tone?: "revenue" | "expense";
  bold?: boolean;
  semibold?: boolean;
  border?: boolean;
  big?: boolean;
  indent?: boolean;
}) {
  const amountClass =
    tone === "expense" ? "text-red-600" : tone === "revenue" ? "text-emerald-700" : "text-zinc-900";
  const weightClass = bold ? "font-semibold" : semibold ? "font-medium" : "";
  const sizeClass = big ? "text-base" : "";

  return (
    <tr className={border ? "border-t border-zinc-200" : "border-t border-zinc-50"}>
      <td className={`py-1.5 pr-4 ${indent ? "pl-6 text-zinc-600" : "text-zinc-800"} ${weightClass} ${sizeClass}`}>
        {label}
      </td>
      {months.map((m) => (
        <td key={m} className={`py-1.5 pr-4 text-right ${amountClass} ${weightClass} ${sizeClass}`}>
          {formatCurrency(byMonth[m] ?? 0)}
        </td>
      ))}
      <td className={`py-1.5 text-right ${amountClass} ${weightClass} ${sizeClass}`}>{formatCurrency(total)}</td>
    </tr>
  );
}
