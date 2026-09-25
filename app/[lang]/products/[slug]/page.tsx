import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { catalogSlugs, findCatalogItem } from "@/features/products/catalog";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้ารายละเอียดหมวดผลิตภัณฑ์ — **ยังเป็นเพียงหน้า "ตัวอย่างรอการอนุมัติ"**
 *
 * เหตุผลที่ทำเป็นหน้า (ไม่ปล่อยให้ลิงก์ไป 404): หน้านี้ถูกใช้เป็นเดโมให้ฝ่ายการตลาดดู
 * ถ้ากดการ์ดสินค้าแล้วเจอ 404 จะดูเหมือนเว็บพัง ทั้งที่จริง ๆ เราแค่ยังไม่มีเนื้อหา
 * → หน้าจึงบอกตรง ๆ ว่ายังไม่เปิดใช้งาน + รอข้อมูล/การอนุมัติ
 *
 * ⚠️ ยังไม่ใช่หน้ารายละเอียดสินค้าจริง — ต้องรอข้อมูลจากฝ่ายการตลาดก่อน
 *    และตั้งใจไม่ให้ search engine จัดทำดัชนี (robots: index false)
 */

/** รู้จักเฉพาะ slug ที่ประกาศไว้ — ที่เหลือให้ 404 โดยไม่ต้องเรนเดอร์ */
export const dynamicParams = false;

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

  return {
    title: { absolute: `${m.items[item.id].name} — ${m.detailStub.title}` },
    robots: { index: false, follow: false },
    alternates: buildAlternates(lang, `/products/${item.slug}`),
  };
}

export default async function ProductCategoryPage({
  params,
}: PageProps<"/[lang]/products/[slug]">) {
  const { lang, slug } = await params;

  if (!isLocale(lang)) notFound();

  const item = findCatalogItem(slug);
  if (!item) notFound();

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
