import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { catalogSlugs, findCatalogItem } from "@/features/products/catalog";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { productDetailPageId } from "@/lib/blocks/product-detail";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageSeo } from "@/lib/pages/repository";
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
      title: { absolute: `${m.items[item.id].name} — ${m.detailStub.title}` },
      description: m.detailStub.body,
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
    ── เนื้อหาของหน้านี้มาจากไหน (S3 ส่วนที่ 2 · รอบที่ 102) ──────────────────────
    1. หลังบ้านกดเผยแพร่ + เปิดสวิตช์ "ใช้กับหน้าเว็บจริง" ⇒ เรนเดอร์เอกสารบล็อกของหมวดนั้น
    2. ถ้าไม่ ⇒ เลย์เอาต์ "ตัวอย่างรอการอนุมัติ" ด้านล่างเหมือนเดิม
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลดคืน null ให้เอง
  */
  const liveDocument = await loadLiveBlockDocument(productDetailPageId(item.slug));
  if (liveDocument !== null) {
    return <BlockDocumentView document={liveDocument} language={lang} />;
  }

  const messages = await getMessages(lang);
  const m = messages.productsPage;
  const copy = m.items[item.id];

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
            {m.detailStub.eyebrow}
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

          <h2 className="mt-8 font-display text-xl font-extrabold text-fg sm:text-2xl">
            {m.detailStub.title}
          </h2>

          <p className="mt-4 text-base leading-relaxed text-fg-muted">{m.detailStub.body}</p>

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
    </>
  );
}
