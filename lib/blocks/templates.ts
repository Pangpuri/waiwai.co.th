import { buildAboutTemplate } from "@/lib/blocks/about-template";
import { buildCareersTemplate } from "@/lib/blocks/careers-template";
import { buildCertificationsTemplate } from "@/lib/blocks/certifications-template";
import { buildContactTemplate } from "@/lib/blocks/contact-template";
import { buildExecutivesTemplate } from "@/lib/blocks/executives-template";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { buildNewsTemplate } from "@/lib/blocks/news-template";
import { buildProductsTemplate } from "@/lib/blocks/products-template";
import { buildRecipesTemplate } from "@/lib/blocks/recipes-template";
import type { BlockDocument } from "@/lib/blocks/types";

/**
 * ทะเบียนเทมเพลตบล็อกของแต่ละหน้า (S2) — **แหล่งความจริงเดียว**
 *
 * ทำไมต้องมีทะเบียน
 * - ก่อนหน้านี้มีเทมเพลตแค่ `buildHomeTemplate()` และปุ่ม "เริ่มจากเทมเพลต" ทำงานได้กับ `home` เท่านั้น
 *   (หน้าอื่นกดแล้วเด้งกลับ) ⇒ เพิ่มหน้าใหม่ทีต้องแก้ 3 ที่ (ปุ่ม · พรีวิว · ลิงก์พรีวิว)
 * - ตอนนี้ทุกอย่างอ่านจากที่นี่: ปุ่มในหลังบ้าน · รายการหน้าที่พรีวิวได้ · ตัวเลือกในหน้าลิงก์พรีวิว · คำเตือน "ส่วนที่ไม่ครอบคลุม"
 *
 * กติกา
 * - เทมเพลตทุกตัว **ต้องผ่าน parser + validator** (มีเทสต์บังคับ — `scripts/test-templates.ts`)
 * - `page` ในเอกสารต้องตรงกับ id ของหน้าที่ขอ (กันเทมเพลตสลับหน้า)
 * - หน้าที่ไม่มีเทมเพลต = ยังใช้เลย์เอาต์ที่ออกแบบไว้ + หน้าจอเนื้อหาแบบฟิลด์เดิม (ไม่ใช่ข้อผิดพลาด)
 */

export const BLOCK_TEMPLATE_PAGE_IDS = [
  "home",
  "about",
  "careers",
  "contact",
  "products",
  "recipes",
  "news",
  "certifications",
  "executives",
] as const;

export type BlockTemplatePageId = (typeof BLOCK_TEMPLATE_PAGE_IDS)[number];

const TEMPLATE_BUILDERS: Readonly<Record<BlockTemplatePageId, () => BlockDocument>> = {
  home: buildHomeTemplate,
  about: buildAboutTemplate,
  careers: buildCareersTemplate,
  contact: buildContactTemplate,
  products: buildProductsTemplate,
  recipes: buildRecipesTemplate,
  news: buildNewsTemplate,
  certifications: buildCertificationsTemplate,
  executives: buildExecutivesTemplate,
};

/**
 * "ส่วนที่เทมเพลตไม่ครอบคลุม" — รหัสกลาง (ข้อความจริงอยู่ในพจนานุกรมทั้งสองภาษา)
 *
 * ทำไมต้องประกาศไว้: ถ้าเปิดสวิตช์ "ใช้กับหน้าเว็บจริง" หน้าเว็บจะแสดง **เฉพาะบล็อก**
 * ⇒ ส่วนที่เทมเพลตไม่มี (เช่น ฟอร์มติดต่อ · แผนที่ · ตารางตำแหน่งงาน) จะหายจากหน้านั้น
 *    ผู้ใช้ต้องเห็นคำเตือนนี้ **ก่อน** กดสวิตช์ ไม่ใช่รู้ทีหลัง
 */
export const BLOCK_COVERAGE_PART_IDS = [
  "gallery",
  "lightbox",
  "form",
  "map",
  "jobBoard",
  "sampleData",
  "rosterText",
] as const;

export type BlockCoveragePartId = (typeof BLOCK_COVERAGE_PART_IDS)[number];

const COVERAGE: Readonly<Record<BlockTemplatePageId, readonly BlockCoveragePartId[]>> = {
  home: [],
  about: ["gallery"],
  careers: ["jobBoard", "form"],
  contact: ["form", "map"],
  products: ["gallery"],
  recipes: ["sampleData"],
  news: ["sampleData"],
  certifications: ["gallery", "lightbox"],
  executives: ["rosterText", "gallery"],
};

/** หน้านี้มีเทมเพลตบล็อกให้เริ่มได้ไหม */
export function hasBlockTemplate(page: string): page is BlockTemplatePageId {
  return (BLOCK_TEMPLATE_PAGE_IDS as readonly string[]).includes(page);
}

/**
 * สร้างเทมเพลตของหน้านั้น (คืน `null` ถ้ายังไม่มีเทมเพลต)
 * ⚠️ เอกสารที่ได้ยัง **ไม่ผ่านการ parse** — ผู้เรียกต้องส่งเข้า `parseBlockDocument` ก่อนเขียนลงฐานข้อมูล
 */
export function buildBlockTemplate(page: string): BlockDocument | null {
  if (!hasBlockTemplate(page)) return null;
  return TEMPLATE_BUILDERS[page]();
}

/** รหัสของส่วนที่เทมเพลตของหน้านั้นไม่ครอบคลุม (หน้านอกทะเบียน = ไม่มีข้อมูล) */
export function blockCoverageGaps(page: string): readonly BlockCoveragePartId[] {
  return hasBlockTemplate(page) ? COVERAGE[page] : [];
}
