import { hmacSha256, safeEqual } from "@/lib/crypto";

/**
 * Signed webhook scheme (used in BOTH directions: providers -> LeadFlow and
 * LeadFlow -> n8n/Sheets):
 *   x-leadflow-timestamp: unix seconds
 *   x-leadflow-signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
 * Timestamp tolerance blocks old captured requests; the signature cache
 * (webhook_events table) blocks exact replays inside the window.
 */
export const SIGNATURE_HEADER = "x-leadflow-signature";
export const TIMESTAMP_HEADER = "x-leadflow-timestamp";
export const TOLERANCE_SECONDS = 300;

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return { timestamp: String(timestamp), signature: `sha256=${hmacSha256(secret, `${timestamp}.${body}`)}` };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" };

export function verifySignature(
  secret: string,
  body: string,
  timestamp: string | null,
  signature: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!timestamp || !signature) return { ok: false, reason: "missing" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return { ok: false, reason: "stale" };
  const expected = `sha256=${hmacSha256(secret, `${timestamp}.${body}`)}`;
  return safeEqual(expected, signature) ? { ok: true } : { ok: false, reason: "mismatch" };
}
