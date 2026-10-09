import { z } from "zod";
import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { findLead, serializeLead, updateLead } from "@/services/lead.service";
import { LEAD_STATUSES } from "@/domain/lead/status";
import { logSecurityEvent } from "@/services/security.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/leads/{id} - details + timeline. */
export const GET = handler<Ctx>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "lead:read");
  const { id } = await params;
  const lead = await findLead(actor, id);
  if (!lead) {
    // Could be another tenant's lead: same 404 either way, but log it.
    await logSecurityEvent({ type: "LEAD_ACCESS_DENIED", organizationId: actor.organizationId, actorId: actor.id, detail: { leadId: id } });
    throw new ApiError("NOT_FOUND");
  }
  return json(serializeLead(actor, lead), 200, requestId);
});

const PatchSchema = z.object({
  version: z.number().int().min(1),
  status: z.enum(LEAD_STATUSES).optional(),
  ownerId: z.string().nullable().optional(),
  note: z.string().max(2000).optional(),
});

/** PATCH /api/v1/leads/{id} - owner, status, note. Optimistic locking via `version`. */
export const PATCH = handler<Ctx>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "lead:update");
  const { id } = await params;
  const patch = PatchSchema.parse(await req.json());
  const lead = await updateLead(actor, id, patch);
  return json({ id: lead.id, status: lead.status, ownerId: lead.ownerId, version: lead.version }, 200, requestId);
});
