import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ops_owners")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ opsOwners: data });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(200) });

/** Returns the existing owner if the name already exists, instead of erroring on the unique constraint. */
export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ops_owners")
    .select("*")
    .eq("name", parsed.data.name)
    .maybeSingle();
  if (existing) return NextResponse.json({ opsOwner: existing });

  const { data, error } = await supabase
    .from("ops_owners")
    .insert({ name: parsed.data.name })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ opsOwner: data }, { status: 201 });
}
