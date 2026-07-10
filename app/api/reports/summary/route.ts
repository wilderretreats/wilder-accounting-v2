import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyPnl } from "@/lib/reports/queries";

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const startMonth = url.searchParams.get("startMonth") ?? undefined;
  const endMonth = url.searchParams.get("endMonth") ?? undefined;

  const supabase = await createClient();
  const months = await getMonthlyPnl(supabase, { startMonth, endMonth });

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

  return NextResponse.json({ months, totals });
}
