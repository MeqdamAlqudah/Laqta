import type { AutomationJob, IntegrationProvider, JobType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { parseSettings } from "@/domain/settings";
import { getEmailProvider } from "@/integrations/email";
import * as templates from "@/integrations/templates";
import { postSignedWebhook } from "@/integrations/outbound-webhook";
import { createClassifier } from "@/ai";
import { dashboardSummary } from "@/services/dashboard.service";

/**
 * Command pattern: every job type maps to one handler with the same signature.
 * The worker doesn't know what a job does - it just looks up and executes the
 * command, then records success or schedules a retry.
 * A handler must THROW on failure so the queue can retry with backoff.
 */
export type JobHandler = (job: AutomationJob) => Promise<void>;

/** Which integration's health a job type reports into (Integrations screen). */
export const JOB_PROVIDER: Partial<Record<JobType, IntegrationProvider>> = {
  SEND_CONFIRMATION: "EMAIL",
  NOTIFY_STAFF: "EMAIL",
  SLA_ESCALATION: "EMAIL",
  DAILY_SUMMARY: "EMAIL",
  SYNC_SHEET: "SHEETS_WEBHOOK",
  NOTIFY_WHATSAPP: "WHATSAPP",
  AI_CLASSIFY: "AI",
};

async function loadLead(job: AutomationJob) {
  if (!job.leadId) throw new Error("Job has no lead");
  const lead = await prisma.lead.findUnique({
    where: { id: job.leadId },
    include: { organization: true, service: true, owner: true },
  });
  if (!lead) throw new Error("Lead not found");
  return lead;
}

async function managerEmails(organizationId: string, extra: string[] = []) {
  const managers = await prisma.user.findMany({
    where: { organizationId, active: true, role: { in: ["ADMIN", "MANAGER"] } },
    select: { email: true },
  });
  return Array.from(new Set([...managers.map((m) => m.email), ...extra]));
}

async function integrationConfig(organizationId: string, provider: IntegrationProvider) {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });
  if (!integration?.enabled) return null;
  return {
    config: integration.configuration as Record<string, string>,
    secrets: decryptJson<Record<string, string>>(integration.encryptedCredentials) ?? {},
  };
}

const serviceName = (s: { nameEn: string; nameAr: string } | null, lang: string) =>
  s ? (lang === "ar" ? s.nameAr : s.nameEn) : lang === "ar" ? "استفسار عام" : "General enquiry";

// ---------------------------------------------------------------------------

const sendConfirmation: JobHandler = async (job) => {
  const lead = await loadLead(job);
  if (!lead.email || lead.anonymizedAt) return; // nothing to send
  const settings = parseSettings(lead.organization.settings);
  const lang = lead.language === "ar" ? "ar" : "en";
  const msg = templates.customerConfirmation({
    lang,
    orgName: lead.organization.name,
    name: lead.fullName,
    reference: lead.reference,
    serviceName: serviceName(lead.service, lang),
    responseTime: settings.responseTimeText[lang],
  });
  const { id } = await getEmailProvider().send({ to: lead.email, ...msg });
  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "EMAIL_SENT", newValue: "customer_confirmation", metadata: { providerId: id, language: lang } },
  });
};

const notifyStaff: JobHandler = async (job) => {
  const lead = await loadLead(job);
  const settings = parseSettings(lead.organization.settings);
  const to = lead.owner?.active ? [lead.owner.email] : await managerEmails(lead.organizationId, settings.notifyEmails);
  if (to.length === 0) throw new Error("No staff recipients configured");
  const kind = (job.payload as { kind?: string })?.kind === "duplicate" ? "duplicate" : "new";
  const msg = templates.staffAlert({
    kind,
    leadId: lead.id,
    reference: lead.reference,
    name: lead.fullName,
    phone: lead.phoneE164,
    serviceName: serviceName(lead.service, "en"),
    channel: lead.sourceChannel,
    message: lead.message,
    ownerName: lead.owner?.name ?? null,
  });
  const { id } = await getEmailProvider().send({ to, ...msg });
  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "NOTIFICATION_SENT", newValue: "email", metadata: { providerId: id, recipients: to.length, kind } },
  });
};

const notifyWhatsApp: JobHandler = async (job) => {
  const lead = await loadLead(job);
  const integ = await integrationConfig(lead.organizationId, "WHATSAPP");
  if (!integ?.config.url) return; // disabled after enqueue -> nothing to do
  await postSignedWebhook({
    url: integ.config.url,
    secret: integ.secrets.secret ?? "",
    event: "lead.staff_alert",
    idempotencyKey: job.idempotencyKey,
    data: {
      reference: lead.reference,
      service: serviceName(lead.service, "en"),
      owner: lead.owner?.name ?? null,
      leadUrl: `${process.env.APP_URL ?? ""}/leads/${lead.id}`,
    },
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "NOTIFICATION_SENT", newValue: "whatsapp" } });
};

const syncSheet: JobHandler = async (job) => {
  const lead = await loadLead(job);
  const integ = await integrationConfig(lead.organizationId, "SHEETS_WEBHOOK");
  if (!integ?.config.url) return;
  await postSignedWebhook({
    url: integ.config.url,
    secret: integ.secrets.secret ?? "",
    event: "lead.upsert",
    // Same key on every retry -> the receiver upserts by reference, never duplicates.
    idempotencyKey: `sync:${lead.id}`,
    data: {
      reference: lead.reference,
      createdAt: lead.createdAt.toISOString(),
      fullName: lead.fullName,
      phone: lead.phoneE164,
      email: lead.email,
      service: serviceName(lead.service, "en"),
      status: lead.status,
      owner: lead.owner?.name ?? "",
      source: lead.sourceChannel,
      campaign: lead.sourceCampaign ?? "",
      message: lead.message ?? "",
    },
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "SYNCED", newValue: "sheets" } });
};

const aiClassify: JobHandler = async (job) => {
  const lead = await loadLead(job);
  if (lead.anonymizedAt) return;
  const services = await prisma.service.findMany({
    where: { organizationId: lead.organizationId, active: true, deletedAt: null },
    select: { code: true },
  });
  const result = await createClassifier().classify({
    message: lead.message,
    serviceCode: lead.service?.code ?? null,
    serviceName: serviceName(lead.service, lead.language),
    channel: lead.sourceChannel,
    language: lead.language === "ar" ? "ar" : "en",
    categories: services.map((s) => s.code),
  });
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: {
        aiCategory: result.isLikelySpam ? "spam" : result.category,
        aiPriority: result.priority,
        aiReason: result.reason,
        aiSuggestedReply: result.suggestedReply,
        aiProvider: result.provider,
      },
    }),
    prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "AI_SUGGESTION",
        newValue: `${result.category} / ${result.priority}`,
        metadata: { provider: result.provider, spam: result.isLikelySpam },
      },
    }),
  ]);
};

const slaEscalation: JobHandler = async (job) => {
  const lead = await loadLead(job);
  // Lead may have been contacted between the sweep and this job.
  if (!["NEW", "ASSIGNED"].includes(lead.status)) return;
  const settings = parseSettings(lead.organization.settings);
  const to = await managerEmails(lead.organizationId, settings.notifyEmails);
  if (lead.owner?.active) to.push(lead.owner.email);
  const minutesLate = lead.slaDueAt ? Math.max(0, Math.round((Date.now() - lead.slaDueAt.getTime()) / 60_000)) : 0;
  const msg = templates.escalationAlert({
    leadId: lead.id,
    reference: lead.reference,
    serviceName: serviceName(lead.service, "en"),
    ownerName: lead.owner?.name ?? null,
    minutesLate,
  });
  await getEmailProvider().send({ to: Array.from(new Set(to)), ...msg });
};

const dailySummaryJob: JobHandler = async (job) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: job.organizationId } });
  const settings = parseSettings(org.settings);
  const to = await managerEmails(org.id, settings.notifyEmails);
  const systemActor = { id: null, organizationId: org.id, role: "ADMIN" as const, name: "system", kind: "service" as const };
  const summary = await dashboardSummary(systemActor);
  const newToday = await prisma.lead.count({
    where: { organizationId: org.id, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
  });
  const date = (job.payload as { date?: string }).date ?? new Date().toISOString().slice(0, 10);
  await getEmailProvider().send({ to, ...templates.dailySummary({ orgName: org.name, date, summary, newToday }) });
};

export const HANDLERS: Record<JobType, JobHandler> = {
  SEND_CONFIRMATION: sendConfirmation,
  NOTIFY_STAFF: notifyStaff,
  NOTIFY_WHATSAPP: notifyWhatsApp,
  SYNC_SHEET: syncSheet,
  AI_CLASSIFY: aiClassify,
  SLA_ESCALATION: slaEscalation,
  DAILY_SUMMARY: dailySummaryJob,
};
