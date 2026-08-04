"use client";

import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { CATEGORICAL_COLORS, OTHER_SLICE_COLOR } from "@/lib/chart-colors";
import type { CodedTransactionRow } from "./CodedTransactionsTable";

interface CategoryTotal {
  id: string;
  name: string;
  total: number;
}

interface PieSlice {
  name: string;
  value: number;
  percent: number;
  color: string;
}

const MAX_PIE_SLICES = 7;

function buildCategoryTotals(rows: CodedTransactionRow[]) {
  const revenue = new Map<string, CategoryTotal>();
  const expense = new Map<string, CategoryTotal>();

  for (const r of rows) {
    if (!r.category) continue;
    const isRevenue = r.category.type === "revenue";
    const bucket = isRevenue ? revenue : expense;
    const sign = isRevenue ? 1 : -1;
    const entry = bucket.get(r.category.id) ?? { id: r.category.id, name: r.category.name, total: 0 };
    entry.total += sign * r.amount;
    bucket.set(r.category.id, entry);
  }

  const sortDesc = (m: Map<string, CategoryTotal>) => Array.from(m.values()).sort((a, b) => b.total - a.total);
  return { revenue: sortDesc(revenue), expense: sortDesc(expense) };
}

/**
 * Caps at MAX_PIE_SLICES + an "Other" rollup so the chart stays legible.
 * Colors are assigned by rank (largest slice = slot 1, etc.), not hashed
 * from the category id -- the palette's fixed order is only guaranteed
 * distinct across ADJACENT slots, and hashing an unbounded set of category
 * ids into 8 buckets collides well before 8 categories are on screen
 * (e.g. Flights/Staff travel/Transportation all landing on the same pink).
 * Ranking guarantees the up-to-7 slices actually on the chart are unique.
 */
function buildPieData(expense: CategoryTotal[]): PieSlice[] {
  const top = expense.slice(0, MAX_PIE_SLICES);
  const rest = expense.slice(MAX_PIE_SLICES);
  const otherTotal = rest.reduce((sum, c) => sum + c.total, 0);
  const grandTotal = expense.reduce((sum, c) => sum + c.total, 0);
  const percentOf = (value: number) => (grandTotal > 0 ? value / grandTotal : 0);

  const slices: PieSlice[] = top.map((c, i) => ({
    name: c.name,
    value: c.total,
    percent: percentOf(c.total),
    color: CATEGORICAL_COLORS[i],
  }));
  if (otherTotal > 0) {
    slices.push({ name: "Other", value: otherTotal, percent: percentOf(otherTotal), color: OTHER_SLICE_COLOR });
  }
  return slices;
}

export function CategoryBreakdownReport({ rows }: { rows: CodedTransactionRow[] }) {
  const { revenue, expense } = useMemo(() => buildCategoryTotals(rows), [rows]);
  const pieData = useMemo(() => buildPieData(expense), [expense]);

  if (revenue.length === 0 && expense.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">By category</h2>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <CategoryTable title="Revenue by category" rows={revenue} />
          <CategoryTable title="Expense by category" rows={expense} tone="expense" />

          <div className="flex flex-col">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Expense totals by category
            </p>
            {pieData.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-sm text-zinc-400">
                No coded expenses yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, item) => {
                      const percent = (item?.payload as PieSlice | undefined)?.percent ?? 0;
                      return [`${formatCurrency(Number(value))} (${(percent * 100).toFixed(1)}%)`, name];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={48}
                    wrapperStyle={{ fontSize: 12, color: "#52514e" }}
                    formatter={(value, entry) => {
                      const percent = (entry?.payload as unknown as PieSlice | undefined)?.percent ?? 0;
                      return `${value} (${Math.round(percent * 100)}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CategoryTable({
  title,
  rows,
  tone = "revenue",
}: {
  title: string;
  rows: CategoryTotal[];
  tone?: "revenue" | "expense";
}) {
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100">
              <td className="py-1.5 pr-2 text-zinc-700">{r.name}</td>
              <td
                className={`py-1.5 text-right font-medium ${
                  tone === "expense" ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {formatCurrency(r.total)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="py-3 text-center text-zinc-400">
                No coded {tone === "expense" ? "expenses" : "revenue"} yet.
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-zinc-200 font-semibold text-zinc-900">
              <td className="py-1.5 pr-2">Total</td>
              <td className="py-1.5 text-right">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
