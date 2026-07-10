import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types";

export interface AuthedProfile {
  user: User;
  profile: Profile;
}

/** For Server Components/pages — redirects to /login instead of returning null. */
export async function requireProfile(): Promise<AuthedProfile> {
  const authed = await getAuthedProfile();
  if (!authed) redirect("/login");
  return authed;
}

/** For Server Components/pages restricted to specific roles — redirects to /dashboard if not permitted. */
export async function requireRole(allowed: Role[]): Promise<AuthedProfile> {
  const authed = await requireProfile();
  if (!hasRole(authed.profile, allowed)) redirect("/dashboard");
  return authed;
}

/** For Route Handlers — callers decide how to respond (401 JSON, etc). */
export async function getAuthedProfile(): Promise<AuthedProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (error || !profile) return null;
  return { user, profile };
}

export function hasRole(profile: Profile, allowed: Role[]): boolean {
  return allowed.includes(profile.role);
}
