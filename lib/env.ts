import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  PLAID_CLIENT_ID: z.string().min(1),
  PLAID_SECRET: z.string().min(1),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]),

  // 32-byte key, base64-encoded (`openssl rand -base64 32`), used for
  // AES-256-GCM encryption of Plaid access tokens at rest.
  PLAID_TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Shared secret Plaid does NOT send us — used only to protect our own
  // Vercel Cron endpoint from being triggered by anyone else.
  CRON_SECRET: z.string().min(1),
});

/**
 * Validated only when called (not at module import time), so pages/routes
 * that don't touch these vars (e.g. static marketing pages, if any) don't
 * fail to build in environments where secrets aren't set yet.
 */
export function getEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Missing or invalid environment variables: ${missing}. See .env.local.example.`
    );
  }
  return parsed.data;
}
