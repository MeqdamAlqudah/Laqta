import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

// Gatekeeper for staff pages. API routes do their own (stronger, DB-backed) checks.
const STAFF_PREFIXES = ["/dashboard", "/leads", "/settings", "/integrations", "/users"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!STAFF_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/leads/:path*", "/settings/:path*", "/integrations/:path*", "/users/:path*"],
};
