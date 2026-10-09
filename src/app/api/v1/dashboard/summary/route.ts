import { handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { dashboardSummary } from "@/services/dashboard.service";

export const runtime = "nodejs";

/** GET /api/v1/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD - aggregated metrics only. */
export const GET = handler(async (req, _ctx, requestId) => {
  const actor = await requireApiActor(req, "dashboard:read");
  const p = new URL(req.url).searchParams;
  const summary = await dashboardSummary(actor, {
    from: p.get("from") ? new Date(p.get("from")!) : undefined,
    to: p.get("to") ? new Date(`${p.get("to")}T23:59:59`) : undefined,
  });
  return json(summary, 200, requestId);
});
