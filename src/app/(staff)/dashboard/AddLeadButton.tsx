"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api-client";

/** "+ Add lead" for phone calls and walk-ins. Goes through the same intake pipeline. */
export function AddLeadButton({ services }: { services: { code: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const res = await api<{ leadId: string }>("/api/v1/leads", {
        body: {
          fullName: fd.get("fullName"),
          phone: fd.get("phone"),
          email: fd.get("email") || null,
          serviceCode: fd.get("serviceCode"),
          message: fd.get("message") || null,
          language: fd.get("language"),
          idempotencyKey: `manual-${crypto.randomUUID()}`,
        },
      });
      setOpen(false);
      router.push(`/leads/${res.leadId}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      else setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" className="btn-primary" onClick={() => setOpen(true)}>+ Add lead</button>;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card w-full max-w-md space-y-3 p-6">
        <h2 className="text-lg font-bold">Add lead</h2>
        {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
        <Field name="fullName" label="Full name *" error={errors.fullName} />
        <Field name="phone" label="Mobile number *" error={errors.phone} />
        <Field name="email" label="Email" error={errors.email} />
        <div>
          <label className="label">Service *</label>
          <select name="serviceCode" className="input" required defaultValue="">
            <option value="" disabled>Choose</option>
            {services.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          {errors.serviceCode && <p className="field-error">{errors.serviceCode}</p>}
        </div>
        <div>
          <label className="label">Language</label>
          <select name="language" className="input" defaultValue="en">
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div>
          <label className="label">Message</label>
          <textarea name="message" className="input" rows={3} maxLength={500} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Save lead"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ name, label, error }: { name: string; label: string; error?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} className="input" />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
