import { handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { testIntegration } from "@/services/integration.service";

export const runtime = "nodejs";

/** POST /api/v1/integrations/{id}/test - admin only. */
export const POST = handler<{ params: Promise<{ id: string }> }>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "integrations:manage");
  const { id } = await params;
  return json(await testIntegration(actor, id), 200, requestId);
});
