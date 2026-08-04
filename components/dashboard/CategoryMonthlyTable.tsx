import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatMonthShort } from "@/lib/utils";
import type { CategoryMonthlyAmount, CategoryType } from "@/types";

interface PivotRow {
  id: string;
  name: string;
  byMonth: Map<string, number>;
  total: number;
}

function buildSection(breakdown: CategoryMonthlyAmount[], type: CategoryType): PivotRow[] {
  const byCategory = new Map<string, PivotRow>();
  for (const entry of breakdown) {
    if (entry.category_type !== type) continue;
    const row = byCategory.get(entry.category_id) ?? {
      id: entry.category_id,
      name: entry.category_name,
      byMonth: new Map<string, number>(),
      total: 0,
    };
    row.byMonth.set(entry.month, (row.byMonth.get(entry.month) ?? 0) + entry.amount);
    row.total += entry.amount;
    byCategory.set(entry.category_id, row);
  }
  return Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
}

export function CategoryMonthlyTable({
  breakdown,
  months,
}: {
  breakdown: CategoryMonthlyAmount[];
  months: string[];
}) {
  const revenue = buildSection(breakdown, "revenue");
  const cogs = buildSection(breakdown, "cogs");
  const overhead = buildSection(breakdown, "overhead");

  const hasData = revenue.length > 0 || cogs.length > 0 || overhead.length > 0;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">Revenue &amp; expense by category</h2>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        {!hasData ? (
          <p className="py-6 text-center text-sm text-zinc-400">No coded transactions yet this year.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">Category</th>
                {months.map((m) => (
                  <th key={m} className="pb-2 pr-4 text-right">
                    {formatMonthShort(m)}
                  </th>
                ))}
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <Section title="Revenue" rows={revenue} months={months} tone="revenue" />
            <Section title="COGS" rows={cogs} months={months} tone="expense" />
            <Section title="Overhead" rows={overhead} months={months} tone="expense" />
          </table>
        )}
      </CardBody>
    </Card>
  );
}

function Section({
  title,
  rows,
  months,
  tone,
}: {
  title: string;
  rows: PivotRow[];
  months: string[];
  tone: "revenue" | "expense";
}) {
  if (rows.length === 0) return null;
  const subtotal = rows.reduce((sum, r) => sum + r.total, 0);
  const amountClass = tone === "expense" ? "text-red-600" : "text-emerald-700";

  return (
    <tbody>
      <tr>
        <td colSpan={months.length + 2} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-zinc-100">
          <td className="py-1.5 pr-4 text-zinc-700">{r.name}</td>
          {months.map((m) => (
            <td key={m} className="py-1.5 pr-4 text-right text-zinc-600">
              {r.byMonth.has(m) ? formatCurrency(r.byMonth.get(m)!) : "—"}
            </td>
          ))}
          <td className={`py-1.5 text-right font-medium ${amountClass}`}>{formatCurrency(r.total)}</td>
        </tr>
      ))}
      <tr className="border-t border-zinc-200 font-semibold text-zinc-900">
        <td className="py-1.5 pr-4">{title} total</td>
        {months.map((m) => {
          const monthTotal = rows.reduce((sum, r) => sum + (r.byMonth.get(m) ?? 0), 0);
          return (
            <td key={m} className="py-1.5 pr-4 text-right">
              {formatCurrency(monthTotal)}
            </td>
          );
        })}
        <td className="py-1.5 text-right">{formatCurrency(subtotal)}</td>
      </tr>
    </tbody>
  );
}
