import { prisma } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { ServiceBody } from "@/domain/service-schema";

export const runtime = "nodejs";

/** POST /api/v1/services - add a client-specific service (admin). */
export const POST = handler(async (req, _ctx, requestId) => {
  const actor = await requireApiActor(req, "settings:manage");
  const body = ServiceBody.parse(await req.json());
  const exists = await prisma.service.findUnique({ where: { organizationId_code: { organizationId: actor.organizationId, code: body.code } } });
  if (exists) throw new ApiError("VALIDATION_ERROR", undefined, { code: "Code already used" });
  const svc = await prisma.service.create({ data: { ...body, organizationId: actor.organizationId } });
  return json(svc, 201, requestId);
});
