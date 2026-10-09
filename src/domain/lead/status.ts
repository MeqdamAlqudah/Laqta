// Lead lifecycle as an explicit State Machine (spec section 4 "Lead statuses").
// Transitions not listed here are rejected, so the pipeline can't be corrupted.
export const LEAD_STATUSES = ["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

const TRANSITIONS: Record<LeadStatusValue, LeadStatusValue[]> = {
  NEW: ["ASSIGNED", "CONTACTED", "LOST"],
  ASSIGNED: ["CONTACTED", "LOST", "NEW"],
  CONTACTED: ["QUALIFIED", "WON", "LOST"],
  QUALIFIED: ["WON", "LOST", "CONTACTED"],
  // Reopening is allowed; the previous outcome stays in the activity history.
  WON: ["CONTACTED"],
  LOST: ["CONTACTED"],
};

export function canTransition(from: LeadStatusValue, to: LeadStatusValue): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: LeadStatusValue): LeadStatusValue[] {
  return TRANSITIONS[from];
}

export const OPEN_STATUSES: LeadStatusValue[] = ["NEW", "ASSIGNED"]; // waiting for first contact
export const FINAL_STATUSES: LeadStatusValue[] = ["WON", "LOST"];
