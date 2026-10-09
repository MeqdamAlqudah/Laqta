import type { ChannelAdapter } from "./types";
import type { CanonicalLeadInput } from "@/domain/lead/schema";

type WebsitePayload = Partial<CanonicalLeadInput> & {
  utm?: Record<string, string>;
  website?: string; // honeypot - checked in the intake pipeline
};

/** The public Next.js form already posts (almost) the canonical shape. */
export const websiteAdapter: ChannelAdapter = {
  channel: "website",
  strictService: true,
  toCanonical(payload) {
    const p = (payload ?? {}) as WebsitePayload;
    const utm = p.utm ?? {};
    return {
      fullName: p.fullName as string,
      phone: p.phone as string,
      email: p.email || null,
      serviceCode: p.serviceCode as string,
      preferredAt: p.preferredAt || null,
      message: p.message || null,
      language: p.language,
      consent: p.consent as CanonicalLeadInput["consent"],
      idempotencyKey: p.idempotencyKey as string,
      source: {
        channel: p.source?.channel === "manual" ? "manual" : "website",
        campaign: utm.utm_campaign ?? p.source?.campaign ?? null,
        meta: utm,
      },
    };
  },
};
