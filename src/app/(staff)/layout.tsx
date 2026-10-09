import Link from "next/link";
import { requirePageActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const org = await prisma.organization.findUnique({ where: { id: actor.organizationId }, select: { name: true } });
  const links = [
    { href: "/dashboard", label: "Leads", show: true },
    { href: "/settings", label: "Settings", show: can(actor.role, "settings:manage") },
    { href: "/integrations", label: "Integrations", show: can(actor.role, "integrations:manage") },
    { href: "/users", label: "Users", show: can(actor.role, "users:manage") },
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-bold text-brand-600">LeadFlow</Link>
          <span className="hidden text-sm text-slate-400 sm:inline">{org?.name}</span>
          <nav className="flex gap-4 text-sm">
            {links.filter((l) => l.show).map((l) => (
              <Link key={l.href} href={l.href} className="text-slate-600 hover:text-brand-600">{l.label}</Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600">{actor.name}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{actor.role}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}
