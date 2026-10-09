"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api-client";

interface Props {
  leadId: string;
  version: number;
  status: string;
  nextStatuses: string[];
  ownerId: string | null;
  users: { id: string; name: string }[];
  canAssign: boolean;
  canAnonymize: boolean;
  highlight: "contacted" | "note" | null;
}

export function LeadActions(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activityType, setActivityType] = useState(p.highlight === "note" ? "NOTE" : "CALL");
  const [text, setText] = useState("");

  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      router.refresh();
    } catch (err) {
      const text =
        err instanceof ApiClientError && err.status === 409
          ? "Someone else changed this lead. The page was reloaded - please try again."
          : err instanceof Error ? err.message : "Failed";
      setMsg({ ok: false, text });
      if (err instanceof ApiClientError && err.status === 409) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: object, ok: string) =>
    run(() => api(`/api/v1/leads/${p.leadId}`, { method: "PATCH", body: { version: p.version, ...body } }), ok);

  return (
    <div className="space-y-4">
      {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      {p.nextStatuses.includes("CONTACTED") && (
        <button
          className={`btn-primary w-full py-3 ${p.highlight === "contacted" ? "ring-4 ring-brand-100" : ""}`}
          disabled={busy}
          onClick={() => patch({ status: "CONTACTED" }, "Marked as contacted")}
        >
          ✓ Mark contacted
        </button>
      )}

      <div className="card space-y-3 p-4">
        <h3 className="font-semibold">Status</h3>
        <div className="flex flex-wrap gap-2">
          {p.nextStatuses.map((s) => (
            <button key={s} className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} onClick={() => patch({ status: s }, `Status changed to ${s}`)}>
              → {s}
            </button>
          ))}
        </div>
      </div>

      {p.canAssign && (
        <div className="card space-y-3 p-4">
          <h3 className="font-semibold">Owner</h3>
          <select
            className="input"
            value={p.ownerId ?? ""}
            disabled={busy}
            onChange={(e) => patch({ ownerId: e.target.value || null }, "Owner updated")}
          >
            <option value="">Unassigned</option>
            {p.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      <form
        className={`card space-y-3 p-4 ${p.highlight === "note" ? "ring-4 ring-brand-100" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api(`/api/v1/leads/${p.leadId}/activities`, { body: { type: activityType, text } });
            setText("");
          }, "Activity recorded");
        }}
      >
        <h3 className="font-semibold">Log activity</h3>
        <select className="input" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
          <option value="CALL">Call</option>
          <option value="MESSAGE">WhatsApp / SMS message</option>
          <option value="NOTE">Internal note</option>
        </select>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened?" required maxLength={2000} />
        <button className="btn-secondary w-full" disabled={busy || !text.trim()}>Save</button>
      </form>

      {p.canAnonymize && (
        <div className="card space-y-2 p-4">
          <h3 className="font-semibold text-red-700">Privacy</h3>
          <p className="text-xs text-slate-500">Removes name, phone, email and messages. The audit trail is kept.</p>
          <button
            className="btn-danger w-full"
            disabled={busy}
            onClick={() => {
              const reason = window.prompt("Reason for anonymization (e.g. customer deletion request):");
              if (reason && reason.trim().length >= 3) run(() => api(`/api/v1/leads/${p.leadId}/anonymize`, { body: { reason } }), "Lead anonymized");
            }}
          >
            Anonymize lead
          </button>
        </div>
      )}
    </div>
  );
}
