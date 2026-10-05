import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { catalogSlugs, findCatalogItem } from "@/features/products/catalog";
import { ProductListSection, productListStringsOf } from "@/features/products/ui/product-list";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { productDetailPageId } from "@/lib/blocks/product-detail";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Messages } from "@/lib/i18n/messages/th";
import { loadPageSeo } from "@/lib/pages/repository";
import { listProductsByCategory, loadProductCategory, type ProductCategoryRecord } from "@/lib/products/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/**
 * หน้ารายละเอียดหมวดผลิตภัณฑ์
 *
 * เนื้อหามาจาก 2 ทาง (เหมือนหน้าอื่นที่แปลงเป็นบล็อกแล้ว — S2):
 * 1. หลังบ้าน **เผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง"** ⇒ เรนเดอร์เอกสารบล็อกของหมวดนั้น
 *    (id ของหน้า = `product-<slug>` · ตัวเรนเดอร์เดียวกับพรีวิว ⇒ "สิ่งที่เห็น = สิ่งที่ขึ้นเว็บ")
 * 2. ยังไม่เปิด ⇒ เลย์เอาต์ "ตัวอย่างรอการอนุมัติ" ด้านล่าง (เดิม) — ไม่มี DB ก็ยังเปิดหน้าได้
 *
 * ⚠️ **ยังคง `noindex` เสมอ** (มติเจ้าของ 2026-10-05): หน้าเดิมบอก "ยังไม่เปิดใช้งาน" อยู่
 *    ⇒ กันเครื่องค้นหาเก็บข้อความนั้นก่อน · ค่า SEO รายหน้า (title/description/OG) ใช้ได้ แต่ช่อง `noindex`
 *    ในหลังบ้านจะไม่มีผลจนกว่าจะมีมติเปิด index (ดู PRODUCT_ROADMAP.md § 10 รอบที่ 102)
 */

/** รู้จักเฉพาะ slug ที่ประกาศไว้ — ที่เหลือให้ 404 โดยไม่ต้องเรนเดอร์ */
export const dynamicParams = false;

/*
  ต่ออายุเพจนี้เองทุก 5 นาที — หน้านี้อ่านฐานข้อมูล (เอกสารบล็อกของหมวด)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

export function generateStaticParams() {
  return catalogSlugs().map((slug) => ({ slug }));
}

/**
 * คำอธิบายหมวดที่จะแสดง — ใช้ข้อมูลที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 3)
 * - เว็บเดิมมีแต่ภาษาไทย ⇒ อังกฤษว่าง = ถอยไปใช้ไทย (ธรรมเนียมเดียวกับชื่อหน้า/ชื่อสินค้า)
 * - ไม่มีคำอธิบายเลย (ฐานข้อมูลว่าง/เก็บได้แต่ข้อมูลเก่า) ⇒ ใช้ข้อความ "ตัวอย่างรออนุมัติ" เดิม
 */
function introTextOf(messages: Messages, category: ProductCategoryRecord | null, language: "th" | "en"): string {
  const thai = category === null ? "" : category.descriptionTh.trim();
  const english = category === null ? "" : category.descriptionEn.trim();
  if (language === "en" && english !== "") return english;
  if (thai !== "") return thai;
  if (english !== "") return english;
  return messages.productsPage.detailStub.body;
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};

  const item = findCatalogItem(slug);
  if (!item) return {};

  const messages = await getMessagesFor(lang);
  const m = messages.productsPage;

  return withPageSeo(
    lang,
    `/products/${item.slug}`,
    {
      /*
        ชื่อหน้า = ชื่อหมวด + ชื่อหน้าหมวด — ไม่ใช้ข้อความ "ยังไม่เปิดใช้งาน" อีกแล้ว
        (ตั้งแต่รอบที่ 103 หน้านี้มีข้อมูลสินค้าจริงจากฐานข้อมูล ⇒ ข้อความเดิมทำให้เข้าใจผิดในผลค้นหา/แท็บเบราว์เซอร์)
      */
      title: { absolute: `${m.items[item.id].name} — ${m.title}` },
      description: introTextOf(messages, await loadProductCategory(item.slug), lang),
      /* ⚠️ บังคับ noindex ไว้ก่อน (มติ 2026-10-05) — `applySeoToMetadata` ไม่ตั้ง index:true
         ⇒ ค่า SEO จากหลังบ้านทับได้แค่ title/description/OG (ช่อง noindex ในหลังบ้านยังไม่มีผล) */
      robots: { index: false, follow: false },
      alternates: buildAlternates(lang, `/products/${item.slug}`),
    },
    () => loadPageSeo(productDetailPageId(item.slug)),
  );
}

export default async function ProductCategoryPage({
  params,
}: PageProps<"/[lang]/products/[slug]">) {
  const { lang, slug } = await params;

  if (!isLocale(lang)) notFound();

  const item = findCatalogItem(slug);
  if (!item) notFound();

  /*
    ── เนื้อหาของหน้านี้มาจาก 2 ทาง ──────────────────────────────────────────────
    1. หลังบ้านกดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง" (S3 ส่วนที่ 2 · รอบที่ 102) ⇒ เรนเดอร์บล็อกของหมวดนั้น
    2. ถ้าไม่ ⇒ เลย์เอาต์ "ตัวอย่างรอการอนุมัติ" ด้านล่าง
    **ทั้งสองทางต่อด้วยรายการสินค้าจากฐานข้อมูล** (S3 ส่วนที่ 3 · รอบที่ 103) — ข้อมูลที่นำเข้าจากเว็บเดิม
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลด/ตัวอ่านคืน null/[] ให้เอง
  */
  const messages = await getMessages(lang);
  const m = messages.productsPage;
  const copy = m.items[item.id];

  const [liveDocument, products, category] = await Promise.all([
    loadLiveBlockDocument(productDetailPageId(item.slug)),
    listProductsByCategory(item.slug),
    loadProductCategory(item.slug),
  ]);

  const listStrings = productListStringsOf(m);
  const hasProducts = products.length > 0;
  const intro = introTextOf(messages, category, lang);

  if (liveDocument !== null) {
    return (
      <>
        <BlockDocumentView document={liveDocument} language={lang} />
        <ProductListSection products={products} language={lang} strings={listStrings} />
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
              { label: messages.nav.products, href: localePath(lang, "/products") },
              { label: copy.name },
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {hasProducts ? m.eyebrow : m.detailStub.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {copy.name}
          </h1>
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <Image
            src={item.image.src}
            alt={copy.imageAlt}
            width={item.image.width}
            height={item.image.height}
            sizes="300px"
            className="h-auto w-60 max-w-full"
          />

          {hasProducts ? null : (
            <h2 className="mt-8 font-display text-xl font-extrabold text-fg sm:text-2xl">{m.detailStub.title}</h2>
          )}

          <p className="mt-4 text-base leading-relaxed text-fg-muted">{intro}</p>

          <Link
            href={localePath(lang, "/products")}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
          >
            <span aria-hidden="true" className="text-accent">
              ←
            </span>
            {m.detailStub.back}
          </Link>
        </div>
      </section>

      <ProductListSection products={products} language={lang} strings={listStrings} />
    </>
  );
}
