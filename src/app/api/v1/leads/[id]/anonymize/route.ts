import { z } from "zod";
import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { anonymizeLead } from "@/services/lead.service";

export const runtime = "nodejs";

const Body = z.object({ reason: z.string().trim().min(3).max(200) });

/** POST /api/v1/leads/{id}/anonymize - privacy deletion request (admin). Audit trail is kept. */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "lead:anonymize");
  const { id } = await params;
  const { reason } = Body.parse(await req.json());
  const done = await anonymizeLead(actor, actor.organizationId, id, reason);
  if (!done) throw new ApiError("NOT_FOUND");
  return json({ ok: true }, 200, requestId);
});
