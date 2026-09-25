import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อมูลเชิงโครงสร้างของหน้าแรก — เป็น pure module (ไม่แตะ DOM/DB/Next.js)
 *
 * หลักการ: ที่นี่เก็บเฉพาะ "รหัส/สี/ลิงก์" ส่วนข้อความที่ต้องแปลอยู่ในพจนานุกรม
 * การผูกกันทำผ่าน id ที่มี type มาจากพจนานุกรม → พิมพ์ id ผิด = compile error
 */

/* ── ชนิดข้อมูลที่ผูกกับพจนานุกรม ─────────────────────────── */

export type ProductCategoryId = keyof Messages["products"]["categories"];
export type ProductItemId = keyof Messages["products"]["items"];
export type RecipeId = keyof Messages["recipes"]["items"];
export type NewsId = keyof Messages["news"]["items"];
export type SustainabilityPointId = keyof Messages["sustainability"]["points"];
export type BrandStatId = keyof Messages["brand"]["stats"];

/** โทนสีที่อนุญาตให้ใช้กับภาพสินค้าแบบวาด — ต้องมีใน TONE ของ pack-shot.tsx */
export type PackTone = "yellow" | "red" | "cream";

/* ── หมวดสินค้า ───────────────────────────────────────────── */

export type ProductCategory = {
  readonly id: ProductCategoryId;
  /** path ปลายทางเมื่อกดการ์ด (ยังไม่รวม prefix ภาษา) */
  readonly path: string;
  readonly tone: PackTone;
};

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  { id: "packet", path: "/products/packet-noodles", tone: "yellow" },
  { id: "cup", path: "/products/cup-noodles", tone: "red" },
  { id: "semi", path: "/products/ready-to-cook", tone: "cream" },
  { id: "sauce", path: "/products/seasoning", tone: "yellow" },
];

/* ── สินค้าแนะนำ ──────────────────────────────────────────── */

export type FeaturedProduct = {
  readonly id: ProductItemId;
  readonly category: ProductCategoryId;
  readonly tone: PackTone;
};

export const FEATURED_PRODUCTS: readonly FeaturedProduct[] = [
  { id: "tomYumGoong", category: "packet", tone: "red" },
  { id: "mooSub", category: "packet", tone: "yellow" },
  { id: "nuaSub", category: "packet", tone: "red" },
  { id: "kai", category: "cup", tone: "yellow" },
  { id: "boatNoodle", category: "packet", tone: "cream" },
  { id: "padThai", category: "semi", tone: "yellow" },
];

/* ── ตัวเลขของแบรนด์ ─────────────────────────────────────── */

export const BRAND_STAT_ORDER: readonly BrandStatId[] = [
  "years",
  "products",
  "quality",
  "reach",
];

/* ── ความยั่งยืน ──────────────────────────────────────────── */

export const SUSTAINABILITY_POINT_ORDER: readonly SustainabilityPointId[] = [
  "packaging",
  "energy",
  "people",
];

/* ── เมนูอาหาร ────────────────────────────────────────────── */

export const RECIPE_ORDER: readonly RecipeId[] = [
  "dryTomYum",
  "boatNoodleBowl",
  "crispyNoodleSalad",
];

/* ── ข่าวสาร ──────────────────────────────────────────────── */

export type NewsEntry = {
  readonly id: NewsId;
  /** วันที่ในรูปแบบ ISO — จัดรูปแบบตามภาษาด้วย lib/format.ts */
  readonly date: string;
};

/**
 * ⚠️ วันที่เป็นข้อมูลตัวอย่างสำหรับจัดวาง ต้องแทนที่ด้วยวันที่ประกาศจริง
 */
export const NEWS_ENTRIES: readonly NewsEntry[] = [
  { id: "community", date: "2026-08-19" },
  { id: "exhibition", date: "2026-07-02" },
  { id: "certification", date: "2026-05-27" },
];
