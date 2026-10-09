import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import type { Actor } from "@/lib/auth/session";
import { canTransition, type LeadStatusValue } from "@/domain/lead/status";
import { maskEmail, maskPhone } from "@/domain/lead/normalize";
import { findLead, scopeFor, type LeadDetail, type LeadListItem } from "@/repositories/lead.repository";
import { logSecurityEvent } from "./security.service";

export interface LeadPatch {
  version: number; // optimistic locking
  status?: LeadStatusValue;
  ownerId?: string | null;
  note?: string;
}

/**
 * Applies a staff change. Optimistic locking: the update only succeeds if the
 * row still has the version the client read; otherwise 409 CONFLICT and the UI
 * reloads. Every change writes an immutable activity (actor, time, old/new).
 */
export async function updateLead(actor: Actor, id: string, patch: LeadPatch) {
  if (!can(actor.role, "lead:update")) throw new ApiError("FORBIDDEN");
  const lead = await prisma.lead.findFirst({ where: { AND: [scopeFor(actor), { id }] } });
  if (!lead) {
    await logSecurityEvent({ type: "LEAD_ACCESS_DENIED", organizationId: actor.organizationId, actorId: actor.id, detail: { leadId: id } });
    throw new ApiError("NOT_FOUND");
  }
  if (lead.anonymizedAt) throw new ApiError("CONFLICT", "Lead was anonymized");

  const data: Prisma.LeadUncheckedUpdateManyInput = {};
  const activities: { type: ActivityType; oldValue: string | null; newValue: string | null; metadata?: object }[] = [];

  if (patch.status && patch.status !== lead.status) {
    if (!canTransition(lead.status, patch.status)) {
      throw new ApiError("VALIDATION_ERROR", undefined, { status: `Cannot move from ${lead.status} to ${patch.status}` });
    }
    data.status = patch.status;
    if (patch.status === "CONTACTED" && !lead.firstContactedAt) data.firstContactedAt = new Date();
    activities.push({ type: "STATUS_CHANGED", oldValue: lead.status, newValue: patch.status });
  }

  if (patch.ownerId !== undefined && patch.ownerId !== lead.ownerId) {
    if (!can(actor.role, "lead:assign")) throw new ApiError("FORBIDDEN", "Only managers can change ownership");
    if (patch.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: patch.ownerId, organizationId: actor.organizationId, active: true },
      });
      if (!owner) throw new ApiError("VALIDATION_ERROR", undefined, { ownerId: "Unknown user" });
    }
    data.ownerId = patch.ownerId;
    if (patch.ownerId && lead.status === "NEW" && !data.status) {
      data.status = "ASSIGNED";
      activities.push({ type: "STATUS_CHANGED", oldValue: "NEW", newValue: "ASSIGNED" });
    }
    activities.push({ type: "OWNER_CHANGED", oldValue: lead.ownerId, newValue: patch.ownerId });
  }

  if (patch.note?.trim()) {
    activities.push({ type: "NOTE", oldValue: null, newValue: patch.note.trim().slice(0, 2000) });
  }

  if (activities.length === 0) return lead;

  return prisma.$transaction(async (tx) => {
    const res = await tx.lead.updateMany({
      where: { id, organizationId: actor.organizationId, version: patch.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (res.count === 0) throw new ApiError("CONFLICT", "This lead was changed by someone else. Reload and try again.");
    await tx.leadActivity.createMany({
      data: activities.map((a) => ({ leadId: id, actorId: actor.id, type: a.type, oldValue: a.oldValue, newValue: a.newValue, metadata: a.metadata ?? {} })),
    });
    return tx.lead.findUniqueOrThrow({ where: { id } });
  });
}

const ACTIVITY_TYPES = ["CALL", "MESSAGE", "NOTE", "EMAIL_SENT"] as const;
export type ManualActivityType = (typeof ACTIVITY_TYPES)[number];

/** Records a call/message/note. A logged call or message counts as first contact. */
export async function addActivity(actor: Actor, id: string, type: ManualActivityType, text: string, metadata: object = {}) {
  if (!can(actor.role, "lead:update")) throw new ApiError("FORBIDDEN");
  if (!ACTIVITY_TYPES.includes(type)) throw new ApiError("VALIDATION_ERROR", undefined, { type: "Unknown activity type" });
  const lead = await prisma.lead.findFirst({ where: { AND: [scopeFor(actor), { id }] } });
  if (!lead) throw new ApiError("NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    const activity = await tx.leadActivity.create({
      data: { leadId: id, actorId: actor.id, type, newValue: text.slice(0, 2000), metadata },
    });
    if ((type === "CALL" || type === "MESSAGE") && !lead.firstContactedAt) {
      await tx.lead.update({ where: { id }, data: { firstContactedAt: new Date() } });
    }
    return activity;
  });
}

/**
 * Privacy request: removes personal fields but keeps the lead row and its
 * audit trail (who did what, when) so reporting and accountability remain.
 */
export async function anonymizeLead(actor: Actor | null, organizationId: string, id: string, reason: string) {
  if (actor && !can(actor.role, "lead:anonymize")) throw new ApiError("FORBIDDEN");
  return prisma.$transaction(async (tx) => {
    const res = await tx.lead.updateMany({
      where: { id, organizationId, anonymizedAt: null },
      data: {
        fullName: "Anonymized",
        phoneE164: null,
        email: null,
        message: null,
        aiSuggestedReply: null,
        aiReason: null,
        sourceMeta: {},
        anonymizedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (res.count === 0) return false;
    // Activities may contain a duplicate's message text: scrub only those fields.
    const dupes = await tx.leadActivity.findMany({ where: { leadId: id, type: { in: ["DUPLICATE_MERGED", "NOTE", "CALL", "MESSAGE"] } } });
    for (const a of dupes) {
      await tx.leadActivity.update({ where: { id: a.id }, data: { newValue: a.newValue ? "[removed]" : null, metadata: { anonymized: true } } });
    }
    await tx.leadActivity.create({ data: { leadId: id, actorId: actor?.id ?? null, type: "ANONYMIZED", metadata: { reason } } });
    return true;
  });
}

/** Viewer role only sees approved fields (spec: "Read-only dashboards and approved lead fields"). */
export function serializeLead<T extends LeadListItem | LeadDetail>(actor: Actor, lead: T) {
  if (can(actor.role, "lead:read_contact")) return lead;
  return { ...lead, phoneE164: maskPhone(lead.phoneE164), email: maskEmail(lead.email), message: null, aiSuggestedReply: null };
}

export { findLead };
