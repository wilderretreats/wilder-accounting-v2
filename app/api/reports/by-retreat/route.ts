import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRetreatSummaries } from "@/lib/reports/queries";

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const startMonth = url.searchParams.get("startMonth") ?? undefined;
  const endMonth = url.searchParams.get("endMonth") ?? undefined;

  const supabase = await createClient();
  const summaries = await getRetreatSummaries(supabase, { clientId, startMonth, endMonth });

  const { data: retreats } = await supabase
    .from("retreats")
    .select("id, name, client:clients(name)")
    .in("id", summaries.map((s) => s.retreat_id));
  const retreatById = new Map((retreats ?? []).map((r) => [r.id, r]));

  const shaped = summaries.map((s) => {
    const r = retreatById.get(s.retreat_id);
    const client = Array.isArray(r?.client) ? r.client[0] : r?.client;
    return {
      ...s,
      retreat_name: r?.name ?? "Unknown",
      client_name: client?.name ?? "Unknown",
    };
  });

  return NextResponse.json({ retreats: shaped });
}
