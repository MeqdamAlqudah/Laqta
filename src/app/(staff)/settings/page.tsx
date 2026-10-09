import { prisma } from "@/lib/db";
import { requirePageActor } from "@/lib/auth/session";
import { parseSettings } from "@/domain/settings";
import { RoutingRuleSchema } from "@/services/assignment";
import { SettingsForm, ServicesEditor } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const actor = await requirePageActor("settings:manage");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId } });
  const [services, users] = await Promise.all([
    prisma.service.findMany({ where: { organizationId: org.id, deletedAt: null }, orderBy: { nameEn: "asc" } }),
    prisma.user.findMany({ where: { organizationId: org.id, active: true, role: { in: ["ADMIN", "MANAGER", "AGENT"] } }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuration</h1>
      <SettingsForm
        name={org.name}
        timezone={org.timezone}
        settings={parseSettings(org.settings)}
        formUrl={`/f/${org.slug}`}
        publicKey={org.publicKey}
      />
      <ServicesEditor
        users={users}
        services={services.map((s) => ({
          id: s.id, code: s.code, nameEn: s.nameEn, nameAr: s.nameAr, active: s.active,
          routingRule: RoutingRuleSchema.parse(s.routingRule ?? {}),
        }))}
      />
    </div>
  );
}
