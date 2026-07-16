import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategoryRules, matchRule } from "@/lib/rules";
import { writeAuditLog } from "@/lib/audit";

/**
 * Applies keyword rules to every uncoded transaction. Only Overhead-type
 * rule matches are fully auto-codeable here, since Revenue/COGS categories
 * require a retreat_id that no keyword rule can supply — those matches are
 * left for a human to pick the retreat in the coding UI (which can still use
 * the rule match to pre-fill the category suggestion client-side).
 */
export async function POST() {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const [rules, categoriesResp, uncodedResp] = await Promise.all([
    getCategoryRules(supabase),
    supabase.from("categories").select("id, type"),
    supabase
      .from("transactions")
      .select("id, description, amount, transaction_codings!left(transaction_id)")
      .eq("is_deleted_by_source", false)
      .is("transaction_codings.transaction_id", null),
  ]);

  if (categoriesResp.error) return NextResponse.json({ error: categoriesResp.error.message }, { status: 400 });
  if (uncodedResp.error) return NextResponse.json({ error: uncodedResp.error.message }, { status: 400 });

  const categoryTypeById = new Map((categoriesResp.data ?? []).map((c) => [c.id, c.type]));
  const now = new Date().toISOString();

  const codedRows = [];
  for (const txn of uncodedResp.data ?? []) {
    const rule = matchRule(txn.description, rules);
    if (!rule) continue;
    if (categoryTypeById.get(rule.category_id) !== "overhead") continue;

    codedRows.push({
      transaction_id: txn.id,
      category_id: rule.category_id,
      retreat_id: null,
      amount: txn.amount,
      coded_by: authed.user.id,
      coded_at: now,
      updated_by: authed.user.id,
      updated_at: now,
    });
  }

  if (codedRows.length === 0) {
    return NextResponse.json({ coded: 0 });
  }

  // These rows are provably for transactions with zero existing codings
  // (guaranteed by the uncoded query filter above), so a plain insert is
  // correct -- there's no conflict to handle, and transaction_id is no
  // longer unique for upsert's onConflict target to resolve against.
  const { error: insertError } = await supabase.from("transaction_codings").insert(codedRows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "transaction.autocoded",
    entityType: "transaction",
    entityId: codedRows[0].transaction_id,
    metadata: { count: codedRows.length },
  });

  return NextResponse.json({ coded: codedRows.length });
}
