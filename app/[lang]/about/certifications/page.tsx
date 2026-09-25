import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildCertificationCards } from "@/features/about/certifications";
import { CertificationGallery } from "@/features/about/ui/certification-gallery";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/about/certifications">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    // ชื่อหน้ามีคำว่า "ใบรับรองมาตรฐาน" อยู่แล้ว จึงใช้ absolute ไม่ให้ต่อท้ายด้วยชื่อเว็บซ้ำ
    title: { absolute: messages.about.certifications.meta.title },
    description: messages.about.certifications.meta.description,
    alternates: buildAlternates(lang, "/about/certifications"),
    openGraph: {
      title: messages.about.certifications.meta.title,
      description: messages.about.certifications.meta.description,
    },
  };
}

export default async function CertificationsPage({
  params,
}: PageProps<"/[lang]/about/certifications">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  const m = messages.about.certifications;
  const cards = buildCertificationCards(messages, lang);

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.about, href: localePath(lang, "/about") },
              { label: m.breadcrumb },
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {m.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {m.title}
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
            {m.intro}
          </p>
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <CertificationGallery
          cards={cards}
          labels={{
            open: m.openLabel,
            close: m.closeLabel,
            dialog: m.dialogLabel,
            issuer: m.labels.issuer,
            certificateNo: m.labels.certificateNo,
            site: m.labels.site,
            validPeriod: m.labels.validPeriod,
          }}
        />

        <p className="mt-10 max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-fg-muted">
          {m.note}
        </p>
      </section>
    </>
  );
}
