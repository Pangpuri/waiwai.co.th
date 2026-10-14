/**
 * ทะเบียน "หน้ารายละเอียดหมวดสินค้า" (S3 ส่วนที่ 2 · รอบที่ 102) — ตรรกะล้วน ทดสอบได้
 *
 * ทำไมต้องมีไฟล์นี้
 * - 6 หมวดของ `/products` มีหน้ารายละเอียดของตัวเอง (`/products/<slug>`) และรอบที่ 102
 *   ทำให้ **แก้ด้วยบล็อกจากหลังบ้านได้** ⇒ ต้องมี "id ของหน้า" ที่ไม่ชนกับหน้าเมนู 9 หน้า
 * - เดิม id ของหน้าเป็นคีย์ของ `page` / `page_document` และพาธจริงอยู่ใน `lib/pages/paths.ts`
 *   ⇒ รวมความสัมพันธ์ id ↔ หมวด ↔ path ไว้ที่เดียว ไม่ให้แต่ละที่ประกอบสตริงเอง
 *
 * ## กติกา (สำคัญ — อ่านก่อนแก้)
 * - **id ของหน้า = `product-<รหัสภายในของหมวด>`** (`product_category.id` · ไม่มี `/`)
 *   เพราะเส้นทางหลังบ้าน `/admin/builder/[page]` รับได้ทีละส่วน
 * - ⚠️ รอบที่ 280/281: **`id` ของหมวด ≠ `slug` (ที่อยู่บนเว็บ) อีกต่อไปแล้ว**
 *   เจ้าของเปลี่ยน slug ได้ ⇒ **id ของหน้าต้องอ้างรหัสภายใน** (ไม่ใช่ slug)
 *   ไม่งั้นเปลี่ยนที่อยู่แล้วเอกสารบล็อก/ประวัติของหน้าจะหลุดจากกัน
 * - `PRODUCT_DETAIL_PAGE_IDS` (ค่าคงที่ด้านล่าง) = **หมวดในโค้ด 6 ใบ** ใช้เป็น baseline:
 *   มีพาธใน `PAGE_PATHS` · มีเทมเพลตตั้งต้น · เทสต์ใช้ไล่ตรวจ
 * - **หมวดที่สร้างใหม่จากหลังบ้าน** (รอบที่ 281 · ปิดหนี้ D-280-1) ก็ได้ id หน้าแบบเดียวกัน
 *   ⇒ ใช้ `productDetailPageId()` / `productDetailCategoryIdOfPageId()` ตัวเดียวกัน
 *   ❗ **ห้ามเช็คกับรายการคงที่นี้เพื่อตัดสินว่า "เป็นหน้า detail ไหม"** ให้ใช้ `isProductDetailPageLike()`
 */

/** หมวดในโค้ด (baseline) — มีพาธคงที่ + เทมเพลตตั้งต้น */
export const PRODUCT_DETAIL_PAGE_IDS = [
  "product-instant-noodles",
  "product-dried-vermicelli",
  "product-serda",
  "product-quick-zabb",
  "product-noodie",
  "product-rod-ded",
] as const;

export type ProductDetailPageId = (typeof PRODUCT_DETAIL_PAGE_IDS)[number];

/** คำนำหน้าของ id หน้า detail — ใช้ทั้งสร้างและถอดกลับ */
const PAGE_ID_PREFIX = "product-";

/** id ของหน้าจาก **รหัสภายใน** ของหมวด (เช่น `instant-noodles` → `product-instant-noodles`) */
export function productDetailPageId(categoryId: string): string {
  return `${PAGE_ID_PREFIX}${categoryId}`;
}

/**
 * **รหัสภายในของหมวด** จาก id ของหน้า detail — รับได้ **ทุกหมวด** (ไม่จำกัด 6 ใบในโค้ด)
 * คืน `null` = ไม่ใช่รูปทรงของหน้า detail (เช่น `home` · `privacy` · `product-` เปล่า ๆ)
 * ⚠️ ตรรกะล้วน — **ไม่ตรวจว่าหมวดนั้นมีจริงในฐานข้อมูล** (ผู้เรียกต้องเช็คเองถ้าจำเป็น)
 */
export function productDetailCategoryIdOfPageId(pageId: string): string | null {
  if (!pageId.startsWith(PAGE_ID_PREFIX)) return null;
  const categoryId = pageId.slice(PAGE_ID_PREFIX.length).trim();
  if (categoryId === "" || categoryId.includes("/")) return null;
  return categoryId;
}

/** หน้านี้เป็น "หน้ารายละเอียดหมวดสินค้า" ไหม (ตามรูปทรงของ id — รวมหมวดที่สร้างใหม่) */
export function isProductDetailPageLike(pageId: string): boolean {
  return productDetailCategoryIdOfPageId(pageId) !== null;
}

/** หน้านี้เป็นหน้า detail ของ **หมวดในโค้ด** ไหม (ใช้กับการไล่เทมเพลต/พาธคงที่) */
export function isProductDetailPageId(value: string): value is ProductDetailPageId {
  return (PRODUCT_DETAIL_PAGE_IDS as readonly string[]).includes(value);
}

/** รหัสหมวดจาก id ของหน้า detail ของ **หมวดในโค้ด** (คืน null ถ้าไม่อยู่ในทะเบียน) */
export function productDetailSlugOfPageId(pageId: string): string | null {
  if (!isProductDetailPageId(pageId)) return null;
  return pageId.slice(PAGE_ID_PREFIX.length);
}

/** พาธจริงของหน้า detail จาก id ที่ **รู้จักในโค้ด** (ไม่มีทางคืน null — ใช้ตอนสร้างทะเบียนพาธ) */
export function productDetailPathOfId(pageId: ProductDetailPageId): string {
  return `/products/${pageId.slice(PAGE_ID_PREFIX.length)}`;
}

/**
 * พาธจริงบนเว็บจาก id ของหน้า (คืน null ถ้าไม่ใช่หน้า detail — ใช้กับค่าที่มาจากผู้ใช้)
 * ⚠️ ใช้ได้กับ **หมวดในโค้ด** เท่านั้น (id == slug ของหมวดเหล่านั้นตลอด)
 *    หมวดที่สร้างใหม่/เปลี่ยน slug แล้ว ต้องอ่านพาธจริงจากฐานข้อมูล (`listProductDetailPagePaths()`)
 */
export function productDetailPathOfPageId(pageId: string): string | null {
  const slug = productDetailSlugOfPageId(pageId);
  return slug === null ? null : `/products/${slug}`;
}
