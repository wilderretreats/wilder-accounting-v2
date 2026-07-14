import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// account_label is free text (see lib/accounts.ts) -- there's no canonical
// accounts table to select from, so the filter dropdown's options come from
// whatever distinct values already exist on non-deleted transactions.
export async function GET() {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("account_label")
    .eq("is_deleted_by_source", false)
    .not("account_label", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const accounts = Array.from(
    new Set((data ?? []).map((r) => r.account_label as string).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ accounts });
}
