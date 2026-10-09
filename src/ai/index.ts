import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ClaudeClassifier } from "./claude-classifier";
import { RuleBasedClassifier } from "./rule-classifier";
import type { Classification, ClassificationInput, LeadClassifier } from "./types";

/**
 * Decorator / fallback chain: tries the primary classifier, and if it throws
 * (no network, rate limit, refusal, invalid output) uses the secondary one.
 * The caller always gets a result and learns which provider produced it.
 */
export class FallbackClassifier implements LeadClassifier {
  readonly name: string;
  constructor(
    private primary: LeadClassifier,
    private secondary: LeadClassifier,
  ) {
    this.name = `${primary.name}|${secondary.name}`;
  }

  async classify(input: ClassificationInput): Promise<Classification & { provider: string }> {
    try {
      return { ...(await this.primary.classify(input)), provider: this.primary.name };
    } catch (err) {
      logger.warn("ai_primary_failed_using_fallback", { provider: this.primary.name, error: err });
      return { ...(await this.secondary.classify(input)), provider: this.secondary.name };
    }
  }
}

/** Factory: picks the implementation from configuration. */
export function createClassifier(): FallbackClassifier {
  const rules = new RuleBasedClassifier();
  if (!env.anthropicApiKey) {
    // No key -> rules only (wrapped so the return type stays the same).
    return new FallbackClassifier(rules, rules);
  }
  return new FallbackClassifier(new ClaudeClassifier(env.anthropicApiKey, env.anthropicModel), rules);
}

export type { Classification, ClassificationInput, LeadClassifier };
