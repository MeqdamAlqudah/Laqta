import { Prisma, type Organization, type Service } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { hashIp } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { ChannelAdapter } from "@/adapters/types";
import { CanonicalLeadSchema, type CanonicalLead } from "@/domain/lead/schema";
import { parseSettings, type OrgSettings } from "@/domain/settings";
import { computeSlaDue } from "@/domain/sla";
import { enqueue, type EnqueueInput } from "@/jobs/queue";
import { assignOwner } from "./assignment";

/**
 * Lead intake = the 10-stage workflow from spec section 4, stages 1-5 here
 * (6-10 run asynchronously as jobs). Implemented as a Pipeline / Chain of
 * Responsibility: each step reads and enriches a shared context, and may stop
 * the chain by setting `ctx.result` (e.g. replay or duplicate).
 */
export interface IntakeResult {
  leadId: string;
  reference: string;
  status: string;
  message: string;
  outcome: "created" | "replayed" | "merged_duplicate" | "discarded_spam";
}

interface IntakeContext {
  org: Organization;
  settings: OrgSettings;
  adapter: ChannelAdapter;
  raw: unknown;
  ip: string;
  requestId: string;
  actorId?: string | null; // staff user for manual entry
  lead?: CanonicalLead;
  service?: Service | null;
  result?: IntakeResult;
}

type IntakeStep = (ctx: IntakeContext) => Promise<void>;

const ACK = {
  en: "Your request was received.",
  ar: "تم استلام طلبك.",
};

// ---- Step 2: Validate & normalize ------------------------------------------
const validate: IntakeStep = async (ctx) => {
  const canonical = ctx.adapter.toCanonical(ctx.raw);
  ctx.lead = CanonicalLeadSchema.parse(canonical); // throws ZodError -> 422 with field messages

  const service = await prisma.service.findFirst({
    where: { organizationId: ctx.org.id, code: ctx.lead.serviceCode, active: true, deletedAt: null },
  });
  if (!service && ctx.adapter.strictService) {
    throw new ApiError("VALIDATION_ERROR", undefined, { serviceCode: "Choose a service" });
  }
  ctx.service = service;
};

// ---- Step 3: Protect (honeypot, CAPTCHA) --------------------------------------
// Rate limiting and payload size are enforced earlier, in the route handler.
const protect: IntakeStep = async (ctx) => {
  const raw = (ctx.raw ?? {}) as { website?: string; captchaToken?: string };
  if (raw.website) {
    // Honeypot filled -> almost certainly a bot. Pretend success, store nothing.
    logger.warn("intake_spam_honeypot", { requestId: ctx.requestId, org: ctx.org.slug });
    ctx.result = { leadId: "", reference: "LF-0000", status: "NEW", message: ACK.en, outcome: "discarded_spam" };
    return;
  }
  if (env.turnstileSecret && ctx.adapter.channel === "website") {
    const ok = await verifyTurnstile(raw.captchaToken, ctx.ip);
    if (!ok) throw new ApiError("VALIDATION_ERROR", undefined, { captcha: "Please complete the verification" });
  }
};

// ---- Idempotency: replayed submissions return the original result ---------
const idempotency: IntakeStep = async (ctx) => {
  const existing = await prisma.lead.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: ctx.org.id, idempotencyKey: ctx.lead!.idempotencyKey } },
  });
  if (existing) ctx.result = replayResult(existing, ctx.lead!.language);
};

// ---- Step 4: Deduplicate ------------------------------------------------------
const deduplicate: IntakeStep = async (ctx) => {
  const lead = ctx.lead!;
  if (ctx.settings.dedupeWindowHours === 0) return;
  const since = new Date(Date.now() - ctx.settings.dedupeWindowHours * 3600_000);
  const match = await prisma.lead.findFirst({
    where: {
      organizationId: ctx.org.id,
      createdAt: { gte: since },
      anonymizedAt: null,
      status: { notIn: ["WON", "LOST"] },
      OR: [{ phoneE164: lead.phone }, ...(lead.email ? [{ email: lead.email }] : [])],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!match) return;

  // Merge: record the new enquiry on the existing lead and alert its owner.
  // The customer is acknowledged normally - we never reveal their history.
  try {
    await prisma.$transaction(async (tx) => {
      // The job's unique key doubles as the idempotency record for this submission.
      await tx.automationJob.create({
        data: {
          organizationId: ctx.org.id,
          leadId: match.id,
          jobType: "NOTIFY_STAFF",
          idempotencyKey: `dup:${ctx.org.id}:${lead.idempotencyKey}`,
          payload: { kind: "duplicate" },
        },
      });
      await tx.leadActivity.create({
        data: {
          leadId: match.id,
          type: "DUPLICATE_MERGED",
          metadata: {
            channel: lead.source.channel,
            serviceCode: lead.serviceCode,
            message: lead.message,
            requestId: ctx.requestId,
          },
        },
      });
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // replay of the same duplicate -> already merged
  }
  ctx.result = { ...replayResult(match, lead.language), outcome: "merged_duplicate" };
};

// ---- Step 5: Persist (one transaction: lead + activity + consent + jobs) ----
const persist: IntakeStep = async (ctx) => {
  const lead = ctx.lead!;
  const now = new Date();
  try {
    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: ctx.org.id },
        data: { leadCounter: { increment: 1 } },
        select: { leadCounter: true },
      });
      const reference = `LF-${now.getFullYear()}-${org.leadCounter}`;
      const assignment = await assignOwner(tx, ctx.org.id, ctx.service ?? null);

      const row = await tx.lead.create({
        data: {
          organizationId: ctx.org.id,
          reference,
          fullName: lead.fullName,
          phoneE164: lead.phone,
          email: lead.email,
          serviceId: ctx.service?.id ?? null,
          preferredAt: lead.preferredAt,
          message: lead.message,
          language: lead.language,
          status: assignment.userId ? "ASSIGNED" : "NEW",
          ownerId: assignment.userId,
          sourceChannel: lead.source.channel,
          sourceCampaign: lead.source.campaign ?? null,
          sourceMeta: (lead.source.meta ?? {}) as Prisma.InputJsonValue,
          idempotencyKey: lead.idempotencyKey,
          slaDueAt: computeSlaDue(now, ctx.settings.slaMinutes, ctx.org.timezone, ctx.settings.workingHours),
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: row.id,
          type: "CREATED",
          actorId: ctx.actorId ?? null,
          newValue: row.status,
          metadata: { channel: lead.source.channel, requestId: ctx.requestId },
        },
      });
      if (assignment.userId) {
        await tx.leadActivity.create({
          data: {
            leadId: row.id,
            type: "OWNER_CHANGED",
            newValue: assignment.userId,
            metadata: { strategy: assignment.strategy, reason: assignment.reason },
          },
        });
      }
      await tx.consent.create({
        data: {
          leadId: row.id,
          consentType: "privacy_notice",
          policyVersion: lead.consent.policyVersion,
          ipHash: ctx.ip !== "unknown" ? hashIp(ctx.ip) : null,
        },
      });

      await enqueue(tx, await followUpJobs(tx, ctx.org.id, row.id, lead));
      return row;
    });

    ctx.result = {
      leadId: created.id,
      reference: created.reference,
      status: created.status,
      message: ACK[lead.language],
      outcome: "created",
    };
  } catch (err) {
    // Two identical requests raced: the loser returns the winner's result.
    if (isUniqueViolation(err)) {
      const existing = await prisma.lead.findUnique({
        where: { organizationId_idempotencyKey: { organizationId: ctx.org.id, idempotencyKey: lead.idempotencyKey } },
      });
      if (existing) {
        ctx.result = replayResult(existing, lead.language);
        return;
      }
    }
    throw err;
  }
};

/** Stages 6-9 become independent jobs: one failing never blocks the others. */
async function followUpJobs(
  tx: Prisma.TransactionClient,
  organizationId: string,
  leadId: string,
  lead: CanonicalLead,
): Promise<EnqueueInput[]> {
  const integrations = await tx.integration.findMany({ where: { organizationId, enabled: true } });
  const enabled = new Set(integrations.map((i) => i.provider));
  const jobs: EnqueueInput[] = [];
  const key = (t: string) => `${t}:${leadId}`;

  if (lead.email && enabled.has("EMAIL")) {
    jobs.push({ organizationId, leadId, jobType: "SEND_CONFIRMATION", idempotencyKey: key("confirm") });
  }
  jobs.push({ organizationId, leadId, jobType: "NOTIFY_STAFF", idempotencyKey: key("notify") });
  if (enabled.has("WHATSAPP")) {
    jobs.push({ organizationId, leadId, jobType: "NOTIFY_WHATSAPP", idempotencyKey: key("wa-notify") });
  }
  if (enabled.has("SHEETS_WEBHOOK")) {
    jobs.push({ organizationId, leadId, jobType: "SYNC_SHEET", idempotencyKey: key("sync") });
  }
  if (enabled.has("AI")) {
    jobs.push({ organizationId, leadId, jobType: "AI_CLASSIFY", idempotencyKey: key("ai"), maxAttempts: 3 });
  }
  return jobs;
}

const PIPELINE: IntakeStep[] = [validate, protect, idempotency, deduplicate, persist];

export async function intakeLead(input: Omit<IntakeContext, "settings" | "lead" | "service" | "result">) {
  const ctx: IntakeContext = { ...input, settings: parseSettings(input.org.settings) };
  for (const step of PIPELINE) {
    await step(ctx);
    if (ctx.result) break;
  }
  logger.info("lead_intake", {
    requestId: ctx.requestId,
    org: ctx.org.slug,
    channel: ctx.adapter.channel,
    outcome: ctx.result?.outcome,
    reference: ctx.result?.reference,
  });
  return ctx.result!;
}

function replayResult(lead: { id: string; reference: string; status: string }, language: "en" | "ar"): IntakeResult {
  return { leadId: lead.id, reference: lead.reference, status: lead.status, message: ACK[language], outcome: "replayed" };
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.turnstileSecret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
