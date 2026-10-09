// The AI part of LeadFlow: classify an incoming enquiry and suggest a priority.
// It is ADVISORY ONLY - the result is shown to staff, never used for routing.

export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface ClassificationInput {
  message: string | null;
  serviceCode: string | null;
  serviceName: string | null;
  channel: string;
  language: "en" | "ar";
  /** Categories the business cares about (its service codes + "general"). */
  categories: string[];
}

export interface Classification {
  category: string;
  priority: Priority;
  isLikelySpam: boolean;
  reason: string; // one sentence a human can check
  suggestedReply: string; // draft for staff to edit - never sent automatically
}

/** Strategy interface: any classifier (LLM, rules, another vendor) plugs in here. */
export interface LeadClassifier {
  readonly name: string;
  classify(input: ClassificationInput): Promise<Classification>;
}
