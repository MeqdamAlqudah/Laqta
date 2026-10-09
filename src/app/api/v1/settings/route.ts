import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireApiActor } from "@/lib/auth/session";
import { OrgSettingsSchema, parseSettings } from "@/domain/settings";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  timezone: z.string().max(60).optional(),
  settings: OrgSettingsSchema.partial().optional(),
});

/** PUT /api/v1/settings - organization name, timezone, SLA, working hours, retention. */
export const PUT = handler(async (req, _ctx, requestId) => {
  const actor = await requireApiActor(req, "settings:manage");
  const body = Body.parse(await req.json());
  if (body.timezone) new Intl.DateTimeFormat("en", { timeZone: body.timezone }); // throws on invalid zone
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId } });
  const merged = OrgSettingsSchema.parse({ ...parseSettings(org.settings), ...(body.settings ?? {}) });
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { name: body.name, timezone: body.timezone, settings: merged },
  });
  return json({ name: updated.name, timezone: updated.timezone, settings: merged }, 200, requestId);
});
