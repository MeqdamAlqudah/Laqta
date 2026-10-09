import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handler, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createSessionCookie } from "@/lib/auth/session";
import { logSecurityEvent } from "@/services/security.service";

export const runtime = "nodejs";

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), password: z.string().min(1).max(200) });

// Real hash of a random value: comparing against it costs the same time as a real user.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

export const POST = handler(async (req, _ctx, requestId) => {
  const { email, password } = LoginSchema.parse(await req.json());
  const ip = clientIp(req);
  const limit = await rateLimit(`login:${ip}:${email}`, 5, 15 * 60_000);
  if (!limit.allowed) throw new ApiError("RATE_LIMITED", "Too many attempts. Try again in 15 minutes.");

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    await logSecurityEvent({ type: "LOGIN_FAILED", organizationId: user?.organizationId, detail: { requestId } });
    throw new ApiError("UNAUTHENTICATED", "Invalid email or password");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSessionCookie(user);
  return json({ ok: true, user: { id: user.id, name: user.name, role: user.role } }, 200, requestId);
});
