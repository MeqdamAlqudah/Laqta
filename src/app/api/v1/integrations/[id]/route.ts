import { z } from "zod";
import { handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { updateIntegration } from "@/services/integration.service";

export const runtime = "nodejs";

const Body = z.object({
  enabled: z.boolean().optional(),
  url: z.string().max(500).optional(),
  secret: z.string().max(200).optional(),
});

/** PUT /api/v1/integrations/{id} - enable/disable and configure (admin). */
export const PUT = handler<{ params: Promise<{ id: string }> }>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "integrations:manage");
  const { id } = await params;
  const updated = await updateIntegration(actor, id, Body.parse(await req.json()));
  return json({ id: updated.id, enabled: updated.enabled, configuration: updated.configuration }, 200, requestId);
});
