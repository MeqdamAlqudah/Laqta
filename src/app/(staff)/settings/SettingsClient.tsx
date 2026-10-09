"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api-client";
import type { OrgSettings } from "@/domain/settings";
import type { RoutingRule } from "@/services/assignment";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, ok = "Saved") {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }
  const banner = msg && <div className={`rounded p-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>;
  return { run, busy, banner };
}

export function SettingsForm(p: { name: string; timezone: string; settings: OrgSettings; formUrl: string; publicKey: string }) {
  const { run, busy, banner } = useAction();
  const [days, setDays] = useState<number[]>(p.settings.workingHours.days);

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() =>
          api("/api/v1/settings", {
            method: "PUT",
            body: {
              name: fd.get("name"),
              timezone: fd.get("timezone"),
              settings: {
                slaMinutes: Number(fd.get("slaMinutes")),
                dedupeWindowHours: Number(fd.get("dedupeWindowHours")),
                retentionDays: Number(fd.get("retentionDays")),
                workingHours: { days, start: fd.get("start"), end: fd.get("end") },
                notifyEmails: String(fd.get("notifyEmails") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
                responseTimeText: { en: fd.get("rtEn"), ar: fd.get("rtAr") },
              },
            },
          }),
        );
      }}
    >
      <h2 className="text-lg font-semibold">Organization, working hours &amp; SLA</h2>
      {banner}
      <div className="grid gap-4 sm:grid-cols-2">
        <L label="Business name"><input name="name" className="input" defaultValue={p.name} /></L>
        <L label="Timezone (IANA)"><input name="timezone" className="input" defaultValue={p.timezone} /></L>
        <L label="First-response SLA (working minutes)"><input name="slaMinutes" type="number" min={1} className="input" defaultValue={p.settings.slaMinutes} /></L>
        <L label="Duplicate window (hours, 0 = off)"><input name="dedupeWindowHours" type="number" min={0} className="input" defaultValue={p.settings.dedupeWindowHours} /></L>
        <L label="Working hours start"><input name="start" type="time" className="input" defaultValue={p.settings.workingHours.start} /></L>
        <L label="Working hours end"><input name="end" type="time" className="input" defaultValue={p.settings.workingHours.end} /></L>
        <L label="Data retention (days)"><input name="retentionDays" type="number" min={30} className="input" defaultValue={p.settings.retentionDays} /></L>
        <L label="Extra alert emails (comma separated)"><input name="notifyEmails" className="input" defaultValue={p.settings.notifyEmails.join(", ")} /></L>
        <L label="Response time text (English)"><input name="rtEn" className="input" defaultValue={p.settings.responseTimeText.en} /></L>
        <L label="Response time text (Arabic)"><input name="rtAr" dir="rtl" className="input" defaultValue={p.settings.responseTimeText.ar} /></L>
      </div>
      <div>
        <span className="label">Working days</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className={`cursor-pointer rounded-lg border px-3 py-1 text-sm ${days.includes(i) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300"}`}>
              <input type="checkbox" className="hidden" checked={days.includes(i)} onChange={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())} />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        Public form: <a className="text-brand-600 underline" href={p.formUrl} target="_blank">{p.formUrl}</a> &middot; Form key (public, not a secret): <code>{p.publicKey}</code>
      </div>
      <button className="btn-primary" disabled={busy}>Save settings</button>
    </form>
  );
}

interface Svc { id: string; code: string; nameEn: string; nameAr: string; active: boolean; routingRule: RoutingRule }

export function ServicesEditor({ services, users }: { services: Svc[]; users: { id: string; name: string }[] }) {
  const { run, busy, banner } = useAction();
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-lg font-semibold">Services &amp; assignment rules</h2>
      <p className="text-sm text-slate-500">
        Each service decides who receives its leads: <b>round robin</b> (take turns), <b>least loaded</b> (fewest open leads), or <b>fixed</b> (first selected person).
      </p>
      {banner}
      <div className="space-y-3">
        {services.map((s) => <ServiceRow key={s.id} s={s} users={users} run={run} busy={busy} />)}
      </div>
      <form
        className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const form = e.currentTarget;
          run(async () => {
            await api("/api/v1/services", { body: { code: fd.get("code"), nameEn: fd.get("nameEn"), nameAr: fd.get("nameAr") } });
            form.reset();
          }, "Service added");
        }}
      >
        <input name="code" className="input" placeholder="code (e.g. cleaning)" required />
        <input name="nameEn" className="input" placeholder="English name" required />
        <input name="nameAr" className="input" dir="rtl" placeholder="الاسم بالعربية" required />
        <button className="btn-secondary" disabled={busy}>+ Add service</button>
      </form>
    </section>
  );
}

function ServiceRow({ s, users, run, busy }: { s: Svc; users: { id: string; name: string }[]; run: (fn: () => Promise<unknown>, ok?: string) => void; busy: boolean }) {
  const [strategy, setStrategy] = useState(s.routingRule.strategy);
  const [userIds, setUserIds] = useState<string[]>(s.routingRule.userIds);
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <b>{s.nameEn}</b>
        <span className="text-slate-500" dir="rtl">{s.nameAr}</span>
        <code className="text-xs text-slate-400">{s.code}</code>
        {!s.active && <span className="rounded bg-slate-100 px-2 text-xs">inactive</span>}
        <div className="ms-auto flex gap-2">
          <button className="btn-secondary px-2 py-1 text-xs" disabled={busy} onClick={() => run(() => api(`/api/v1/services/${s.id}`, { method: "PATCH", body: { active: !s.active } }))}>
            {s.active ? "Deactivate" : "Activate"}
          </button>
          <button className="btn-secondary px-2 py-1 text-xs text-red-600" disabled={busy} onClick={() => confirm(`Remove ${s.nameEn}?`) && run(() => api(`/api/v1/services/${s.id}`, { method: "DELETE" }), "Removed")}>
            Remove
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <select className="input w-44" value={strategy} onChange={(e) => setStrategy(e.target.value as RoutingRule["strategy"])}>
          <option value="none">Manual (no auto-assign)</option>
          <option value="round_robin">Round robin</option>
          <option value="least_loaded">Least loaded</option>
          <option value="fixed">Fixed owner</option>
        </select>
        {users.map((u) => (
          <label key={u.id} className="flex items-center gap-1">
            <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => setUserIds(userIds.includes(u.id) ? userIds.filter((x) => x !== u.id) : [...userIds, u.id])} />
            {u.name}
          </label>
        ))}
        <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => run(() => api(`/api/v1/services/${s.id}`, { method: "PATCH", body: { routingRule: { strategy, userIds } } }), "Routing saved")}>
          Save rule
        </button>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
