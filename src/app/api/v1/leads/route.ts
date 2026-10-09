import { after } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listLeads, type LeadFilters } from "@/repositories/lead.repository";
import { serializeLead } from "@/services/lead.service";
import { intakeLead } from "@/services/lead-intake.service";
import { websiteAdapter } from "@/adapters/website";
import { processJobsForLead } from "@/jobs/worker";

export const runtime = "nodejs";

function filtersFrom(url: URL): LeadFilters {
  const p = url.searchParams;
  return {
    status: p.get("status") ?? undefined,
    owner: p.get("owner") ?? undefined,
    service: p.get("service") ?? undefined,
    source: p.get("source") ?? undefined,
    q: p.get("q") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    page: Number(p.get("page") ?? 1),
    pageSize: Number(p.get("pageSize") ?? 25),
  };
}

/** GET /api/v1/leads - list/filter (tenant-scoped). `?format=csv` exports (manager+). */
export const GET = handler(async (req, _ctx, requestId) => {
  const actor = await requireApiActor(req, "lead:read");
  const url = new URL(req.url);
  const filters = filtersFrom(url);

  if (url.searchParams.get("format") === "csv") {
    if (!can(actor.role, "lead:export")) throw new ApiError("FORBIDDEN");
    const { items } = await listLeads(actor, { ...filters, page: 1, pageSize: 200 });
    const header = ["reference", "created_at", "full_name", "phone", "email", "service", "status", "owner", "source", "campaign"];
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`; // CSV-injection safe
    const rows = items.map((l) =>
      [l.reference, l.createdAt.toISOString(), l.fullName, l.phoneE164, l.email, l.service?.nameEn, l.status, l.owner?.name, l.sourceChannel, l.sourceCampaign]
        .map(cell)
        .join(","),
    );
    return new Response([header.join(","), ...rows].join("\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads.csv"`, "x-request-id": requestId },
    });
  }

  const result = await listLeads(actor, filters);
  return json({ ...result, items: result.items.map((l) => serializeLead(actor, l)) }, 200, requestId);
});

/** POST /api/v1/leads - staff "+ Add lead" (phone call, walk-in). Same pipeline as the public form. */
export const POST = handler(async (req, _ctx, requestId) => {
  const actor = await requireApiActor(req, "lead:create");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId } });
  const body = await req.json();
  const result = await intakeLead({
    org,
    adapter: websiteAdapter,
    raw: { ...body, source: { channel: "manual" }, consent: { accepted: true, policyVersion: "staff-entry" } },
    ip: clientIp(req),
    requestId,
    actorId: actor.id,
  });
  if (result.outcome === "created") after(() => processJobsForLead(result.leadId).catch(() => undefined));
  return json(result, result.outcome === "replayed" ? 200 : 201, requestId);
});
