import type { Transaction as PlaidTransaction } from "plaid";
import { getPlaidClient } from "./client";
import { decryptToken } from "./crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SyncResult {
  itemDbId: string;
  plaidItemId: string;
  added: number;
  modified: number;
  removed: number;
  error?: string;
}

/**
 * Syncs one Plaid item (institution connection) using the cursor-based
 * /transactions/sync endpoint — never a full-history poll. Called
 * identically by the manual "sync now" button, the Vercel Cron job, and the
 * Plaid webhook receiver, so all three paths can never drift from each
 * other. Always uses the service-role client since this runs in contexts
 * with no logged-in user session (cron, webhook) as well as user-triggered
 * ones.
 */
export async function syncPlaidItem(itemDbId: string): Promise<SyncResult> {
  const supabase = createAdminClient();
  const plaid = getPlaidClient();

  const { data: item, error: itemError } = await supabase
    .from("plaid_items")
    .select("*")
    .eq("id", itemDbId)
    .single();

  if (itemError || !item) {
    throw new Error(`plaid_items row ${itemDbId} not found`);
  }

  try {
    const accessToken = decryptToken({
      ciphertext: item.access_token_encrypted,
      iv: item.access_token_iv,
      tag: item.access_token_tag,
    });

    const accountLabelByPlaidId = await refreshAccounts(
      supabase,
      plaid,
      accessToken,
      item.id,
      item.institution_name
    );

    let cursor: string | undefined = item.cursor ?? undefined;
    let hasMore = true;
    let added = 0;
    let modified = 0;
    let removed = 0;

    while (hasMore) {
      const resp = await plaid.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
      });
      const data = resp.data;

      for (const t of data.added) {
        await upsertTransaction(supabase, t, accountLabelByPlaidId);
        added++;
      }
      for (const t of data.modified) {
        await upsertTransaction(supabase, t, accountLabelByPlaidId);
        modified++;
      }
      for (const t of data.removed) {
        if (t.transaction_id) {
          await supabase
            .from("transactions")
            .update({ is_deleted_by_source: true })
            .eq("plaid_transaction_id", t.transaction_id);
          removed++;
        }
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    await supabase
      .from("plaid_items")
      .update({
        cursor,
        status: "active",
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
      })
      .eq("id", item.id);

    return { itemDbId: item.id, plaidItemId: item.item_id, added, modified, removed };
  } catch (err) {
    // Only ever persist err.message (a plain string) — never the raw error
    // object, which for Plaid SDK errors can embed the original request
    // body (including the access token) in `error.response.data`.
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await supabase
      .from("plaid_items")
      .update({ status: "error", last_sync_error: message })
      .eq("id", item.id);
    return {
      itemDbId: item.id,
      plaidItemId: item.item_id,
      added: 0,
      modified: 0,
      removed: 0,
      error: message,
    };
  }
}

/** Syncs every currently-active Plaid item. Used by cron. */
export async function syncAllActiveItems(): Promise<SyncResult[]> {
  const supabase = createAdminClient();
  const { data: items, error } = await supabase
    .from("plaid_items")
    .select("id")
    .eq("status", "active");
  if (error) throw error;

  const results: SyncResult[] = [];
  for (const item of items ?? []) {
    results.push(await syncPlaidItem(item.id));
  }
  return results;
}

/**
 * Pulls all accounts (checking + credit card, etc.) for this item from
 * Plaid, upserts them into plaid_accounts, and returns a
 * plaid_account_id -> display label map for use while upserting
 * transactions. Fetched fresh every sync so a newly-added account at the
 * institution gets picked up automatically.
 */
async function refreshAccounts(
  supabase: AdminClient,
  plaid: ReturnType<typeof getPlaidClient>,
  accessToken: string,
  plaidItemDbId: string,
  institutionName: string | null
): Promise<Map<string, { dbId: string; label: string }>> {
  const accountsResp = await plaid.accountsGet({ access_token: accessToken });
  const map = new Map<string, { dbId: string; label: string }>();

  for (const acct of accountsResp.data.accounts) {
    const label = [institutionName, acct.name, acct.mask ? `••${acct.mask}` : null]
      .filter(Boolean)
      .join(" ");

    const { data: upserted, error } = await supabase
      .from("plaid_accounts")
      .upsert(
        {
          plaid_item_id: plaidItemDbId,
          plaid_account_id: acct.account_id,
          name: acct.name,
          mask: acct.mask ?? null,
          subtype: acct.subtype ?? null,
        },
        { onConflict: "plaid_account_id" }
      )
      .select("id")
      .single();

    if (error) throw error;
    map.set(acct.account_id, { dbId: upserted.id, label });
  }

  return map;
}

async function upsertTransaction(
  supabase: AdminClient,
  t: PlaidTransaction,
  accountLabelByPlaidId: Map<string, { dbId: string; label: string }>
) {
  const account = accountLabelByPlaidId.get(t.account_id);

  const { error } = await supabase.from("transactions").upsert(
    {
      source: "plaid",
      plaid_transaction_id: t.transaction_id,
      plaid_account_id: account?.dbId ?? null,
      account_label: account?.label ?? null,
      posted_date: t.date,
      description: t.merchant_name || t.name,
      // Plaid: positive = money OUT of the account, negative = money IN.
      // Inverted here to match this app's convention (negative = out,
      // positive = in), which mirrors how the original sheet was coded.
      amount: -t.amount,
      raw_plaid_payload: t,
      is_deleted_by_source: false,
    },
    { onConflict: "plaid_transaction_id" }
  );
  if (error) throw error;
}
