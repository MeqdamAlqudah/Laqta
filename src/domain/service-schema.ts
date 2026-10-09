import { z } from "zod";
import { RoutingRuleSchema } from "@/services/assignment";

export const ServiceBody = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,40}$/, "Use lowercase letters, numbers and _"),
  nameEn: z.string().trim().min(2).max(80),
  nameAr: z.string().trim().min(2).max(80),
  active: z.boolean().default(true),
  routingRule: RoutingRuleSchema.default({ strategy: "none", userIds: [] }),
});
