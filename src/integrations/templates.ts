import { env } from "@/lib/env";
import type { DashboardSummary } from "@/services/dashboard.service";

// Localized message templates. Arabic emails use dir="rtl".
const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(lang: "en" | "ar", body: string) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body style="font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f6f7fb;padding:24px;direction:${dir}">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">${body}</div></body></html>`;
}

export function customerConfirmation(p: {
  lang: "en" | "ar";
  orgName: string;
  name: string;
  reference: string;
  serviceName: string;
  responseTime: string;
}) {
  if (p.lang === "ar") {
    return {
      subject: `${p.orgName}: تم استلام طلبك (${p.reference})`,
      html: layout("ar", `<h2>مرحباً ${esc(p.name)}،</h2>
<p>شكراً لتواصلك مع <b>${esc(p.orgName)}</b>. لقد استلمنا طلبك بخصوص <b>${esc(p.serviceName)}</b>.</p>
<p>رقم المرجع: <b>${esc(p.reference)}</b></p>
<p>سيتواصل معك فريقنا ${esc(p.responseTime)}. هذه الرسالة لا تعني تأكيد موعد.</p>`),
      text: `مرحباً ${p.name}، استلمنا طلبك. رقم المرجع: ${p.reference}. سنتواصل معك ${p.responseTime}.`,
    };
  }
  return {
    subject: `${p.orgName}: we received your request (${p.reference})`,
    html: layout("en", `<h2>Hello ${esc(p.name)},</h2>
<p>Thank you for contacting <b>${esc(p.orgName)}</b>. We received your request about <b>${esc(p.serviceName)}</b>.</p>
<p>Your reference number: <b>${esc(p.reference)}</b></p>
<p>Our team will contact you ${esc(p.responseTime)}. This message does not confirm an appointment.</p>`),
    text: `Hello ${p.name}, we received your request. Reference: ${p.reference}. We will contact you ${p.responseTime}.`,
  };
}

export function staffAlert(p: {
  kind: "new" | "duplicate";
  leadId: string;
  reference: string;
  name: string;
  phone: string | null;
  serviceName: string;
  channel: string;
  message: string | null;
  ownerName: string | null;
}) {
  const url = `${env.appUrl}/leads/${p.leadId}`;
  const title = p.kind === "duplicate" ? "Repeat enquiry from an existing lead" : "New lead";
  const btn = (href: string, label: string, color: string) =>
    `<a href="${href}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 14px;border-radius:8px;background:${color};color:#fff;text-decoration:none">${label}</a>`;
  return {
    subject: `[LeadFlow] ${title}: ${p.reference} - ${p.serviceName}`,
    html: layout("en", `<h2>${title}</h2>
<table style="font-size:14px">
<tr><td><b>Reference</b></td><td>${esc(p.reference)}</td></tr>
<tr><td><b>Name</b></td><td>${esc(p.name)}</td></tr>
<tr><td><b>Service</b></td><td>${esc(p.serviceName)}</td></tr>
<tr><td><b>Channel</b></td><td>${esc(p.channel)}</td></tr>
<tr><td><b>Owner</b></td><td>${esc(p.ownerName ?? "Unassigned")}</td></tr>
</table>
<p style="background:#f3f4f6;padding:12px;border-radius:8px">${esc(p.message ?? "(no message)")}</p>
${btn(url, "Open lead", "#4f46e5")}
${p.phone ? btn(`tel:${p.phone}`, "Call", "#059669") : ""}
${btn(`${url}?action=contacted`, "Mark contacted", "#0891b2")}
${btn(`${url}?action=note`, "Add note", "#6b7280")}`),
    text: `${title} ${p.reference} (${p.serviceName}). Open: ${url}`,
  };
}

export function escalationAlert(p: { leadId: string; reference: string; serviceName: string; ownerName: string | null; minutesLate: number }) {
  const url = `${env.appUrl}/leads/${p.leadId}`;
  return {
    subject: `[LeadFlow] OVERDUE: ${p.reference} not contacted (${p.minutesLate} min late)`,
    html: layout("en", `<h2 style="color:#b91c1c">Overdue lead</h2>
<p>Lead <b>${esc(p.reference)}</b> (${esc(p.serviceName)}) has not been contacted and is past its response target by <b>${p.minutesLate} minutes</b>.</p>
<p>Owner: ${esc(p.ownerName ?? "Unassigned")}</p>
<a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#b91c1c;color:#fff;text-decoration:none">Open lead</a>`),
    text: `Overdue lead ${p.reference}. Open: ${url}`,
  };
}

export function dailySummary(p: { orgName: string; date: string; summary: DashboardSummary; newToday: number }) {
  const s = p.summary;
  const row = (k: string, v: string | number) => `<tr><td style="padding:4px 12px 4px 0">${k}</td><td><b>${v}</b></td></tr>`;
  return {
    subject: `[LeadFlow] Daily summary ${p.date} - ${p.orgName}`,
    html: layout("en", `<h2>Daily summary - ${esc(p.date)}</h2><table>
${row("New leads (last 24h)", p.newToday)}
${row("Open leads", s.open)}
${row("Overdue", s.overdue)}
${row("Won", s.status.WON ?? 0)}
${row("Lost", s.status.LOST ?? 0)}
${row("Median first response", s.medianFirstResponseMinutes === null ? "n/a" : `${s.medianFirstResponseMinutes} min`)}
${row("Contacted within SLA", s.contactedWithinSlaPct === null ? "n/a" : `${s.contactedWithinSlaPct}%`)}
</table><p><a href="${env.appUrl}/dashboard">Open dashboard</a></p>`),
    text: `Daily summary ${p.date}: open ${s.open}, overdue ${s.overdue}, new ${p.newToday}.`,
  };
}

export function deadJobAlert(p: { jobType: string; jobId: string; error: string }) {
  return {
    subject: `[LeadFlow] Automation failed permanently: ${p.jobType}`,
    html: layout("en", `<h2 style="color:#b91c1c">Job moved to dead-letter</h2>
<p>Job <code>${esc(p.jobId)}</code> (${esc(p.jobType)}) failed after all retries.</p>
<p>Last error: <code>${esc(p.error.slice(0, 300))}</code></p>
<p><a href="${env.appUrl}/integrations">Review and retry in Integrations</a></p>`),
    text: `Job ${p.jobId} (${p.jobType}) is dead: ${p.error}`,
  };
}
