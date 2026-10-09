import { env } from "@/lib/env";
import { ApiError, handler, json } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";
import { processDueJobs } from "@/jobs/worker";
import { runAllSweeps } from "@/jobs/sweeps";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET|POST /api/v1/jobs/run  (Authorization: Bearer <CRON_SECRET>)
 * For serverless hosting (e.g. Vercel Cron every minute) instead of `npm run worker`.
 */
async function run(req: Request, requestId: string) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) throw new ApiError("UNAUTHENTICATED");
  const sweeps = await runAllSweeps();
  let processed = 0;
  for (let i = 0; i < 5; i++) {
    const n = await processDueJobs(25);
    processed += n;
    if (n === 0) break;
  }
  return json({ processed, sweeps }, 200, requestId);
}

export const GET = handler((req, _ctx, requestId) => run(req, requestId));
export const POST = handler((req, _ctx, requestId) => run(req, requestId));
