import { clearSessionCookie } from "@/lib/auth/session";
import { handler, json } from "@/lib/http";

export const POST = handler(async (_req, _ctx, requestId) => {
  await clearSessionCookie();
  return json({ ok: true }, 200, requestId);
});
