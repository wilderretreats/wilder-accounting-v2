import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClientSummaries } from "@/lib/reports/queries";

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
  const clients = await getClientSummaries(supabase, { startMonth, endMonth });

  return NextResponse.json({ clients });
}
