import { z } from "zod";
import { handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { addActivity } from "@/services/lead.service";

export const runtime = "nodejs";

const Body = z.object({
  type: z.enum(["CALL", "MESSAGE", "NOTE", "EMAIL_SENT"]),
  text: z.string().trim().min(1, "Write something").max(2000),
  metadata: z.record(z.string(), z.string().max(200)).optional(),
});

/** POST /api/v1/leads/{id}/activities - record a call, message or note (staff or automation). */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "lead:update");
  const { id } = await params;
  const body = Body.parse(await req.json());
  const activity = await addActivity(actor, id, body.type, body.text, { ...(body.metadata ?? {}), via: actor.kind });
  return json(activity, 201, requestId);
});
