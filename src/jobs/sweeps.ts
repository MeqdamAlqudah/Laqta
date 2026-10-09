import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { parseSettings } from "@/domain/settings";
import { localClock } from "@/domain/sla";
import { anonymizeLead } from "@/services/lead.service";
import { enqueue } from "./queue";

/**
 * Periodic "sweeps" (scheduled jobs). Each one is safe to run as often as you
 * like because it relies on conditional updates and unique idempotency keys.
 */

/** Stage 9 - Remind: escalate leads still NEW/ASSIGNED after their SLA, exactly once. */
export async function slaSweep(now = new Date()) {
  const overdue = await prisma.lead.findMany({
    where: { status: { in: ["NEW", "ASSIGNED"] }, slaDueAt: { lt: now }, slaEscalatedAt: null, anonymizedAt: null },
    select: { id: true, organizationId: true },
    take: 200,
  });
  let escalated = 0;
  for (const lead of overdue) {
    await prisma.$transaction(async (tx) => {
      // Conditional update = the "once" guarantee even with parallel sweeps.
      const res = await tx.lead.updateMany({ where: { id: lead.id, slaEscalatedAt: null }, data: { slaEscalatedAt: now } });
      if (res.count === 0) return;
      await tx.leadActivity.create({ data: { leadId: lead.id, type: "SLA_ESCALATED", metadata: { at: now.toISOString() } } });
      await enqueue(tx, [{ organizationId: lead.organizationId, leadId: lead.id, jobType: "SLA_ESCALATION", idempotencyKey: `sla:${lead.id}` }]);
      escalated++;
    });
  }
  return escalated;
}

/** Reconciliation: leads missing their Sheet/CRM sync job get one (spec section 8). */
export async function reconciliationSweep() {
  const orgs = await prisma.integration.findMany({ where: { provider: "SHEETS_WEBHOOK", enabled: true }, select: { organizationId: true } });
  let enqueued = 0;
  for (const { organizationId } of orgs) {
    const missing = await prisma.lead.findMany({
      where: {
        organizationId,
        anonymizedAt: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000), lt: new Date(Date.now() - 10 * 60_000) },
        jobs: { none: { jobType: "SYNC_SHEET" } },
      },
      select: { id: true },
      take: 200,
    });
    await enqueue(
      prisma,
      missing.map((l) => ({ organizationId, leadId: l.id, jobType: "SYNC_SHEET" as const, idempotencyKey: `sync:${l.id}` })),
    );
    enqueued += missing.length;
  }
  return enqueued;
}

/** Stage 10 - Report: one DAILY_SUMMARY per org per local day, sent after 18:00 local time. */
export async function dailySummarySweep(now = new Date()) {
  const orgs = await prisma.organization.findMany();
  let queued = 0;
  for (const org of orgs) {
    const { minutes } = localClock(now, org.timezone);
    if (minutes < 18 * 60) continue;
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: org.timezone }).format(now); // YYYY-MM-DD
    await enqueue(prisma, [
      { organizationId: org.id, jobType: "DAILY_SUMMARY", idempotencyKey: `daily:${org.id}:${localDate}`, payload: { date: localDate } },
    ]);
    queued++;
  }
  return queued;
}

/** Privacy: anonymize leads older than each organization's retention period. */
export async function retentionSweep(now = new Date()) {
  const orgs = await prisma.organization.findMany();
  let anonymized = 0;
  for (const org of orgs) {
    const { retentionDays } = parseSettings(org.settings);
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 3600_000);
    const expired = await prisma.lead.findMany({
      where: { organizationId: org.id, anonymizedAt: null, createdAt: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });
    for (const l of expired) {
      if (await anonymizeLead(null, org.id, l.id, `retention ${retentionDays} days`)) anonymized++;
    }
  }
  return anonymized;
}

export async function runAllSweeps() {
  const result = {
    escalated: await slaSweep(),
    reconciled: await reconciliationSweep(),
    dailySummaries: await dailySummarySweep(),
    anonymized: await retentionSweep(),
  };
  if (Object.values(result).some((v) => v > 0)) logger.info("sweeps_completed", result);
  return result;
}
