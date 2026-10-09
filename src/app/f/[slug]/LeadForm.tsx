"use client";

import { useMemo, useState } from "react";
import { arabicErrors, dict, type Lang } from "@/lib/i18n";

interface Props {
  lang: Lang;
  slug: string;
  orgName: string;
  orgKey: string;
  services: { code: string; name: string }[];
  responseTime: string;
  privacyUrl: string;
  policyVersion: string;
  utm: Record<string, string>;
  turnstileSiteKey: string | null;
}

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; reference: string }
  | { kind: "error"; message: string };

const newKey = () => `web-${crypto.randomUUID()}`;

/**
 * Implements the 5 user-facing states from the spec:
 * submitting, success, validation error, temporary failure, duplicate (= normal success).
 */
export function LeadForm(p: Props) {
  const t = dict[p.lang];
  const [state, setState] = useState<State>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  // One idempotency key per filled-in form: retries after a network failure reuse it,
  // so a request that actually reached the server is never stored twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const otherLang = useMemo(() => (p.lang === "ar" ? "en" : "ar"), [p.lang]);

  const tr = (msg: string) => (p.lang === "ar" ? (arabicErrors[msg] ?? msg) : msg);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrors({});
    setState({ kind: "submitting" });

    const body = {
      fullName: String(fd.get("fullName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? "") || null,
      serviceCode: String(fd.get("serviceCode") ?? ""),
      preferredAt: fd.get("preferredAt") ? new Date(String(fd.get("preferredAt"))).toISOString() : null,
      message: message || null,
      language: p.lang,
      consent: { accepted: fd.get("consent") === "on", policyVersion: p.policyVersion },
      idempotencyKey,
      utm: p.utm,
      website: String(fd.get("website") ?? ""), // honeypot
      captchaToken: String(fd.get("cf-turnstile-response") ?? "") || undefined,
    };

    try {
      const res = await fetch("/api/v1/public/leads", {
        method: "POST",
        headers: { "content-type": "application/json", "x-leadflow-key": p.orgKey },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState({ kind: "success", reference: data.reference });
        return;
      }
      if (res.status === 422 && data.fields) {
        setErrors(Object.fromEntries(Object.entries(data.fields as Record<string, string>).map(([k, v]) => [k.split(".")[0]!, tr(v)])));
        setState({ kind: "idle" });
        return;
      }
      setState({ kind: "error", message: res.status === 429 ? t.rateLimited : t.failBody });
    } catch {
      setState({ kind: "error", message: t.failBody });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="card p-8 text-center" role="status">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
        <h1 className="text-xl font-bold">{t.successTitle}</h1>
        <p className="mt-4 text-slate-600">{t.successRef}</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider" dir="ltr">{state.reference}</p>
        <p className="mt-4 text-slate-600">{t.successTime} {p.responseTime}.</p>
        <p className="mt-2 text-xs text-slate-500">{t.successNote}</p>
        <button
          className="btn-secondary mt-6"
          onClick={() => {
            setIdempotencyKey(newKey());
            setMessage("");
            setState({ kind: "idle" });
          }}
        >
          {t.another}
        </button>
      </div>
    );
  }

  const busy = state.kind === "submitting";
  const err = (k: string) => errors[k] && <p className="field-error">{errors[k]}</p>;

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6 sm:p-8" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-brand-600">{p.orgName}</div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <a href={`/f/${p.slug}?lang=${otherLang}`} className="shrink-0 text-sm text-brand-600 hover:underline">
          {t.switchLang}
        </a>
      </div>

      {state.kind === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <b>{t.failTitle}</b> {state.message}
        </div>
      )}

      <div>
        <label className="label" htmlFor="fullName">{t.fullName} *</label>
        <input id="fullName" name="fullName" className="input" required minLength={2} maxLength={80} autoComplete="name" disabled={busy} aria-invalid={!!errors.fullName} />
        {err("fullName")}
      </div>

      <div>
        <label className="label" htmlFor="phone">{t.phone} *</label>
        <input id="phone" name="phone" type="tel" dir="ltr" className="input" required placeholder={t.phoneHint} autoComplete="tel" inputMode="tel" disabled={busy} aria-invalid={!!errors.phone} />
        {err("phone")}
      </div>

      <div>
        <label className="label" htmlFor="email">{t.email}</label>
        <input id="email" name="email" type="email" dir="ltr" className="input" autoComplete="email" disabled={busy} aria-invalid={!!errors.email} />
        {err("email")}
      </div>

      <div>
        <label className="label" htmlFor="serviceCode">{t.service} *</label>
        <select id="serviceCode" name="serviceCode" className="input" required defaultValue="" disabled={busy} aria-invalid={!!errors.serviceCode}>
          <option value="" disabled>{t.chooseService}</option>
          {p.services.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        {err("serviceCode")}
      </div>

      <div>
        <label className="label" htmlFor="preferredAt">{t.preferredAt}</label>
        <input id="preferredAt" name="preferredAt" type="datetime-local" className="input" disabled={busy} />
        <p className="mt-1 text-xs text-slate-500">{t.preferredHint}</p>
        {err("preferredAt")}
      </div>

      <div>
        <label className="label" htmlFor="message">{t.message}</label>
        <textarea id="message" name="message" rows={3} maxLength={500} className="input" value={message} onChange={(e) => setMessage(e.target.value)} disabled={busy} />
        <p className="mt-1 text-xs text-slate-400">{500 - message.length} {t.chars}</p>
        {err("message")}
      </div>

      {/* Honeypot: hidden from humans, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4" required disabled={busy} />
          <span>
            {t.consent}{" "}
            <a href={p.privacyUrl} target="_blank" className="text-brand-600 underline">{t.privacy}</a>.
          </span>
        </label>
        {err("consent")}
      </div>

      {p.turnstileSiteKey && (
        <>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={p.turnstileSiteKey} />
          {err("captcha")}
        </>
      )}

      <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        {busy ? t.submitting : state.kind === "error" ? t.retry : t.submit}
      </button>
    </form>
  );
}
