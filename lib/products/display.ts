import type { Locale } from "@/lib/i18n/config";

/**
 * ข้อความสองภาษาของ "สินค้า" — ที่เดียวของทั้งระบบ (รอบที่ 141)
 *
 * มติเจ้าของ (2026-10-06): *"รายละเอียดสินค้า EN ข้ามได้เลย เพราะเราจะไม่ได้รับผิดชอบส่วนนี้
 * เป็นของการตลาด เขาใส่ข้อมูลเอง อาจจะทำฟิลด์ภาษาอังกฤษไว้ให้เผื่อเขาอยากจะใส่เอง"*
 * ⇒ ทีมเว็บ **ไม่แปล** · เตรียมช่องให้กรอก · และ **หน้า EN ต้องแสดงค่า EN จริงเมื่อมี**
 *   ถ้าไม่มี ⇒ **ถอยไปใช้ไทย** (มติ D3/D19: ไม่ต้องมีข้อมูลครบก่อนเปิดเว็บ)
 *
 * ⚠️ ทำไมต้องมีไฟล์นี้: ก่อนรอบนี้มี 2 ปัญหา
 *   1. `taglineEn` มีช่องให้กรอกในหลังบ้าน แต่ **หน้าเว็บไม่เคยแสดง** (อ่าน `taglineTh` ตรง ๆ)
 *   2. รายละเอียด/สารก่อภูมิแพ้/น้ำหนัก/บรรจุภัณฑ์ **ไม่มีฟิลด์ EN เลย**
 *   ⇒ รวมตรรกะ "เลือกภาษา" ไว้ที่เดียว กันหลุดแบบเดิมอีก (มีเทสต์ `scripts/test-products-display.ts`)
 */

/** ฟิลด์ข้อความของสินค้าที่มีสองภาษา (คู่ที่ไม่มี EN: `fdaNumber` เป็นรหัส ไม่ต้องมี) */
export type BilingualProductText = {
  readonly nameTh: string;
  readonly nameEn: string;
  readonly groupTh: string;
  readonly groupEn: string;
  readonly taglineTh: string;
  readonly taglineEn: string;
  readonly detailsTh: string;
  readonly detailsEn: string;
  readonly allergensTh: string;
  readonly allergensEn: string;
  readonly netWeightTh: string;
  readonly netWeightEn: string;
  readonly packagingTh: string;
  readonly packagingEn: string;
};

/** เลือกข้อความตามภาษา: EN ว่าง = ถอยไปใช้ไทย (ตัดช่องว่างหัวท้ายก่อนตัดสิน) */
export function bilingualProductText(thai: string, english: string, language: Locale): string {
  if (language === "en" && english.trim() !== "") return english;
  return thai;
}

export function productNameOf(product: BilingualProductText, language: Locale): string {
  return bilingualProductText(product.nameTh, product.nameEn, language);
}

/**
 * กลุ่มสินค้า: EN ว่างถอยไทย · **ไทยว่างถอย EN** (ของเดิม — บางกลุ่มมีแต่คำอังกฤษ)
 * ⇒ ไม่ให้การ์ดเหลือบรรทัดว่างเมื่อรู้จักแค่ชื่อกลุ่มภาษาอังกฤษ
 */
export function productGroupOf(product: BilingualProductText, language: Locale): string {
  const english = product.groupEn.trim();
  const thai = product.groupTh.trim();
  if (language === "en" && english !== "") return english;
  return thai !== "" ? thai : english;
}

export function productTaglineOf(product: BilingualProductText, language: Locale): string {
  return bilingualProductText(product.taglineTh, product.taglineEn, language);
}

export function productDetailsOf(product: BilingualProductText, language: Locale): string {
  return bilingualProductText(product.detailsTh, product.detailsEn, language);
}

export function productAllergensOf(product: BilingualProductText, language: Locale): string {
  return bilingualProductText(product.allergensTh, product.allergensEn, language);
}

export function productNetWeightOf(product: BilingualProductText, language: Locale): string {
  return bilingualProductText(product.netWeightTh, product.netWeightEn, language);
}

export function productPackagingOf(product: BilingualProductText, language: Locale): string {
  return bilingualProductText(product.packagingTh, product.packagingEn, language);
}

/* ── หมวดสินค้า: ชื่อ + โลโก้ (migration 0037 · รอบที่ 254 · มติ D24) ──────────────

   หลังบ้านแก้ "ชื่อหมวด" และ "โลโก้การ์ด" ได้ ⇒ หน้าเว็บต้องเลือกค่าที่ถูกต้อง:
   - ชื่อ: **ค่าจากฐานข้อมูลมาก่อน** (ตามภาษา) → ว่าง = ถอยไปใช้ค่าในพจนานุกรม
   - โลโก้: **พาธจากคลังภาพมาก่อน** → null/ว่าง = ถอยไปใช้ไฟล์ใน `public/products/*.png`
   ⇒ ยังไม่นำเข้า/ยังไม่แก้ = หน้าเว็บหน้าตาเหมือนเดิมเป๊ะ (ไม่มีอะไรเปลี่ยนโดยไม่ตั้งใจ)
   ⚠️ ตรรกะอยู่ที่เดียว (pure) — ทั้งหน้า `/products` และหน้ารายละเอียดหมวดใช้ตัวเดียวกัน */

/**
 * ชื่อหมวดที่จะแสดง: DB (ตามภาษา) → ถอยอีกภาษา → ถอยพจนานุกรม
 * ⚠️ อังกฤษว่าง = ถอยไปใช้ไทย (ธรรมเนียมเดียวกับชื่อสินค้า · `bilingualProductText`)
 */
export function categoryNameOf(
  dbNameTh: string,
  dbNameEn: string,
  dictionaryName: string,
  language: Locale,
): string {
  const thai = dbNameTh.trim();
  const english = dbNameEn.trim();
  if (language === "en" && english !== "") return english;
  if (thai !== "") return thai;
  if (english !== "") return english;
  return dictionaryName;
}

/** พาธโลโก้การ์ดหมวด: คลังภาพ (หลังบ้าน) → ถอยไฟล์ใน `public/` */
export function categoryLogoOf(dbLogoPath: string | null, fallbackSrc: string): string {
  const fromLibrary = dbLogoPath === null ? "" : dbLogoPath.trim();
  return fromLibrary !== "" ? fromLibrary : fallbackSrc;
}
