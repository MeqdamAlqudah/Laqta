import { prisma } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { ServiceBody } from "@/domain/service-schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/v1/services/{id} - rename, toggle, change routing rule (admin). */
export const PATCH = handler<Ctx>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "settings:manage");
  const { id } = await params;
  const body = ServiceBody.omit({ code: true }).partial().parse(await req.json());
  const res = await prisma.service.updateMany({ where: { id, organizationId: actor.organizationId, deletedAt: null }, data: body });
  if (res.count === 0) throw new ApiError("NOT_FOUND");
  return json({ ok: true }, 200, requestId);
});

/** DELETE /api/v1/services/{id} - soft delete; existing leads keep their service. */
export const DELETE = handler<Ctx>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "settings:manage");
  const { id } = await params;
  const res = await prisma.service.updateMany({
    where: { id, organizationId: actor.organizationId, deletedAt: null },
    data: { deletedAt: new Date(), active: false },
  });
  if (res.count === 0) throw new ApiError("NOT_FOUND");
  return json({ ok: true }, 200, requestId);
});
