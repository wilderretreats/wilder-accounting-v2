import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("category_rules")
    .select("*, category:categories(name, type)")
    .order("priority", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rules: data });
}

const createSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid(),
  priority: z.number().int().default(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

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
  const { data, error } = await supabase
    .from("category_rules")
    .insert({
      keyword: parsed.data.keyword,
      category_id: parsed.data.categoryId,
      priority: parsed.data.priority,
      notes: parsed.data.notes ?? null,
      created_by: authed.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
