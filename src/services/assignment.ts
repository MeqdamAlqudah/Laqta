import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Strategy pattern for lead routing. Each service has a routing rule like
 *   { "strategy": "round_robin", "userIds": ["u1", "u2"] }
 * Assignment is deliberately rule-based and explainable (spec section 4):
 * the AI may suggest a category, but it never decides who gets the lead.
 */
export const RoutingRuleSchema = z.object({
  strategy: z.enum(["round_robin", "least_loaded", "fixed", "none"]).default("none"),
  userIds: z.array(z.string()).default([]),
});
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

export interface AssignmentContext {
  tx: Prisma.TransactionClient;
  organizationId: string;
  serviceId: string | null;
  candidateIds: string[]; // active users from the rule
}

export interface AssignmentStrategy {
  readonly name: string;
  pick(ctx: AssignmentContext): Promise<{ userId: string | null; reason: string }>;
}

const fixed: AssignmentStrategy = {
  name: "fixed",
  async pick({ candidateIds }) {
    return { userId: candidateIds[0] ?? null, reason: "fixed owner for this service" };
  },
};

/** Round robin: the candidate who received a lead for this service least recently. */
const roundRobin: AssignmentStrategy = {
  name: "round_robin",
  async pick({ tx, organizationId, serviceId, candidateIds }) {
    if (candidateIds.length === 0) return { userId: null, reason: "no active candidates" };
    const last = await tx.lead.groupBy({
      by: ["ownerId"],
      where: { organizationId, serviceId, ownerId: { in: candidateIds } },
      _max: { createdAt: true },
    });
    const lastAt = new Map(last.map((r) => [r.ownerId, r._max.createdAt?.getTime() ?? 0]));
    const sorted = [...candidateIds].sort((a, b) => (lastAt.get(a) ?? 0) - (lastAt.get(b) ?? 0));
    return { userId: sorted[0]!, reason: "round robin (longest since last lead)" };
  },
};

/** Least loaded: the candidate with the fewest open leads. */
const leastLoaded: AssignmentStrategy = {
  name: "least_loaded",
  async pick({ tx, organizationId, candidateIds }) {
    if (candidateIds.length === 0) return { userId: null, reason: "no active candidates" };
    const counts = await tx.lead.groupBy({
      by: ["ownerId"],
      where: { organizationId, ownerId: { in: candidateIds }, status: { in: ["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED"] } },
      _count: { _all: true },
    });
    const load = new Map(counts.map((c) => [c.ownerId, c._count._all]));
    const sorted = [...candidateIds].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
    return { userId: sorted[0]!, reason: "least open leads" };
  },
};

const none: AssignmentStrategy = {
  name: "none",
  async pick() {
    return { userId: null, reason: "no routing rule - managers assign manually" };
  },
};

const STRATEGIES: Record<RoutingRule["strategy"], AssignmentStrategy> = {
  fixed,
  round_robin: roundRobin,
  least_loaded: leastLoaded,
  none,
};

export async function assignOwner(
  tx: Prisma.TransactionClient,
  organizationId: string,
  service: { id: string; routingRule: unknown } | null,
) {
  const rule = RoutingRuleSchema.safeParse(service?.routingRule ?? {});
  const parsed = rule.success ? rule.data : RoutingRuleSchema.parse({});
  const active = await tx.user.findMany({
    where: { organizationId, id: { in: parsed.userIds }, active: true, role: { in: ["ADMIN", "MANAGER", "AGENT"] } },
    select: { id: true },
  });
  // keep the rule's order for "fixed"
  const activeIds = parsed.userIds.filter((id) => active.some((u) => u.id === id));
  const strategy = STRATEGIES[parsed.strategy];
  const result = await strategy.pick({ tx, organizationId, serviceId: service?.id ?? null, candidateIds: activeIds });
  return { ...result, strategy: strategy.name };
}
