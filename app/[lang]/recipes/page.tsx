import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { RecipeVideoList, recipeVideoListStringsOf } from "@/features/recipes/ui/recipe-video-list";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";

import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { MockCardGrid } from "@/features/shell/ui/mock-card-grid";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageSeo } from "@/lib/pages/repository";
import { listRecipes } from "@/lib/recipes/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

/**
 * หน้า /recipes (เมนูอาหาร) — **มีเนื้อหาจริงแล้ว (รอบที่ 104) ⇒ เปิดให้จัดทำดัชนี (รอบที่ 170)**
 *
 * ประวัติ
 * - รอบที่ 15: ทำการ์ดตัวอย่าง 3 ใบ × 2 แถว ไว้ดูโครง layout เท่านั้น (ไม่มีข้อมูลจริง ไม่มีคำบรรยายที่แต่งขึ้น)
 * - รอบที่ 104: **มีเมนูวิดีโอจริง 18 เมนูในฐานข้อมูล** (นำเข้าจากเว็บเดิมของแบรนด์) ⇒ แสดงของจริงแทนการ์ดทดสอบ
 * - รอบที่ 170 (มติเจ้าของ 2026-10-07): **เอา `noindex` ออก** — หน้านี้มีเนื้อหาจริงครบแล้ว
 *   · หลังบ้านยังสั่ง `noindex` กลับได้รายหน้าผ่านช่อง SEO (W2) — `withPageSeo` จะตั้ง `robots` ให้เอง
 */

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/recipes">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  /* ค่า SEO จากหลังบ้าน (W2) — ไม่ตั้งค่า = ใช้ค่าเดิมจากพจนานุกรมเป๊ะ */
  return withPageSeo(lang, "/recipes", {
    title: { absolute: messages.recipesPage.meta.title },
    description: messages.recipesPage.meta.description,
    alternates: buildAlternates(lang, "/recipes"),
    /* รอบที่ 170: เปิด index (เนื้อหาจริงแล้ว) · ถ้าหลังบ้านตั้ง noindex ⇒ `applySeoToMetadata` ใส่กลับให้ */
    openGraph: {
      title: messages.recipesPage.meta.title,
      description: messages.recipesPage.meta.description,
    },
  }, () => loadPageSeo("recipes"));
}

export default async function RecipesPage({ params }: PageProps<"/[lang]/recipes">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  /*
    ── เนื้อหาของหน้านี้มาจากไหน (S2 · รอบที่ 83 · ส่วนเมนูวิดีโอ เพิ่มรอบที่ 104) ──────────
    1. ถ้าหลังบ้าน **กดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง"** ⇒ เรนเดอร์เอกสารบล็อกที่เผยแพร่
       (ตัวเรนเดอร์เดียวกับพรีวิว ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" 1:1)
    2. ถ้าไม่ ⇒ ใช้เลย์เอาต์ที่ออกแบบไว้ด้านล่างเหมือนเดิม **ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ**
    **ทั้งสองทางต่อด้วย "เมนูวิดีโอ" จากฐานข้อมูล** (18 เมนูที่นำเข้าจากเว็บเดิม · รอบที่ 104)
      · เลย์เอาต์เดิม: ถ้ามีเมนูจริง ⇒ แสดงเมนูจริงแทนการ์ดทดสอบ (ไม่โชว์ของปลอมคู่ของจริง)
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลด/ตัวอ่านคืน null/[] ให้เอง
    ⚠️ เทมเพลตยังไม่ครอบคลุมทุกส่วน (ดู `blockCoverageGaps`) — หลังบ้านจะเตือนก่อนเปิดสวิตช์
  */
  const [liveDocument, recipes] = await Promise.all([loadLiveBlockDocument("recipes"), listRecipes()]);
  const m = messages.recipesPage;
  const listStrings = recipeVideoListStringsOf(m);

  if (liveDocument !== null) {
    return (
      <>
        <BlockDocumentView document={liveDocument} language={lang} />
        <RecipeVideoList recipes={recipes} language={lang} strings={listStrings} />
      </>
    );
  }

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

      {/*
        มีเมนูจริงในฐานข้อมูลแล้ว (รอบที่ 104) ⇒ แสดงของจริงแทนการ์ดทดสอบ
        ⚠️ ถ้าฐานข้อมูลว่าง/ล่ม ⇒ ยังเห็นการ์ดทดสอบเหมือนเดิม (ไม่ทำให้หน้าเว็บพัง)
      */}
      {recipes.length > 0 ? (
        <RecipeVideoList recipes={recipes} language={lang} strings={listStrings} />
      ) : (
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
      )}
    </>
  );
}
