/**
 * Safe demo dataset: one clinic, four staff (one per role), services with
 * routing rules, integrations, and sample leads in every status.
 * All names/numbers are fictional. Run with: npm run db:seed
 */
import { PrismaClient, type LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo credentials - development only. Change or delete these users in production.
const DEMO_PASSWORD = "LeadFlow#2026";
const STAFF = [
  { name: "Lina Admin", email: "admin@leadflow.local", role: "ADMIN" as const },
  { name: "Omar Manager", email: "manager@leadflow.local", role: "MANAGER" as const },
  { name: "Sara Agent", email: "agent@leadflow.local", role: "AGENT" as const },
  { name: "Yousef Agent", email: "agent2@leadflow.local", role: "AGENT" as const },
  { name: "Rania Viewer", email: "viewer@leadflow.local", role: "VIEWER" as const },
];

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: "smile-clinic" } });
  if (existing) {
    console.log("Seed data already present - run `npm run db:reset` to start over.");
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: "Smile Dental Clinic",
      slug: "smile-clinic",
      timezone: "Asia/Amman",
      defaultLanguage: "en",
      publicKey: "pk_demo_smile_clinic",
      settings: {
        slaMinutes: 15,
        workingHours: { days: [0, 1, 2, 3, 4], start: "09:00", end: "17:00" },
        dedupeWindowHours: 24,
        retentionDays: 365,
        notifyEmails: [],
      },
    },
  });

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, string> = {};
  for (const s of STAFF) {
    const u = await prisma.user.create({ data: { ...s, organizationId: org.id, passwordHash: hash } });
    users[s.email] = u.id;
  }
  const agents = [users["agent@leadflow.local"]!, users["agent2@leadflow.local"]!];

  const svc = async (code: string, nameEn: string, nameAr: string, routingRule: object) =>
    prisma.service.create({ data: { organizationId: org.id, code, nameEn, nameAr, routingRule } });
  const services = [
    await svc("consultation", "Consultation", "استشارة", { strategy: "round_robin", userIds: agents }),
    await svc("cleaning", "Teeth cleaning", "تنظيف الأسنان", { strategy: "least_loaded", userIds: agents }),
    await svc("whitening", "Teeth whitening", "تبييض الأسنان", { strategy: "fixed", userIds: [agents[0]] }),
    await svc("orthodontics", "Orthodontics (braces)", "تقويم الأسنان", { strategy: "none", userIds: [] }),
  ];

  await prisma.integration.createMany({
    data: [
      { organizationId: org.id, provider: "EMAIL", enabled: true },
      { organizationId: org.id, provider: "AI", enabled: true },
      { organizationId: org.id, provider: "SHEETS_WEBHOOK", enabled: false },
      { organizationId: org.id, provider: "WHATSAPP", enabled: false },
    ],
  });

  const samples: { name: string; phone: string; svc: number; status: LeadStatus; source: string; mins: number; msg: string; lang?: string; owner?: string | null }[] = [
    { name: "Ahmad Saleh", phone: "+962790000101", svc: 0, status: "NEW", source: "website", mins: 2, msg: "I have tooth pain since yesterday, can I come today?" },
    { name: "Hala Nasser", phone: "+962790000102", svc: 1, status: "ASSIGNED", source: "meta_ads", mins: 40, msg: "How much is a cleaning session?", owner: agents[0] },
    { name: "Khaled Omari", phone: "+962790000103", svc: 3, status: "NEW", source: "google_form", mins: 75, msg: "استفسار عن تقويم الأسنان للأطفال", lang: "ar" },
    { name: "Dana Haddad", phone: "+962790000104", svc: 2, status: "CONTACTED", source: "website", mins: 180, msg: "Interested in whitening before my wedding next month.", owner: agents[0] },
    { name: "Mohammad Zoubi", phone: "+962790000105", svc: 0, status: "QUALIFIED", source: "whatsapp", mins: 60 * 26, msg: "Need a full check-up for my family.", owner: agents[1] },
    { name: "Rami Khoury", phone: "+962790000106", svc: 1, status: "WON", source: "website", mins: 60 * 50, msg: "Book me for cleaning please.", owner: agents[1] },
    { name: "Noor Abbadi", phone: "+962790000107", svc: 3, status: "LOST", source: "meta_ads", mins: 60 * 72, msg: "Just checking prices.", owner: agents[0] },
    { name: "Tareq Masri", phone: "+962790000108", svc: 0, status: "ASSIGNED", source: "website", mins: 25, msg: "", owner: agents[1] },
  ];

  let counter = org.leadCounter;
  for (const [i, s] of samples.entries()) {
    const createdAt = new Date(Date.now() - s.mins * 60_000);
    const reference = `LF-${createdAt.getFullYear()}-${++counter}`;
    const contacted = ["CONTACTED", "QUALIFIED", "WON", "LOST"].includes(s.status);
    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        reference,
        fullName: s.name,
        phoneE164: s.phone,
        email: `customer${i + 1}@example.com`,
        serviceId: services[s.svc]!.id,
        message: s.msg || null,
        language: s.lang ?? "en",
        status: s.status,
        ownerId: s.owner ?? null,
        sourceChannel: s.source,
        idempotencyKey: `seed-${i}`,
        createdAt,
        slaDueAt: new Date(createdAt.getTime() + 15 * 60_000),
        firstContactedAt: contacted ? new Date(createdAt.getTime() + (8 + i) * 60_000) : null,
      },
    });
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: "CREATED", newValue: "NEW", createdAt, metadata: { channel: s.source } } });
    if (s.owner) {
      await prisma.leadActivity.create({ data: { leadId: lead.id, type: "OWNER_CHANGED", newValue: s.owner, createdAt, metadata: { strategy: "seed" } } });
    }
    if (contacted) {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, type: "CALL", actorId: s.owner ?? null, newValue: "Called the customer and explained the options.", createdAt: lead.firstContactedAt! },
      });
      await prisma.leadActivity.create({
        data: { leadId: lead.id, type: "STATUS_CHANGED", actorId: s.owner ?? null, oldValue: "ASSIGNED", newValue: s.status, createdAt: lead.firstContactedAt! },
      });
    }
    await prisma.consent.create({ data: { leadId: lead.id, consentType: "privacy_notice", policyVersion: "2026-10", capturedAt: createdAt } });
    // Queue AI classification so the worker fills in suggestions for the demo leads.
    await prisma.automationJob.create({
      data: { organizationId: org.id, leadId: lead.id, jobType: "AI_CLASSIFY", idempotencyKey: `ai:${lead.id}`, maxAttempts: 3 },
    });
  }
  await prisma.organization.update({ where: { id: org.id }, data: { leadCounter: counter } });

  console.log("\nSeed complete.");
  console.log(`Public form:  http://localhost:3000/f/${org.slug}   (Arabic: ?lang=ar)`);
  console.log(`Form key:     ${org.publicKey}`);
  console.log(`Staff login:  ${STAFF.map((s) => `${s.email} (${s.role})`).join(", ")}`);
  console.log(`Password:     ${DEMO_PASSWORD}  (all demo users)\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
