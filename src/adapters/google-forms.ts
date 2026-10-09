import type { ChannelAdapter } from "./types";

/**
 * Google Forms -> Apps Script / n8n -> POST /api/v1/webhooks/google-forms
 * Expected body (see docs/integrations/google-forms-apps-script.gs):
 * { "responseId": "...", "responses": { "Full name": "...", "Mobile number": "...", ... } }
 */
interface GoogleFormsPayload {
  responseId?: string;
  responses?: Record<string, string | string[]>;
  language?: "en" | "ar";
}

const FIELD_ALIASES: Record<string, string[]> = {
  fullName: ["full name", "name", "الاسم", "الاسم الكامل"],
  phone: ["mobile number", "phone", "mobile", "رقم الهاتف", "رقم الجوال"],
  email: ["email", "email address", "البريد الإلكتروني"],
  service: ["service", "الخدمة"],
  message: ["message", "notes", "الرسالة"],
  preferred: ["preferred date/time", "preferred date", "الموعد المفضل"],
  consent: ["consent", "privacy", "الموافقة"],
};

function pick(responses: Record<string, string | string[]>, field: string): string | undefined {
  const aliases = FIELD_ALIASES[field] ?? [];
  for (const [question, answer] of Object.entries(responses)) {
    if (aliases.includes(question.trim().toLowerCase())) return Array.isArray(answer) ? answer.join(", ") : answer;
  }
  return undefined;
}

export const googleFormsAdapter: ChannelAdapter = {
  channel: "google_form",
  strictService: false,
  toCanonical(payload) {
    const p = (payload ?? {}) as GoogleFormsPayload;
    const r = p.responses ?? {};
    return {
      fullName: pick(r, "fullName") ?? "",
      phone: pick(r, "phone") ?? "",
      email: pick(r, "email") ?? null,
      // Service answers are free text in Forms; slugify to match service codes.
      serviceCode: (pick(r, "service") ?? "general").trim().toLowerCase().replace(/\s+/g, "_"),
      preferredAt: pick(r, "preferred") ?? null,
      message: pick(r, "message") ?? null,
      language: p.language ?? "en",
      // A required consent checkbox in the Form produces a non-empty answer.
      consent: { accepted: Boolean(pick(r, "consent")) as true, policyVersion: "google-form" },
      idempotencyKey: `gform-${p.responseId ?? ""}`,
      source: { channel: "google_form" },
    };
  },
};
