import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlaidClient } from "@/lib/plaid/client";
import { decryptToken } from "@/lib/plaid/crypto";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Only admins can disconnect bank accounts" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: item, error: fetchError } = await supabase
    .from("plaid_items")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort: revoke access at Plaid's end too, not just stop syncing locally.
  try {
    const accessToken = decryptToken({
      ciphertext: item.access_token_encrypted,
      iv: item.access_token_iv,
      tag: item.access_token_tag,
    });
    await getPlaidClient().itemRemove({ access_token: accessToken });
  } catch {
    // Non-fatal — the item might already be invalid at Plaid's end. Still
    // mark it disconnected locally so it stops showing up as syncable.
  }

  const { error } = await supabase
    .from("plaid_items")
    .update({ status: "disconnected" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "plaid_item.disconnected",
    entityType: "plaid_item",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
