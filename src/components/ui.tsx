// Small presentational helpers shared by staff pages.
const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  ASSIGNED: "bg-indigo-100 text-indigo-800",
  CONTACTED: "bg-cyan-100 text-cyan-800",
  QUALIFIED: "bg-amber-100 text-amber-800",
  WON: "bg-emerald-100 text-emerald-800",
  LOST: "bg-slate-200 text-slate-700",
  OVERDUE: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-slate-100"}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const style = priority === "HIGH" ? "bg-red-50 text-red-700 ring-red-200" : priority === "LOW" ? "bg-slate-50 text-slate-600 ring-slate-200" : "bg-amber-50 text-amber-700 ring-amber-200";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${style}`}>AI: {priority}</span>;
}

export function isOverdue(l: { status: string; slaDueAt: Date | string | null }) {
  return (l.status === "NEW" || l.status === "ASSIGNED") && !!l.slaDueAt && new Date(l.slaDueAt) < new Date();
}

/** SLA indicator: time left (green/amber) or how late (red). */
export function SlaIndicator({ lead }: { lead: { status: string; slaDueAt: Date | string | null } }) {
  if (!lead.slaDueAt || !(lead.status === "NEW" || lead.status === "ASSIGNED")) return <span className="text-xs text-slate-400">-</span>;
  const diff = Math.round((new Date(lead.slaDueAt).getTime() - Date.now()) / 60_000);
  if (diff < 0) return <span className="text-xs font-semibold text-red-600">{formatMinutes(-diff)} late</span>;
  return <span className={`text-xs font-semibold ${diff < 5 ? "text-amber-600" : "text-emerald-600"}`}>{formatMinutes(diff)} left</span>;
}

export function formatMinutes(m: number) {
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d`;
}

export function timeAgo(d: Date | string) {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
  return `${Math.floor(m / 1440)} d ago`;
}

export function StatCard({ label, value, tone = "slate", href }: { label: string; value: number | string; tone?: string; href?: string }) {
  const tones: Record<string, string> = {
    blue: "text-blue-700", indigo: "text-indigo-700", red: "text-red-600", emerald: "text-emerald-700", slate: "text-slate-800", cyan: "text-cyan-700", amber: "text-amber-700",
  };
  const body = (
    <div className="card p-4 transition hover:shadow-md">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tones[tone]}`}>{value}</div>
    </div>
  );
  return href ? <a href={href}>{body}</a> : body;
}
