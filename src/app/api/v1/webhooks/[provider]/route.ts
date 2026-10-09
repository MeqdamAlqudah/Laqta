import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError, clientIp, handler, json } from "@/lib/http";
import { getAdapter, WEBHOOK_PROVIDERS } from "@/adapters";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from "@/integrations/webhook-signature";
import { intakeLead } from "@/services/lead-intake.service";
import { logSecurityEvent } from "@/services/security.service";
import { processJobsForLead } from "@/jobs/worker";
import { after } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/v1/webhooks/{provider}?org=<slug>
 * Channel adapters for google-forms, meta, whatsapp. Requests must be signed
 * (HMAC + timestamp) - see src/integrations/webhook-signature.ts.
 */
export const POST = handler<{ params: Promise<{ provider: string }> }>(async (req, { params }, requestId) => {
  const { provider } = await params;
  const adapter = getAdapter(provider);
  if (!adapter || !WEBHOOK_PROVIDERS.includes(provider)) throw new ApiError("NOT_FOUND", "Unknown provider");

  const raw = await req.text();
  if (raw.length > 64 * 1024) throw new ApiError("PAYLOAD_TOO_LARGE");

  if (!env.webhookSecret) throw new ApiError("INVALID_SIGNATURE", "Webhooks are not configured");
  const signature = req.headers.get(SIGNATURE_HEADER);
  const check = verifySignature(env.webhookSecret, raw, req.headers.get(TIMESTAMP_HEADER), signature);
  if (!check.ok) {
    await logSecurityEvent({ type: "WEBHOOK_SIGNATURE_REJECTED", detail: { provider, reason: check.reason, requestId } });
    throw new ApiError("INVALID_SIGNATURE");
  }

  // Replay protection: each valid signature is accepted once.
  try {
    await prisma.webhookEvent.create({
      data: { provider, signature: createHash("sha256").update(signature!).digest("hex") },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await logSecurityEvent({ type: "WEBHOOK_REPLAY_REJECTED", detail: { provider, requestId } });
      throw new ApiError("CONFLICT", "Replay detected");
    }
    throw err;
  }

  const slug = new URL(req.url).searchParams.get("org") ?? req.headers.get("x-leadflow-org");
  const org = slug ? await prisma.organization.findUnique({ where: { slug } }) : null;
  if (!org) throw new ApiError("NOT_FOUND", "Unknown organization");

  const result = await intakeLead({ org, adapter, raw: JSON.parse(raw), ip: clientIp(req), requestId });
  if (result.outcome === "created") after(() => processJobsForLead(result.leadId).catch(() => undefined));
  return json({ leadId: result.leadId, reference: result.reference, status: result.status, outcome: result.outcome }, result.outcome === "replayed" ? 200 : 201, requestId);
});
