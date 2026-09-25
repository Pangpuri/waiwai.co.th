import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { MockCardGrid } from "@/features/shell/ui/mock-card-grid";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้า /recipes (เมนูอาหาร) — **หน้าตัวอย่าง (mockup) รอการอนุมัติ**
 *
 * ผู้ใช้สั่งรอบที่ 15: ทำการ์ดตัวอย่าง 3 ใบ × 2 แถว ไว้ดูโครง layout เท่านั้น
 * → ไม่มีข้อมูลเมนูจริง ไม่มีคำบรรยายที่แต่งขึ้น และการ์ดไม่เป็นลิงก์ (ยังไม่มีปลายทาง)
 * รายละเอียดเพิ่มเติม: PRODUCT_ROADMAP.md § 9
 */

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/recipes">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    title: { absolute: messages.recipesPage.meta.title },
    description: messages.recipesPage.meta.description,
    alternates: buildAlternates(lang, "/recipes"),
    // หน้าตัวอย่าง ไม่ควรถูกจัดทำดัชนี
    robots: { index: false, follow: false },
    openGraph: {
      title: messages.recipesPage.meta.title,
      description: messages.recipesPage.meta.description,
    },
  };
}

export default async function RecipesPage({ params }: PageProps<"/[lang]/recipes">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  const m = messages.recipesPage;

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.recipes },
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

          <SampleNotice text={m.notice} />
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <MockCardGrid
          idPrefix="mock-recipe"
          titlePrefix={m.cardTitle}
          captionPrefix={m.figureCaption}
          badge={m.figureBadge}
          metaLabel={m.cardMeta}
          icon="recipe"
        />
      </section>
    </>
  );
}
