import { buildAboutTemplate } from "@/lib/blocks/about-template";
import { buildCareersTemplate } from "@/lib/blocks/careers-template";
import { buildCertificationsTemplate } from "@/lib/blocks/certifications-template";
import { buildContactTemplate } from "@/lib/blocks/contact-template";
import { buildExecutivesTemplate } from "@/lib/blocks/executives-template";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { buildNewsTemplate } from "@/lib/blocks/news-template";
import { buildProductsTemplate } from "@/lib/blocks/products-template";
import { buildProductDetailTemplate } from "@/lib/blocks/product-detail-template";
import { PRODUCT_DETAIL_PAGE_IDS } from "@/lib/blocks/product-detail";
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

/** หน้าเมนูหลักที่มีเทมเพลต (9 หน้าเดิม — S2 รอบที่ 83) */
const MENU_TEMPLATE_PAGE_IDS = [
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

/**
 * ทะเบียนรวมของ "หน้าที่มีเทมเพลตบล็อก" — หน้าเมนู 9 หน้า + หน้ารายละเอียดหมวดสินค้า 6 หน้า
 * (S3 ส่วนที่ 2 · รอบที่ 102 · มาจาก `PRODUCT_DETAIL_PAGE_IDS` ⇒ ไม่มีทางหลุดจาก `CATALOG_ITEMS`)
 *
 * ⚠️ ลำดับมีเทสต์บังคับ: หน้าเมนูก่อน แล้วต่อด้วยหน้า detail ตามลำดับหมวด
 * ⚠️ `PAGE_PATHS` ต้องมีครบทุก id ในนี้ (มีเทสต์) — ไม่งั้นปุ่ม "เปิดหน้าเว็บ" จะพาไปหน้าแรกแทน
 */
export const BLOCK_TEMPLATE_PAGE_IDS = [...MENU_TEMPLATE_PAGE_IDS, ...PRODUCT_DETAIL_PAGE_IDS] as const;

export type BlockTemplatePageId = (typeof BLOCK_TEMPLATE_PAGE_IDS)[number];

const TEMPLATE_BUILDERS: Readonly<Record<BlockTemplatePageId, () => BlockDocument | null>> = {
  home: buildHomeTemplate,
  about: buildAboutTemplate,
  careers: buildCareersTemplate,
  contact: buildContactTemplate,
  products: buildProductsTemplate,
  recipes: buildRecipesTemplate,
  news: buildNewsTemplate,
  certifications: buildCertificationsTemplate,
  executives: buildExecutivesTemplate,
  /* หน้ารายละเอียดหมวด — เทมเพลตต่อหมวด (ใช้ชื่อ/ภาพจริง + คำอธิบาย "ยังไม่เปิดใช้งาน" ในพจนานุกรม) */
  "product-instant-noodles": () => buildProductDetailTemplate("instant-noodles"),
  "product-dried-vermicelli": () => buildProductDetailTemplate("dried-vermicelli"),
  "product-serda": () => buildProductDetailTemplate("serda"),
  "product-quick-zabb": () => buildProductDetailTemplate("quick-zabb"),
  "product-noodie": () => buildProductDetailTemplate("noodie"),
  "product-rod-ded": () => buildProductDetailTemplate("rod-ded"),
};

/**
 * "ส่วนที่เทมเพลตไม่ครอบคลุม" — รหัสกลาง (ข้อความจริงอยู่ในพจนานุกรมทั้งสองภาษา)
 *
 * ทำไมต้องประกาศไว้: ถ้าเปิดสวิตช์ "ใช้กับหน้าเว็บจริง" หน้าเว็บจะแสดง **เฉพาะบล็อก**
 * ⇒ ส่วนที่เทมเพลตไม่มี (เช่น ฟอร์มติดต่อ · แผนที่ · ตารางตำแหน่งงาน) จะหายจากหน้านั้น
 *    ผู้ใช้ต้องเห็นคำเตือนนี้ **ก่อน** กดสวิตช์ ไม่ใช่รู้ทีหลัง
 */
export const BLOCK_COVERAGE_PART_IDS = [
  /* รอบที่ 228: ส่วน "ที่ซื้อสินค้า" มีเจ้าของคือหน้าจอเนื้อหาหน้าแรก (ไม่ใช่บล็อก) */
  "whereToBuy",
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
  /*
    หน้าแรก (รอบที่ 224 · คิวข้อ 5 — **ครบตามหน้าเว็บจริงแล้ว**)
    ครอบคลุม: หัวข้อ/คำโปรยจดหมายข่าว + ฟอร์มจริง · หมวดสินค้า+สินค้าแนะนำ (ไดนามิก) ·
              เมนูล่าสุด (ไดนามิก) · ข่าวล่าสุด (ไดนามิก) · ช่องทางจำหน่าย (ลิงก์จริง)
    ⚠️ hero **ไม่นับเป็นช่องว่าง** — หน้าแรกเรนเดอร์ hero จริงจาก `/admin/hero` (สไลด์ + การ์ด PR) แหล่งเดียว (รอบที่ 217)
  */
  home: [],
  /* หน้าข้อความล้วน — ไม่มีแกลเลอรีในเลย์เอาต์เดิม (เผื่อไว้ถ้าเจ้าของเพิ่มภาพชุดภายหลัง) */
  about: ["gallery"],
  /* รอบที่ 88: บล็อก `jobBoard` (ตำแหน่งจริงจาก `JOBS`) ⇒ ครอบคลุมครบ */
  careers: [],
  /* รอบที่ 87: ฟอร์มติดต่อ + แผนที่ (ภาพ) เป็นบล็อกแล้ว ⇒ ครอบคลุมครบ */
  contact: [],
  /* หน้านี้แสดงเป็นกริดการ์ดสินค้าอยู่แล้ว (`cards`) — ไม่มีแกลเลอรี/lightbox แยก */
  products: ["gallery"],
  recipes: ["sampleData"],
  news: ["sampleData"],
  /* รอบที่ 87: ใช้บล็อก `gallery` (มี lightbox ในตัว) แทนการ์ด ⇒ ครอบคลุม gallery + lightbox */
  certifications: [],
  /*
    executives: **เจ้าของยืนยัน 2026-10-03 ว่าไฟล์ภาพผังคือแหล่งข้อมูลที่ถูกต้อง**
    (ชื่อ/ตำแหน่ง/ข้อความอยู่ในตัวภาพ `public/executives/management-team.jpg`)
    ⇒ เทมเพลตใช้ `imageText` กับภาพนั้น และ **ไม่ต้องมี `rosterText`** · ไม่ต้องมีแกลเลอรี (มีภาพเดียว)
    ⚠️ ห้ามถอดชื่อ/ตำแหน่งออกจากภาพมาใส่เป็นข้อความเอง — บทเรียนรอบที่ 22: ตัวอักษรในภาพอ่านเพี้ยนได้
       ถ้าอนาคตต้องการรายชื่อเป็นข้อความ ต้องได้รายชื่อที่ยืนยันแล้วจากเจ้าของก่อน (บล็อก `rosterText` พร้อมใช้)
  */
  executives: [],
  /*
    หน้ารายละเอียดหมวดสินค้า (S3 ส่วนที่ 2 · รอบที่ 102) — **ไม่ประกาศช่องว่าง**
    เทมเพลต mirror หน้า stub เดิมครบ: ชื่อหมวด · ภาพ (มี alt) · คำอธิบาย "ยังไม่เปิดใช้งาน" · ปุ่มย้อนกลับ
    ⇒ เปิดสวิตช์ "ใช้กับหน้าเว็บจริง" แล้วไม่มีส่วนไหนหายไป (เนื้อหารายละเอียดจริงรอเจ้าของเติมเอง)
  */
  "product-instant-noodles": [],
  "product-dried-vermicelli": [],
  "product-serda": [],
  "product-quick-zabb": [],
  "product-noodie": [],
  "product-rod-ded": [],
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
