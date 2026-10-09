import type { AutomationJob } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getEmailProvider } from "@/integrations/email";
import { deadJobAlert } from "@/integrations/templates";
import { claimDueJobs, markFailed, markSucceeded } from "./queue";
import { HANDLERS, JOB_PROVIDER } from "./handlers";

const JOB_TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Timed out after ${ms}ms`)), ms))]);
}

/** Runs one claimed job and records the outcome (Observer-style health updates). */
async function runJob(job: AutomationJob) {
  const handler = HANDLERS[job.jobType];
  const provider = JOB_PROVIDER[job.jobType];
  try {
    await withTimeout(handler(job), JOB_TIMEOUT_MS);
    await markSucceeded(job.id);
    if (provider) {
      await prisma.integration.updateMany({
        where: { organizationId: job.organizationId, provider },
        data: { lastSuccessAt: new Date() },
      });
    }
    logger.info("job_succeeded", { jobId: job.id, type: job.jobType, attempt: job.attempts });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const outcome = await markFailed(job, error);
    if (provider) {
      await prisma.integration.updateMany({
        where: { organizationId: job.organizationId, provider },
        data: { lastErrorAt: new Date(), lastError: error.slice(0, 500) },
      });
    }
    logger.warn("job_failed", { jobId: job.id, type: job.jobType, attempt: job.attempts, outcome, error });
    if (outcome === "dead") await alertOperator(job, error);
  }
}

/** Dead-letter alert to the organization's admins. Best effort, never throws. */
async function alertOperator(job: AutomationJob, error: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { organizationId: job.organizationId, role: "ADMIN", active: true },
      select: { email: true },
    });
    if (admins.length === 0) return;
    await getEmailProvider().send({
      to: admins.map((a) => a.email),
      ...deadJobAlert({ jobType: job.jobType, jobId: job.id, error }),
    });
  } catch (err) {
    logger.error("dead_letter_alert_failed", { jobId: job.id, error: err });
  }
}

/**
 * Claims and runs due jobs. Jobs in one batch run concurrently: a slow CRM
 * sync never delays the customer confirmation.
 */
export async function processDueJobs(limit = 20): Promise<number> {
  const jobs = await claimDueJobs(limit);
  await Promise.allSettled(jobs.map(runJob));
  return jobs.length;
}

/** Processes specific jobs right after a request (fast path); the worker covers retries. */
export async function processJobsForLead(leadId: string) {
  const jobs = await prisma.automationJob.findMany({ where: { leadId, state: "PENDING", attempts: 0 }, select: { id: true } });
  if (jobs.length === 0) return;
  await processDueJobs(jobs.length + 5);
}
