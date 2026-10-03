import { NEWS_ENTRIES, BRAND_STAT_ORDER, FEATURED_PRODUCTS, PRODUCT_CATEGORIES, RECIPE_ORDER, SUSTAINABILITY_POINT_ORDER } from "@/features/home/content";
import { HERO_CARD_HREF, HERO_CARD_IMAGE } from "@/features/home/hero-card";
import { HERO_SLIDES } from "@/features/home/slides";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";
import type { ItemContent, LocalizedValue, MediaValue, PageContent, SectionContent } from "@/lib/content/types";

/**
 * seed ของ **หน้าแรก** — เนื้อหาปัจจุบัน (จากพจนานุกรม + ไฟล์ข้อมูลใน `features/home/`)
 * แปลงเข้าสู่โครงใหม่ตาม `lib/content/model.ts`
 *
 * ทำไมต้องมีไฟล์นี้
 * - เป็น **แหล่ง migration เดียว**: ตอนต่อ DB จริง (B1b) จะ insert จากออบเจ็กต์นี้ ไม่ต้องคัดข้อความด้วยมือ
 * - ทำให้ด่าน `check:content` ตรวจ "ข้อมูลจริงชุดปัจจุบัน" ได้ **โดยไม่ต้องมีฐานข้อมูล**
 * - เป็นตัวอย่างให้หลังบ้าน (B2): รูปร่างของค่าที่จะบันทึก/อ่าน ตรงกับที่ validator คาดหวัง
 *
 * กติกาการแปลง (ตรงกับ BACKEND_DECISIONS.md)
 * - ฟิลด์ที่ต้องแปล → ใส่ทั้ง th และ en
 * - ฟิลด์ที่ไม่ต้องแปล (ลิงก์ · โทนสี · วันที่ · ตัวเลข) → ใส่ที่ `th` และเว้น `en` เป็น ""
 * - ฟิลด์ภาพ → เก็บ **พาธ** (`/slide/x.jpg`) ไม่ใช่ URL เต็ม (มติ D9) · alt แยกตามภาษา
 *
 * ⚠️ เนื้อหาหลายส่วนยังเป็น placeholder (`XX` · `ข้อมูลทดสอบ` · `ไวไว รส XXX`) ตามข้อตกลง § 9 ของ roadmap
 *    ด่านจะรายงานเป็น "คำเตือน" ไม่ใช่ error — ของจริงต้องมาจากฝ่ายการตลาด
 */

function text(thText: string, enText = ""): LocalizedValue {
  return { th: thText, en: enText };
}

function notLocalized(value: string): LocalizedValue {
  return { th: value, en: "" };
}

function image(filePath: string, altTh: string, altEn: string, hasWatermark: boolean): MediaValue {
  return { path: filePath, altTh, altEn, hasWatermark };
}

function item(
  order: number,
  fields: Readonly<Record<string, LocalizedValue>> = {},
  media: Readonly<Record<string, MediaValue>> = {},
): ItemContent {
  return { order, fields, media };
}

/* ── hero ───────────────────────────────────────────────────────────── */

const heroSlides: readonly ItemContent[] = HERO_SLIDES.map((slide, index) =>
  item(
    index + 1,
    { focus: notLocalized(slide.objectPosition) },
    {
      image: image(slide.src, th.hero.slides[slide.id].alt, en.hero.slides[slide.id].alt, slide.watermarked),
    },
  ),
);

const heroCard: readonly ItemContent[] = [
  item(1, {
    title: text(th.hero.card.title, en.hero.card.title),
    body: text(th.hero.card.body, en.hero.card.body),
    linkLabel: text(th.hero.card.link, en.hero.card.link),
    href: notLocalized(HERO_CARD_HREF),
  }, {
    image: image(HERO_CARD_IMAGE.src, th.hero.card.alt, en.hero.card.alt, HERO_CARD_IMAGE.watermarked),
  }),
];

const hero: SectionContent = {
  fields: {
    eyebrow: text(th.hero.eyebrow, en.hero.eyebrow),
    title: text(th.hero.title, en.hero.title),
    titleAccent: text(th.hero.titleAccent, en.hero.titleAccent),
    body: text(th.hero.body, en.hero.body),
    note: text(th.hero.note, en.hero.note),
  },
  items: { slides: heroSlides, card: heroCard },
};

/* ── หมวดสินค้า + สินค้าแนะนำ ───────────────────────────────────────── */

const productCategories: readonly ItemContent[] = PRODUCT_CATEGORIES.map((category, index) =>
  item(index + 1, {
    name: text(th.products.categories[category.id].name, en.products.categories[category.id].name),
    description: text(
      th.products.categories[category.id].description,
      en.products.categories[category.id].description,
    ),
    tone: notLocalized(category.tone),
    href: notLocalized(category.path),
  }),
);

const featuredProducts: readonly ItemContent[] = FEATURED_PRODUCTS.map((product, index) =>
  item(index + 1, {
    name: text(th.products.items[product.id].name, en.products.items[product.id].name),
    tagline: text(th.products.items[product.id].tagline, en.products.items[product.id].tagline),
    category: notLocalized(product.category),
    tone: notLocalized(product.tone),
  }),
);

const products: SectionContent = {
  fields: {
    eyebrow: text(th.products.eyebrow, en.products.eyebrow),
    title: text(th.products.title, en.products.title),
    body: text(th.products.body, en.products.body),
    categoriesTitle: text(th.products.categoriesTitle, en.products.categoriesTitle),
    featuredTitle: text(th.products.featuredTitle, en.products.featuredTitle),
  },
  items: { categories: productCategories, featured: featuredProducts },
};

/* ── เรื่องราวแบรนด์ ────────────────────────────────────────────────── */

const brandStats: readonly ItemContent[] = BRAND_STAT_ORDER.map((id, index) =>
  item(index + 1, {
    value: notLocalized(th.brand.stats[id].value),
    label: text(th.brand.stats[id].label, en.brand.stats[id].label),
  }),
);

const brand: SectionContent = {
  fields: {
    eyebrow: text(th.brand.eyebrow, en.brand.eyebrow),
    title: text(th.brand.title, en.brand.title),
    body: text(th.brand.body, en.brand.body),
    bodySecondary: text(th.brand.bodySecondary, en.brand.bodySecondary),
    ctaLabel: text(th.brand.ctaLabel, en.brand.ctaLabel),
  },
  items: { stats: brandStats },
};

/* ── ความยั่งยืน ────────────────────────────────────────────────────── */

const sustainabilityPoints: readonly ItemContent[] = SUSTAINABILITY_POINT_ORDER.map((id, index) =>
  item(index + 1, {
    title: text(th.sustainability.points[id].title, en.sustainability.points[id].title),
    description: text(th.sustainability.points[id].description, en.sustainability.points[id].description),
  }),
);

const sustainability: SectionContent = {
  fields: {
    eyebrow: text(th.sustainability.eyebrow, en.sustainability.eyebrow),
    title: text(th.sustainability.title, en.sustainability.title),
    body: text(th.sustainability.body, en.sustainability.body),
  },
  items: { points: sustainabilityPoints },
};

/* ── เมนูอาหาร (หน้าแรก) ─────────────────────────────────────────────── */

const recipeCards: readonly ItemContent[] = RECIPE_ORDER.map((id, index) =>
  item(index + 1, {
    name: text(th.recipes.items[id].name, en.recipes.items[id].name),
    description: text(th.recipes.items[id].description, en.recipes.items[id].description),
    minutes: notLocalized(th.recipes.items[id].minutes),
    level: notLocalized(th.recipes.items[id].level),
  }),
);

const recipes: SectionContent = {
  fields: {
    eyebrow: text(th.recipes.eyebrow, en.recipes.eyebrow),
    title: text(th.recipes.title, en.recipes.title),
    body: text(th.recipes.body, en.recipes.body),
  },
  items: { recipes: recipeCards },
};

/* ── ข่าว/กิจกรรม (หน้าแรก) ──────────────────────────────────────────── */

const newsCards: readonly ItemContent[] = NEWS_ENTRIES.map((entry, index) =>
  item(index + 1, {
    title: text(th.news.items[entry.id].title, en.news.items[entry.id].title),
    excerpt: text(th.news.items[entry.id].excerpt, en.news.items[entry.id].excerpt),
    tag: text(th.news.items[entry.id].tag, en.news.items[entry.id].tag),
    date: notLocalized(entry.date),
  }),
);

const news: SectionContent = {
  fields: {
    eyebrow: text(th.news.eyebrow, en.news.eyebrow),
    title: text(th.news.title, en.news.title),
    body: text(th.news.body, en.news.body),
  },
  items: { news: newsCards },
};

/* ── ที่ซื้อ ─────────────────────────────────────────────────────────── */

const marketplaces: readonly ItemContent[] = SITE.marketplaces.map((marketplace, index) =>
  item(index + 1, {
    name: text(th.whereToBuy.marketplaces[marketplace.id], en.whereToBuy.marketplaces[marketplace.id]),
    href: notLocalized(marketplace.href),
  }),
);

const whereToBuy: SectionContent = {
  fields: {
    eyebrow: text(th.whereToBuy.eyebrow, en.whereToBuy.eyebrow),
    title: text(th.whereToBuy.title, en.whereToBuy.title),
    body: text(th.whereToBuy.body, en.whereToBuy.body),
    retailNote: text(th.whereToBuy.retailNote, en.whereToBuy.retailNote),
  },
  items: { marketplaces },
};

/* ── สมัครรับข่าวสาร ────────────────────────────────────────────────── */

const newsletter: SectionContent = {
  fields: {
    eyebrow: text(th.newsletter.eyebrow, en.newsletter.eyebrow),
    title: text(th.newsletter.title, en.newsletter.title),
    body: text(th.newsletter.body, en.newsletter.body),
    consent: text(th.newsletter.consent, en.newsletter.consent),
    successMessage: text(th.newsletter.successMessage, en.newsletter.successMessage),
    note: text(th.newsletter.note, en.newsletter.note),
  },
  items: {},
};

/* ── SEO ────────────────────────────────────────────────────────────── */

const seo: SectionContent = {
  fields: {
    title: text(th.meta.homeTitle, en.meta.homeTitle),
    description: text(th.meta.homeDescription, en.meta.homeDescription),
  },
  items: {},
};

/** เนื้อหาหน้าแรกชุดปัจจุบัน — ลำดับ section ตรงกับ `app/[lang]/page.tsx` */
export const HOME_SEED: PageContent = {
  page: "home",
  sections: {
    hero,
    products,
    brand,
    sustainability,
    recipes,
    news,
    whereToBuy,
    newsletter,
    seo,
  },
};
