import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { FEATURED_PRODUCTS, PRODUCT_CATEGORIES, type ProductCategoryId } from "../content";
import { PackShot } from "./pack-shot";
import { SectionHeading } from "./section-heading";

/** ไอคอนเส้นง่าย ๆ ของแต่ละหมวด — วาดเองเพื่อไม่ต้องเพิ่มไลบรารี */
const CATEGORY_ICON: Record<ProductCategoryId, string> = {
  packet: "M4 9h16l-1.2 9.2A2 2 0 0 1 16.8 20H7.2a2 2 0 0 1-2-1.8L4 9Zm4 0V6a4 4 0 0 1 8 0v3",
  cup: "M6 8h12l-1 11a2 2 0 0 1-2 1.8H9A2 2 0 0 1 7 19L6 8Zm2 0V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3",
  semi: "M3 7h18M3 12h18M3 17h18M7 4v16M17 4v16",
  sauce: "M10 3h4v3l1.8 2.2A4 4 0 0 1 16.6 12v6a3 3 0 0 1-3 3h-3.2a3 3 0 0 1-3-3v-6a4 4 0 0 1 .8-2.4L10 6V3Z",
};

type ProductsShowcaseProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function ProductsShowcase({ locale, messages }: ProductsShowcaseProps) {
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

      {/* หมวดสินค้า */}
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCT_CATEGORIES.map((category) => {
          const copy = m.categories[category.id];
          return (
            <li key={category.id}>
              <Link
                href={localePath(locale, category.path)}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-all hover:-translate-y-1 hover:border-line-strong hover:shadow-lg"
              >
                <span
                  aria-hidden="true"
                  className="grid h-12 w-12 place-items-center rounded-xl bg-brand-yellow text-accent-on-yellow"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                  >
                    <path d={CATEGORY_ICON[category.id]} />
                  </svg>
                </span>

                <h3 className="mt-5 font-display text-lg font-bold text-fg">{copy.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">
                  {copy.description}
                </p>

                <span
                  aria-hidden="true"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1"
                >
                  {messages.actions.viewProducts} →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* สินค้าแนะนำ */}
      <h3 className="mt-16 font-display text-xl font-extrabold text-fg">
        {m.featuredTitle}
      </h3>

      <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {FEATURED_PRODUCTS.map((product) => {
          const copy = m.items[product.id];
          const category = m.categories[product.category];

          return (
            <li key={product.id}>
              <Link
                href={localePath(locale, "/products")}
                className="group block focus-visible:outline-offset-4"
              >
                <PackShot
                  tone={product.tone}
                  name={copy.name}
                  tagline={copy.tagline}
                  className="transition-transform group-hover:-translate-y-1.5"
                />
                <p className="mt-3 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  {category.name}
                </p>
                <p className="mt-1 text-sm font-bold text-fg group-hover:text-accent">
                  {copy.name}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
