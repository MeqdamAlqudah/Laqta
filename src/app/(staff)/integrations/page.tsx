import { prisma } from "@/lib/db";
import { requirePageActor } from "@/lib/auth/session";
import { timeAgo } from "@/components/ui";
import { IntegrationCard, RetryButton } from "./IntegrationsClient";

export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<string, string> = {
  EMAIL: "Customer confirmations, staff alerts, escalations and the daily summary. SMTP settings come from server environment variables.",
  SHEETS_WEBHOOK: "Sends a signed copy of every lead to n8n/Make or a Google Apps Script that writes to Google Sheets.",
  WHATSAPP: "Sends a signed staff-alert event to n8n/Make, which delivers it through your approved WhatsApp Business provider.",
  AI: "Suggests a category, priority and draft reply for each lead. Uses Claude when ANTHROPIC_API_KEY is set, otherwise keyword rules.",
};

export default async function IntegrationsPage() {
  const actor = await requirePageActor("integrations:manage");
  const [integrations, jobCounts, problemJobs] = await Promise.all([
    prisma.integration.findMany({ where: { organizationId: actor.organizationId }, orderBy: { provider: "asc" } }),
    prisma.automationJob.groupBy({ by: ["state"], where: { organizationId: actor.organizationId }, _count: { _all: true } }),
    prisma.automationJob.findMany({
      where: { organizationId: actor.organizationId, OR: [{ state: "DEAD" }, { state: "PENDING", attempts: { gt: 0 } }] },
      include: { lead: { select: { reference: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const counts = Object.fromEntries(jobCounts.map((j) => [j.state, j._count._all]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integrations &amp; automation health</h1>

      <div className="flex flex-wrap gap-3 text-sm">
        {["PENDING", "RUNNING", "SUCCEEDED", "DEAD"].map((s) => (
          <span key={s} className={`rounded-lg px-3 py-1 ${s === "DEAD" && counts[s] ? "bg-red-100 text-red-700" : "bg-white ring-1 ring-slate-200"}`}>
            {s}: <b>{counts[s] ?? 0}</b>
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((i) => (
          <IntegrationCard
            key={i.id}
            id={i.id}
            provider={i.provider}
            description={DESCRIPTIONS[i.provider] ?? ""}
            enabled={i.enabled}
            url={(i.configuration as Record<string, string>).url ?? ""}
            hasSecret={!!i.encryptedCredentials}
            needsUrl={i.provider === "SHEETS_WEBHOOK" || i.provider === "WHATSAPP"}
            lastSuccess={i.lastSuccessAt ? timeAgo(i.lastSuccessAt) : null}
            lastError={i.lastError}
            lastErrorAt={i.lastErrorAt ? timeAgo(i.lastErrorAt) : null}
          />
        ))}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">Failed and retrying jobs</h2>
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Job</th><th className="px-4 py-2">Lead</th><th className="px-4 py-2">State</th><th className="px-4 py-2">Attempts</th><th className="px-4 py-2">Last error</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {problemJobs.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">All automation is healthy.</td></tr>}
            {problemJobs.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2 font-mono text-xs">{j.jobType}</td>
                <td className="px-4 py-2">{j.lead?.reference ?? "-"}</td>
                <td className="px-4 py-2"><span className={j.state === "DEAD" ? "font-semibold text-red-600" : "text-amber-600"}>{j.state === "DEAD" ? "DEAD" : "RETRYING"}</span></td>
                <td className="px-4 py-2">{j.attempts}/{j.maxAttempts}</td>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-500" title={j.lastError ?? ""}>{j.lastError}</td>
                <td className="px-4 py-2 text-right">{j.state === "DEAD" && <RetryButton jobId={j.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
