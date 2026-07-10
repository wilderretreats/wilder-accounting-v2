import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionCsv } from "@/lib/csv";

const AMOUNT_TOLERANCE = 0.01;
const DATE_TOLERANCE_DAYS = 3;

/**
 * Matches an uploaded bank/card statement CSV against existing transactions
 * as a sanity check on top of Plaid sync — catches sync gaps, duplicates, or
 * coding mistakes. Matches by amount (exact, within a cent) and date
 * (within a few days, since posted dates can shift slightly between the
 * bank's own statement and what Plaid reports).
 */
export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const accountLabel = String(formData.get("accountLabel") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const csvText = await file.text();
  let statementRows;
  try {
    statementRows = parseTransactionCsv(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse CSV";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (statementRows.length === 0) {
    return NextResponse.json({ error: "CSV has no rows" }, { status: 400 });
  }

  const dates = statementRows.map((r) => r.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("id, posted_date, description, amount, reconciled")
    .eq("is_deleted_by_source", false)
    .gte("posted_date", minDate)
    .lte("posted_date", maxDate);
  if (accountLabel) query = query.eq("account_label", accountLabel);

  const { data: candidates, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const remaining = new Map((candidates ?? []).map((t) => [t.id, t]));
  const matchedIds: string[] = [];
  const unmatchedStatementRows: typeof statementRows = [];

  for (const row of statementRows) {
    const rowTime = new Date(row.date).getTime();
    let matchId: string | null = null;

    for (const [id, txn] of remaining) {
      if (Math.abs(txn.amount - row.amount) > AMOUNT_TOLERANCE) continue;
      const dayDiff = Math.abs(new Date(txn.posted_date).getTime() - rowTime) / 86_400_000;
      if (dayDiff > DATE_TOLERANCE_DAYS) continue;
      matchId = id;
      break;
    }

    if (matchId) {
      matchedIds.push(matchId);
      remaining.delete(matchId);
    } else {
      unmatchedStatementRows.push(row);
    }
  }

  if (matchedIds.length > 0) {
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        reconciled: true,
        reconciled_at: new Date().toISOString(),
        reconciled_by: authed.user.id,
      })
      .in("id", matchedIds);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    matched: matchedIds.length,
    unmatchedStatementRows,
    unmatchedTransactions: Array.from(remaining.values()),
  });
}
