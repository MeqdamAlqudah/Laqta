import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Records denied access, bad signatures, etc. Never stores personal content. */
export async function logSecurityEvent(e: {
  type: string;
  organizationId?: string | null;
  actorId?: string | null;
  detail?: Record<string, unknown>;
}) {
  logger.warn("security_event", { type: e.type, organizationId: e.organizationId, actorId: e.actorId, detail: e.detail });
  try {
    await prisma.securityEvent.create({
      data: {
        type: e.type,
        organizationId: e.organizationId ?? null,
        actorId: e.actorId ?? null,
        detail: (e.detail ?? {}) as object,
      },
    });
  } catch (err) {
    logger.error("security_event_write_failed", { error: err });
  }
}
