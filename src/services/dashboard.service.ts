import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { overdueWhere, scopeFor } from "@/repositories/lead.repository";

/**
 * Pipeline and SLA statistics. Uses the same scope as the lead list so the
 * dashboard totals always match the list for the same user (definition of done).
 */
export async function dashboardSummary(actor: Actor, opts: { from?: Date; to?: Date } = {}) {
  const base = scopeFor(actor);
  const where = {
    AND: [base, ...(opts.from ? [{ createdAt: { gte: opts.from } }] : []), ...(opts.to ? [{ createdAt: { lte: opts.to } }] : [])],
  };

  const [byStatus, bySource, overdue, contacted] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["sourceChannel"], where, _count: { _all: true } }),
    prisma.lead.count({ where: { AND: [where, overdueWhere()] } }),
    prisma.lead.findMany({
      where: { AND: [where, { firstContactedAt: { not: null } }] },
      select: { createdAt: true, firstContactedAt: true, slaDueAt: true },
      take: 1000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const status: Record<string, number> = { NEW: 0, ASSIGNED: 0, CONTACTED: 0, QUALIFIED: 0, WON: 0, LOST: 0 };
  for (const r of byStatus) status[r.status] = r._count._all;

  const responseMinutes = contacted
    .map((l) => (l.firstContactedAt!.getTime() - l.createdAt.getTime()) / 60_000)
    .sort((a, b) => a - b);
  const median = responseMinutes.length ? responseMinutes[Math.floor(responseMinutes.length / 2)]! : null;
  const withinSla = contacted.filter((l) => l.slaDueAt && l.firstContactedAt! <= l.slaDueAt).length;

  return {
    status,
    total: Object.values(status).reduce((a, b) => a + b, 0),
    open: status.NEW! + status.ASSIGNED! + status.CONTACTED! + status.QUALIFIED!,
    overdue,
    sources: Object.fromEntries(bySource.map((s) => [s.sourceChannel, s._count._all])),
    medianFirstResponseMinutes: median === null ? null : Math.round(median),
    contactedWithinSlaPct: contacted.length ? Math.round((withinSla / contacted.length) * 100) : null,
  };
}

export type DashboardSummary = Awaited<ReturnType<typeof dashboardSummary>>;
