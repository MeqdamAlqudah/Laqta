import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { randomToken } from "@/lib/crypto";

export const runtime = "nodejs";

const InviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]),
});

/**
 * POST /api/v1/users - invite a staff member. Returns a one-time temporary
 * password for the admin to share; it is stored only as a bcrypt hash.
 */
export const POST = handler(async (req, _ctx, requestId) => {
  const actor = await requireApiActor(req, "users:manage");
  const input = InviteSchema.parse(await req.json());
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new ApiError("VALIDATION_ERROR", undefined, { email: "A user with this email already exists" });
  }
  const tempPassword = randomToken(9);
  const user = await prisma.user.create({
    data: { ...input, organizationId: actor.organizationId, passwordHash: await bcrypt.hash(tempPassword, 10) },
  });
  return json({ id: user.id, email: user.email, role: user.role, tempPassword }, 201, requestId);
});
