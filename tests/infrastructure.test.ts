import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "@/integrations/webhook-signature";
import { backoffMs } from "@/jobs/queue";
import { redact } from "@/lib/logger";
import { can } from "@/lib/auth/rbac";
import { RuleBasedClassifier } from "@/ai/rule-classifier";
import { googleFormsAdapter } from "@/adapters/google-forms";
import { metaLeadAdsAdapter } from "@/adapters/meta-lead-ads";
import { whatsappAdapter } from "@/adapters/whatsapp";
import { CanonicalLeadSchema } from "@/domain/lead/schema";

describe("webhook signatures", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ hello: "world" });

  it("accepts a fresh valid signature", () => {
    const { timestamp, signature } = signPayload(secret, body);
    expect(verifySignature(secret, body, timestamp, signature)).toEqual({ ok: true });
  });
  it("rejects tampered bodies and wrong secrets", () => {
    const { timestamp, signature } = signPayload(secret, body);
    expect(verifySignature(secret, body + " ", timestamp, signature).ok).toBe(false);
    expect(verifySignature("other", body, timestamp, signature).ok).toBe(false);
  });
  it("rejects stale timestamps (replay window)", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const { timestamp, signature } = signPayload(secret, body, old);
    expect(verifySignature(secret, body, timestamp, signature)).toEqual({ ok: false, reason: "stale" });
  });
});

describe("retry backoff", () => {
  it("grows exponentially and is capped", () => {
    expect(backoffMs(1)).toBeGreaterThanOrEqual(30_000);
    expect(backoffMs(1)).toBeLessThan(36_001);
    expect(backoffMs(3)).toBeGreaterThanOrEqual(120_000);
    expect(backoffMs(20)).toBeLessThanOrEqual(72 * 60_000);
  });
});

describe("log redaction", () => {
  it("removes personal data at any depth", () => {
    const out = redact({ requestId: "r1", lead: { phone: "+962790000000", email: "a@b.c", nested: { message: "hi" } } });
    expect(JSON.stringify(out)).not.toContain("962790000000");
    expect(JSON.stringify(out)).not.toContain("a@b.c");
    expect(JSON.stringify(out)).toContain("r1");
  });
});

describe("RBAC policy", () => {
  it("matches the role table", () => {
    expect(can("ADMIN", "integrations:manage")).toBe(true);
    expect(can("MANAGER", "lead:assign")).toBe(true);
    expect(can("MANAGER", "users:manage")).toBe(false);
    expect(can("AGENT", "lead:read_all")).toBe(false);
    expect(can("VIEWER", "lead:update")).toBe(false);
    expect(can("VIEWER", "lead:read_contact")).toBe(false);
  });
});

describe("rule-based AI fallback", () => {
  const c = new RuleBasedClassifier();
  const base = { serviceCode: "consultation", serviceName: "Consultation", channel: "website", categories: ["consultation"] };
  it("detects urgency in English and Arabic", async () => {
    expect((await c.classify({ ...base, language: "en", message: "Severe pain, can I come today?" })).priority).toBe("HIGH");
    expect((await c.classify({ ...base, language: "ar", message: "عندي ألم شديد" })).priority).toBe("HIGH");
  });
  it("marks informational enquiries LOW", async () => {
    expect((await c.classify({ ...base, language: "en", message: "Just asking for the price list" })).priority).toBe("LOW");
  });
});

describe("channel adapters produce valid canonical leads", () => {
  it("google forms", () => {
    const input = googleFormsAdapter.toCanonical({
      responseId: "abc123",
      responses: { "Full name": "Sara Ali", "Mobile number": "0790000000", Service: "Consultation", Consent: "Yes" },
    });
    const lead = CanonicalLeadSchema.parse(input);
    expect(lead.idempotencyKey).toBe("gform-abc123");
    expect(lead.serviceCode).toBe("consultation");
  });
  it("meta lead ads", () => {
    const lead = CanonicalLeadSchema.parse(
      metaLeadAdsAdapter.toCanonical({
        leadgen_id: "999000111",
        campaign_name: "autumn_launch",
        field_data: [{ name: "full_name", values: ["Omar K"] }, { name: "phone_number", values: ["+962790000001"] }],
      }),
    );
    expect(lead.source).toMatchObject({ channel: "meta_ads", campaign: "autumn_launch" });
  });
  it("whatsapp detects Arabic", () => {
    const lead = CanonicalLeadSchema.parse(whatsappAdapter.toCanonical({ messageId: "wamid.1", from: "+962790000002", text: "مرحبا، أريد موعد" }));
    expect(lead.language).toBe("ar");
  });
});
