import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { MANAGEMENT_TEAM_IMAGE } from "@/features/about/executives";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/about/executives">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    // ชื่อหน้ามีคำว่า "คณะผู้บริหาร" อยู่แล้ว จึงใช้ absolute ไม่ให้ต่อท้ายด้วยชื่อเว็บซ้ำ
    title: { absolute: messages.about.executives.meta.title },
    description: messages.about.executives.meta.description,
    alternates: buildAlternates(lang, "/about/executives"),
    openGraph: {
      title: messages.about.executives.meta.title,
      description: messages.about.executives.meta.description,
      images: [
        {
          url: MANAGEMENT_TEAM_IMAGE.src,
          width: MANAGEMENT_TEAM_IMAGE.width,
          height: MANAGEMENT_TEAM_IMAGE.height,
        },
      ],
    },
  };
}

export default async function ExecutivesPage({ params }: PageProps<"/[lang]/about/executives">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  const m = messages.about.executives;

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
        {/*
          ภาพผังคณะผู้บริหาร — ให้ใหญ่เต็มความกว้างของคอนเทนเนอร์ แต่ `h-auto w-full`
          ทำให้ย่อพอดีจอเสมอ ไม่ล้นแนวนอนแม้จอเล็ก (คอนเทนเนอร์ถูกจำกัดที่ max-w-80rem)

          ใช้ `loading="eager"` + `fetchPriority="high"` แทน `priority`
          เพราะ `priority` ถูก deprecate ตั้งแต่ Next 16 (ดู docs ที่แถมมากับเวอร์ชันที่ติดตั้ง)

          `sizes` ระบุ 1200px (ไม่ใช่ 1216px = ความกว้างจริงของคอนเทนเนอร์) เพราะ 1200 อยู่ใน
          `deviceSizes` ของ Next → เบราว์เซอร์เลือกภาพขนาดที่ตรงพอดี ไม่ต้องโหลดรุ่น 1920 เกินจำเป็น
        */}
        <figure className="mx-auto">
          <Image
            src={MANAGEMENT_TEAM_IMAGE.src}
            alt={m.figure.alt}
            width={MANAGEMENT_TEAM_IMAGE.width}
            height={MANAGEMENT_TEAM_IMAGE.height}
            sizes="(min-width: 1280px) 1200px, 100vw"
            loading="eager"
            fetchPriority="high"
            className="h-auto w-full rounded-2xl border border-line bg-surface"
          />

          <figcaption className="mt-4 text-center text-xs leading-relaxed text-fg-muted">
            {m.figure.caption}
          </figcaption>
        </figure>

        <p className="mx-auto mt-8 max-w-3xl rounded-2xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-fg-muted">
          {m.note}
        </p>
      </section>
    </>
  );
}
