import { after } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handler, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { websiteAdapter } from "@/adapters/website";
import { intakeLead } from "@/services/lead-intake.service";
import { processJobsForLead } from "@/jobs/worker";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;

// The form can be embedded on the client's own website (another origin).
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-leadflow-key",
  "access-control-max-age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * POST /api/v1/public/leads
 * Stage 1 (Receive): request id, size limit, rate limit, tenant lookup by
 * public origin key, then the intake pipeline. Responds right after the DB
 * commit; notifications run afterwards (after()) and in the worker.
 */
export const POST = handler(async (req, _ctx, requestId) => {
  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > MAX_BODY_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE");

  const ip = clientIp(req);
  const ipLimit = await rateLimit(`public:ip:${ip}`, 10, 60_000);
  if (!ipLimit.allowed) throw new ApiError("RATE_LIMITED", "Too many submissions. Please wait a minute.");

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Body must be JSON");
  }

  const key = req.headers.get("x-leadflow-key") ?? (body.orgKey as string | undefined);
  const org = key ? await prisma.organization.findUnique({ where: { publicKey: key } }) : null;
  if (!org) throw new ApiError("UNAUTHENTICATED", "Unknown form key");

  const orgLimit = await rateLimit(`public:org:${org.id}`, 300, 60_000);
  if (!orgLimit.allowed) throw new ApiError("RATE_LIMITED");

  const result = await intakeLead({ org, adapter: websiteAdapter, raw: body, ip, requestId });

  if (result.outcome === "created") {
    // Fast path: start notifications right after responding. If the server
    // dies, the jobs are still PENDING in the DB and the worker picks them up.
    after(() => processJobsForLead(result.leadId).catch((err) => logger.error("after_jobs_failed", { error: err })));
  }

  const status = result.outcome === "replayed" ? 200 : 201;
  const res = json(
    { leadId: result.leadId || undefined, reference: result.reference, status: result.status, message: result.message },
    status,
    requestId,
  );
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
});
