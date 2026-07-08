import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, CategoryType, CategoryWithParent } from "@/types";

export async function getCategories(
  supabase: SupabaseClient,
  opts: { type?: CategoryType; includeInactive?: boolean } = {}
): Promise<CategoryWithParent[]> {
  let query = supabase
    .from("categories")
    .select("*, parent:parent_id(name)")
    .order("sort_order", { ascending: true });

  if (opts.type) query = query.eq("type", opts.type);
  if (!opts.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { parent, ...rest } = row as Category & { parent: { name: string } | null };
    return { ...rest, parent_name: parent?.name ?? null };
  });
}

export async function createCategory(
  supabase: SupabaseClient,
  input: { type: CategoryType; name: string; parentId?: string | null; createdBy: string }
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({
      type: input.type,
      name: input.name.trim(),
      parent_id: input.parentId ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Groups a flat category list into { parent, children[] } for picker/settings UIs. */
export function groupCategoriesByParent(
  categories: CategoryWithParent[]
): Array<{ parent: CategoryWithParent; children: CategoryWithParent[] }> {
  const topLevel = categories.filter((c) => c.parent_id === null);
  const byParent = new Map<string, CategoryWithParent[]>();

  for (const c of categories) {
    if (c.parent_id) {
      if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, []);
      byParent.get(c.parent_id)!.push(c);
    }
  }

  return topLevel.map((parent) => ({
    parent,
    children: byParent.get(parent.id) ?? [],
  }));
}
