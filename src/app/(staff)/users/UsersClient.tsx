"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api-client";

const ROLES = ["ADMIN", "MANAGER", "AGENT", "VIEWER"];

export function InviteForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="card grid gap-3 p-5 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setBusy(true);
        setResult(null);
        try {
          const r = await api<{ email: string; tempPassword: string }>("/api/v1/users", {
            body: { name: fd.get("name"), email: fd.get("email"), role: fd.get("role") },
          });
          setResult({ ok: true, text: `Invited ${r.email}. Temporary password (shown once): ${r.tempPassword}` });
          form.reset();
          router.refresh();
        } catch (err) {
          setResult({ ok: false, text: err instanceof Error ? err.message : "Failed" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold sm:col-span-5">Invite staff member</h2>
      <input name="name" className="input" placeholder="Full name" required />
      <input name="email" type="email" className="input sm:col-span-2" placeholder="email@company.com" required />
      <select name="role" className="input" defaultValue="AGENT">
        {ROLES.map((r) => <option key={r}>{r}</option>)}
      </select>
      <button className="btn-primary" disabled={busy}>Invite</button>
      {result && <div className={`rounded p-2 text-sm sm:col-span-5 ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{result.text}</div>}
    </form>
  );
}

export function UserRow({ user, isSelf }: { user: { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null }; isSelf: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const update = async (body: object) => {
    setError(null);
    try {
      await api(`/api/v1/users/${user.id}`, { method: "PATCH", body });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <div className={`flex flex-wrap items-center gap-4 px-5 py-3 ${user.active ? "" : "opacity-50"}`}>
      <div className="min-w-48 flex-1">
        <div className="font-medium">{user.name} {isSelf && <span className="text-xs text-slate-400">(you)</span>}</div>
        <div className="text-xs text-slate-500">{user.email} &middot; last login {user.lastLoginAt ?? "never"}</div>
      </div>
      <select className="input w-36" value={user.role} disabled={isSelf} onChange={(e) => update({ role: e.target.value })}>
        {ROLES.map((r) => <option key={r}>{r}</option>)}
      </select>
      {!isSelf && (
        <button className="btn-secondary text-xs" onClick={() => update({ active: !user.active })}>{user.active ? "Deactivate" : "Reactivate"}</button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
