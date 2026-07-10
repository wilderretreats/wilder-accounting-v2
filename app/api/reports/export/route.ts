import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClientSummaries, getMonthlyPnl, getRetreatSummaries } from "@/lib/reports/queries";

type ReportType = "by-client" | "by-retreat" | "by-month";

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") ?? "by-month") as ReportType;
  const startMonth = url.searchParams.get("startMonth") ?? undefined;
  const endMonth = url.searchParams.get("endMonth") ?? undefined;

  const supabase = await createClient();
  let csv: string;
  let filename: string;

  if (type === "by-client") {
    const rows = await getClientSummaries(supabase, { startMonth, endMonth });
    csv = Papa.unparse(
      rows.map((r) => ({
        Client: r.client_name,
        Retreats: r.retreat_count,
        Revenue: r.revenue.toFixed(2),
        COGS: r.cogs.toFixed(2),
        "Gross Profit": r.gross_profit.toFixed(2),
        Margin: r.margin !== null ? (r.margin * 100).toFixed(2) + "%" : "",
      }))
    );
    filename = "revenue-by-client.csv";
  } else if (type === "by-retreat") {
    const rows = await getRetreatSummaries(supabase, { startMonth, endMonth });
    const { data: retreats } = await supabase
      .from("retreats")
      .select("id, name, retreat_month, client:clients(name)")
      .in("id", rows.map((r) => r.retreat_id));
    const byId = new Map((retreats ?? []).map((r) => [r.id, r]));
    csv = Papa.unparse(
      rows.map((r) => {
        const retreat = byId.get(r.retreat_id);
        const client = Array.isArray(retreat?.client) ? retreat.client[0] : retreat?.client;
        return {
          Client: client?.name ?? "",
          Retreat: retreat?.name ?? "",
          Month: r.retreat_month,
          Revenue: r.revenue.toFixed(2),
          COGS: r.cogs.toFixed(2),
          "Gross Profit": r.gross_profit.toFixed(2),
          Margin: r.margin !== null ? (r.margin * 100).toFixed(2) + "%" : "",
          "COGS (ex-flights)": r.cogs_ex_flights.toFixed(2),
          "Margin (ex-flights)":
            r.margin_ex_flights !== null ? (r.margin_ex_flights * 100).toFixed(2) + "%" : "",
        };
      })
    );
    filename = "revenue-by-retreat.csv";
  } else {
    const rows = await getMonthlyPnl(supabase, { startMonth, endMonth });
    csv = Papa.unparse(
      rows.map((r) => ({
        Month: r.month,
        Revenue: r.revenue.toFixed(2),
        COGS: r.cogs.toFixed(2),
        "Gross Profit": r.gross_profit.toFixed(2),
        Overhead: r.overhead.toFixed(2),
        "Net Income": r.net_income.toFixed(2),
      }))
    );
    filename = "monthly-pnl.csv";
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
