import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Single sign-on bridge. Team members sign in once at the Wilder Dashboard
 * (apps.discoverwilder.com), which sets a session cookie on .discoverwilder.com
 * for the Platform Supabase project. Accounting keeps its own Supabase project,
 * roles and RLS, so on page loads this proxy:
 *   - sends anyone without a dashboard session to the dashboard to sign in;
 *   - signs the same email into Accounting's project when it isn't already
 *     (a server-generated magic link, verified here, so no email is sent);
 *   - signs Accounting out when the dashboard session ends.
 * Only page routes run through here; API routes keep checking the Accounting
 * session themselves. With the SSO env vars unset (local dev), it does nothing.
 */
const SIGNIN_URL = process.env.NEXT_PUBLIC_SIGNIN_URL;
const SHARED_COOKIE_DOMAIN = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;
const PLATFORM_URL = process.env.PLATFORM_SUPABASE_URL;
const PLATFORM_ANON_KEY = process.env.PLATFORM_SUPABASE_ANON_KEY;

type PendingCookie = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

export async function proxy(request: NextRequest) {
  if (!SIGNIN_URL || !SHARED_COOKIE_DOMAIN || !PLATFORM_URL || !PLATFORM_ANON_KEY) {
    return NextResponse.next();
  }
  const path = request.nextUrl.pathname;

  // Both Supabase clients write into one list, applied to whichever response goes out.
  const pending: PendingCookie[] = [];
  const cookies = {
    getAll: () => request.cookies.getAll(),
    setAll: (list: PendingCookie[]) => {
      list.forEach((c) => {
        request.cookies.set(c.name, c.value);
        pending.push(c);
      });
    },
  };
  const withCookies = (res: NextResponse) => {
    pending.forEach((c) => res.cookies.set(c.name, c.value, c.options));
    return res;
  };

  const platform = createServerClient(PLATFORM_URL, PLATFORM_ANON_KEY, {
    cookieOptions: { name: "wilder-auth", domain: SHARED_COOKIE_DOMAIN, path: "/", sameSite: "lax", secure: true },
    cookies,
  });
  const local = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies,
  });

  const shared = (await platform.auth.getUser()).data.user;
  const localUser = (await local.auth.getUser()).data.user;
  const sharedEmail = shared?.email?.toLowerCase();

  if (!sharedEmail) {
    if (localUser) await local.auth.signOut();
    const to = new URL(SIGNIN_URL);
    const back = new URL(path === "/login" ? "/" : path + request.nextUrl.search, request.url);
    to.searchParams.set("next", back.toString());
    return withCookies(NextResponse.redirect(to));
  }

  if (localUser?.email?.toLowerCase() !== sharedEmail) {
    if (localUser) await local.auth.signOut();

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", sharedEmail.replace(/[\\%_]/g, "\\$&"))
      .eq("is_active", true)
      .maybeSingle();
    if (!profile) return withCookies(noAccess(sharedEmail));

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: sharedEmail });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) return withCookies(noAccess(sharedEmail));
    const { data: verified, error: verifyError } = await local.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (verifyError || verified.user?.id !== profile.id) {
      await local.auth.signOut();
      return withCookies(noAccess(sharedEmail));
    }
  } else if (path === "/login") {
    // The app sends people here when their profile is missing or inactive; stop the loop instead.
    const { data: profile } = await local.from("profiles").select("id").eq("id", localUser.id).eq("is_active", true).maybeSingle();
    if (!profile) return withCookies(noAccess(sharedEmail));
  }

  if (path === "/login") return withCookies(NextResponse.redirect(new URL("/", request.url)));
  return withCookies(NextResponse.next({ request }));
}

function noAccess(email: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>No access | Wilder Accounting</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b;display:grid;place-items:center;min-height:100vh;padding:16px}main{max-width:420px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:32px}h1{font-size:20px;margin:0 0 12px}p{color:#52525b;margin:0 0 12px}a{color:#18181b}</style></head>
<body><main><h1>No Accounting access</h1><p>${escapeHtml(email)} doesn't have an Accounting account. Ask Kirk to add you, or sign in with a different account.</p><p><a href="${escapeHtml(SIGNIN_URL ?? "/")}">Back to the Wilder Dashboard</a></p></main></body></html>`;
  return new NextResponse(html, { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const config = {
  // Pages only: API routes (including the Plaid webhook and cron), password reset and static files are left alone.
  matcher: ["/((?!api/|reset-password|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
