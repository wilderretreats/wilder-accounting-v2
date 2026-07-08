import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "ops", "viewer"]).default("ops"),
});

/**
 * Admin-only. Uses the Supabase Auth Admin API (service-role client) to send
 * an invite email; the new profiles row is created by the handle_new_user()
 * trigger on auth.users insert, then this route sets the requested role.
 */
export async function POST(request: Request) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Only admins can invite users" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email
  );
  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Failed to invite user" },
      { status: 400 }
    );
  }

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", invited.user.id);
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 });

  await writeAuditLog({
    actorId: authed.user.id,
    action: "user.invited",
    entityType: "profile",
    entityId: invited.user.id,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}
