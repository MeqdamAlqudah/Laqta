import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";

export const runtime = "nodejs";

const Body = z.object({
  role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]).optional(),
  active: z.boolean().optional(),
});

/** PATCH /api/v1/users/{id} - change role or deactivate (admin). Users are never hard-deleted. */
export const PATCH = handler<{ params: Promise<{ id: string }> }>(async (req, { params }, requestId) => {
  const actor = await requireApiActor(req, "users:manage");
  const { id } = await params;
  const body = Body.parse(await req.json());
  if (id === actor.id && (body.active === false || (body.role && body.role !== "ADMIN"))) {
    throw new ApiError("VALIDATION_ERROR", "You cannot demote or deactivate yourself");
  }
  const res = await prisma.user.updateMany({ where: { id, organizationId: actor.organizationId }, data: body });
  if (res.count === 0) throw new ApiError("NOT_FOUND");
  return json({ ok: true }, 200, requestId);
});
