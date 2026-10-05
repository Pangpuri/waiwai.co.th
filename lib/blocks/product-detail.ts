/**
 * ทะเบียน "หน้ารายละเอียดหมวดสินค้า" (S3 ส่วนที่ 2 · รอบที่ 102) — ตรรกะล้วน ทดสอบได้
 *
 * ทำไมต้องมีไฟล์นี้
 * - 6 หมวดของ `/products` มีหน้ารายละเอียดของตัวเอง (`/products/<slug>`) และรอบที่ 102
 *   ทำให้ **แก้ด้วยบล็อกจากหลังบ้านได้** ⇒ ต้องมี "id ของหน้า" ที่ไม่ชนกับหน้าเมนู 9 หน้า
 * - เดิม id ของหน้าเป็นคีย์ของ `page` / `page_document` และพาธจริงอยู่ใน `lib/pages/paths.ts`
 *   ⇒ รวมความสัมพันธ์ id ↔ slug ↔ path ไว้ที่เดียว ไม่ให้แต่ละที่ประกอบสตริงเอง
 *
 * กติกา
 * - **id = `product-<slug>`** (มีขีดกลาง ไม่มี `/`) เพราะเส้นทางหลังบ้าน `/admin/builder/[page]`
 *   รับได้ทีละส่วน และ slug ของหมวดไม่มี `/` อยู่แล้ว
 * - รายการ id เป็น **ค่าคงที่แบบ literal** (ไม่ใช่ `string[]`) ⇒ ใช้เป็นคีย์ของ `Record<>` ได้
 *   และมีเทสต์บังคับว่า **ตรงกับ `CATALOG_ITEMS` เป๊ะ** (กันลืมเพิ่ม/ลบหมวดแล้วทะเบียนหลุด)
 *   — เจ้าของเลือกล็อก 6 หมวด (มติ Q-D 2026-10-05) ⇒ ไม่มีหน้า dynamic ในรอบนี้
 */

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

export function isProductDetailPageId(value: string): value is ProductDetailPageId {
  return (PRODUCT_DETAIL_PAGE_IDS as readonly string[]).includes(value);
}

/** id ของหน้าจาก slug หมวด (เช่น `instant-noodles` → `product-instant-noodles`) */
export function productDetailPageId(slug: string): string {
  return `${PAGE_ID_PREFIX}${slug}`;
}

/** slug ของหมวดจาก id ของหน้า (คืน null ถ้าไม่ใช่หน้า detail) */
export function productDetailSlugOfPageId(pageId: string): string | null {
  if (!isProductDetailPageId(pageId)) return null;
  return pageId.slice(PAGE_ID_PREFIX.length);
}

/** พาธจริงของหน้า detail จาก id ที่ **รู้จักแล้ว** (ไม่มีทางคืน null — ใช้ตอนสร้างทะเบียนพาธ) */
export function productDetailPathOfId(pageId: ProductDetailPageId): string {
  return `/products/${pageId.slice(PAGE_ID_PREFIX.length)}`;
}

/** พาธจริงบนเว็บจาก id ของหน้า (คืน null ถ้าไม่ใช่หน้า detail — ใช้กับค่าที่มาจากผู้ใช้) */
export function productDetailPathOfPageId(pageId: string): string | null {
  const slug = productDetailSlugOfPageId(pageId);
  return slug === null ? null : `/products/${slug}`;
}
