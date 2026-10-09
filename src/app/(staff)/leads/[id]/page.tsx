import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { findLead, serializeLead } from "@/services/lead.service";
import { nextStatuses } from "@/domain/lead/status";
import { PriorityBadge, SlaIndicator, StatusBadge, isOverdue, timeAgo } from "@/components/ui";
import { LeadActions } from "./LeadActions";
import { logSecurityEvent } from "@/services/security.service";

export const dynamic = "force-dynamic";

const ACTIVITY_LABEL: Record<string, string> = {
  CREATED: "Lead captured",
  DUPLICATE_MERGED: "Repeat enquiry merged",
  STATUS_CHANGED: "Status changed",
  OWNER_CHANGED: "Owner changed",
  NOTE: "Note",
  CALL: "Call logged",
  MESSAGE: "Message logged",
  EMAIL_SENT: "Email sent",
  NOTIFICATION_SENT: "Staff notified",
  SYNCED: "Synchronized",
  AI_SUGGESTION: "AI suggestion",
  SLA_ESCALATED: "SLA escalated",
  ANONYMIZED: "Personal data removed",
};

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const actor = await requirePageActor("lead:read");
  const { id } = await params;
  const { action } = await searchParams;
  const found = await findLead(actor, id);
  if (!found) {
    await logSecurityEvent({ type: "LEAD_ACCESS_DENIED", organizationId: actor.organizationId, actorId: actor.id, detail: { leadId: id } });
    notFound();
  }
  const lead = serializeLead(actor, found);
  const users = await prisma.user.findMany({
    where: { organizationId: actor.organizationId, active: true, role: { in: ["ADMIN", "MANAGER", "AGENT"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const showValue = (type: string, v: string | null) => (type === "OWNER_CHANGED" ? (v ? userName.get(v) ?? "another user" : "nobody") : v);
  const waNumber = lead.phoneE164?.replace(/\D/g, "");

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="text-sm text-brand-600 hover:underline">&larr; Back to leads</Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{lead.fullName}</h1>
        <span className="font-mono text-sm text-slate-500">{lead.reference}</span>
        <StatusBadge status={lead.status} />
        {isOverdue(lead) && <StatusBadge status="OVERDUE" />}
        <SlaIndicator lead={lead} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <Info label="Mobile">
              <span dir="ltr">{lead.phoneE164 ?? "-"}</span>
              {can(actor.role, "lead:read_contact") && lead.phoneE164 && (
                <span className="ms-3 inline-flex gap-2">
                  <a className="text-brand-600 hover:underline" href={`tel:${lead.phoneE164}`}>Call</a>
                  <a className="text-emerald-600 hover:underline" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">WhatsApp</a>
                </span>
              )}
            </Info>
            <Info label="Email">{lead.email ? <a className="text-brand-600 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : "-"}</Info>
            <Info label="Service">{lead.service?.nameEn ?? "General enquiry"}</Info>
            <Info label="Language">{lead.language === "ar" ? "Arabic" : "English"}</Info>
            <Info label="Source">{lead.sourceChannel}{lead.sourceCampaign ? ` / ${lead.sourceCampaign}` : ""}</Info>
            <Info label="Received">{lead.createdAt.toLocaleString("en-GB")} ({timeAgo(lead.createdAt)})</Info>
            <Info label="Preferred time">{lead.preferredAt ? `${lead.preferredAt.toLocaleString("en-GB")} (not confirmed)` : "-"}</Info>
            <Info label="Owner">{lead.owner?.name ?? "Unassigned"}</Info>
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Message</div>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm" dir="auto">{lead.message ?? "(no message)"}</p>
            </div>
          </section>

          {lead.aiPriority && (
            <section className="card border-violet-200 bg-violet-50/40 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">AI suggestion</h2>
                <PriorityBadge priority={lead.aiPriority} />
                <span className="rounded bg-white px-1.5 text-[11px] text-slate-500 ring-1 ring-slate-200">{lead.aiProvider}</span>
              </div>
              <p className="mt-2 text-sm"><b>Category:</b> {lead.aiCategory} &middot; <b>Why:</b> {lead.aiReason}</p>
              {lead.aiSuggestedReply && (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Draft first reply (review before sending)</div>
                  <p className="mt-1 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200" dir="auto">{lead.aiSuggestedReply}</p>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">Suggestions only. Assignment stays rule-based and is never changed by AI.</p>
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <ol className="relative space-y-4 border-s border-slate-200 ps-5">
              {lead.activities.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -start-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                  <div className="text-sm">
                    <b>{ACTIVITY_LABEL[a.type] ?? a.type}</b>
                    {(a.oldValue || a.newValue) && a.type !== "NOTE" && a.type !== "CALL" && a.type !== "MESSAGE" && (
                      <span className="text-slate-600">: {a.oldValue ? `${showValue(a.type, a.oldValue)} → ` : ""}{showValue(a.type, a.newValue)}</span>
                    )}
                  </div>
                  {(a.type === "NOTE" || a.type === "CALL" || a.type === "MESSAGE") && a.newValue && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700" dir="auto">{a.newValue}</p>
                  )}
                  {a.type === "DUPLICATE_MERGED" && (
                    <p className="mt-1 text-sm text-slate-600" dir="auto">{String((a.metadata as Record<string, unknown>)?.message ?? "")}</p>
                  )}
                  <div className="text-xs text-slate-400">{a.createdAt.toLocaleString("en-GB")} &middot; {a.actor?.name ?? "System"}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside>
          {can(actor.role, "lead:update") && !lead.anonymizedAt ? (
            <LeadActions
              leadId={lead.id}
              version={lead.version}
              status={lead.status}
              nextStatuses={nextStatuses(lead.status)}
              ownerId={lead.ownerId}
              users={users}
              canAssign={can(actor.role, "lead:assign")}
              canAnonymize={can(actor.role, "lead:anonymize")}
              highlight={action === "contacted" || action === "note" ? action : null}
            />
          ) : (
            <div className="card p-5 text-sm text-slate-500">{lead.anonymizedAt ? "This lead was anonymized." : "Read-only access."}</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
