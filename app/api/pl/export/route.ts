import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAuthedProfile, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExpectedPnlStatement, getPnlStatement } from "@/lib/reports/queries";
import { formatMonthShort } from "@/lib/utils";

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(authed)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const startMonth = url.searchParams.get("startMonth");
  const endMonth = url.searchParams.get("endMonth");
  if (!startMonth || !endMonth) {
    return NextResponse.json({ error: "startMonth and endMonth are required" }, { status: 400 });
  }

  const isExpected = url.searchParams.get("mode") === "expected";
  const supabase = await createClient();
  const statement = isExpected
    ? await getExpectedPnlStatement(supabase, { startMonth, endMonth })
    : await getPnlStatement(supabase, { startMonth, endMonth });

  const rows: Record<string, string>[] = [];
  function pushRow(section: string, category: string, byMonth: Record<string, number>, total: number) {
    const row: Record<string, string> = { Section: section, Category: category };
    for (const month of statement.months) {
      row[formatMonthShort(month)] = (byMonth[month] ?? 0).toFixed(2);
    }
    row.Total = total.toFixed(2);
    rows.push(row);
  }

  pushRow("Revenue", "", statement.revenueByMonth, statement.revenue);
  pushRow("COGS", "", statement.cogsByMonth, statement.cogs);
  pushRow("Operating Profit", "", statement.operatingProfitByMonth, statement.operating_profit);

  for (const line of statement.overhead) {
    pushRow("Overhead", line.name, line.byMonth, line.total);
    for (const child of line.children) {
      pushRow("Overhead", `  ${child.name}`, child.byMonth, child.total);
    }
  }
  pushRow("Overhead", "Total Overhead", statement.overheadTotalByMonth, statement.overhead_total);
  pushRow(
    "Net Income Before Taxes",
    "",
    statement.netIncomeBeforeTaxesByMonth,
    statement.net_income_before_taxes
  );

  for (const line of statement.taxes) {
    pushRow("Taxes", line.name, line.byMonth, line.total);
    for (const child of line.children) {
      pushRow("Taxes", `  ${child.name}`, child.byMonth, child.total);
    }
  }
  pushRow("Taxes", "Total Taxes", statement.taxesTotalByMonth, statement.taxes_total);
  pushRow("Net Income", "", statement.netIncomeByMonth, statement.net_income);

  const csv = Papa.unparse(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pl-${isExpected ? "expected-" : ""}${startMonth}-to-${endMonth}.csv"`,
    },
  });
}
