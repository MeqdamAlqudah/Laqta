import type { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { ApiError } from "@/lib/http";
import type { Actor } from "@/lib/auth/session";
import { getEmailProvider } from "@/integrations/email";
import { postSignedWebhook } from "@/integrations/outbound-webhook";
import { createClassifier } from "@/ai";

export async function updateIntegration(
  actor: Actor,
  id: string,
  input: { enabled?: boolean; url?: string; secret?: string },
) {
  const integration = await prisma.integration.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!integration) throw new ApiError("NOT_FOUND");
  const config = { ...(integration.configuration as Record<string, string>) };
  if (input.url !== undefined) {
    if (input.url && !/^https?:\/\//.test(input.url)) throw new ApiError("VALIDATION_ERROR", undefined, { url: "Must be an http(s) URL" });
    config.url = input.url;
  }
  // Secrets are merged and re-encrypted; they are never returned to the browser.
  const secrets = decryptJson<Record<string, string>>(integration.encryptedCredentials) ?? {};
  if (input.secret) secrets.secret = input.secret;
  return prisma.integration.update({
    where: { id },
    data: {
      enabled: input.enabled ?? integration.enabled,
      configuration: config,
      encryptedCredentials: Object.keys(secrets).length ? encryptJson(secrets) : null,
    },
  });
}

/** POST /integrations/{id}/test - proves the connection works and records health. */
export async function testIntegration(actor: Actor, id: string): Promise<{ ok: boolean; detail: string }> {
  const integration = await prisma.integration.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!integration) throw new ApiError("NOT_FOUND");
  const config = integration.configuration as Record<string, string>;
  const secrets = decryptJson<Record<string, string>>(integration.encryptedCredentials) ?? {};

  const tests: Record<IntegrationProvider, () => Promise<string>> = {
    EMAIL: async () => {
      const me = actor.id ? await prisma.user.findUnique({ where: { id: actor.id } }) : null;
      if (!me) throw new Error("No recipient");
      const p = getEmailProvider();
      await p.send({ to: me.email, subject: "[LeadFlow] Test email", html: "<p>Email integration works.</p>", text: "Email integration works." });
      return `Test email sent via ${p.name} to ${me.email}`;
    },
    SHEETS_WEBHOOK: async () => {
      if (!config.url) throw new Error("No webhook URL configured");
      const status = await postSignedWebhook({ url: config.url, secret: secrets.secret ?? "", event: "test.ping", idempotencyKey: `test:${Date.now()}`, data: { ok: true } });
      return `Webhook answered HTTP ${status}`;
    },
    WHATSAPP: async () => {
      if (!config.url) throw new Error("No webhook URL configured");
      const status = await postSignedWebhook({ url: config.url, secret: secrets.secret ?? "", event: "test.ping", idempotencyKey: `test:${Date.now()}`, data: { ok: true } });
      return `Webhook answered HTTP ${status}`;
    },
    AI: async () => {
      const r = await createClassifier().classify({
        message: "I have strong tooth pain since last night, can I come today?",
        serviceCode: "consultation",
        serviceName: "Consultation",
        channel: "website",
        language: "en",
        categories: ["consultation", "cleaning"],
      });
      return `${r.provider} -> ${r.category} / ${r.priority}: ${r.reason}`;
    },
  };

  try {
    const detail = await tests[integration.provider]();
    await prisma.integration.update({ where: { id }, data: { lastSuccessAt: new Date() } });
    return { ok: true, detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await prisma.integration.update({ where: { id }, data: { lastErrorAt: new Date(), lastError: detail.slice(0, 500) } });
    return { ok: false, detail };
  }
}
