import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatMonthShort, formatPercent } from "@/lib/utils";
import type { PnlOverheadLine, PnlStatement } from "@/types";

/**
 * Renders a full company-wide P&L statement -- shared by the Monthly and
 * Expected P&L tabs, which differ only in how revenue/COGS were computed
 * (see getPnlStatement vs getExpectedPnlStatement), not in layout. Zero
 * categories are hidden (a parent still shows if any of its children carry
 * an amount) and every subtotal gets a "% of Revenue" column alongside its
 * period total.
 */
export function PnlStatementTable({
  statement,
  title,
  note,
}: {
  statement: PnlStatement;
  title: string;
  note?: string;
}) {
  const pctOfRevenue = (amount: number) => (statement.revenue !== 0 ? amount / statement.revenue : null);
  const visibleOverhead = statement.overhead.filter(isLineVisible);
  const visibleTaxes = statement.taxes.filter(isLineVisible);

  return (
    <Card>
      <CardHeader className="print:hidden">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        {note && <p className="mb-3 text-xs text-zinc-500 print:hidden">{note}</p>}
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-2 pr-4">Category</th>
              {statement.months.map((m) => (
                <th key={m} className="pb-2 pr-4 text-right">
                  {formatMonthShort(m)}
                </th>
              ))}
              <th className="pb-2 pr-4 text-right">Total</th>
              <th className="pb-2 text-right">% of Revenue</th>
            </tr>
          </thead>

          <tbody>
            <Row
              label="Revenue"
              months={statement.months}
              byMonth={statement.revenueByMonth}
              total={statement.revenue}
              percent={pctOfRevenue(statement.revenue)}
              tone="revenue"
            />
            <Row
              label="COGS"
              months={statement.months}
              byMonth={statement.cogsByMonth}
              total={statement.cogs}
              percent={pctOfRevenue(statement.cogs)}
              tone="expense"
            />
            <Row
              label="Operating Profit"
              months={statement.months}
              byMonth={statement.operatingProfitByMonth}
              total={statement.operating_profit}
              percent={pctOfRevenue(statement.operating_profit)}
              bold
              border
            />
          </tbody>

          <tbody>
            <SectionHeader label="Overhead" span={statement.months.length + 3} />
            {visibleOverhead.map((line) => (
              <OverheadSection key={line.id} line={line} months={statement.months} pctOfRevenue={pctOfRevenue} />
            ))}
            <Row
              label="Total Overhead"
              months={statement.months}
              byMonth={statement.overheadTotalByMonth}
              total={statement.overhead_total}
              percent={pctOfRevenue(statement.overhead_total)}
              tone="expense"
              bold
              border
            />
          </tbody>

          <tbody>
            <Row
              label="Net Income Before Taxes"
              months={statement.months}
              byMonth={statement.netIncomeBeforeTaxesByMonth}
              total={statement.net_income_before_taxes}
              percent={pctOfRevenue(statement.net_income_before_taxes)}
              bold
              border
              big
            />
          </tbody>

          <tbody>
            <SectionHeader label="Taxes" span={statement.months.length + 3} />
            {visibleTaxes.map((line) => (
              <OverheadSection key={line.id} line={line} months={statement.months} pctOfRevenue={pctOfRevenue} />
            ))}
            <Row
              label="Total Taxes"
              months={statement.months}
              byMonth={statement.taxesTotalByMonth}
              total={statement.taxes_total}
              percent={pctOfRevenue(statement.taxes_total)}
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
              percent={pctOfRevenue(statement.net_income)}
              bold
              border
              big
            />
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

/** A top-level overhead/tax line is worth showing if it or any child carries a nonzero amount. */
function isLineVisible(line: PnlOverheadLine): boolean {
  return line.total !== 0 || line.children.some((c) => c.total !== 0);
}

function SectionHeader({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <td
        colSpan={span}
        className="border-y border-zinc-200 bg-zinc-100 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
      >
        {label}
      </td>
    </tr>
  );
}

function OverheadSection({
  line,
  months,
  pctOfRevenue,
}: {
  line: PnlOverheadLine;
  months: string[];
  pctOfRevenue: (amount: number) => number | null;
}) {
  const visibleChildren = line.children.filter((c) => c.total !== 0);
  return (
    <>
      <Row
        label={line.name}
        months={months}
        byMonth={line.byMonth}
        total={line.total}
        percent={pctOfRevenue(line.total)}
        tone="expense"
        semibold
        shaded
      />
      {visibleChildren.map((child) => (
        <Row
          key={child.id}
          label={child.name}
          months={months}
          byMonth={child.byMonth}
          total={child.total}
          percent={pctOfRevenue(child.total)}
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
  percent,
  tone,
  bold,
  semibold,
  border,
  big,
  indent,
  shaded,
}: {
  label: string;
  months: string[];
  byMonth: Record<string, number>;
  total: number;
  percent: number | null;
  tone?: "revenue" | "expense";
  bold?: boolean;
  semibold?: boolean;
  border?: boolean;
  big?: boolean;
  indent?: boolean;
  shaded?: boolean;
}) {
  const amountClass =
    tone === "expense" ? "text-red-600" : tone === "revenue" ? "text-emerald-700" : "text-zinc-900";
  const weightClass = bold ? "font-semibold" : semibold ? "font-medium" : "";
  const sizeClass = big ? "text-sm" : "";
  const rowClass = [
    border ? "border-t border-zinc-200" : "border-t border-zinc-50",
    big ? "bg-zinc-100" : shaded ? "bg-zinc-100/60" : "hover:bg-zinc-50",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr className={rowClass}>
      <td className={`py-1.5 pr-4 ${indent ? "pl-6 text-zinc-600" : "text-zinc-800"} ${weightClass} ${sizeClass}`}>
        {label}
      </td>
      {months.map((m) => (
        <td key={m} className={`py-1.5 pr-4 text-right ${amountClass} ${weightClass} ${sizeClass}`}>
          {formatCurrency(byMonth[m] ?? 0)}
        </td>
      ))}
      <td className={`py-1.5 pr-4 text-right ${amountClass} ${weightClass} ${sizeClass}`}>{formatCurrency(total)}</td>
      <td className={`py-1.5 text-right text-zinc-500 ${weightClass} ${sizeClass}`}>{formatPercent(percent)}</td>
    </tr>
  );
}
