import { CATALOG_ITEMS } from "@/features/products/catalog";

/**
 * "หมวดสินค้า" ของหลังบ้าน — **ตรรกะล้วน ทดสอบได้ ไม่มี Next/DB/env** (รอบที่ 264)
 *
 * ## ที่มา (มติเจ้าของ 2026-10-14 · มติ **D25**)
 * เจ้าของสั่ง *"ต้องมีหน้าหมวดสินค้า … เก็บรูปไว้ในฐานข้อมูลเป็นรูปค่าเริ่มต้น และโครงสร้างตามหน้าบ้าน
 * เป็นค่าเริ่มต้น … สามารถปรับเปลี่ยนรูปได้ เพิ่มหมวดได้ … และสามารถคืนค่าเริ่มต้นได้ เพราะฉะนั้น
 * ค่าเริ่มต้นจะเก็บถาวรเสมอ เก็บพรัซเซ็ตได้"* ⇒ ถามข้อตัดสิน 5 ข้อ แล้วได้มติ:
 *  1. **slug ของหมวด** = สร้างอัตโนมัติจากชื่ออังกฤษ ⚠️ **แก้ไข:** มติ D30 (รอบที่ 279/280) เปิดให้แก้ทีหลัง
 *     พร้อมระบบ **301** จากที่อยู่เก่า (เดิมรอบที่ 264 ล็อกถาวร ⇒ ไม่มี 301)
 *  2. **เพดานจำนวน** = **ไม่เกิน `MAX_PRODUCT_CATEGORIES` (12) หมวด**
 *  3. **ลบหมวด** = **ยังไม่ให้ลบ** — ใช้ **"ซ่อนจากเว็บ"** (`is_hidden`) แทน (ไม่มีข้อมูลตกงาน)
 *  4. **"ค่าเริ่มต้น"** = ชุด ณ วันนี้ (6 หมวดในโค้ด) **ล็อกถาวร** ⇒ UI แก้ไม่ได้ · กดคืนค่าได้เสมอ
 *  5. **พรีเซ็ต** = เก็บไม่จำกัด · ไม่หมดอายุ · **ไม่ขึ้นหน้า `/privacy`** (ไม่ใช่ข้อมูลส่วนบุคคล)
 *
 * ## หลักการ
 * - **ค่าเริ่มต้นของ 6 หมวดอยู่ในโค้ด** (`CATALOG_ITEMS` + พจนานุกรม + `public/products/*.png`)
 *   ⇒ เป็น baseline ที่ UI แก้ไม่ได้จริง ๆ · ตาราง `product_category_default` เก็บ **สำเนาชุด ณ วันนี้**
 *     (รวมพาธภาพที่นำเข้าคลังแล้ว) เพื่อให้ "คืนค่าเริ่มต้น" ทำงานได้แม้ค่าปัจจุบันถูกแก้ไปแล้ว
 * - **ห้ามให้ตรรกะนี้แตะ DB** — ชั้นข้อมูล (`repository`) เป็นคนอ่าน/เขียน · ที่นี่ตัดสินใจเท่านั้น
 *
 * ## ที่อยู่บนเว็บ: `id` (ภายใน) กับ `slug` (URL) — รอบที่ 279/280 · มติ D30
 * - `product_category.id` = **รหัสภายใน** ที่ตารางอื่นอ้างอยู่ (`product.category_id`, ค่าเริ่มต้น, พรีเซ็ต,
 *   id ของหน้าตัวสร้าง) ⇒ **ไม่เปลี่ยนตลอดชีพ**
 * - `product_category.slug` = **ที่อยู่บนเว็บ** (`/products/<slug>`) ที่แก้ได้ ⇒ เปลี่ยนแล้วระบบทำ **301**
 *   จากที่อยู่เก่าให้ (ประวัติอยู่ใน `product_category_slug_history`)
 * - หมวดที่นำเข้าจากเว็บเดิม/สร้างใหม่: `slug = id` ตอนเกิด ⇒ URL วันแรกเหมือนเดิมเสมอ
 * - ⚠️ ชื่อ/คำอธิบายยังผูกกับ `id` (คีย์พจนานุกรม = `id`) · อย่าใช้ `slug` ไปหาคีย์พจนานุกรม
 */

/** เพดานจำนวนหมวด (มติ D25 ข้อ 2) — validator ปฏิเสธการเพิ่มเมื่อถึงเพดาน */
export const MAX_PRODUCT_CATEGORIES = 12;

/** ชื่อหมวด/คำอธิบาย — เพดานความยาว (กันข้อความผิดปกติหลุดเข้าไป · เท่าของเดิมใน `lib/products/model.ts`) */
export const MAX_CATEGORY_NAME_LENGTH = 300;
export const MAX_CATEGORY_TEXT_LENGTH = 4000;

/** ระยะห่างของลำดับที่ระบบสร้างให้อัตโนมัติ (เว้นช่องให้แทรกทีหลังได้โดยไม่ต้องแก้เลขอื่น) */
export const CATEGORY_SORT_STEP = 10;

/** ลำดับตั้งต้นของหมวดที่สร้างใหม่ (หลัง 6 หมวดในโค้ดซึ่งใช้ 10..60) */
export const NEW_CATEGORY_SORT_BASE = 100;

/** ความยาวสูงสุดของ slug — เท่าค่าที่ปลอดภัยกับ URL และดัชนีฐานข้อมูล */
export const MAX_CATEGORY_SLUG_LENGTH = 60;

/**
 * ขนาดสำรองของภาพหมวดเมื่อไม่รู้ขนาดจริง (การ์ดใช้ `object-contain` + กำหนดความสูงด้วย CSS ⇒ ไม่ผิดรูป)
 * ⚠️ ต้องมีค่า > 0 เสมอ ไม่งั้น `next/image` ของหน้าเว็บจะพัง (ผู้ใช้อัปโหลดภาพที่อ่านขนาดไม่ได้)
 */
export const FALLBACK_CATEGORY_IMAGE_WIDTH = 300;
export const FALLBACK_CATEGORY_IMAGE_HEIGHT = 200;

/**
 * slug ที่ **ห้ามใช้** เพราะชนกับเส้นทาง/คำสงวนของเว็บ (หรือทำให้สับสน)
 * ⚠️ รายการนี้ผูกกับโครง URL จริง — เพิ่มเมื่อมีเส้นทางใหม่ใต้ `/products` หรือคำสงวนใหม่
 */
export const RESERVED_CATEGORY_SLUGS: readonly string[] = [
  "products",
  "product",
  "new",
  "all",
  "page",
  "index",
  "search",
  "admin",
  "api",
  "media",
  "_next",
];

/** ชุด slug ของ 6 หมวดในโค้ด (baseline ที่แก้ไม่ได้) */
export function builtInCategorySlugs(): readonly string[] {
  return CATALOG_ITEMS.map((item) => item.slug);
}

export function isBuiltInCategorySlug(slug: string): boolean {
  return CATALOG_ITEMS.some((item) => item.slug === slug);
}

/** ลำดับของหมวดในโค้ด (0 = ตัวแรก) · คืน -1 ถ้าไม่ใช่หมวดในโค้ด */
export function builtInCategoryIndex(slug: string): number {
  return CATALOG_ITEMS.findIndex((item) => item.slug === slug);
}

/** ลำดับตั้งต้นของหมวดในโค้ด (10, 20, 30, …) · คืน `NEW_CATEGORY_SORT_BASE` ถ้าไม่รู้จัก */
export function defaultSortOrderOf(slug: string): number {
  const index = builtInCategoryIndex(slug);
  return index < 0 ? NEW_CATEGORY_SORT_BASE : (index + 1) * CATEGORY_SORT_STEP;
}

/**
 * แปลง "ชื่ออังกฤษ" → slug (มติ D25 ข้อ 1)
 *
 * กติกา: ตัวพิมพ์เล็ก · a-z/0-9 · คั่นด้วย `-` · ยุบขีดซ้ำ · ตัดขีดหัวท้าย
 * - อักขระอื่น (ไทย/สระ/เครื่องหมาย) ถูกตัดออก ⇒ ชื่อไทยล้วน (และชื่ออังกฤษที่ไม่มี a-z)
 *   จะได้สตริงว่าง ⇒ ผู้เรียกต้อง **ปฏิเสธ** (ห้ามเดา slug ให้เจ้าของ) — มีเทสต์ล็อกไว้
 * - คืนสตริงว่าง = "สร้างไม่ได้" (ไม่ใช่ค่าว่างที่ใช้ต่อได้)
 */
export function slugifyCategoryName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    /* ตัดวรรณยุกต์/เครื่องหมายกำกับ (é → e) — เก็บเฉพาะ ASCII ต่อ */
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const collapsed = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return collapsed.slice(0, MAX_CATEGORY_SLUG_LENGTH).replace(/-+$/g, "");
}

export type CategorySlugIssue = "empty" | "reserved" | "duplicate" | "too-long" | "bad-chars";

/**
 * ตรวจ slug ของหมวด (ใช้ทั้งตอนสร้างใหม่และตอนอ่านค่าที่มีอยู่)
 * `existing` = slug ที่มีอยู่แล้วในระบบ (สำหรับเช็คซ้ำ) — **ตัดตัวเองออกก่อน** ถ้าเป็นการแก้ของเดิม
 */
export function categorySlugIssue(slug: string, existing: readonly string[] = []): CategorySlugIssue | null {
  const value = slug.trim();
  if (value === "") return "empty";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return "bad-chars";
  if (value.length > MAX_CATEGORY_SLUG_LENGTH) return "too-long";
  if (RESERVED_CATEGORY_SLUGS.includes(value)) return "reserved";
  if (existing.includes(value)) return "duplicate";
  return null;
}

export type NewCategoryInput = {
  readonly nameTh: string;
  readonly nameEn: string;
};

export type CategoryIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};

/**
 * ตรวจคำขอนี้ "สร้างหมวดใหม่" — **ไม่แตะ DB** (ผู้เรียกส่งสถานะปัจจุบันเข้ามา)
 *
 * @param input ชื่อไทย/อังกฤษที่กรอก
 * @param context `existingSlugs` = slug ที่มีอยู่แล้ว · `total` = จำนวนหมวดปัจจุบัน
 */
export function validateNewCategory(
  input: NewCategoryInput,
  context: { readonly existingSlugs: readonly string[]; readonly total: number },
): readonly CategoryIssue[] {
  const issues: CategoryIssue[] = [];

  const nameTh = input.nameTh.trim();
  if (nameTh === "") {
    issues.push({ code: "empty-name-th", path: "nameTh", message: "ชื่อหมวดภาษาไทยห้ามว่าง" });
  }
  if (nameTh.length > MAX_CATEGORY_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameTh", message: `ชื่อหมวดไทยยาวเกิน ${MAX_CATEGORY_NAME_LENGTH} ตัวอักษร` });
  }
  if (input.nameEn.trim().length > MAX_CATEGORY_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameEn", message: `ชื่อหมวดอังกฤษยาวเกิน ${MAX_CATEGORY_NAME_LENGTH} ตัวอักษร` });
  }

  /* slug มาจากชื่ออังกฤษเท่านั้น (มติ D25 ข้อ 1) */
  const slug = slugifyCategoryName(input.nameEn);
  const slugIssue = categorySlugIssue(slug, context.existingSlugs);
  if (slugIssue !== null) {
    issues.push({
      code: `slug-${slugIssue}`,
      path: "nameEn",
      message:
        slugIssue === "empty"
          ? "ชื่ออังกฤษต้องมีตัวอักษร a–z หรือ 0–9 (ใช้สร้าง URL ของหมวด)"
          : slugIssue === "duplicate"
            ? `มีหมวดที่ใช้ URL "${slug}" อยู่แล้ว`
            : slugIssue === "reserved"
              ? `คำว่า "${slug}" สงวนไว้สำหรับเส้นทางอื่นของเว็บ`
              : `URL ของหมวดไม่ถูกต้อง ("${slug}")`,
    });
  }

  if (context.total >= MAX_PRODUCT_CATEGORIES) {
    issues.push({
      code: "too-many-categories",
      path: "",
      message: `เพิ่มหมวดได้ไม่เกิน ${MAX_PRODUCT_CATEGORIES} หมวด (ตอนนี้มี ${context.total} หมวด)`,
    });
  }

  return issues;
}

/** แถวหมวดที่ใช้เรียงลำดับ — รับได้ทั้งแถว DB และรายการที่ประกอบเอง */
export type SortableCategory = {
  readonly id: string;
  readonly sortOrder: number;
};

/**
 * ค่าที่แก้ได้ของหมวด
 *
 * ℹ️ รอบที่ 280 (มติ D30): **`slug` กลายเป็นค่าที่แก้ได้** — พร้อมบันทึกประวัติและทำ 301
 *    (เดิมมติ D25 ข้อ 1 ล็อก slug ถาวร) ⇒ ฟิลด์ `slug` เป็น **ทางเลือก**: ไม่ส่ง = ไม่แตะที่อยู่เดิม
 */
export type CategoryEditFields = {
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly sortOrder: number;
  /**
   * ที่อยู่บนเว็บใหม่ — ไม่ส่ง (`undefined`) = **ไม่แตะ slug เดิม**
   * ⚠️ ค่าที่ส่งต้องผ่าน `categorySlugIssue()` (ผู้เรียกต้องตัด slug ของตัวเองออกจาก `existing` ก่อน)
   */
  readonly slug?: string;
};

/**
 * ตรวจค่าที่แก้ของหมวดก่อนเขียนลงฐานข้อมูล (ใช้ทั้งตอนแก้และตอนสร้าง)
 *
 * @param context `existingSlugs` = slug ของหมวด **อื่น** ที่มีอยู่แล้ว (ใช้ตรวจ slug ซ้ำ)
 *   · ไม่ส่งมา = ไม่ตรวจ slug (ผู้เรียกที่ไม่รองรับการแก้ slug)
 */
export function validateCategoryEdit(
  input: CategoryEditFields,
  context?: { readonly existingSlugs: readonly string[] },
): readonly CategoryIssue[] {
  const issues: CategoryIssue[] = [];
  if (input.nameTh.length > MAX_CATEGORY_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameTh", message: `ชื่อหมวดไทยยาวเกิน ${MAX_CATEGORY_NAME_LENGTH} ตัวอักษร` });
  }
  if (input.nameEn.length > MAX_CATEGORY_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameEn", message: `ชื่อหมวดอังกฤษยาวเกิน ${MAX_CATEGORY_NAME_LENGTH} ตัวอักษร` });
  }
  if (input.descriptionTh.length > MAX_CATEGORY_TEXT_LENGTH) {
    issues.push({ code: "too-long", path: "descriptionTh", message: `คำอธิบายไทยยาวเกิน ${MAX_CATEGORY_TEXT_LENGTH} ตัวอักษร` });
  }
  if (input.descriptionEn.length > MAX_CATEGORY_TEXT_LENGTH) {
    issues.push({ code: "too-long", path: "descriptionEn", message: `คำอธิบายอังกฤษยาวเกิน ${MAX_CATEGORY_TEXT_LENGTH} ตัวอักษร` });
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    issues.push({ code: "bad-order", path: "sortOrder", message: "ลำดับต้องเป็นจำนวนเต็ม ≥ 0" });
  }
  if (input.slug !== undefined && context !== undefined) {
    const slugIssue = categorySlugIssue(input.slug, context.existingSlugs);
    if (slugIssue !== null) {
      issues.push({
        code: `slug-${slugIssue}`,
        path: "slug",
        message:
          slugIssue === "empty"
            ? "ที่อยู่บนเว็บ (slug) ห้ามว่าง"
            : slugIssue === "duplicate"
              ? `มีหมวดอื่นใช้ที่อยู่ \"${input.slug}\" อยู่แล้ว`
              : slugIssue === "reserved"
                ? `คำว่า \"${input.slug}\" สงวนไว้สำหรับเส้นทางอื่นของเว็บ`
                : `ที่อยู่บนเว็บไม่ถูกต้อง (\"${input.slug}\")`,
      });
    }
  }
  return issues;
}

/**
 * ค่าที่ผู้ใช้กรอกในช่อง slug → ค่าที่จะเขียนจริง
 * - ตัดช่องว่าง + ตัวพิมพ์เล็ก (ผู้ใช้วางลิงก์/พิมพ์ตัวใหญ่ได้ ไม่ควรพัง)
 * - คืน `undefined` = **ไม่แตะที่อยู่เดิม** (ช่องว่าง)
 * ⚠️ ไม่ได้ตรวจความถูกต้อง — ผู้เรียกต้องส่งผ่าน `validateCategoryEdit` ก่อน
 */
export function categorySlugInput(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return normalized === "" ? undefined : normalized;
}

/** เปลี่ยน slug จริงไหม (ที่อยู่เดิม = ค่าที่มีผลอยู่ · ที่อยู่ใหม่ = ค่าที่จะเขียน) */
export function isCategorySlugChange(currentSlug: string, nextSlug: string | undefined): boolean {
  if (nextSlug === undefined) return false;
  return nextSlug !== currentSlug.trim().toLowerCase();
}

/**
 * ปลายทางของคำขอ `/products/<requested>` (รอบที่ 280 · มติ D30 · ขยายรอบที่ 286)
 * - `slug` = เด้งไปที่อยู่ปัจจุบันของหมวดนั้น (`308` permanent)
 * - `index` = ที่อยู่นี้ "เคยมีแต่หมวดถูกลบแล้ว" ⇒ เด้งไปหน้าเลือกหมวด `/products` (ไม่ตายทาง)
 *   (มติเจ้าของ 2026-10-15 · ปิดหนี้ D-280-3)
 */
export type CategoryRedirect = {
  readonly kind: "slug" | "index";
  /** slug ปลายทาง — มีค่าเฉพาะ `kind = "slug"` */
  readonly slug: string;
};

/**
 * ตัดสินว่าคำขอ `/products/<requested>` ต้องเด้งไปไหนไหม
 *
 * @param current หมวดที่เจอด้วยที่อยู่ปัจจุบันหรือรหัสภายใน (`null` = ไม่เจอ)
 * @param moved หมวดที่เจอจากประวัติที่อยู่ (`null` = ที่อยู่นี้ไม่เคยมี/ไม่มีหมวดแล้ว)
 * @param retired ที่อยู่นี้เคยเป็นของหมวดที่ **ถูกลบไปแล้ว** (ประวัติยังอยู่ · `category_id = null`)
 * @returns ปลายทาง · `null` = ไม่ต้องเด้ง (แสดงหน้านี้ต่อ หรือปล่อยให้ผู้เรียก 404)
 *
 * กติกา
 * - เจอหมวดแต่ที่อยู่ที่ขอ **ไม่ใช่ที่อยู่ปัจจุบัน** (เช่นลิงก์เก่าที่ชี้ `id`) ⇒ เด้งไปที่อยู่ปัจจุบัน
 * - หมวดที่ **ถูกซ่อน** = ไม่เด้ง (ปล่อยให้ 404 — ไม่บอกใบ้ว่ามีอยู่)
 * - เจอได้แค่จากประวัติ ⇒ เด้งไปที่อยู่ปัจจุบันของหมวดนั้น (นี่คือหัวใจของ 301)
 * - ประวัติที่ **ปลดระวางแล้ว** (หมวดถูกลบ) ⇒ เด้งไปหน้า `/products` (ไม่ปล่อยเป็น 404 เงียบ ๆ)
 *   ⚠️ เช็ค `current`/`moved` ก่อนเสมอ — ที่อยู่ที่ถูกหมวดใหม่ "ยึดคืน" แล้วต้องเปิดหมวดใหม่ ไม่ใช่เด้งไป index
 */
export function categoryRedirectTarget(options: {
  readonly requested: string;
  readonly current: { readonly slug: string; readonly isHidden: boolean } | null;
  readonly moved: { readonly slug: string; readonly isHidden: boolean } | null;
  readonly retired: boolean;
}): CategoryRedirect | null {
  const requested = options.requested.trim();
  if (options.current !== null) {
    if (options.current.isHidden) return null;
    const slug = options.current.slug.trim();
    return slug === "" || slug === requested ? null : { kind: "slug", slug };
  }
  if (options.moved !== null) {
    if (options.moved.isHidden) return null;
    const slug = options.moved.slug.trim();
    return slug === "" || slug === requested ? null : { kind: "slug", slug };
  }
  return options.retired ? { kind: "index", slug: "" } : null;
}

/**
 * ลบหมวดนี้ได้ไหม (มติ D30 ข้อ 4) — **ประตูจริงอยู่ที่ SQL** (`deleteEmptyCategoryAdmin`)
 * เงื่อนไข 2 ข้อ
 * 1. **ไม่มีสินค้าเลย** (`productCount === 0`) — หมวดที่มีสินค้าใช้ "ซ่อนจากเว็บ" เท่านั้น
 * 2. **ไม่ใช่หมวดในโค้ด 6 ใบ** — หมวดเหล่านั้นมีแถวในตาราง `page`/หน้าตัวสร้าง/เทมเพลตผูกอยู่
 *    ⇒ ลบแล้วโครงเว็บหลักพัง (ใช้ "ซ่อน" แทน)
 */
export function categoryDeletionAllowed(input: {
  readonly builtIn: boolean;
  readonly productCount: number;
}): boolean {
  return !input.builtIn && input.productCount === 0;
}

/** เทียบลำดับของหมวด 2 รายการ — `sort_order` → ลำดับในโค้ด → id (นิ่งทุกครั้ง) */
function compareCategoryOrder(aId: string, aOrder: number, bId: string, bOrder: number): number {
  if (aOrder !== bOrder) return aOrder - bOrder;
  const indexA = builtInCategoryIndex(aId);
  const indexB = builtInCategoryIndex(bId);
  const rankA = indexA < 0 ? Number.MAX_SAFE_INTEGER : indexA;
  const rankB = indexB < 0 ? Number.MAX_SAFE_INTEGER : indexB;
  if (rankA !== rankB) return rankA - rankB;
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

/**
 * เรียงหมวด: `sort_order` → ลำดับในโค้ด (หมวดในโค้ดมาก่อนหมวดที่สร้างใหม่) → ชื่อ id
 * ⚠️ ลำดับต้อง **นิ่ง** (ผลเท่าเดิมทุกครั้งที่ input เท่าเดิม) เพื่อให้หน้าจอ/หน้าเว็บไม่สลับไปมา
 */
export function sortCategoryRows<T extends SortableCategory>(rows: readonly T[]): readonly T[] {
  return [...rows].sort((a, b) => compareCategoryOrder(a.id, a.sortOrder, b.id, b.sortOrder));
}

/** ลำดับถัดไปที่ระบบจะให้หมวดใหม่ (ต่อท้ายของเดิมเสมอ) */
export function nextCategorySortOrder(rows: readonly SortableCategory[]): number {
  if (rows.length === 0) return NEW_CATEGORY_SORT_BASE;
  const highest = rows.reduce((max, row) => (row.sortOrder > max ? row.sortOrder : max), 0);
  return Math.max(highest + CATEGORY_SORT_STEP, NEW_CATEGORY_SORT_BASE);
}

/* ── หน้าบ้าน: รวม "หมวดในโค้ด" กับ "แถวในฐานข้อมูล" ──────────────────────────────── */

/** ข้อมูลของหมวดในโค้ดที่หน้าบ้านต้องใช้ (ผู้เรียกแปลงจาก `CATALOG_ITEMS` + พจนานุกรมมาให้) */
export type BuiltInCategoryInfo = {
  readonly slug: string;
  /** ชื่อจากพจนานุกรม (ค่าเริ่มต้นที่ล็อกในโค้ด) */
  readonly name: string;
  readonly imageAlt: string;
  /** ไฟล์ภาพใน `public/products/*` */
  readonly imageSrc: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
};

/** แถวหมวดจากฐานข้อมูล (ค่าที่ผู้ดูแลแก้) */
export type CategoryRow = {
  /** รหัสภายใน (ไม่เปลี่ยน) */
  readonly id: string;
  /** ที่อยู่บนเว็บ `/products/<slug>` (แก้ได้) */
  readonly slug: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly logoPath: string | null;
  readonly logoWidth: number | null;
  readonly logoHeight: number | null;
  readonly productCount: number;
  readonly sortOrder: number;
  readonly isHidden: boolean;
};

/** หมวด 1 รายการที่หน้าบ้านใช้แสดง (การ์ด/หน้ารายละเอียด) — ค่าที่ "มีผลจริง" แล้ว */
export type SiteCategory = {
  /** รหัสภายใน (`product_category.id`) — ใช้หาสินค้า/พจนานุกรม · **ห้ามใช้เป็น URL** */
  readonly id: string;
  /** ที่อยู่บนเว็บ `/products/<slug>` */
  readonly slug: string;
  /** true = หมวดในโค้ด (ค่าเริ่มต้นแก้ไม่ได้) */
  readonly builtIn: boolean;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** โลโก้การ์ด: คลังภาพ → ถอยไฟล์ใน `public/` */
  readonly logoSrc: string;
  readonly logoWidth: number;
  readonly logoHeight: number;
  /** ภาพหัวหมวด (หน้ารายละเอียด): คลังภาพ → ถอยไฟล์ใน `public/` */
  readonly imageSrc: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageAlt: string;
  readonly productCount: number;
  readonly sortOrder: number;
};

function pickText(th: string, en: string, language: "th" | "en"): string {
  const english = en.trim();
  if (language === "en" && english !== "") return english;
  return th.trim() === "" ? english : th.trim();
}

/** ขนาดภาพต้องเป็นจำนวนเต็ม > 0 — ค่าที่อ่านไม่ได้/เป็น 0 ใช้ค่าสำรอง (กัน `next/image` พัง) */
function size(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * รวมหมวดหน้าบ้าน = **หมวดในโค้ด (เสมอ) + แถวในฐานข้อมูล (ทับค่า) + หมวดที่สร้างใหม่**
 *
 * กติกา
 * - หมวดในโค้ดที่ไม่มีแถวใน DB = ยังใช้ค่าในโค้ด (หน้าเว็บไม่มีอะไรเปลี่ยนโดยไม่ตั้งใจ)
 * - แถวที่ `isHidden` = **ไม่ขึ้นเว็บ** (มติ D25 ข้อ 3 — "ซ่อน" แทน "ลบ")
 * - หมวดที่สร้างใหม่ (ไม่อยู่ในโค้ด) ต้องมี **ชื่อไทย** จึงแสดง (ไม่มีชื่อ = ข้าม ไม่ทำให้หน้าพัง)
 * - ภาพ: ใช้ `logoPath`/`imagePath` จากคลังภาพ (DB) ก่อน → ถอยไฟล์ใน `public/` (เฉพาะหมวดในโค้ด)
 * - ชื่อ/คำอธิบาย: DB → ถอยพจนานุกรม (เฉพาะหมวดในโค้ด) — ผู้เรียกเลือกภาษาด้วย `language`
 * - **ที่อยู่ (`slug`)**: แถว DB มาก่อน → ไม่มีก็ใช้ `id` (รอบที่ 280) · **จับคู่กับหมวดในโค้ดด้วย `id`** เสมอ
 *   (⚠️ ห้ามจับคู่ด้วย slug — เจ้าของเปลี่ยน slug ได้ แล้วการ์ดจะหลุดจากพจนานุกรม)
 */
export function mergeSiteCategories(
  builtIn: readonly BuiltInCategoryInfo[],
  rows: readonly CategoryRow[],
  language: "th" | "en",
): readonly SiteCategory[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const merged: SiteCategory[] = [];

  for (const item of builtIn) {
    const row = rowById.get(item.slug);
    if (row !== undefined && row.isHidden) continue;

    const nameTh = row !== undefined && row.nameTh.trim() !== "" ? row.nameTh.trim() : item.name;
    const nameEn = row?.nameEn.trim() ?? "";
    const logo = row?.logoPath ?? null;

    merged.push({
      id: item.slug,
      slug: row?.slug.trim() !== "" && row?.slug !== undefined ? row.slug.trim() : item.slug,
      builtIn: true,
      nameTh,
      nameEn,
      descriptionTh: row?.descriptionTh ?? "",
      descriptionEn: row?.descriptionEn ?? "",
      logoSrc: logo ?? item.imageSrc,
      logoWidth: (logo === null ? null : row?.logoWidth ?? null) ?? item.imageWidth,
      logoHeight: (logo === null ? null : row?.logoHeight ?? null) ?? item.imageHeight,
      imageSrc: row?.imagePath ?? item.imageSrc,
      imageWidth: (row?.imagePath === null || row?.imagePath === undefined ? null : row.imageWidth) ?? item.imageWidth,
      imageHeight: (row?.imagePath === null || row?.imagePath === undefined ? null : row.imageHeight) ?? item.imageHeight,
      imageAlt: item.imageAlt,
      productCount: row?.productCount ?? 0,
      sortOrder: row?.sortOrder ?? defaultSortOrderOf(item.slug),
    });
  }

  for (const row of rows) {
    if (isBuiltInCategorySlug(row.id)) continue;
    if (row.isHidden) continue;
    const nameTh = row.nameTh.trim();
    if (nameTh === "") continue;
    const nameEn = row.nameEn.trim();
    const displayName = nameEn !== "" && language === "en" ? nameEn : nameTh;
    const logoSrc = row.logoPath ?? row.imagePath ?? "";
    if (logoSrc === "") continue; // ไม่มีการ์ดที่ไม่มีภาพ (กันการ์ดว่างบนหน้าเว็บ)

    merged.push({
      id: row.id,
      slug: row.slug.trim() !== "" ? row.slug.trim() : row.id,
      builtIn: false,
      nameTh,
      nameEn,
      descriptionTh: row.descriptionTh,
      descriptionEn: row.descriptionEn,
      logoSrc,
      logoWidth: size(row.logoPath === null ? row.imageWidth : row.logoWidth, FALLBACK_CATEGORY_IMAGE_WIDTH),
      logoHeight: size(row.logoPath === null ? row.imageHeight : row.logoHeight, FALLBACK_CATEGORY_IMAGE_HEIGHT),
      imageSrc: row.imagePath ?? logoSrc,
      imageWidth: size(row.imagePath === null ? row.logoWidth : row.imageWidth, FALLBACK_CATEGORY_IMAGE_WIDTH),
      imageHeight: size(row.imagePath === null ? row.logoHeight : row.imageHeight, FALLBACK_CATEGORY_IMAGE_HEIGHT),
      imageAlt: displayName,
      productCount: row.productCount,
      sortOrder: row.sortOrder,
    });
  }

  /* ⚠️ เรียงด้วย **id ภายใน** (ไม่ใช่ slug) — ลำดับต้องไม่เปลี่ยนตามที่อยู่บนเว็บ */
  return [...merged].sort((a, b) => compareCategoryOrder(a.id, a.sortOrder, b.id, b.sortOrder));
}

/** ข้อความตามภาษาของหมวดที่รวมแล้ว (ใช้ทั้งหน้าแรกและหน้า `/products/<slug>`) */
export function siteCategoryName(category: SiteCategory, language: "th" | "en"): string {
  return language === "en" && category.nameEn.trim() !== "" ? category.nameEn.trim() : category.nameTh;
}

export function siteCategoryDescription(category: SiteCategory, language: "th" | "en"): string {
  return pickText(category.descriptionTh, category.descriptionEn, language);
}

/* ── ค่าเริ่มต้นถาวร (มติ D25 ข้อ 4) ─────────────────────────────────────────── */

/** ค่าของหมวด 1 แถวในรูปแบบที่บันทึก/คืนค่าได้ (ใช้ทั้งค่าเริ่มต้นและพรีเซ็ต) */
export type CategorySnapshot = {
  readonly id: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly imageMediaId: string | null;
  readonly logoMediaId: string | null;
  readonly sortOrder: number;
  readonly isHidden: boolean;
};

export type CategoryDefaultRecord = CategorySnapshot & {
  readonly capturedAt: string;
  readonly capturedBy: string;
};

/**
 * เลือก "ค่าเริ่มต้นที่ต้องเขียนกลับ" ของหมวดหนึ่ง
 * - ไม่มีแถวค่าเริ่มต้น (หมวดที่สร้างใหม่) ⇒ คืน `null` = **ไม่มีอะไรให้คืน** (ผู้เรียกต้องบอกผู้ใช้ตรง ๆ)
 * - ⚠️ คืนค่าทั้งชุดรวม `isHidden: false` ⇒ กดคืนค่าเริ่มต้น = หมวดกลับมาแสดงบนเว็บ (พฤติกรรมที่ผู้ใช้คาดหวัง)
 */
export function categoryRestoreFields(record: CategoryDefaultRecord | null): CategorySnapshot | null {
  if (record === null) return null;
  return {
    id: record.id,
    nameTh: record.nameTh,
    nameEn: record.nameEn,
    descriptionTh: record.descriptionTh,
    descriptionEn: record.descriptionEn,
    imageMediaId: record.imageMediaId,
    logoMediaId: record.logoMediaId,
    sortOrder: record.sortOrder,
    isHidden: false,
  };
}

/* ── พรีเซ็ต (มติ D25 ข้อ 5) ────────────────────────────────────────────────── */

export type CategoryPresetPayload = {
  /** เวอร์ชันของรูปแบบไฟล์ — กันไฟล์เก่า/ใหม่ปนกันโดยไม่รู้ตัว */
  readonly version: 1;
  readonly categories: readonly CategorySnapshot[];
};

export const CATEGORY_PRESET_VERSION = 1 as const;

/** เพดานจำนวนชุดในพรีเซ็ต — กันไฟล์นำเข้าที่ใหญ่ผิดปกติ (พรีเซ็ตในระบบไม่จำกัดจำนวนชุด) */
export const MAX_CATEGORIES_PER_PRESET = MAX_PRODUCT_CATEGORIES;

export function categoryPresetPayload(categories: readonly CategorySnapshot[]): CategoryPresetPayload {
  return { version: CATEGORY_PRESET_VERSION, categories: [...categories] };
}

export function serializeCategoryPreset(payload: CategoryPresetPayload): string {
  return JSON.stringify({ version: payload.version, categories: payload.categories }, null, 2);
}

function readSnapshotText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > maxLength ? null : text;
}

function readSnapshotId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return categorySlugIssue(id) === null ? id : null;
}

/**
 * อ่านไฟล์พรีเซ็ต (JSON) — **ไม่เชื่อไฟล์** (นำเข้าจากเครื่องอื่นได้)
 * คืน `null` = ไฟล์ใช้ไม่ได้ · แถวที่เสียถูก **ข้าม** (ผู้เรียกบอกจำนวนที่ข้ามให้ผู้ใช้รู้)
 */
export function parseCategoryPreset(text: string): { readonly payload: CategoryPresetPayload; readonly skipped: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (record["version"] !== CATEGORY_PRESET_VERSION) return null;
  const raw = record["categories"];
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_CATEGORIES_PER_PRESET) return null;

  const categories: CategorySnapshot[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      skipped += 1;
      continue;
    }
    const row = entry as Record<string, unknown>;
    const id = readSnapshotId(row["id"]);
    const nameTh = readSnapshotText(row["nameTh"], MAX_CATEGORY_NAME_LENGTH);
    const nameEn = readSnapshotText(row["nameEn"], MAX_CATEGORY_NAME_LENGTH);
    const descriptionTh = readSnapshotText(row["descriptionTh"], MAX_CATEGORY_TEXT_LENGTH);
    const descriptionEn = readSnapshotText(row["descriptionEn"], MAX_CATEGORY_TEXT_LENGTH);
    if (id === null || nameTh === null || nameEn === null || descriptionTh === null || descriptionEn === null || seen.has(id)) {
      skipped += 1;
      continue;
    }
    const sortOrder = typeof row["sortOrder"] === "number" && Number.isInteger(row["sortOrder"]) && row["sortOrder"] >= 0
      ? row["sortOrder"]
      : NEW_CATEGORY_SORT_BASE;
    seen.add(id);
    categories.push({
      id,
      nameTh,
      nameEn,
      descriptionTh,
      descriptionEn,
      imageMediaId: typeof row["imageMediaId"] === "string" && row["imageMediaId"].trim() !== "" ? row["imageMediaId"].trim() : null,
      logoMediaId: typeof row["logoMediaId"] === "string" && row["logoMediaId"].trim() !== "" ? row["logoMediaId"].trim() : null,
      sortOrder,
      isHidden: row["isHidden"] === true,
    });
  }

  return { payload: { version: CATEGORY_PRESET_VERSION, categories }, skipped };
}

/**
 * แผนการใช้พรีเซ็ต — **ไม่ลบหมวดที่ไม่มีในพรีเซ็ต** (ตั้งใจ: กดใช้ชุดต้องไม่ทำให้ข้อมูลหาย)
 * ⇒ คืนเฉพาะรายการที่ "มีอยู่ในทั้งสองฝั่ง" และบอกจำนวนที่ถูกข้าม
 */
export function categoryPresetApplyPlan(
  payload: CategoryPresetPayload,
  existingIds: readonly string[],
): { readonly apply: readonly CategorySnapshot[]; readonly skipped: readonly string[] } {
  const existing = new Set(existingIds);
  const apply: CategorySnapshot[] = [];
  const skipped: string[] = [];
  for (const item of payload.categories) {
    if (existing.has(item.id)) apply.push(item);
    else skipped.push(item.id);
  }
  return { apply, skipped };
}

/** สรุปจำนวนหมวดที่พรีเซ็ตมีผลจริง (ไว้แสดงในหน้าจอก่อนกดใช้) */
export function categoryPresetPreview(payload: CategoryPresetPayload, existingIds: readonly string[]): string {
  const { apply, skipped } = categoryPresetApplyPlan(payload, existingIds);
  return `${apply.length}/${payload.categories.length}${skipped.length > 0 ? ` (ข้าม ${skipped.length})` : ""}`;
}
