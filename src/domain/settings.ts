import { z } from "zod";

// Organization settings live in organizations.settings_json.
// Parsing them through one schema gives every value a safe default.
export const WorkingHoursSchema = z.object({
  // 0 = Sunday ... 6 = Saturday. Jordan default: Sunday-Thursday.
  days: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4]),
  start: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  end: z.string().regex(/^\d{2}:\d{2}$/).default("17:00"),
});

export const OrgSettingsSchema = z.object({
  slaMinutes: z.number().int().min(1).max(10080).default(15),
  workingHours: WorkingHoursSchema.default({ days: [0, 1, 2, 3, 4], start: "09:00", end: "17:00" }),
  dedupeWindowHours: z.number().int().min(0).max(720).default(24),
  retentionDays: z.number().int().min(30).max(3650).default(365),
  // Fallback recipients for staff alerts when a lead has no owner.
  notifyEmails: z.array(z.string()).default([]),
  responseTimeText: z
    .object({ en: z.string(), ar: z.string() })
    .default({ en: "within 1 working hour", ar: "خلال ساعة عمل واحدة" }),
  privacyPolicyUrl: z.string().default("/privacy"),
  policyVersion: z.string().default("2026-10"),
});

export type OrgSettings = z.infer<typeof OrgSettingsSchema>;
export type WorkingHours = z.infer<typeof WorkingHoursSchema>;

export function parseSettings(raw: unknown): OrgSettings {
  const parsed = OrgSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : OrgSettingsSchema.parse({});
}
