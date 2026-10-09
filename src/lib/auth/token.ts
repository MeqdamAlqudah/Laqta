// Edge-safe session token helpers (used by middleware AND server code).
// Sessions are signed JWTs stored in an httpOnly, SameSite=Lax cookie.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "lf_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type Role = "ADMIN" | "MANAGER" | "AGENT" | "VIEWER";

export interface SessionClaims {
  sub: string; // user id
  org: string; // organization id (tenant)
  role: Role;
  name: string;
}

function secret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me-please");
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ org: claims.org, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return {
      sub: String(payload.sub),
      org: String(payload.org),
      role: payload.role as Role,
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}
