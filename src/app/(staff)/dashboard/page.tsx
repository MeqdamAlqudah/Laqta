import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listLeads, type LeadFilters } from "@/repositories/lead.repository";
import { dashboardSummary } from "@/services/dashboard.service";
import { LEAD_STATUSES } from "@/domain/lead/status";
import { maskPhone } from "@/domain/lead/normalize";
import { PriorityBadge, SlaIndicator, StatCard, StatusBadge, isOverdue, timeAgo } from "@/components/ui";
import { AddLeadButton } from "./AddLeadButton";

export const dynamic = "force-dynamic";

const SOURCES = ["website", "google_form", "meta_ads", "whatsapp", "manual"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor("lead:read");
  const sp = await searchParams;
  const filters: LeadFilters = {
    status: sp.status, owner: sp.owner, service: sp.service, source: sp.source, q: sp.q, from: sp.from, to: sp.to,
    page: Number(sp.page ?? 1),
  };

  const [summary, list, users, services] = await Promise.all([
    dashboardSummary(actor),
    listLeads(actor, filters),
    prisma.user.findMany({ where: { organizationId: actor.organizationId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { organizationId: actor.organizationId, deletedAt: null }, orderBy: { nameEn: "asc" } }),
  ]);

  const showContact = can(actor.role, "lead:read_contact");
  const qs = (extra: Record<string, string | number>) =>
    "?" + new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) }).toString();
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-6">
      {sp.denied && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">You don&apos;t have access to that page.</div>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <StatCard label="New" value={summary.status.NEW ?? 0} tone="blue" href="/dashboard?status=NEW" />
        <StatCard label="Assigned" value={summary.status.ASSIGNED ?? 0} tone="indigo" href="/dashboard?status=ASSIGNED" />
        <StatCard label="Overdue" value={summary.overdue} tone="red" href="/dashboard?status=OVERDUE" />
        <StatCard label="Contacted" value={summary.status.CONTACTED ?? 0} tone="cyan" href="/dashboard?status=CONTACTED" />
        <StatCard label="Qualified" value={summary.status.QUALIFIED ?? 0} tone="amber" href="/dashboard?status=QUALIFIED" />
        <StatCard label="Won" value={summary.status.WON ?? 0} tone="emerald" href="/dashboard?status=WON" />
        <StatCard label="Lost" value={summary.status.LOST ?? 0} href="/dashboard?status=LOST" />
      </section>

      <section className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span>Median first response: <b>{summary.medianFirstResponseMinutes ?? "n/a"}{summary.medianFirstResponseMinutes !== null && " min"}</b></span>
        <span>Contacted within SLA: <b>{summary.contactedWithinSlaPct ?? "n/a"}{summary.contactedWithinSlaPct !== null && "%"}</b></span>
        <span>Sources: {Object.entries(summary.sources).map(([k, v]) => <b key={k} className="me-2">{k} {v}</b>)}</span>
      </section>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Name, reference, phone, email" />
        </div>
        <Select name="status" label="Status" value={sp.status} options={[...LEAD_STATUSES, "OVERDUE"].map((s) => [s, s])} />
        <Select name="owner" label="Owner" value={sp.owner} options={[["me", "Me"], ["unassigned", "Unassigned"], ...users.map((u) => [u.id, u.name] as [string, string])]} />
        <Select name="service" label="Service" value={sp.service} options={services.map((s) => [s.id, s.nameEn])} />
        <Select name="source" label="Source" value={sp.source} options={SOURCES.map((s) => [s, s])} />
        <div>
          <label className="label" htmlFor="from">From</label>
          <input id="from" type="date" name="from" defaultValue={sp.from} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input id="to" type="date" name="to" defaultValue={sp.to} className="input" />
        </div>
        <button className="btn-primary">Filter</button>
        <Link href="/dashboard" className="btn-secondary">Reset</Link>
        <div className="ms-auto flex gap-2">
          {can(actor.role, "lead:export") && (
            <a className="btn-secondary" href={`/api/v1/leads${qs({ format: "csv" })}`}>Export CSV</a>
          )}
          {can(actor.role, "lead:create") && (
            <AddLeadButton services={services.filter((s) => s.active).map((s) => ({ code: s.code, name: s.nameEn }))} />
          )}
        </div>
      </form>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No leads match these filters.</td></tr>
            )}
            {list.items.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs"><Link className="text-brand-600 hover:underline" href={`/leads/${l.id}`}>{l.reference}</Link></td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.fullName}</Link>
                  <div className="text-xs text-slate-500" dir="ltr">{showContact ? l.phoneE164 : maskPhone(l.phoneE164)}</div>
                </td>
                <td className="px-4 py-3">
                  {l.service?.nameEn ?? <span className="text-slate-400">General</span>}
                  <div><PriorityBadge priority={l.aiPriority} /></div>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.sourceChannel}</td>
                <td className="px-4 py-3">{l.owner?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                <td className="px-4 py-3 text-slate-600">{timeAgo(l.createdAt)}</td>
                <td className="px-4 py-3"><SlaIndicator lead={l} /></td>
                <td className="px-4 py-3"><StatusBadge status={isOverdue(l) ? "OVERDUE" : l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>{list.total} leads</span>
          <div className="flex gap-2">
            {list.page > 1 && <Link className="btn-secondary" href={qs({ page: list.page - 1 })}>Previous</Link>}
            <span className="px-2 py-2">Page {list.page} / {pages}</span>
            {list.page < pages && <Link className="btn-secondary" href={qs({ page: list.page + 1 })}>Next</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
