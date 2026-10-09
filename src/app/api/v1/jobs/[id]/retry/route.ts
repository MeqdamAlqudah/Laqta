import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { retryJob } from "@/jobs/queue";

export const runtime = "nodejs";

/** POST /api/v1/jobs/{id}/retry - operator re-queues a dead-letter job. */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "integrations:manage");
  const { id } = await params;
  const res = await retryJob(actor.organizationId, id);
  if (res.count === 0) throw new ApiError("NOT_FOUND", "No dead job with that id");
  return json({ ok: true }, 200, requestId);
});
