import { buildCertificationsTemplate } from "@/lib/blocks/certifications-template";
/* รอบที่ 267: หน้า /contact ใช้ "เอกสารตั้งต้น" ตัวเดียวกับที่ตัวนำเข้าเขียนลงฐานข้อมูล */
import { buildContactDocument } from "@/lib/contact/document";
import { buildExecutivesTemplate } from "@/lib/blocks/executives-template";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { PRODUCT_DETAIL_PAGE_IDS, productDetailCategoryIdOfPageId } from "@/lib/blocks/product-detail";
import { buildProductDetailDocument, type ProductDetailCategoryValues } from "@/lib/products/detail-document";
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

/** หน้าเมนูหลักที่มีเทมเพลต (รอบที่ 266: 8 หน้า — ตัด careers ออก) */
const MENU_TEMPLATE_PAGE_IDS = [
  "home",
  "about",
  /* ⚠️ รอบที่ 266: `careers` **ไม่มีเทมเพลต/ไม่มีจอตัวสร้างหน้า** แล้ว (มติเจ้าของ)
     เหตุผล: เนื้อหาหน้าอยู่ที่ **ประกาศรับสมัครงานในฐานข้อมูล** + จอ `/admin/careers` (รอบที่ 265)
     ⇒ ตัวสร้างหน้า careers ไม่มีอะไรให้แก้ และเป็นทาง "กดเผยแพร่ทับหน้า" ที่ไม่ต้องการ */
  "contact",
  "certifications",
  "executives",
] as const;
/*
  ⚠️ รอบที่ 269 (มติเจ้าของ: "เราเผยแพร่จุดเดียวจุดที่ไซด์บาร์พาไปส่วนนั้นๆ จะได้ไม่สับสน"):
  ถอดจอตัวสร้างของ **`products` · `recipes` · `news`** ออก — ซ้ำซ้อนกับจอหลักที่ไซด์บาร์พาไป
  (`/admin/products` · `/admin/recipes` · `/admin/news`) และหลักฐานยืนยันว่าไม่เคยถูกใช้:
  · ฐานข้อมูลไม่มีเอกสารบล็อกของสามหน้านี้เลย (มีแต่ home · about · contact · certifications · executives)
  · ไม่อยู่ใน `PUBLISH_GOES_LIVE_PAGES` ⇒ กดเผยแพร่แล้วหน้าเว็บก็ไม่เปลี่ยน (กับดัก)
  เนื้อหาสามหน้านี้ยังแก้ได้ตามปกติที่จอของมันเอง · เลย์เอาต์หน้าเว็บ (โค้ด) ไม่ถูกแตะ
*/

/**
 * ทะเบียนรวมของ "หน้าที่มีเทมเพลตบล็อก" — หน้าเมนู 9 หน้า + หน้ารายละเอียดหมวดสินค้า 6 หน้า
 * (S3 ส่วนที่ 2 · รอบที่ 102 · มาจาก `PRODUCT_DETAIL_PAGE_IDS` ⇒ ไม่มีทางหลุดจาก `CATALOG_ITEMS`)
 *
 * ⚠️ ลำดับมีเทสต์บังคับ: หน้าเมนูก่อน แล้วต่อด้วยหน้า detail ตามลำดับหมวด
 * ⚠️ `PAGE_PATHS` ต้องมีครบทุก id ในนี้ (มีเทสต์) — ไม่งั้นปุ่ม "เปิดหน้าเว็บ" จะพาไปหน้าแรกแทน
 */
export const BLOCK_TEMPLATE_PAGE_IDS = [...MENU_TEMPLATE_PAGE_IDS, ...PRODUCT_DETAIL_PAGE_IDS] as const;

export type BlockTemplatePageId = (typeof BLOCK_TEMPLATE_PAGE_IDS)[number];

/** หน้าเมนูที่มีเทมเพลต (คีย์ของตารางเทมเพลต) */
export type MenuTemplatePageId = (typeof MENU_TEMPLATE_PAGE_IDS)[number];

/**
 * ตัวเลือกตอนสร้างเทมเพลต (รอบที่ 253) — หน้าที่ใช้ **ภาพจริงจากคลังภาพ** ต้องรู้พาธ `/media/<id>`
 * (ผู้เรียกอ่าน id จากคลังแล้วส่งตัวช่วยมา · เทมเพลตยังเป็นฟังก์ชันบริสุทธิ์)
 *
 * ⚠️ **ไม่มีตัวเลือก `mapUrl`** — การใส่ `linkHref` โดยไม่มีข้อความบนปุ่ม = ลิงก์ที่มองไม่เห็น
 *    + validator เตือน `map-link-without-label` (บทเรียนจากเทมเพลตหน้า /about ยุคแรก)
 */
export type TemplateBuildOptions = {
  readonly image?: (key: string) => string;
  /**
   * ค่าจริงจากฐานข้อมูลของหมวดสินค้า (รอบที่ 270) — ใช้กับเทมเพลตหน้า "รายละเอียดหมวดสินค้า"
   * ผู้เรียก (Server Action) อ่าน DB แล้วส่งตัวช่วยนี้ ⇒ เทมเพลตยังเป็นฟังก์ชันบริสุทธิ์
   * ⚠️ คีย์คือ **รหัสภายในของหมวด** (`product_category.id`) ไม่ใช่ slug (รอบที่ 280)
   */
  readonly categoryValues?: (categoryId: string) => ProductDetailCategoryValues | null;
};

type TemplateBuilder = (options?: TemplateBuildOptions) => BlockDocument | null;

const MENU_TEMPLATE_BUILDERS: Readonly<Record<MenuTemplatePageId, TemplateBuilder | null>> = {
  home: buildHomeTemplate,
  /*
    ⚠️ รอบที่ 260: `about` **ไม่มีเทมเพลตตั้งต้นแล้ว** (หนี้ D-255-1)
    เนื้อหาหน้านี้มาจาก **ตัวนำเข้าหน้าต้นทาง** (`npm run about:import` · `lib/about/*`)
    เทมเพลตเก่า (20 บล็อกที่ประกอบจากพจนานุกรม) ถูกลบทั้งไฟล์ตามมติเจ้าของ 2026-10-09
    ("ใช้ภาพ ข้อความ และแบ่งบล็อกตามความเหมาะสมจากแหล่งข้อมูลนี้") — เก็บไว้จะเป็นกับดัก:
    กด "เริ่มจากเทมเพลต" แล้ว **ทับเนื้อหาที่นำเข้าจริงทั้งหน้า**
  */
  about: null,
  contact: buildContactDocument,
  certifications: buildCertificationsTemplate,
  executives: buildExecutivesTemplate,
};

/**
 * เทมเพลตของ **หน้ารายละเอียดหมวดสินค้า** — ตัวสร้างเดียวใช้ได้ทุกหมวด (รอบที่ 281 · ปิดหนี้ D-280-1)
 * ก่อนหน้านี้ต้องเขียนทีละหมวดในตาราง ⇒ หมวดที่สร้างใหม่ไม่มีเทมเพลตให้เริ่ม (กดแล้วเงียบ)
 * ⚠️ ต้องเป็น**ฟังก์ชันบริสุทธิ์** — ค่าจริงจาก DB เข้ามาทาง `options.categoryValues` (ผู้เรียกอ่านมาให้)
 *
 * ⚠️ **ห้ามคืน `null` เมื่อไม่รู้จักหมวด** (ต่างจากหน้า detail ของหมวดในโค้ด): ถ้าคืน `null`
 *    หน้าจอจะโชว์ปุ่ม "เริ่มจากเทมเพลต" (เพราะ `hasBlockTemplate()` = true) แต่กดแล้วไม่มีอะไรเกิดขึ้น
 *    = กับดักเดียวกับ `careers` ⇒ ที่นี่ถอยไปสร้างแบนเนอร์ด้วย **รหัสหมวด** (ไม่แต่งชื่อขึ้นเอง)
 */
function buildProductDetailTemplate(page: string, options?: TemplateBuildOptions): BlockDocument | null {
  const categoryId = productDetailCategoryIdOfPageId(page);
  if (categoryId === null) return null;

  const values = options?.categoryValues?.(categoryId) ?? null;
  const document = buildProductDetailDocument(categoryId, values);
  if (document !== null) return document;

  /* หมวดที่ไม่อยู่ในโค้ด + ยังอ่านค่าจริงไม่ได้ ⇒ เอกสารตั้งต้นที่ใช้รหัสหมวดเป็นชื่อ (ยังแก้ต่อได้) */
  return buildProductDetailDocument(categoryId, {
    slug: categoryId,
    nameTh: categoryId,
    nameEn: categoryId,
    descriptionTh: "",
    descriptionEn: "",
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    hasProducts: false,
  });
}

/**
 * หน้านี้ **มีหน้าจอตัวสร้าง (builder) + พรีวิว** ไหม — ใช้กับงานที่ไม่เกี่ยวกับเทมเพลต
 * (เช่น ปุ่ม "กลับไปใช้ดีไซน์เดิม" · ล้างประวัติการเผยแพร่) ⇒ **ห้ามใช้ `hasBlockTemplate` กับงานพวกนี้**
 * เพราะหน้าที่เนื้อหามาจากตัวนำเข้า (about) ก็ยังต้องกลับไปใช้เลย์เอาต์เดิม/ล้างประวัติได้
 *
 * 🆕 รอบที่ 281: หน้า detail ของ **หมวดที่สร้างใหม่** ก็นับเป็นหน้าที่มีตัวสร้าง
 *    (ตรวจตาม **รูปทรงของ id** `product-<อะไรก็ได้>` — ไม่จำกัด 6 ใบในโค้ด)
 *    ⚠️ ผู้เรียกที่ต้องรู้ว่าหมวดนั้นมีจริงไหม ต้องเช็คฐานข้อมูลเอง (เช่น `/admin/builder/[page]`)
 */
export function isBlockBuilderPage(page: string): boolean {
  return (BLOCK_TEMPLATE_PAGE_IDS as readonly string[]).includes(page) || productDetailCategoryIdOfPageId(page) !== null;
}

export const TEMPLATED_PAGE_IDS: readonly string[] = [
  ...MENU_TEMPLATE_PAGE_IDS.filter((page) => MENU_TEMPLATE_BUILDERS[page] !== null),
  ...PRODUCT_DETAIL_PAGE_IDS,
];

/**
 * "ส่วนที่เทมเพลตไม่ครอบคลุม" — รหัสกลาง (ข้อความจริงอยู่ในพจนานุกรมทั้งสองภาษา)
 *
 * ทำไมต้องประกาศไว้: เมื่อ **กดเผยแพร่** หน้าเว็บจะแสดง **เฉพาะบล็อก**
 * ⇒ ส่วนที่เทมเพลตไม่มี (เช่น ฟอร์มติดต่อ · แผนที่ · กระดานรับสมัครงาน) จะหายจากหน้านั้น
 *    ผู้ใช้ต้องเห็นคำเตือนนี้ **ก่อน** กดเผยแพร่ ไม่ใช่รู้ทีหลัง
 */
export const BLOCK_COVERAGE_PART_IDS = [
  /* รอบที่ 228: ส่วน "ที่ซื้อสินค้า" มีเจ้าของคือหน้าจอเนื้อหาหน้าแรก (ไม่ใช่บล็อก) */
  "whereToBuy",
  "gallery",
  "lightbox",
  "form",
  "map",
  "rosterText",
] as const;

export type BlockCoveragePartId = (typeof BLOCK_COVERAGE_PART_IDS)[number];

const COVERAGE: Readonly<Record<MenuTemplatePageId, readonly BlockCoveragePartId[]>> = {
  /*
    หน้าแรก (รอบที่ 224 · คิวข้อ 5 — **ครบตามหน้าเว็บจริงแล้ว**)
    ครอบคลุม: หัวข้อ/คำโปรยจดหมายข่าว + ฟอร์มจริง · หมวดสินค้า+สินค้าแนะนำ (ไดนามิก) ·
              เมนูล่าสุด (ไดนามิก) · ข่าวล่าสุด (ไดนามิก) · ช่องทางจำหน่าย (ลิงก์จริง)
    ⚠️ hero **ไม่นับเป็นช่องว่าง** — หน้าแรกเรนเดอร์ hero จริงจาก `/admin/hero` (สไลด์ + การ์ด PR) แหล่งเดียว (รอบที่ 217)
  */
  home: [],
  /*
    ★ รอบที่ 253 (มติเจ้าของ: ย้ายเนื้อหาบริษัทเข้า DB ครบ 10 ส่วน) — เทมเพลตครอบคลุมครบแล้ว
    รวม **แกลเลอรีใบรับรองมาตรฐาน 11 ใบ** (ภาพจริงจากคลังภาพ) ⇒ ไม่มีช่องว่างเหลือ
  */
  about: [],
  /* รอบที่ 87: ฟอร์มติดต่อ + แผนที่ (ภาพ) เป็นบล็อกแล้ว ⇒ ครอบคลุมครบ */
  contact: [],
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
};

/**
 * หน้าที่ **เนื้อหามาจาก "ตัวนำเข้า" ไม่ใช่จากพจนานุกรม** (รอบที่ 260)
 *
 * ⚠️ ทำไมต้องแยก: หน้าที่อยู่ในรายการนี้ **ต้องไม่มีปุ่ม "เริ่มจากเทมเพลต"**
 * เพราะปุ่มนั้นจะเขียนทับเอกสารทั้งหน้าด้วยเทมเพลตตั้งต้น ⇒ งานที่ตรวจ/แก้ไว้หายหมด
 * (หนี้ D-255-1: เคยมีเทมเพลต /about 20 บล็อกที่ประกอบจากพจนานุกรม กับดักนี้ถูกถอดออกแล้ว)
 *
 * วิธีสร้างเนื้อหาของหน้าเหล่านี้: รันสคริปต์นำเข้าของหน้า (ดู `package.json`) แล้วกดเผยแพร่ในหน้าตัวสร้าง
 */
export const IMPORTED_CONTENT_PAGES = ["about"] as const;

/** หน้านี้เนื้อหามาจากตัวนำเข้าไหม (ห้ามเสนอ "เริ่มจากเทมเพลต") */
export function isImportedContentPage(page: string): boolean {
  return (IMPORTED_CONTENT_PAGES as readonly string[]).includes(page);
}

/**
 * หน้านี้มีเทมเพลตบล็อกให้เริ่มได้ไหม
 * ⚠️ หน้าที่เนื้อหามาจากตัวนำเข้า = `false` เสมอ (ดู `IMPORTED_CONTENT_PAGES`)
 * 🆕 รอบที่ 281: หน้า detail ของหมวดใดก็ได้ = `true` (เทมเพลตเดียวใช้ได้ทุกหมวด)
 */
export function hasBlockTemplate(page: string): boolean {
  if (isImportedContentPage(page)) return false;
  if (productDetailCategoryIdOfPageId(page) !== null) return true;
  if (!(MENU_TEMPLATE_PAGE_IDS as readonly string[]).includes(page)) return false;
  return MENU_TEMPLATE_BUILDERS[page as MenuTemplatePageId] !== null;
}

/**
 * สร้างเทมเพลตของหน้านั้น (คืน `null` ถ้าหน้านั้นไม่มีเทมเพลตตั้งต้น)
 * ⚠️ เอกสารที่ได้ยัง **ไม่ผ่านการ parse** — ผู้เรียกต้องส่งเข้า `parseBlockDocument` ก่อนเขียนลงฐานข้อมูล
 */
export function buildBlockTemplate(page: string, options?: TemplateBuildOptions): BlockDocument | null {
  if (!hasBlockTemplate(page)) return null;
  if (productDetailCategoryIdOfPageId(page) !== null) return buildProductDetailTemplate(page, options);
  const builder = MENU_TEMPLATE_BUILDERS[page as MenuTemplatePageId];
  return builder === null ? null : builder(options);
}

/**
 * รหัสของส่วนที่เทมเพลตของหน้านั้นไม่ครอบคลุม (หน้านอกทะเบียน = ไม่มีข้อมูล)
 * ℹ️ หน้า detail ของหมวดสินค้า **ไม่ประกาศช่องว่าง** (เทมเพลต mirror หน้าเว็บเดิมครบ) — ทุกหมวดเหมือนกัน
 */
export function blockCoverageGaps(page: string): readonly BlockCoveragePartId[] {
  if (productDetailCategoryIdOfPageId(page) !== null) return [];
  if (!hasBlockTemplate(page)) return [];
  return COVERAGE[page as MenuTemplatePageId];
}

/**
 * ปลายทางของแต่ละ "ส่วนที่เทมเพลตไม่ครอบคลุม" (หนี้ D-252-2)
 *
 * ปัญหาเดิม: คำเตือนบอกว่า "ส่วนนี้จะหายจากหน้าเว็บ" แต่ **กดไม่ได้** ⇒ ผู้ใช้ไม่รู้จะไปแก้ที่ไหน
 * ⇒ ทุกส่วนต้องมีปลายทางที่ **มีจริง** (มีเทสต์พิสูจน์ทุกค่า):
 *   · `#…` = สมอย (anchor) **ในหน้าจอเดียวกัน** — ต้องมี `id="…"` อยู่ในตัวสร้างหน้าเว็บ
 *   · `/admin/…` = ส่วนนั้นมีเจ้าของเป็นหน้าจออื่น (ลิงก์ข้ามจอ — route ต้องมีไฟล์จริง)
 *
 * ℹ️ ทุกวันนี้ `COVERAGE` ของทุกหน้าเป็น `[]` (ครอบคลุมครบ) ⇒ ยังไม่มีรายการให้กดบนจอจริง
 *    แต่ตารางนี้พร้อมใช้ทันทีที่มีช่องว่างใหม่ และเทสต์กันการใส่ค่าที่กดแล้วเงียบ
 */
export const BLOCK_COVERAGE_PART_TARGETS: Readonly<Record<BlockCoveragePartId, string>> = {
  /* เจ้าของคือหน้าจอเนื้อหาหน้าแรก (ไม่ใช่บล็อก) — ดูเหตุผลใน `COVERAGE`/`BLOCK_COVERAGE_PART_IDS` */
  whereToBuy: "/admin/content/home",
  /* ส่วนที่เกิดจาก "ชนิดบล็อก" ⇒ ปลายทางคือแผงเพิ่มบล็อกในตัวสร้าง (เลือกชนิดที่ขาดจากรายการ) */
  gallery: "#builder-add-type",
  lightbox: "#builder-add-type",
  form: "#builder-add-type",
  map: "#builder-add-type",
  rosterText: "#builder-add-type",
};

/** ปลายทางของส่วนนั้น (ผู้เรียกใช้เรนเดอร์เป็นลิงก์ — ห้ามว่างเปล่า) */
export function coveragePartTarget(part: BlockCoveragePartId): string {
  return BLOCK_COVERAGE_PART_TARGETS[part];
}
