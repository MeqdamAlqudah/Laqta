import type { ChannelAdapter } from "./types";
import { websiteAdapter } from "./website";
import { googleFormsAdapter } from "./google-forms";
import { metaLeadAdsAdapter } from "./meta-lead-ads";
import { whatsappAdapter } from "./whatsapp";

// Registry / factory: maps a webhook provider name to its adapter.
// Adding a channel = writing one adapter + one line here.
const ADAPTERS: Record<string, ChannelAdapter> = {
  website: websiteAdapter,
  "google-forms": googleFormsAdapter,
  meta: metaLeadAdsAdapter,
  whatsapp: whatsappAdapter,
};

export function getAdapter(provider: string): ChannelAdapter | undefined {
  return ADAPTERS[provider];
}

export const WEBHOOK_PROVIDERS = Object.keys(ADAPTERS).filter((p) => p !== "website");
export type { ChannelAdapter };
