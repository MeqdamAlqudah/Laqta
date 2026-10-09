import { Prisma, type AutomationJob, type JobType } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

export interface EnqueueInput {
  organizationId: string;
  leadId?: string | null;
  jobType: JobType;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  delayMs?: number;
  maxAttempts?: number;
}

/**
 * Transactional outbox: call this with the SAME transaction that writes the lead.
 * Either both the lead and its jobs exist, or neither does. `skipDuplicates`
 * on the unique idempotency key makes enqueueing safe to repeat.
 */
export async function enqueue(db: Db, jobs: EnqueueInput[]) {
  if (jobs.length === 0) return;
  await db.automationJob.createMany({
    skipDuplicates: true,
    data: jobs.map((j) => ({
      organizationId: j.organizationId,
      leadId: j.leadId ?? null,
      jobType: j.jobType,
      idempotencyKey: j.idempotencyKey,
      payload: (j.payload ?? {}) as Prisma.InputJsonValue,
      nextAttemptAt: new Date(Date.now() + (j.delayMs ?? 0)),
      maxAttempts: j.maxAttempts ?? 5,
    })),
  });
}

const STALE_LOCK_MINUTES = 5;

/**
 * Claims due jobs atomically. FOR UPDATE SKIP LOCKED lets several workers run
 * side by side without ever processing the same job twice. Jobs stuck in
 * RUNNING (worker crashed) are reclaimed after a few minutes.
 */
export async function claimDueJobs(limit = 20): Promise<AutomationJob[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE automation_jobs
       SET state = 'RUNNING'::"JobState", locked_at = now(), attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM automation_jobs
        WHERE (state = 'PENDING'::"JobState" AND next_attempt_at <= now())
           OR (state = 'RUNNING'::"JobState" AND locked_at < now() - make_interval(mins => ${STALE_LOCK_MINUTES}::int))
        ORDER BY next_attempt_at
        LIMIT ${limit}::int
        FOR UPDATE SKIP LOCKED
     )
  RETURNING id`;
  if (rows.length === 0) return [];
  return prisma.automationJob.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
}

/** Exponential backoff with jitter: 30s, 1m, 2m, 4m ... capped at 1h. */
export function backoffMs(attempt: number): number {
  const base = Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 60 * 60_000);
  const jitter = Math.floor(Math.random() * 0.2 * base);
  return base + jitter;
}

export async function markSucceeded(jobId: string) {
  await prisma.automationJob.update({
    where: { id: jobId },
    data: { state: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lastError: null },
  });
}

/** Returns "retry" or "dead" so the caller can alert the operator on dead-letter. */
export async function markFailed(job: AutomationJob, error: string): Promise<"retry" | "dead"> {
  const dead = job.attempts >= job.maxAttempts;
  await prisma.automationJob.update({
    where: { id: job.id },
    data: {
      state: dead ? "DEAD" : "PENDING",
      lockedAt: null,
      lastError: error.slice(0, 1000),
      nextAttemptAt: dead ? job.nextAttemptAt : new Date(Date.now() + backoffMs(job.attempts)),
    },
  });
  return dead ? "dead" : "retry";
}

/** Operator action from the Integrations screen: put a dead job back in the queue. */
export async function retryJob(organizationId: string, jobId: string) {
  return prisma.automationJob.updateMany({
    where: { id: jobId, organizationId, state: "DEAD" },
    data: { state: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
}
