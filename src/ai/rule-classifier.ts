import type { Classification, ClassificationInput, LeadClassifier, Priority } from "./types";

/**
 * Deterministic keyword classifier. Used when no API key is configured and as
 * the fallback whenever the LLM call fails - so classification never blocks.
 */
const URGENT = [
  "urgent", "emergency", "asap", "today", "now", "pain", "bleeding", "immediately", "as soon as possible",
  "عاجل", "طارئ", "اليوم", "الآن", "ألم", "فورا", "فوراً", "بسرعة",
];
const LOW = ["just asking", "information", "info", "price list", "brochure", "later", "next month", "استفسار", "معلومات", "الشهر القادم"];
const SPAM = ["http://", "https://", "crypto", "bitcoin", "seo services", "casino", "loan offer", "backlinks"];

const REPLIES = {
  en: (svc: string) => `Hello, thank you for contacting us about ${svc}. A member of our team will call you shortly to help.`,
  ar: (svc: string) => `مرحباً، شكراً لتواصلك معنا بخصوص ${svc}. سيتصل بك أحد أعضاء فريقنا قريباً لمساعدتك.`,
};

export class RuleBasedClassifier implements LeadClassifier {
  readonly name = "rules";

  async classify(input: ClassificationInput): Promise<Classification> {
    const text = (input.message ?? "").toLowerCase();
    const hits = (words: string[]) => words.filter((w) => text.includes(w));

    const spamHits = hits(SPAM);
    const urgentHits = hits(URGENT);
    const lowHits = hits(LOW);

    let priority: Priority = "MEDIUM";
    let reason = "No strong urgency signals; default priority.";
    if (urgentHits.length) {
      priority = "HIGH";
      reason = `Urgency keywords found: ${urgentHits.slice(0, 3).join(", ")}.`;
    } else if (lowHits.length) {
      priority = "LOW";
      reason = `Informational keywords found: ${lowHits.slice(0, 3).join(", ")}.`;
    }

    const category =
      input.serviceCode && input.categories.includes(input.serviceCode) ? input.serviceCode : "general";
    const svc = input.serviceName ?? (input.language === "ar" ? "طلبك" : "your request");

    return {
      category,
      priority,
      isLikelySpam: spamHits.length >= 2,
      reason,
      suggestedReply: REPLIES[input.language](svc),
    };
  }
}
