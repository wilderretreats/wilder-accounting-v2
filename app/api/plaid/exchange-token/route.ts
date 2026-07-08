import { NextResponse } from "next/server";
import { z } from "zod";
import { CountryCode } from "plaid";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { getPlaidClient } from "@/lib/plaid/client";
import { encryptToken } from "@/lib/plaid/crypto";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { syncPlaidItem } from "@/lib/plaid/sync";

const schema = z.object({ publicToken: z.string().min(1) });

export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Only admins can connect bank accounts" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const plaid = getPlaidClient();

  let accessToken: string;
  let itemId: string;
  try {
    const exchangeResp = await plaid.itemPublicTokenExchange({
      public_token: parsed.data.publicToken,
    });
    accessToken = exchangeResp.data.access_token;
    itemId = exchangeResp.data.item_id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to exchange public token";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Institution name is cosmetic — never let a lookup failure block the connection.
  let institutionName: string | null = null;
  try {
    const itemResp = await plaid.itemGet({ access_token: accessToken });
    const institutionId = itemResp.data.item.institution_id;
    if (institutionId) {
      const instResp = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = instResp.data.institution.name;
    }
  } catch {
    // ignore
  }

  const encrypted = encryptToken(accessToken);

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("plaid_items")
    .insert({
      institution_name: institutionName,
      item_id: itemId,
      access_token_encrypted: encrypted.ciphertext,
      access_token_iv: encrypted.iv,
      access_token_tag: encrypted.tag,
      connected_by: authed.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "plaid_item.connected",
    entityType: "plaid_item",
    entityId: item.id,
    metadata: { institutionName },
  });

  // Kick off an initial sync immediately so the connection feels alive
  // rather than waiting for the next cron tick.
  const syncResult = await syncPlaidItem(item.id);

  return NextResponse.json({
    item: { id: item.id, institution_name: item.institution_name },
    syncResult,
  });
}
