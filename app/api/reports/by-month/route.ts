import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyPnl } from "@/lib/reports/queries";

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const startMonth = url.searchParams.get("startMonth") ?? undefined;
  const endMonth = url.searchParams.get("endMonth") ?? undefined;

  const supabase = await createClient();
  const months = await getMonthlyPnl(supabase, { startMonth, endMonth });

  return NextResponse.json({ months });
}
