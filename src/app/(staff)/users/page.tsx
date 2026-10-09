import { prisma } from "@/lib/db";
import { requirePageActor } from "@/lib/auth/session";
import { InviteForm, UserRow } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const actor = await requirePageActor("users:manage");
  const users = await prisma.user.findMany({ where: { organizationId: actor.organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <InviteForm />
      <section className="card divide-y divide-slate-100">
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt?.toLocaleString("en-GB") ?? null }}
            isSelf={u.id === actor.id}
          />
        ))}
      </section>
      <div className="card p-4 text-sm text-slate-600">
        <b>Roles:</b> Admin - everything. Manager - all leads, assignment, dashboards, exports. Agent - own and unassigned leads.
        Viewer - read-only dashboards, contact details masked.
      </div>
    </div>
  );
}
