import type { ChannelAdapter } from "./types";

/**
 * WhatsApp Business API provider (e.g. 360dialog, Twilio, Meta Cloud API)
 * -> n8n -> here. A simplified inbound-message shape:
 * { "messageId": "wamid...", "from": "+962790000000", "profileName": "Sara", "text": "..." }
 */
interface WhatsAppPayload {
  messageId?: string;
  from?: string;
  profileName?: string;
  text?: string;
  language?: "en" | "ar";
}

export const whatsappAdapter: ChannelAdapter = {
  channel: "whatsapp",
  strictService: false,
  toCanonical(payload) {
    const p = (payload ?? {}) as WhatsAppPayload;
    const text = p.text ?? "";
    return {
      fullName: p.profileName?.trim() || "WhatsApp contact",
      phone: p.from ?? "",
      email: null,
      serviceCode: "general",
      message: text,
      language: p.language ?? (/[؀-ۿ]/.test(text) ? "ar" : "en"),
      // The customer started the conversation themselves.
      consent: { accepted: true, policyVersion: "whatsapp-inbound" },
      idempotencyKey: `wa-${p.messageId ?? ""}`,
      source: { channel: "whatsapp" },
    };
  },
};
