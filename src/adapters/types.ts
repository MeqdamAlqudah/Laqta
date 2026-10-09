import type { CanonicalLeadInput } from "@/domain/lead/schema";

/**
 * Adapter pattern: every channel speaks its own payload format.
 * A ChannelAdapter translates that format into the canonical lead input,
 * so validation, dedupe, persistence and automation are written ONCE.
 */
export interface ChannelAdapter {
  /** Channel name stored on the lead (source.channel). */
  readonly channel: string;
  /** Whether an unknown service code is a validation error (strict) or falls back to "no service". */
  readonly strictService: boolean;
  toCanonical(payload: unknown): CanonicalLeadInput;
}
