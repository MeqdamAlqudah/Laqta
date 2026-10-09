import type { ChannelAdapter } from "./types";

/**
 * Meta (Facebook/Instagram) lead ads. Meta's webhook only sends a leadgen_id;
 * n8n/Make fetches the lead from the Graph API and forwards the result here:
 * { "leadgen_id": "...", "campaign_name": "...", "field_data": [{ "name": "full_name", "values": ["..."] }] }
 */
interface MetaPayload {
  leadgen_id?: string;
  campaign_name?: string;
  ad_name?: string;
  form_name?: string;
  service_code?: string;
  field_data?: { name: string; values: string[] }[];
}

export const metaLeadAdsAdapter: ChannelAdapter = {
  channel: "meta_ads",
  strictService: false,
  toCanonical(payload) {
    const p = (payload ?? {}) as MetaPayload;
    const field = (name: string) => p.field_data?.find((f) => f.name === name)?.values?.[0];
    return {
      fullName: field("full_name") ?? field("first_name") ?? "",
      phone: field("phone_number") ?? "",
      email: field("email") ?? null,
      serviceCode: p.service_code ?? field("service") ?? "general",
      message: field("message") ?? null,
      language: "en",
      // Meta lead forms require the user to accept the advertiser's privacy policy.
      consent: { accepted: true, policyVersion: "meta-lead-form" },
      idempotencyKey: `meta-${p.leadgen_id ?? ""}`,
      source: {
        channel: "meta_ads",
        campaign: p.campaign_name ?? null,
        meta: { ad_name: p.ad_name ?? "", form_name: p.form_name ?? "" },
      },
    };
  },
};
