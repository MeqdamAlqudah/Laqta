/**
 * Background worker: `npm run worker` (keep it running next to `npm run dev`).
 *  - every 3 seconds: claim and run due automation jobs (retries included)
 *  - every 60 seconds: SLA escalation, reconciliation, daily summary, retention sweeps
 * Several workers can run at once safely (FOR UPDATE SKIP LOCKED).
 */
import { processDueJobs } from "@/jobs/worker";
import { runAllSweeps } from "@/jobs/sweeps";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const JOB_INTERVAL_MS = 3_000;
const SWEEP_INTERVAL_MS = 60_000;

let stopping = false;
let lastSweep = 0;

async function loop() {
  logger.info("worker_started", { jobIntervalMs: JOB_INTERVAL_MS, sweepIntervalMs: SWEEP_INTERVAL_MS });
  while (!stopping) {
    try {
      if (Date.now() - lastSweep >= SWEEP_INTERVAL_MS) {
        lastSweep = Date.now();
        await runAllSweeps();
      }
      // Drain the queue, then wait.
      while (!stopping && (await processDueJobs(20)) > 0);
    } catch (err) {
      logger.error("worker_loop_error", { error: err });
    }
    await new Promise((r) => setTimeout(r, JOB_INTERVAL_MS));
  }
  await prisma.$disconnect();
  logger.info("worker_stopped");
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopping = true;
  });
}

void loop();
