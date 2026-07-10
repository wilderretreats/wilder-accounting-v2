import { NextResponse } from "next/server";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

/**
 * Admin-only. inviteUserByEmail() errors for an email already in auth.users,
 * so re-sending access to someone already in the system (e.g. they never
 * finished setting a password) goes through the password-recovery flow
 * instead -- it works regardless of whether the user ever set a password,
 * and lands on the same /reset-password page. Note this sends Supabase's
 * "Reset Password" email template, not "Invite".
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin"])) {
    return NextResponse.json({ error: "Only admins can manage users" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .eq("id", id)
    .single();
  if (profileError || !profile?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: resendError } = await admin.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  if (resendError) {
    return NextResponse.json({ error: resendError.message }, { status: 400 });
  }

  await writeAuditLog({
    actorId: authed.user.id,
    action: "user.invite_resent",
    entityType: "profile",
    entityId: id,
    metadata: { email: profile.email },
  });

  return NextResponse.json({ ok: true });
}
