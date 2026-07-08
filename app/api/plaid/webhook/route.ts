import { NextResponse } from "next/server";
import { verifyPlaidWebhook } from "@/lib/plaid/webhook-verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPlaidItem } from "@/lib/plaid/sync";

interface PlaidWebhookPayload {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
}

/**
 * Plaid webhook receiver. Reads the raw body text (not request.json())
 * because signature verification hashes the exact bytes received —
 * re-serializing through JSON.parse/stringify could change whitespace and
 * break the request_body_sha256 check even for a legitimate request.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const verificationHeader = request.headers.get("plaid-verification");

  const verification = await verifyPlaidWebhook(rawBody, verificationHeader);
  if (!verification.valid) {
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }

  let payload: PlaidWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (payload.webhook_type === "TRANSACTIONS" && payload.webhook_code === "SYNC_UPDATES_AVAILABLE" && payload.item_id) {
    const supabase = createAdminClient();
    const { data: item } = await supabase
      .from("plaid_items")
      .select("id")
      .eq("item_id", payload.item_id)
      .eq("status", "active")
      .maybeSingle();

    if (item) {
      // Fire-and-forget from the webhook's perspective — Plaid only needs a
      // 200 to know we received it, and it'll re-notify if this item has
      // more updates after our next scheduled/manual sync anyway.
      await syncPlaidItem(item.id);
    }
  }

  return NextResponse.json({ ok: true });
}
