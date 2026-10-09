"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api-client";

interface Props {
  id: string;
  provider: string;
  description: string;
  enabled: boolean;
  url: string;
  hasSecret: boolean;
  needsUrl: boolean;
  lastSuccess: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export function IntegrationCard(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  async function save(body: object) {
    setBusy(true);
    try {
      await api(`/api/v1/integrations/${p.id}`, { method: "PUT", body });
      setResult({ ok: true, detail: "Saved" });
      router.refresh();
    } catch (e) {
      setResult({ ok: false, detail: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await api<{ ok: boolean; detail: string }>(`/api/v1/integrations/${p.id}/test`, { method: "POST" }));
      router.refresh();
    } catch (e) {
      setResult({ ok: false, detail: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  const healthy = p.enabled && p.lastSuccess && (!p.lastErrorAt || p.lastError === null);
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${!p.enabled ? "bg-slate-300" : healthy ? "bg-emerald-500" : p.lastError ? "bg-red-500" : "bg-amber-400"}`} />
        <h2 className="font-semibold">{p.provider.replace("_", " ")}</h2>
        <label className="ms-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.enabled} disabled={busy} onChange={(e) => save({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
      <p className="text-sm text-slate-500">{p.description}</p>
      <div className="text-xs text-slate-500">
        Last success: <b>{p.lastSuccess ?? "never"}</b>
        {p.lastError && <> &middot; Last error ({p.lastErrorAt}): <span className="text-red-600">{p.lastError}</span></>}
      </div>

      {p.needsUrl && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save({ url: fd.get("url"), secret: fd.get("secret") || undefined });
          }}
        >
          <input name="url" className="input" defaultValue={p.url} placeholder="https://your-n8n/webhook/..." />
          <input name="secret" type="password" className="input" placeholder={p.hasSecret ? "Signing secret is set (leave empty to keep)" : "Signing secret"} autoComplete="off" />
          <button className="btn-secondary w-full" disabled={busy}>Save connection</button>
        </form>
      )}

      <button className="btn-secondary w-full" disabled={busy} onClick={test}>{busy ? "Working..." : "Test connection"}</button>
      {result && <div className={`rounded p-2 text-xs ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{result.detail}</div>}
    </div>
  );
}

export function RetryButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary px-2 py-1 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api(`/api/v1/jobs/${jobId}/retry`, { method: "POST" }).catch(() => undefined);
        router.refresh();
      }}
    >
      Retry
    </button>
  );
}
