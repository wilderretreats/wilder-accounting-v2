import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { syncAllActiveItems, syncPlaidItem } from "@/lib/plaid/sync";

/** Manual "sync now" — the same lib/plaid/sync.ts functions used by cron and the webhook. */
export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;

  try {
    const results = itemId ? [await syncPlaidItem(itemId)] : await syncAllActiveItems();
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
