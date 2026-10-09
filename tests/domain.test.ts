import { describe, expect, it } from "vitest";
import { normalizePhone, sanitizeText, maskPhone } from "@/domain/lead/normalize";
import { CanonicalLeadSchema } from "@/domain/lead/schema";
import { canTransition } from "@/domain/lead/status";
import { computeSlaDue } from "@/domain/sla";

describe("phone normalization", () => {
  it("normalizes local Jordanian numbers to E.164", () => {
    expect(normalizePhone("0790000000")).toBe("+962790000000");
    expect(normalizePhone("079 000 0000")).toBe("+962790000000");
    expect(normalizePhone("00962790000000")).toBe("+962790000000");
    expect(normalizePhone("+962 79 000 0000")).toBe("+962790000000");
  });
  it("accepts Arabic-Indic digits", () => {
    expect(normalizePhone("٠٧٩٠٠٠٠٠٠٠")).toBe("+962790000000");
  });
  it("rejects garbage", () => {
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("hello")).toBeNull();
  });
  it("masks for logs", () => {
    expect(maskPhone("+962790000123")).toBe("+9627****123");
  });
});

describe("canonical lead schema", () => {
  const valid = {
    fullName: "  Sample   Customer ",
    phone: "0790000000",
    email: "Customer@Example.com",
    serviceCode: "consultation",
    consent: { accepted: true },
    idempotencyKey: "web-12345678",
  };

  it("normalizes a valid lead", () => {
    const lead = CanonicalLeadSchema.parse(valid);
    expect(lead.fullName).toBe("Sample Customer");
    expect(lead.phone).toBe("+962790000000");
    expect(lead.email).toBe("customer@example.com");
    expect(lead.language).toBe("en");
    expect(lead.source.channel).toBe("website");
  });

  it("returns field-level errors", () => {
    const r = CanonicalLeadSchema.safeParse({ ...valid, phone: "123", fullName: "A", consent: { accepted: false } });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["phone", "fullName", "consent.accepted"]));
  });

  it("strips HTML from messages and enforces 500 chars", () => {
    expect(sanitizeText("<script>x</script>Hello")).toBe("xHello");
    expect(CanonicalLeadSchema.safeParse({ ...valid, message: "a".repeat(501) }).success).toBe(false);
  });
});

describe("status state machine", () => {
  it("allows the main pipeline", () => {
    expect(canTransition("NEW", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "CONTACTED")).toBe(true);
    expect(canTransition("CONTACTED", "QUALIFIED")).toBe(true);
    expect(canTransition("QUALIFIED", "WON")).toBe(true);
  });
  it("blocks skipping to WON and allows reopening", () => {
    expect(canTransition("NEW", "WON")).toBe(false);
    expect(canTransition("WON", "CONTACTED")).toBe(true);
  });
});

describe("SLA in working hours", () => {
  const wh = { days: [0, 1, 2, 3, 4], start: "09:00", end: "17:00" };
  it("adds minutes inside working hours", () => {
    // Sunday 2026-10-04 10:00 Amman (UTC+3) = 07:00Z
    const due = computeSlaDue(new Date("2026-10-04T07:00:00Z"), 15, "Asia/Amman", wh);
    expect(due.toISOString()).toBe("2026-10-04T07:15:00.000Z");
  });
  it("carries over the weekend (Thursday 16:55 -> Sunday 09:10)", () => {
    // Thursday 2026-10-08 16:55 Amman = 13:55Z
    const due = computeSlaDue(new Date("2026-10-08T13:55:00Z"), 15, "Asia/Amman", wh);
    expect(due.toISOString()).toBe("2026-10-11T06:10:00.000Z"); // Sunday 09:10 Amman
  });
});
