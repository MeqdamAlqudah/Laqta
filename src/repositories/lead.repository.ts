import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/auth/session";
import { LEAD_STATUSES, type LeadStatusValue } from "@/domain/lead/status";
import { toAsciiDigits } from "@/domain/lead/normalize";

/**
 * Repository pattern: the ONLY place that builds lead queries.
 * Every query starts from `scopeFor(actor)`, which always includes the
 * tenant (organizationId) and, for agents, restricts to own/unassigned leads.
 * A route can't forget tenant isolation because it never writes a raw where.
 */
export function scopeFor(actor: Actor): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { organizationId: actor.organizationId };
  if (!can(actor.role, "lead:read_all") && actor.id) {
    where.OR = [{ ownerId: actor.id }, { ownerId: null }];
  }
  return where;
}

export interface LeadFilters {
  status?: string; // a LeadStatus or "OVERDUE"
  owner?: string; // user id | "me" | "unassigned"
  service?: string;
  source?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function overdueWhere(now = new Date()): Prisma.LeadWhereInput {
  return { status: { in: ["NEW", "ASSIGNED"] }, slaDueAt: { lt: now } };
}

export function buildWhere(actor: Actor, f: LeadFilters): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [scopeFor(actor)];
  if (f.status === "OVERDUE") and.push(overdueWhere());
  else if (f.status && LEAD_STATUSES.includes(f.status as LeadStatusValue)) and.push({ status: f.status as LeadStatusValue });
  if (f.owner === "me" && actor.id) and.push({ ownerId: actor.id });
  else if (f.owner === "unassigned") and.push({ ownerId: null });
  else if (f.owner) and.push({ ownerId: f.owner });
  if (f.service) and.push({ serviceId: f.service });
  if (f.source) and.push({ sourceChannel: f.source });
  if (f.from) and.push({ createdAt: { gte: new Date(f.from) } });
  if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59`) } });
  if (f.q) {
    const q = f.q.trim();
    const digits = toAsciiDigits(q).replace(/\D/g, "");
    and.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phoneE164: { contains: digits } }] : []),
      ],
    });
  }
  return { AND: and };
}

const listInclude = {
  owner: { select: { id: true, name: true } },
  service: { select: { id: true, code: true, nameEn: true, nameAr: true } },
} satisfies Prisma.LeadInclude;

export async function listLeads(actor: Actor, f: LeadFilters) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 200);
  const page = Math.max(f.page ?? 1, 1);
  const where = buildWhere(actor, f);
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function findLead(actor: Actor, id: string) {
  return prisma.lead.findFirst({
    where: { AND: [scopeFor(actor), { id }] },
    include: {
      ...listInclude,
      activities: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      consents: true,
    },
  });
}

export type LeadListItem = Awaited<ReturnType<typeof listLeads>>["items"][number];
export type LeadDetail = NonNullable<Awaited<ReturnType<typeof findLead>>>;
