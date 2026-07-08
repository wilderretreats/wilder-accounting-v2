import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { syncAllActiveItems } from "@/lib/plaid/sync";

/**
 * Vercel Cron target (see vercel.json) — Vercel sends
 * `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set
 * as an env var, so this route rejects anything else as unauthenticated.
 * Also directly curl-able with the same header for manual testing.
 */
export async function GET(request: Request) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await syncAllActiveItems();
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
