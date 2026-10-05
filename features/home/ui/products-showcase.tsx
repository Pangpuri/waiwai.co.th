import Image from "next/image";
import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import type { HomeCategoryCard, HomeProductHighlight } from "../view-models";
import { SectionHeading } from "./section-heading";

/**
 * ส่วน "ผลิตภัณฑ์" ของหน้าแรก (รอบที่ 108)
 *
 * ประวัติ/บทเรียน
 * - เดิมใช้ข้อมูลจำลองในโค้ด (`PRODUCT_CATEGORIES` 4 ใบ + `FEATURED_PRODUCTS` 6 ตัว)
 *   โดย **ฝัง slug เอง** (`/products/cup-noodles` · `/products/ready-to-cook` ฯลฯ)
 *   ซึ่งไม่มีอยู่จริง ⇒ **ลิงก์เสีย 4 เส้น** และการ์ดทุกใบขึ้นว่า "ข้อมูลทดสอบ"
 * - ตอนนี้: **6 หมวดจริง** จาก `CATALOG_ITEMS` (slug/ชื่อ/ลำดับ = แหล่งความจริงเดียวในโค้ด)
 *   + คำอธิบาย/ภาพจริง/จำนวนสินค้า จากฐานข้อมูล (ผ่าน `homeCategoryCards`)
 * - **สินค้าเด่น**: 1 ตัวต่อหมวดจากฐานข้อมูลพร้อมภาพจริง · ไม่มีข้อมูล = **ซ่อนส่วนนี้** (ไม่แต่งชื่อสินค้าขึ้นเอง)
 *
 * หมายเหตุการเข้าถึง (a11y): การ์ดหมวดเน้นด้วย `border`/`shadow` ไม่ใช่สีอย่างเดียว ·
 * รูปทุกใบมี alt จากข้อมูลจริง (ชื่อหมวด/ชื่อสินค้า) — ไม่ใช่ alt="" เพราะรูปสื่อความหมาย
 */

const CATEGORY_ICON: Record<HomeCategoryCard["id"], string> = {
  instantNoodles: "M4 9h16l-1.2 9.2A2 2 0 0 1 16.8 20H7.2a2 2 0 0 1-2-1.8L4 9Zm4 0V6a4 4 0 0 1 8 0v3",
  driedVermicelli: "M3 7h18M3 12h18M3 17h18M7 4v16M17 4v16",
  serda: "M12 3l2.2 5.4L20 9.4l-4 3.9.9 5.7L12 16.4 7.1 19l.9-5.7-4-3.9 5.8-1Z",
  quickZabb: "M13 2 4.5 13.5H11L9.8 22l8.7-11.7H12L13 2Z",
  noodie: "M5 5h14v3a7 7 0 0 1-7 7 7 7 0 0 1-7-7V5Zm3 14h8",
  rodDed: "M10 3h4v3l1.8 2.2A4 4 0 0 1 16.6 12v6a3 3 0 0 1-3 3h-3.2a3 3 0 0 1-3-3v-6a4 4 0 0 1 .8-2.4L10 6V3Z",
};

type ProductsShowcaseProps = {
  readonly locale: Locale;
  readonly messages: Messages;
  /** 6 หมวดจริง (เรียงตาม CATALOG_ITEMS) — มาจาก `homeCategoryCards()` */
  readonly categories: readonly HomeCategoryCard[];
  /** สินค้าเด่น 1 ตัวต่อหมวด — ว่าง = ซ่อนส่วน "สินค้าแนะนำ" */
  readonly highlights: readonly HomeProductHighlight[];
  /** ป้ายจำนวนสินค้า เช่น "{count} รายการ" — เติมด้วย `fillTemplate` แล้ว */
  readonly countLabel: (count: number) => string;
};

export function ProductsShowcase({ locale, messages, categories, highlights, countLabel }: ProductsShowcaseProps) {
  const m = messages.products;

  return (
    <section className="container-site py-16 lg:py-24">
      <SectionHeading
        eyebrow={m.eyebrow}
        title={m.title}
        body={m.body}
        action={
          <Link
            href={localePath(locale, "/products")}
            className="inline-flex items-center gap-2 rounded-full border-2 border-line-strong px-5 py-3 text-sm font-bold text-fg transition-colors hover:bg-bg-subtle"
          >
            {messages.actions.viewAllProducts}
          </Link>
        }
      />

      <h3 className="mt-10 font-display text-xl font-extrabold text-fg">{m.categoriesTitle}</h3>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={category.href}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:-translate-y-1 hover:border-line-strong hover:shadow-lg"
            >
              {/* ภาพจริงของหมวด (จากคลัง) — ถอยไปใช้ภาพในโค้ดถ้ายังไม่มีข้อมูล */}
              <span className="relative flex h-40 items-center justify-center bg-bg-subtle p-4">
                <Image
                  src={category.image.src}
                  alt={messages.productsPage.items[category.id].imageAlt}
                  width={category.image.width}
                  height={category.image.height}
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 320px"
                  className="h-auto max-h-32 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </span>

              <span className="flex flex-1 flex-col p-6">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-yellow text-accent-on-yellow"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d={CATEGORY_ICON[category.id]} />
                    </svg>
                  </span>
                  <span className="font-display text-lg font-bold text-fg">{category.name}</span>
                </span>

                {category.description === "" ? null : (
                  <span className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-fg-muted">
                    {category.description}
                  </span>
                )}

                <span className="mt-4 flex items-center justify-between gap-3">
                  {category.productCount > 0 ? (
                    <span className="text-xs font-semibold text-fg-muted">{countLabel(category.productCount)}</span>
                  ) : (
                    <span />
                  )}
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1"
                  >
                    {messages.actions.viewProducts} →
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {highlights.length === 0 ? null : (
        <>
          <h3 className="mt-16 font-display text-xl font-extrabold text-fg">{m.featuredTitle}</h3>

          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {highlights.map((product) => (
              <li key={product.id}>
                <Link href={product.href} className="group block focus-visible:outline-offset-4">
                  <span className="flex h-36 items-center justify-center rounded-xl bg-bg-subtle p-3">
                    <Image
                      src={product.image.src}
                      alt={product.name}
                      width={product.image.width}
                      height={product.image.height}
                      sizes="(max-width: 640px) 45vw, 160px"
                      className="h-auto max-h-32 w-auto object-contain transition-transform group-hover:-translate-y-1.5"
                    />
                  </span>
                  <span className="mt-3 block text-xs font-semibold tracking-wide text-fg-muted uppercase">
                    {product.categoryName}
                  </span>
                  <span className="mt-1 block text-sm font-bold text-fg group-hover:text-accent">
                    {product.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
