import { createPlatformClient } from "@/lib/supabase/platform-client";

export interface PlatformRetreatOption {
  id: string;
  name: string;
  slug: string;
  organization_name: string | null;
}

/** organizations is a many-to-one FK, so PostgREST returns a single object at runtime. */
interface PlatformRetreatRow {
  id: string;
  name: string;
  slug: string;
  organization: { name: string } | null;
}

/** Every Retreats Platform retreat not yet linked to an accounting retreat — for the linking dropdown. */
export async function listUnlinkedPlatformRetreats(): Promise<PlatformRetreatOption[]> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("retreats")
    .select("id, name, slug, organization:organizations(name)")
    .is("accounting_retreat_id", null)
    .order("name");
  if (error) throw error;

  return ((data ?? []) as unknown as PlatformRetreatRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    organization_name: r.organization?.name ?? null,
  }));
}

/** The Retreats Platform retreat currently linked to this accounting retreat, if any. */
export async function getLinkedPlatformRetreat(
  accountingRetreatId: string
): Promise<PlatformRetreatOption | null> {
  const supabase = createPlatformClient();
  const { data, error } = await supabase
    .from("retreats")
    .select("id, name, slug, organization:organizations(name)")
    .eq("accounting_retreat_id", accountingRetreatId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PlatformRetreatRow;
  return { id: row.id, name: row.name, slug: row.slug, organization_name: row.organization?.name ?? null };
}

/**
 * Sets (or clears, with platformRetreatId = null) which Retreats Platform
 * retreat this accounting retreat is linked to. Clears any other platform
 * retreat previously pointing at this same accounting retreat first, so a
 * link never ends up shared by two platform retreats at once.
 */
export async function setPlatformRetreatLink(
  accountingRetreatId: string,
  platformRetreatId: string | null
): Promise<void> {
  const supabase = createPlatformClient();

  const { error: clearError } = await supabase
    .from("retreats")
    .update({ accounting_retreat_id: null })
    .eq("accounting_retreat_id", accountingRetreatId);
  if (clearError) throw clearError;

  if (platformRetreatId) {
    const { error } = await supabase
      .from("retreats")
      .update({ accounting_retreat_id: accountingRetreatId })
      .eq("id", platformRetreatId);
    if (error) throw error;
  }
}
