import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { getPlaidClient } from "@/lib/plaid/client";

/** Connecting a bank account is admin-only (matches plaid_items RLS write policy). */
export async function POST() {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Only admins can connect bank accounts" }, { status: 403 });
  }

  const plaid = getPlaidClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: authed.user.id },
      client_name: "Wilder Retreats Accounting",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      // Required for OAuth-based institutions (most large US banks); must be
      // registered in the Plaid dashboard's Allowed redirect URIs.
      redirect_uri: appUrl ? `${appUrl}/plaid-oauth` : undefined,
      // Registers our webhook receiver on every Item created through this
      // Link session — this is how Plaid learns where to send
      // SYNC_UPDATES_AVAILABLE, not a dashboard setting.
      webhook: appUrl ? `${appUrl}/api/plaid/webhook` : undefined,
      transactions: { days_requested: 730 },
    });
    return NextResponse.json({ linkToken: response.data.link_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
