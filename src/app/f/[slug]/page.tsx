import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseSettings } from "@/domain/settings";
import { dict, type Lang } from "@/lib/i18n";
import { LeadForm } from "./LeadForm";

export const dynamic = "force-dynamic";

/**
 * Public, mobile-first form. Server component: loads the organization and its
 * services, then hands only PUBLIC data (name, public key, service list) to the
 * client form. No internal links or IDs are exposed.
 */
export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { services: { where: { active: true, deletedAt: null }, orderBy: { nameEn: "asc" } } },
  });
  if (!org) notFound();

  const lang: Lang = sp.lang === "ar" ? "ar" : sp.lang === "en" ? "en" : (org.defaultLanguage as Lang) ?? "en";
  const settings = parseSettings(org.settings);
  const utm = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => k.startsWith("utm_") && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 120)]),
  );

  return (
    <main dir={dict[lang].dir} lang={lang} className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <LeadForm
          lang={lang}
          slug={slug}
          orgName={org.name}
          orgKey={org.publicKey}
          services={org.services.map((s) => ({ code: s.code, name: lang === "ar" ? s.nameAr : s.nameEn }))}
          responseTime={settings.responseTimeText[lang]}
          privacyUrl={settings.privacyPolicyUrl}
          policyVersion={settings.policyVersion}
          utm={utm}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
        />
      </div>
    </main>
  );
}
