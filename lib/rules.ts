import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRule } from "@/types";

export async function getCategoryRules(supabase: SupabaseClient): Promise<CategoryRule[]> {
  const { data, error } = await supabase
    .from("category_rules")
    .select("*")
    .order("priority", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Longest matching keyword wins when multiple rules match a description. */
export function matchRule(description: string, rules: CategoryRule[]): CategoryRule | null {
  const haystack = description.toLowerCase();
  let best: CategoryRule | null = null;

  for (const rule of rules) {
    const needle = rule.keyword.toLowerCase();
    if (haystack.includes(needle) && (!best || needle.length > best.keyword.length)) {
      best = rule;
    }
  }

  return best;
}
