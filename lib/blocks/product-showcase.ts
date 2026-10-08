import { CATALOG_ITEMS } from "@/features/products/catalog";
import type { Language } from "@/lib/content/home-section";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import type { ProductCategoryCardRecord, ProductHighlightRecord } from "@/lib/products/repository";

/**
 * ชั้นข้อมูล + ตรรกะของ **บล็อกไดนามิก "หมวดสินค้า + สินค้าแนะนำ"** — รอบที่ 211 (ขั้น 2 ส่วน ก)
 *
 * มติเจ้าของ: *"เราจะทำใหม่ให้เข้ากับข้อมูลจริงทั้งโครงสร้าง … ทีละขั้น"* (ทิศทางกำหนดที่ `/admin/builder/home`)
 *
 * ทำไมต้องมี: "บล็อก" ปกติเป็น **เนื้อหานิ่งที่พิมพ์เก็บในเอกสาร** ⇒ ทำให้ตรงกับหน้าเว็บจริงไม่ได้
 * (การ์ดหมวดไม่รู้ว่ามีสินค้ากี่ชิ้น/ภาพอะไร) ⇒ บล็อกนี้เป็น **บล็อกไดนามิก** ตัวแรก:
 * เก็บแค่ **ตัวเลือก** ในเอกสาร (คอลัมน์/จำนวน/เลือกหมวด) แล้ว **ดึงข้อมูลจริงจากฐานข้อมูลตอนเรนเดอร์**
 *
 * กติกา
 * - **ไม่มีข้อมูล = ไม่เรนเดอร์** (`isEmpty`) — หน้าเว็บต้องไม่พังเพราะฐานข้อมูลว่าง/ล่ม (ตัวอ่านคืน `[]` ให้เอง)
 * - เก็บ **พาธ** ไม่เก็บ URL เต็ม (มติ D9) · ลิงก์หมวด = `/products/<id>` (id ในฐานข้อมูล = slug)
 * - ตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test`
 */
export type ProductShowcaseOptions = {
  readonly columns: 1 | 2 | 3;
  /** แสดงการ์ด "สินค้าแนะนำ" (เด่น 1 ตัวต่อหมวด) */
  readonly showFeatured: boolean;
  /** กี่ตัวต่อหมวด (1–3) — ใช้เมื่อ `showFeatured` */
  readonly featuredPerCategory: number;
  /** เลือกเฉพาะหมวดที่ต้องการ (รหัส = slug) · ว่าง = ทุกหมวด */
  readonly categoryIds: readonly string[];
  /** แสดงจำนวนสินค้าบนการ์ดหมวด */
  readonly showCount: boolean;
};

export const DEFAULT_PRODUCT_SHOWCASE: ProductShowcaseOptions = {
  columns: 3,
  showFeatured: true,
  featuredPerCategory: 1,
  categoryIds: [],
  showCount: true,
};

export const MAX_FEATURED_PER_CATEGORY = 3;

/** บีบค่าตัวเลือกให้อยู่ในช่วงที่ใช้ได้ (ค่าที่ส่งมาจากเอกสาร/ฟอร์มไม่เชื่อถือได้) */
export function clampShowcaseOptions(options: Partial<ProductShowcaseOptions>): ProductShowcaseOptions {
  const columns = options.columns === 1 || options.columns === 2 || options.columns === 3 ? options.columns : DEFAULT_PRODUCT_SHOWCASE.columns;
  const per = options.featuredPerCategory;
  return {
    columns,
    showFeatured: options.showFeatured ?? DEFAULT_PRODUCT_SHOWCASE.showFeatured,
    featuredPerCategory:
      typeof per === "number" && Number.isFinite(per)
        ? Math.min(MAX_FEATURED_PER_CATEGORY, Math.max(1, Math.round(per)))
        : DEFAULT_PRODUCT_SHOWCASE.featuredPerCategory,
    categoryIds: [...new Set((options.categoryIds ?? []).map((id) => id.trim()).filter((id) => id !== ""))],
    showCount: options.showCount ?? DEFAULT_PRODUCT_SHOWCASE.showCount,
  };
}

export type ProductShowcaseCategoryView = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** `/media/<id>` หรือ null */
  readonly image: string | null;
  readonly productCount: number;
  readonly href: string;
};

export type ProductShowcaseFeaturedView = {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly image: string | null;
  readonly href: string;
};

export type ProductShowcaseView = {
  readonly categories: readonly ProductShowcaseCategoryView[];
  readonly featured: readonly ProductShowcaseFeaturedView[];
  /** true = ไม่มีข้อมูลจริง ⇒ ตัวเรนเดอร์ต้องไม่แสดงบล็อกนี้ (ห้ามขึ้นกล่องเปล่า) */
  readonly isEmpty: boolean;
};

/**
 * ประกอบวิวของบล็อกจากข้อมูลจริง
 * - หมวด: เรียงตามลำดับที่ฐานข้อมูลคืนมา (sort_order) · กรองตาม `categoryIds` ถ้าเลือกไว้
 * - สินค้าแนะนำ: เอาเฉพาะหมวดที่แสดง · ตัดที่ `featuredPerCategory` ตัวต่อหมวด (รักษาลำดับ)
 */
/*
  ชื่อหมวด: **อยู่ในพจนานุกรมเท่านั้น** (ตาราง `product_category` ไม่มีคอลัมน์ชื่อ — มีแค่คำอธิบาย/ภาพ)
  คีย์ = `CatalogItemId` เดียวกับ `CATALOG_ITEMS` (บทเรียนรอบ 108/210: id ≠ คีย์พจนานุกรมของพื้นที่อื่น)
*/
type CatalogName = { readonly name?: string };
const catalogTh = th.productsPage.items as Readonly<Record<string, CatalogName | undefined>>;
const catalogEn = en.productsPage.items as Readonly<Record<string, CatalogName | undefined>>;

/*
  ⚠️ บทเรียนจริง (รอบ 211): **id ของหมวดในฐานข้อมูล = slug** ("instant-noodles")
  แต่พจนานุกรมใช้คีย์ `CatalogItemId` (คนละรูปแบบ) ⇒ ต้องแปลงผ่าน `CATALOG_ITEMS` ก่อนเสมอ
  (ถ้าค้นด้วย slug ตรง ๆ จะไม่เจอ → ชื่อหมวดกลายเป็น slug แทน — เทสต์จับได้)
*/
const catalogIdOfSlug = new Map(CATALOG_ITEMS.map((item) => [item.slug, item.id]));

function categoryNameOf(id: string, language: Language): string {
  const key = catalogIdOfSlug.get(id) ?? id;
  const thai = catalogTh[key]?.name ?? id;
  if (language !== "en") return thai;
  const english = catalogEn[key]?.name ?? "";
  return english.trim() !== "" ? english : thai;
}

export function productShowcaseView(
  categories: readonly ProductCategoryCardRecord[],
  highlights: readonly ProductHighlightRecord[],
  rawOptions: Partial<ProductShowcaseOptions>,
  language: Language,
): ProductShowcaseView {
  const options = clampShowcaseOptions(rawOptions);
  const selected =
    options.categoryIds.length === 0 ? categories : categories.filter((row) => options.categoryIds.includes(row.id));

  const views: readonly ProductShowcaseCategoryView[] = selected.map((row) => ({
    id: row.id,
    title: categoryNameOf(row.id, language),
    description: language === "en" && row.descriptionEn.trim() !== "" ? row.descriptionEn : row.descriptionTh,
    image: row.imagePath,
    productCount: row.productCount,
    href: `/products/${row.id}`,
  }));

  const featuredViews: ProductShowcaseFeaturedView[] = options.showFeatured
    ? selected.flatMap((category) =>
        highlights
          .filter((row) => row.categoryId === category.id)
          .slice(0, options.featuredPerCategory)
          .map((row) => ({
            id: row.id,
            categoryId: row.categoryId,
            title: language === "en" && row.nameEn.trim() !== "" ? row.nameEn : row.nameTh,
            image: row.imagePath,
            href: `/products/${category.id}`,
          })),
      )
    : [];

  return { categories: views, featured: featuredViews, isEmpty: views.length === 0 };
}

/* ── ส่วนเชื่อมกับ "เอกสารบล็อก" (รอบที่ 212 · ขั้น 2 ส่วน ข) ───────────────────────── */

/**
 * อ่านตัวเลือกจากก้อนข้อมูลดิบ (JSONB) แล้วบีบให้อยู่ในช่วงที่ใช้ได้
 * — เอกสารในฐานข้อมูล/ไฟล์ที่ผู้ใช้อัปโหลด **ไม่เชื่อถือได้** (ค่าผิดชนิด/นอกช่วงต้องไม่ทำให้พัง)
 */
export function showcaseOptionsFromUnknown(raw: Readonly<Record<string, unknown>>): ProductShowcaseOptions {
  const columns = raw["columns"];
  const per = raw["featuredPerCategory"];
  const ids = raw["categoryIds"];
  return clampShowcaseOptions({
    columns: columns === 1 || columns === 2 || columns === 3 ? columns : undefined,
    showFeatured: typeof raw["showFeatured"] === "boolean" ? raw["showFeatured"] : undefined,
    featuredPerCategory: typeof per === "number" ? per : undefined,
    categoryIds: Array.isArray(ids) ? ids.filter((value): value is string => typeof value === "string") : undefined,
    showCount: typeof raw["showCount"] === "boolean" ? raw["showCount"] : undefined,
  });
}

/** ตัวเลือกเริ่มต้นของบล็อก (ใช้ตอนเพิ่มบล็อกใหม่/เทมเพลต) */
export const PRODUCT_SHOWCASE_BLOCK_DEFAULTS = {
  columns: DEFAULT_PRODUCT_SHOWCASE.columns,
  showFeatured: DEFAULT_PRODUCT_SHOWCASE.showFeatured,
  featuredPerCategory: DEFAULT_PRODUCT_SHOWCASE.featuredPerCategory,
  categoryIds: DEFAULT_PRODUCT_SHOWCASE.categoryIds,
  showCount: DEFAULT_PRODUCT_SHOWCASE.showCount,
} as const;
