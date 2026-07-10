import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseTransactionCsv } from "@/lib/csv";
import { getCategoryRules, matchRule } from "@/lib/rules";
import { friendlyAccountLabel } from "@/lib/accounts";

export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const accountLabel = String(formData.get("accountLabel") ?? "").trim();
  const replaceAll = formData.get("replaceAll") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const csvText = await file.text();
  let rows;
  try {
    rows = parseTransactionCsv(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse CSV";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no rows" }, { status: 400 });
  }

  const supabase = await createClient();

  if (replaceAll && accountLabel) {
    await supabase
      .from("transactions")
      .update({ is_deleted_by_source: true })
      .eq("source", "csv")
      .eq("account_label", accountLabel)
      .eq("is_deleted_by_source", false);
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      source: "csv",
      file_name: file.name,
      imported_by: authed.user.id,
      row_count: rows.length,
    })
    .select()
    .single();
  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 400 });

  const { data: insertedTransactions, error: insertError } = await supabase
    .from("transactions")
    .insert(
      rows.map((r) => ({
        source: "csv" as const,
        // A per-row card column (see lib/csv.ts) always wins over the single
        // label typed into the import form -- Chase's business-card export
        // bundles multiple physical cards into one file, so one label per
        // batch would be wrong for rows that belong to a different card.
        account_label: r.accountLabel ? friendlyAccountLabel(r.accountLabel) : accountLabel || null,
        posted_date: r.date,
        description: r.description,
        amount: r.amount,
        import_batch_id: batch.id,
      }))
    )
    .select("id, description");
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  // Auto-code Overhead matches immediately (same rule as /api/transactions/autocode —
  // Revenue/COGS matches still need a human to pick the retreat).
  const [rules, categoriesResp] = await Promise.all([
    getCategoryRules(supabase),
    supabase.from("categories").select("id, type"),
  ]);
  const categoryTypeById = new Map((categoriesResp.data ?? []).map((c) => [c.id, c.type]));
  const now = new Date().toISOString();

  const codedRows = (insertedTransactions ?? [])
    .map((t) => {
      const rule = matchRule(t.description, rules);
      if (!rule || categoryTypeById.get(rule.category_id) !== "overhead") return null;
      return {
        transaction_id: t.id,
        category_id: rule.category_id,
        retreat_id: null,
        coded_by: authed.user.id,
        coded_at: now,
        updated_by: authed.user.id,
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (codedRows.length > 0) {
    await supabase.from("transaction_codings").upsert(codedRows, { onConflict: "transaction_id" });
  }

  return NextResponse.json({
    imported: insertedTransactions?.length ?? 0,
    autoCoded: codedRows.length,
    batchId: batch.id,
  });
}
