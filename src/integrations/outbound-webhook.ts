import { signPayload } from "./webhook-signature";

/**
 * Sends a signed JSON event to an automation endpoint (n8n webhook node,
 * Make custom webhook, or a Google Apps Script web app that writes to Sheets).
 * The Idempotency-Key header lets the receiver ignore retried deliveries.
 */
export async function postSignedWebhook(opts: {
  url: string;
  secret: string;
  event: string;
  idempotencyKey: string;
  data: unknown;
  timeoutMs?: number;
}) {
  const body = JSON.stringify({ event: opts.event, idempotencyKey: opts.idempotencyKey, data: opts.data });
  const { timestamp, signature } = signPayload(opts.secret, body);
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": opts.idempotencyKey,
      "x-leadflow-timestamp": timestamp,
      "x-leadflow-signature": signature,
    },
    body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Webhook ${opts.event} failed with HTTP ${res.status}`);
  }
  return res.status;
}
