import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";

import { CATALOG_ITEMS, catalogHref } from "@/features/products/catalog";
import { ProductCategoryCard } from "@/features/products/ui/category-card";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageSeo } from "@/lib/pages/repository";
import { categoryLogoOf, categoryNameOf } from "@/lib/products/display";
import { listProductCategoryCards } from "@/lib/products/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     (ถ้าเขียน = PAGE_REVALIDATE_SECONDS จะพังด้วย "Invalid segment configuration export detected")
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/products">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  /* ค่า SEO จากหลังบ้าน (W2) — ไม่ตั้งค่า = ใช้ค่าเดิมจากพจนานุกรมเป๊ะ */
  return withPageSeo(lang, "/products", {
    // ชื่อหน้ามีคำว่า "ผลิตภัณฑ์" อยู่แล้ว จึงใช้ absolute ไม่ให้ต่อท้ายด้วยชื่อเว็บซ้ำ
    title: { absolute: messages.productsPage.meta.title },
    description: messages.productsPage.meta.description,
    alternates: buildAlternates(lang, "/products"),
    openGraph: {
      title: messages.productsPage.meta.title,
      description: messages.productsPage.meta.description,
    },
  }, () => loadPageSeo("products"));
}

export default async function ProductsPage({ params }: PageProps<"/[lang]/products">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  /*
    ── เนื้อหาของหน้านี้มาจากไหน (S2 · รอบที่ 83) ────────────────────────────────
    1. ถ้าหลังบ้าน **กดเผยแพร่ (มติ 2026-10-09: หน้าแรกขึ้นเว็บทันที · หน้าอื่นยังไม่ขึ้นเว็บ)** ⇒ เรนเดอร์เอกสารบล็อกที่เผยแพร่
       (ตัวเรนเดอร์เดียวกับพรีวิว ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" 1:1)
    2. ถ้าไม่ ⇒ ใช้เลย์เอาต์ที่ออกแบบไว้ด้านล่างเหมือนเดิม **ไม่มีการเปลี่ยนแปลงโดยไม่ตั้งใจ**
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลดคืน null ให้เอง
    ⚠️ เทมเพลตยังไม่ครอบคลุมทุกส่วน (ดู `blockCoverageGaps`) — หลังบ้านจะเตือนก่อนเปิดสวิตช์
  */
  const liveDocument = await loadLiveBlockDocument("products");
  if (liveDocument !== null) {
    return <BlockDocumentView document={liveDocument} language={lang} />;
  }

  const m = messages.productsPage;

  /*
    ── ชื่อ + โลโก้หมวดมาจากไหน (รอบที่ 254 · มติ D24) ─────────────────────────────
    หลังบ้านแก้ชื่อหมวด/โลโก้การ์ดได้ ⇒ เอาค่าจากฐานข้อมูลมาก่อน แล้ว **ถอยไปใช้ค่าในโค้ด/พจนานุกรม**
    เมื่อยังไม่แก้ (หรือไม่มีฐานข้อมูล — `listProductCategoryCards()` คืน [] ⇒ หน้าตาเหมือนเดิมเป๊ะ)
  */
  const categoryCards = await listProductCategoryCards();
  const cardBySlug = new Map(categoryCards.map((card) => [card.id, card]));

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.products },
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

          {/* ข้อความบอกสถานะ "ตัวอย่างรออนุมัติ" — ใช้คอมโพเนนต์กลางให้เหมือนหน้า recipes/news */}
          <SampleNotice text={m.notice} />
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        {/* `category-card-grid` = คลาสเดียวกับพรีวิวหลังบ้านใช้บังคับ 1 คอลัมน์ (ดู app/globals.css) */}
        <ul className="category-card-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_ITEMS.map((item) => {
            const copy = m.items[item.id];
            const card = cardBySlug.get(item.slug) ?? null;

            return (
              <li key={item.id}>
                <ProductCategoryCard
                  name={categoryNameOf(card?.nameTh ?? "", card?.nameEn ?? "", copy.name, lang)}
                  imageSrc={categoryLogoOf(card?.logoPath ?? null, item.image.src)}
                  imageWidth={card?.logoWidth ?? item.image.width}
                  imageHeight={card?.logoHeight ?? item.image.height}
                  imageAlt={copy.imageAlt}
                  href={catalogHref(lang, item.slug)}
                />
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
