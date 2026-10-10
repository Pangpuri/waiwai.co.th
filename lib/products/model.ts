import { catalogSlugs } from "@/features/products/catalog";

/**
 * โมเดล "สินค้า" ที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 3 · รอบที่ 103) — **ตรรกะล้วน ทดสอบได้**
 *
 * ที่มา: เจ้าของสั่ง 2026-10-05 — ดึงข้อมูลสินค้าจาก waiwai.co.th (เว็บเดิม) ลงฐานข้อมูล
 * พร้อมแยกประเภทตามหมวด (มติ: ใช้ตารางใหม่ · รูปโหลดเก็บในตาราง `media`)
 *
 * กติกา
 * - **id ของสินค้า = `p<source_id>`** (เช่น `p15136`) ⇒ นำเข้าซ้ำได้แบบ idempotent
 *   ⚠️ ยังไม่ทำ "หน้ารายละเอียดสินค้า" แยก (ยังไม่มี slug สวย ๆ) — บันทึกเป็นหนี้ใน PRODUCT_ROADMAP § 9
 * - **หมวด** = slug 6 ตัวจาก `features/products/catalog.ts` (เจ้าของยืนยันชื่อแล้ว · ห้ามตีความใหม่)
 *   ⇒ `product_category.id` ใช้ slug และ **ไม่เก็บชื่อหมวดในฐานข้อมูล** (กันชื่อหลุดจากกัน 2 ที่)
 * - **ห้ามเก็บ URL เต็มของรูป** (มติ D9) — ที่นี่เก็บเป็น id ของแถวใน `media`
 */
export type ProductCategoryInput = {
  /** slug ของหมวด (ต้องเป็นหนึ่งใน `catalogSlugs()`) */
  readonly id: string;
  /** id ของหน้าในเว็บเดิม (40599, 15235, …) */
  readonly sourceId: string;
  /**
   * ชื่อหมวดที่แก้จากหลังบ้าน (migration 0037 · รอบที่ 254 · มติ D24)
   * ⚠️ ว่างได้ = หน้าเว็บถอยไปใช้ชื่อในพจนานุกรม (`productsPage.items[id].name`)
   * ⇒ สคริปต์นำเข้าไม่ต้องส่งชื่อ (ส่ง "") · หลังบ้านส่งค่าที่กรอก
   */
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
};

export type ProductInput = {
  readonly id: string;
  readonly categoryId: string;
  readonly sourceId: string;
  /** พาธในเว็บเดิม (เก็บไว้ตรวจย้อนหลัง — ไม่ใช่พาธของเว็บเรา) */
  readonly sourceUrl: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly groupTh: string;
  readonly groupEn: string;
  readonly taglineTh: string;
  readonly taglineEn: string;
  readonly detailsTh: string;
  /* ช่องภาษาอังกฤษ (รอบที่ 141) — การตลาดกรอกเอง · ว่าง = หน้า EN ถอยไปใช้ไทย */
  readonly detailsEn: string;
  readonly allergensTh: string;
  readonly allergensEn: string;
  readonly netWeightTh: string;
  readonly netWeightEn: string;
  readonly fdaNumber: string;
  readonly packagingTh: string;
  readonly packagingEn: string;
  readonly sortOrder: number;
};

export type ProductIngredientInput = {
  readonly nameTh: string;
  readonly nameEn: string;
  readonly percentText: string;
};

export type ImportIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};

/** id ของสินค้าในฐานข้อมูล (คงที่ตาม source id ⇒ นำเข้าซ้ำแล้วอัปเดตแถวเดิม) */
export function productIdOfSourceId(sourceId: string): string {
  return `p${sourceId.trim()}`;
}

export function isCatalogCategoryId(value: string): boolean {
  return catalogSlugs().includes(value);
}

export function validateCategoryInput(input: ProductCategoryInput): readonly ImportIssue[] {
  const issues: ImportIssue[] = [];
  if (!isCatalogCategoryId(input.id)) {
    issues.push({ code: "unknown-category", path: "id", message: `ไม่รู้จักหมวด "${input.id}" (ต้องมีใน features/products/catalog.ts)` });
  }
  if (!/^\d{3,}$/.test(input.sourceId.trim())) {
    issues.push({ code: "bad-source-id", path: "sourceId", message: `source id ต้องเป็นตัวเลข (ได้ "${input.sourceId}")` });
  }
  /* ชื่อว่างได้ (ถอยพจนานุกรม) แต่ยาวเกินไม่ได้ — กันข้อความยาวผิดปกติหลุดเข้าไป */
  if (input.nameTh.length > MAX_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameTh", message: `ชื่อหมวดไทยยาวเกิน ${MAX_NAME_LENGTH} ตัวอักษร` });
  }
  if (input.nameEn.length > MAX_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameEn", message: `ชื่อหมวดอังกฤษยาวเกิน ${MAX_NAME_LENGTH} ตัวอักษร` });
  }
  return issues;
}

const MAX_NAME_LENGTH = 300;
const MAX_TEXT_LENGTH = 4000;

export function validateProductInput(input: ProductInput): readonly ImportIssue[] {
  const issues: ImportIssue[] = [];

  if (input.id !== productIdOfSourceId(input.sourceId)) {
    issues.push({ code: "id-mismatch", path: "id", message: `id ต้องเป็น "${productIdOfSourceId(input.sourceId)}"` });
  }
  if (!isCatalogCategoryId(input.categoryId)) {
    issues.push({ code: "unknown-category", path: "categoryId", message: `ไม่รู้จักหมวด "${input.categoryId}"` });
  }
  if (input.nameTh.trim() === "") {
    issues.push({ code: "empty-name-th", path: "nameTh", message: "ชื่อสินค้าไทยห้ามว่าง" });
  }
  if (input.nameTh.length > MAX_NAME_LENGTH) {
    issues.push({ code: "too-long", path: "nameTh", message: `ชื่อสินค้ายาวเกิน ${MAX_NAME_LENGTH} ตัวอักษร` });
  }
  if (input.detailsTh.length > MAX_TEXT_LENGTH) {
    issues.push({ code: "too-long", path: "detailsTh", message: `ข้อความรายละเอียดยาวเกิน ${MAX_TEXT_LENGTH} ตัวอักษร` });
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    issues.push({ code: "bad-order", path: "sortOrder", message: "ลำดับต้องเป็นจำนวนเต็ม ≥ 0" });
  }
  if (input.sourceUrl !== "" && !input.sourceUrl.startsWith("/")) {
    issues.push({ code: "bad-source-url", path: "sourceUrl", message: "เก็บพาธของเว็บเดิม (เริ่มด้วย /) ไม่ใช่ URL เต็ม" });
  }

  return issues;
}

export function validateIngredientInput(input: ProductIngredientInput, index: number): readonly ImportIssue[] {
  const issues: ImportIssue[] = [];
  if (input.nameTh.trim() === "") {
    issues.push({ code: "empty-ingredient", path: `ingredients[${index}].nameTh`, message: "ชื่อส่วนผสมไทยห้ามว่าง" });
  }
  if (input.nameTh.length > MAX_NAME_LENGTH) {
    issues.push({ code: "too-long", path: `ingredients[${index}].nameTh`, message: "ชื่อส่วนผสมยาวเกินกำหนด" });
  }
  return issues;
}

/**
 * ข้อความ alt ของภาพสินค้า — ใช้ชื่อสินค้า (มีข้อมูลจริง ไม่แต่งขึ้นเอง)
 * ⚠️ ชื่ออังกฤษว่างได้ (เว็บเดิมไม่มี) ⇒ ถอยไปใช้ชื่อไทยเสมอ (ห้ามปล่อย alt ว่าง)
 */
export function productImageAlt(nameTh: string, nameEn: string, locale: "th" | "en"): string {
  const preferred = locale === "en" ? nameEn.trim() : nameTh.trim();
  return preferred === "" ? nameTh.trim() : preferred;
}
