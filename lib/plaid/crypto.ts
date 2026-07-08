import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, GCM standard

export interface EncryptedToken {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

function getKey(): Buffer {
  const env = getEnv();
  const key = Buffer.from(env.PLAID_TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      `PLAID_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32"
    );
  }
  return key;
}

/** Encrypts a Plaid access token for storage. Never call this client-side. */
export function encryptToken(plaintext: string): EncryptedToken {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Decrypts a stored Plaid access token. Only call this immediately before a
 * Plaid API call — never log or return the result in an API response.
 */
export function decryptToken(encrypted: EncryptedToken): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(encrypted.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

const SENSITIVE_KEYS = new Set([
  "access_token",
  "public_token",
  "link_token",
  "account_number",
  "routing_number",
]);

/**
 * Deep-clones an object with any known-sensitive keys redacted. Wrap every
 * Plaid client response/error in this before it touches console.log/error
 * or any error-tracking integration — Plaid errors can embed the request
 * body (including access_token) in `error.response.data`.
 */
export function redactForLogging(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForLogging);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[redacted]" : redactForLogging(v);
    }
    return out;
  }
  return value;
}
