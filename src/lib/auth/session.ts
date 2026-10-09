import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";
import { can, type Permission } from "./rbac";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type Role } from "./token";
import { logSecurityEvent } from "@/services/security.service";

export interface Actor {
  id: string | null; // null for service (automation) callers
  organizationId: string;
  role: Role;
  name: string;
  kind: "user" | "service";
}

export async function createSessionCookie(user: { id: string; organizationId: string; role: Role; name: string }) {
  const token = await signSession({ sub: user.id, org: user.organizationId, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Loads the signed-in user and re-checks the DB so deactivated users lose access immediately. */
export async function getActor(): Promise<Actor | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.active) return null;
  return { id: user.id, organizationId: user.organizationId, role: user.role, name: user.name, kind: "user" };
}

/** For server components/pages: redirect to /login when not signed in. */
export async function requirePageActor(permission?: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (permission && !can(actor.role, permission)) redirect("/dashboard?denied=1");
  return actor;
}

/**
 * For API routes: accepts a staff session cookie, or a service token
 * (`Authorization: Bearer <SERVICE_API_TOKEN>` + `x-leadflow-org: <slug>`)
 * used by n8n/Make. Service callers get least-privilege AGENT-like scope.
 */
export async function requireApiActor(req: Request, permission?: Permission): Promise<Actor> {
  let actor = await getActor();

  const auth = req.headers.get("authorization");
  if (!actor && auth?.startsWith("Bearer ") && env.serviceApiToken) {
    if (safeEqual(auth.slice(7), env.serviceApiToken)) {
      const org = await prisma.organization.findUnique({ where: { slug: req.headers.get("x-leadflow-org") ?? "" } });
      if (org) actor = { id: null, organizationId: org.id, role: "AGENT", name: "automation", kind: "service" };
    }
  }

  if (!actor) throw new ApiError("UNAUTHENTICATED");
  if (permission && !can(actor.role, permission)) {
    await logSecurityEvent({ type: "PERMISSION_DENIED", organizationId: actor.organizationId, actorId: actor.id, detail: { permission } });
    throw new ApiError("FORBIDDEN");
  }
  return actor;
}
