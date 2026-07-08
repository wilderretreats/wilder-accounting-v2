import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Normalizes any date string to the first of its month, per the retreats table's constraint. */
function toFirstOfMonth(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.length === 7 ? "-01" : ""));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const supabase = await createClient();
  let query = supabase
    .from("retreats")
    .select("*, client:clients(name), ops_owner:ops_owners(name)")
    .order("retreat_month", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const shaped = (data ?? []).map((r) => ({
    ...r,
    client_name: r.client?.name ?? null,
    ops_owner_name: r.ops_owner?.name ?? null,
  }));

  return NextResponse.json({ retreats: shaped });
}

const createSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  retreatMonth: z.string(), // ISO date or YYYY-MM
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  opsOwnerId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
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
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retreats")
    .insert({
      client_id: input.clientId,
      name: input.name,
      retreat_month: toFirstOfMonth(input.retreatMonth),
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      ops_owner_id: input.opsOwnerId ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "A retreat with this client, name, and month already exists." : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ retreat: data }, { status: 201 });
}
