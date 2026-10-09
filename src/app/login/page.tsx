"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Sign in failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4 p-8">
      <div>
        <div className="text-sm font-semibold text-brand-600">LEADFLOW</div>
        <h1 className="text-xl font-bold">Staff sign in</h1>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" required autoComplete="current-password" />
      </div>
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      <p className="text-xs text-slate-500">Demo accounts are listed in the README after running the seed.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
