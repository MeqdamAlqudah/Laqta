import { z } from "zod";
import { normalizeEmail, normalizePhone, sanitizeText } from "./normalize";

/**
 * The canonical lead (spec section 5 "Example canonical lead").
 * Every channel adapter converts its own payload INTO this shape; business
 * rules run only after this normalization step.
 */
export const CanonicalLeadSchema = z.object({
  fullName: z
    .string({ error: "Full name is required" })
    .transform((s) => sanitizeText(s, 80) ?? "")
    .pipe(z.string().min(2, "Enter your full name (2-80 characters)").max(80)),
  phone: z
    .string({ error: "Mobile number is required" })
    .transform((s, ctx) => {
      const e164 = normalizePhone(s);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
        return z.NEVER;
      }
      return e164;
    }),
  email: z
    .string()
    .optional()
    .nullable()
    .transform((s) => normalizeEmail(s))
    .refine((s) => s === null || z.email().safeParse(s).success, "Enter a valid email address"),
  serviceCode: z.string({ error: "Choose a service" }).min(1, "Choose a service").max(60),
  preferredAt: z
    .string()
    .optional()
    .nullable()
    .transform((s) => (s ? new Date(s) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Enter a valid date and time"),
  message: z
    .string()
    .max(500, "Message must be 500 characters or fewer")
    .optional()
    .nullable()
    .transform((s) => sanitizeText(s, 500)),
  source: z
    .object({
      channel: z.string().min(1).max(40).default("website"),
      campaign: z.string().max(120).optional().nullable(),
      meta: z.record(z.string(), z.string().max(300)).optional(),
    })
    .default({ channel: "website" }),
  language: z.enum(["en", "ar"]).default("en"),
  consent: z.object({
    accepted: z.literal(true, { error: "You must accept the privacy notice" }),
    policyVersion: z.string().max(40).default("2026-10"),
  }),
  idempotencyKey: z.string().min(8).max(120),
});

export type CanonicalLeadInput = z.input<typeof CanonicalLeadSchema>;
export type CanonicalLead = z.output<typeof CanonicalLeadSchema>;
