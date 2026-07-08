import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import crypto from "node:crypto";
import { getPlaidClient } from "./client";

const MAX_TOKEN_AGE_SECONDS = 5 * 60;

interface CachedKey {
  jwk: JWK;
  expiredAt: string | null;
}

// Verification keys rotate infrequently; a short-lived in-memory cache
// avoids calling Plaid's key endpoint on every single webhook delivery.
const keyCache = new Map<string, CachedKey>();

async function getVerificationKey(keyId: string): Promise<CachedKey> {
  const cached = keyCache.get(keyId);
  if (cached) return cached;

  const plaid = getPlaidClient();
  const resp = await plaid.webhookVerificationKeyGet({ key_id: keyId });
  const key = resp.data.key as unknown as JWK & { expired_at?: string | null };
  const entry: CachedKey = { jwk: key, expiredAt: key.expired_at ?? null };
  keyCache.set(keyId, entry);
  return entry;
}

export interface WebhookVerifyResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies a Plaid webhook per Plaid's documented flow:
 *   1. Decode the JWT header (unverified) to get `kid`.
 *   2. Fetch the public key for that `kid` from Plaid (cached).
 *   3. Verify the JWT signature (ES256) using that key.
 *   4. Reject stale tokens (defense against a captured-and-replayed header).
 *   5. Verify `request_body_sha256` against a hash of the *actual* raw body
 *      received — this is the step naive implementations skip, and skipping
 *      it means a captured valid webhook could be replayed with a different
 *      (attacker-controlled) body.
 *
 * Always pass the raw request body text (not a re-serialized JSON object) —
 * re-serializing can change whitespace/key order and break the hash check
 * even for a legitimate request.
 */
export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string | null
): Promise<WebhookVerifyResult> {
  if (!verificationHeader) {
    return { valid: false, reason: "Missing Plaid-Verification header" };
  }

  let kid: string | undefined;
  try {
    kid = decodeProtectedHeader(verificationHeader).kid;
  } catch {
    return { valid: false, reason: "Malformed JWT header" };
  }
  if (!kid) return { valid: false, reason: "JWT header missing kid" };

  const { jwk, expiredAt } = await getVerificationKey(kid);
  if (expiredAt) {
    return { valid: false, reason: "Verification key has expired" };
  }

  let iat: number | undefined;
  let requestBodySha256: unknown;
  try {
    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(verificationHeader, key, {
      algorithms: ["ES256"],
    });
    iat = payload.iat;
    requestBodySha256 = payload.request_body_sha256;
  } catch {
    return { valid: false, reason: "JWT signature verification failed" };
  }

  if (!iat || Date.now() / 1000 - iat > MAX_TOKEN_AGE_SECONDS) {
    return { valid: false, reason: "JWT is stale (possible replay)" };
  }

  if (typeof requestBodySha256 !== "string") {
    return { valid: false, reason: "JWT missing request_body_sha256" };
  }

  const actualHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  if (actualHash !== requestBodySha256) {
    return { valid: false, reason: "request_body_sha256 mismatch — body may have been tampered with" };
  }

  return { valid: true };
}
