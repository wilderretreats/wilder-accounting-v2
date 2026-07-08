import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategories, createCategory } from "@/lib/categories";
import type { CategoryType } from "@/types";

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") as CategoryType | null;
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const supabase = await createClient();
  const categories = await getCategories(supabase, {
    type: type ?? undefined,
    includeInactive,
  });

  return NextResponse.json({ categories });
}

const createSchema = z.object({
  type: z.enum(["revenue", "cogs", "overhead"]),
  name: z.string().trim().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
});

/** Any signed-in admin/ops user can add a category inline — no separate approval gate. */
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
  try {
    const category = await createCategory(supabase, {
      type: parsed.data.type,
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
      createdBy: authed.user.id,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
