import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const orgs = await prisma.organization.findMany({ select: { slug: true, name: true }, take: 5 }).catch(() => []);
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-2 text-sm font-semibold tracking-wide text-brand-600">LEADFLOW</div>
      <h1 className="text-4xl font-bold">Automated lead capture &amp; follow-up</h1>
      <p className="mt-4 text-lg text-slate-600">
        Every enquiry is captured, acknowledged and assigned for follow-up within seconds, with a visible status and an
        audit trail.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">Public form (customers)</h2>
          {orgs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No organization yet - run <code>npm run db:seed</code>.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {orgs.map((o) => (
                <li key={o.slug} className="flex gap-3">
                  <Link className="text-brand-600 hover:underline" href={`/f/${o.slug}`}>{o.name} (English)</Link>
                  <Link className="text-brand-600 hover:underline" href={`/f/${o.slug}?lang=ar`}>العربية</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">Operations dashboard (staff)</h2>
          <p className="mt-2 text-sm text-slate-500">Leads, assignment, statuses, SLA and integrations.</p>
          <Link href="/login" className="btn-primary mt-4">Staff sign in</Link>
        </div>
      </div>
    </main>
  );
}
