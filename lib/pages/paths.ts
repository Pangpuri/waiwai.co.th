import { PRODUCT_DETAIL_PAGE_IDS, productDetailPathOfId } from "@/lib/blocks/product-detail";
import { BLOCK_TEMPLATE_PAGE_IDS } from "@/lib/blocks/templates";

/**
 * ที่อยู่ (path) ของแต่ละหน้า — **ที่เดียว** ที่รู้ว่า id ของหน้าไปอยู่ตรงไหนของเว็บ
 *
 * ใช้ร่วมกัน: sitemap · JSON-LD · ลิงก์ในหลังบ้าน (อนาคต: เมนูอัตโนมัติ)
 * ⚠️ ถ้าเพิ่มหน้าใหม่ ต้องเพิ่มที่ `page` (migration/seed) และที่นี่
 */

/** หน้าเมนูหลัก 9 หน้า (id ตรงกับเมนูในโค้ด) */
const MENU_PAGE_PATHS: Readonly<Record<string, string>> = {
  home: "",
  about: "/about",
  certifications: "/about/certifications",
  executives: "/about/executives",
  products: "/products",
  recipes: "/recipes",
  news: "/news",
  careers: "/careers",
  contact: "/contact",
};

/**
 * หน้ารายละเอียดหมวดสินค้า (S3 ส่วนที่ 2 · รอบที่ 102) — derive จากทะเบียนกลาง
 * ⇒ เพิ่ม/ลบหมวดที่ `lib/blocks/product-detail.ts` แล้วพาธตามมาเอง (ไม่มีสตริงซ้ำให้หลุด)
 * ⚠️ หน้าเหล่านี้ตั้ง `in_menu = false` (migration 0015) ⇒ ไม่ขึ้นเมนู แต่ **ยังขึ้น sitemap ได้**
 *    ผ่าน `MENU_HIDDEN_INDEXABLE_PAGE_IDS` ด้านล่าง (รอบที่ 170 เปิด index แล้ว)
 */
const PRODUCT_DETAIL_PAGE_PATHS: Readonly<Record<string, string>> = Object.fromEntries(
  PRODUCT_DETAIL_PAGE_IDS.map((id) => [id, productDetailPathOfId(id)]),
);

export const PAGE_PATHS: Readonly<Record<string, string>> = {
  ...MENU_PAGE_PATHS,
  ...PRODUCT_DETAIL_PAGE_PATHS,
};

/**
 * หน้าที่ "ห้ามจัดทำดัชนีเสมอ" — ตั้งไว้ในโค้ดของหน้านั้น ๆ (`robots: { index: false }`)
 * ⚠️ ต้องตรงกับ sitemap: หน้าที่ noindex ต้องไม่อยู่ใน sitemap (ไม่งั้นเครื่องค้นหาสับสน)
 * ตอนนี้ **ว่าง** — เดิมมี `/news` (หน้าตัวอย่างรออนุมัติ) แต่ **เปิด index แล้วรอบที่ 173** (มีเนื้อหาจริง 151 ข่าว)
 * ⇒ เก็บทะเบียนนี้ไว้ใช้กับหน้าที่ต้อง noindex ตลอดในอนาคต (มีเทสต์คุมว่าไม่ขัดกับโค้ดจริง)
 */
export const PAGES_ALWAYS_NOINDEX: readonly string[] = [];

/** path ภายในเว็บ (ไม่รวม prefix ภาษา) — หน้าแรกได้ "/" */
export function pathForPage(id: string): string {
  const path = PAGE_PATHS[id];
  return path === undefined || path === "" ? "/" : path;
}

/**
 * หน้าที่ **ซ่อนจากเมนู** (`in_menu = false`) แต่ **ควรให้เครื่องค้นหาจัดทำดัชนี** (รอบที่ 170)
 *
 * ทำไมต้องมีรายการนี้แยกจาก `inMenu`
 * - `inMenu` = "หน้าโผล่ในเมนูหลัก/navbar ไหม" (เรื่องการนำทาง)
 * - sitemap = "อยากให้เครื่องค้นหาเก็บไหม" (เรื่อง SEO) — คนละแกนกัน
 * ⇒ หน้ารายละเอียดหมวดสินค้าไม่ควรอยู่ในเมนู แต่ **ควรอยู่ใน sitemap** (มีข้อมูลสินค้าจริง)
 * ⚠️ หน้าที่ไม่อยู่ในรายการนี้และ `inMenu = false` จะยังถูกตัดออกจาก sitemap เหมือนเดิม
 */
export const MENU_HIDDEN_INDEXABLE_PAGE_IDS: readonly string[] = PRODUCT_DETAIL_PAGE_IDS;

export function isKnownPagePath(id: string): boolean {
  return id in PAGE_PATHS;
}

/**
 * หน้าที่ **เปิดพรีวิวได้** (ทั้งพรีวิวในหลังบ้านและลิงก์พรีวิวชั่วคราว X2.6)
 *
 * ⭐ S2 (รอบที่ 82): รายการนี้ **derive จากทะเบียนเทมเพลตบล็อก** (`lib/blocks/templates.ts`)
 *    เพราะ "พรีวิวได้" = "มีเอกสารบล็อกให้ดู" ⇒ เพิ่มเทมเพลตหน้าใหม่ที่เดียว แล้วพรีวิว/ลิงก์พรีวิวตามมาเอง
 * ⚠️ หน้าที่ไม่มีเทมเพลต = ยังไม่เปิดพรีวิว (จะเห็นหน้าว่าง ไม่มีประโยชน์)
 */
export const PREVIEWABLE_PAGE_IDS: readonly string[] = BLOCK_TEMPLATE_PAGE_IDS;

export function isPreviewablePage(id: string): boolean {
  return PREVIEWABLE_PAGE_IDS.includes(id);
}

/**
 * หน้าที่ "อยู่ในโค้ดล้วน" — **ไม่ใช่แถวในตาราง `page`** เพราะตารางนั้นผูกกับเมนูหลัก 9 รายการ
 * (เพิ่มแถวในตาราง = หน้านั้นโผล่ในเมนู/แท็บหลังบ้านทันที ซึ่งไม่ใช่สิ่งที่ต้องการ)
 *
 * แต่ยังควรให้เครื่องค้นหาจัดทำดัชนี ⇒ `sitemap.xml` ใส่ให้ผ่านรายการนี้
 * ⚠️ หน้าที่นี่ต้องมีอยู่จริงใน `app/[lang]/` ไม่งั้น sitemap จะชี้ไป 404
 *
 * ปัจจุบัน: `/privacy` (นโยบายความเป็นส่วนตัว — X2b · จำเป็นเพราะข้อความยินยอมของทุกฟอร์มอ้างถึงหน้านี้)
 */
export const CODE_ONLY_PAGE_PATHS: readonly {
  readonly id: string;
  readonly path: string;
  readonly priority: number;
}[] = [{ id: "privacy", path: "/privacy", priority: 0.5 }];
