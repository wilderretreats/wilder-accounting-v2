import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedProfile, hasRole } from "@/lib/auth";
import {
  getLinkedPlatformRetreat,
  listUnlinkedPlatformRetreats,
  setPlatformRetreatLink,
} from "@/lib/platform-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [current, unlinked] = await Promise.all([
    getLinkedPlatformRetreat(id),
    listUnlinkedPlatformRetreats(),
  ]);

  // The currently-linked retreat won't show up in the "unlinked" list (it's
  // linked, to this one) — add it back in so it's still selectable.
  const options = current ? [current, ...unlinked] : unlinked;

  return NextResponse.json({ current, options });
}

const linkSchema = z.object({
  platformRetreatId: z.string().uuid().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await getAuthedProfile();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(authed.profile, ["admin", "ops", "ops_manager"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = linkSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await setPlatformRetreatLink(id, parsed.data.platformRetreatId);
  return NextResponse.json({ ok: true });
}
