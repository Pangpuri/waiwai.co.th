import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CATALOG_ITEMS, catalogHref } from "@/features/products/catalog";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { SampleNotice } from "@/features/shell/ui/sample-notice";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/products">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const messages = await getMessagesFor(lang);

  return {
    // ชื่อหน้ามีคำว่า "ผลิตภัณฑ์" อยู่แล้ว จึงใช้ absolute ไม่ให้ต่อท้ายด้วยชื่อเว็บซ้ำ
    title: { absolute: messages.productsPage.meta.title },
    description: messages.productsPage.meta.description,
    alternates: buildAlternates(lang, "/products"),
    openGraph: {
      title: messages.productsPage.meta.title,
      description: messages.productsPage.meta.description,
    },
  };
}

export default async function ProductsPage({ params }: PageProps<"/[lang]/products">) {
  const { lang } = await params;

  // ภาษาที่ไม่รองรับ → 404 (ไม่ใช่ 500) เหมือนหน้าอื่น
  if (!isLocale(lang)) notFound();
  const messages = await getMessages(lang);

  const m = messages.productsPage;

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
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_ITEMS.map((item) => {
            const copy = m.items[item.id];

            return (
              <li key={item.id}>
                <Link
                  href={catalogHref(lang, item.slug)}
                  className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  {/* ภาพโลโก้หมวดความกว้างคงที่ — ใช้ object-contain ไม่ครอปภาพ */}
                  <span className="flex h-44 items-center justify-center rounded-xl border border-line bg-bg-subtle p-4">
                    <Image
                      src={item.image.src}
                      alt={copy.imageAlt}
                      width={item.image.width}
                      height={item.image.height}
                      sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 80vw"
                      className="h-full w-auto object-contain"
                    />
                  </span>

                  <span className="mt-4 font-display text-base font-extrabold text-fg">
                    {copy.name}
                  </span>

                  <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                    {m.cardCta}
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
