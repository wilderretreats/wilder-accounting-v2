import { NextResponse } from "next/server";
import { getAuthedProfile, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPnlStatement } from "@/lib/reports/queries";

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

  const supabase = await createClient();
  const statement = await getPnlStatement(supabase, { startMonth, endMonth });

  return NextResponse.json({ statement });
}
