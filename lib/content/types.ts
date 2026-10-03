/**
 * ชนิดข้อมูลของ "เนื้อหาที่แก้ได้จากหลังบ้าน" (content model)
 *
 * หลักการ (ดู BACKEND_DECISIONS.md D3 + D9)
 * - **th บังคับเสมอ** · `en: ""` = ยังไม่มีคำแปลอังกฤษ (ไม่ใช่ error ถ้าฟิลด์นั้นเป็นระดับรายการ)
 * - เก็บ **พาธของไฟล์** ไม่เก็บ URL เต็ม → ย้ายที่เก็บ/ย้ายโดเมนไม่ต้องแก้ข้อมูล (D9)
 * - โครงนี้เป็น "ตรรกะล้วน" — ไม่แตะ DB/DOM/Next.js จึงทดสอบได้โดยไม่ต้องมีฐานข้อมูล
 */

/** ระดับของฟิลด์ — ตัดสินว่าบังคับ EN หรือไม่ (มติ D3) */
export type FieldLevel = "section" | "item";

/** ชนิดของค่า — ใช้เลือกกติกาตรวจ (url · date · media ฯลฯ) */
export type ValueKind = "text" | "url" | "date" | "media";

/** ข้อกำหนดของฟิลด์หนึ่งช่อง */
export type FieldSpec = {
  /** คีย์คงที่ ใช้เป็นคอลัมน์ในตาราง content_field */
  readonly key: string;
  readonly label: string;
  readonly level: FieldLevel;
  readonly kind: ValueKind;
  /** true = ข้อความที่ต้องแปลสองภาษา · false = ค่าเดียวกันทั้งสองภาษา (เช่น ลิงก์ · โทนสี) */
  readonly localized: boolean;
  /** ต้องมีค่าเสมอ (ค่าเริ่มต้น = true) — ตั้ง false ได้กับช่องที่เจตนาเว้นว่าง (เช่น ป้ายตัวอย่าง) */
  readonly required: boolean;
  /** ความยาวสูงสุด (ตัวอักษร) — กันพิมพ์ยาวจนผังหน้าเว็บพัง */
  readonly maxLength: number;
  /** สำหรับ kind = media: ต้องมี alt ภาษาไทยเสมอเมื่อมีไฟล์ */
  readonly altRequired: boolean;
};

/** ข้อกำหนดของกลุ่มรายการ (การ์ด/สไลด์) ที่เพิ่ม–ลบได้จากหลังบ้าน */
export type ItemSpec = {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly FieldSpec[];
  readonly maxItems: number;
};

/** ข้อกำหนดของ section หนึ่งบนหน้าเว็บ */
export type SectionSpec = {
  readonly key: string;
  readonly label: string;
  readonly fields: readonly FieldSpec[];
  readonly items: readonly ItemSpec[];
};

/** ข้อกำหนดของหน้าเว็บหนึ่งหน้า */
export type PageSpec = {
  readonly page: string;
  readonly sections: readonly SectionSpec[];
};

/** ค่าข้อความของฟิลด์หนึ่งช่อง · `en: ""` = ยังไม่มีคำแปลอังกฤษ */
export type LocalizedValue = {
  readonly th: string;
  readonly en: string;
};

/** ค่าของฟิลด์ภาพ · เก็บ "พาธ" (เช่น `/slide/x.jpg`) ไม่ใช่ URL เต็ม (D9) */
export type MediaValue = {
  readonly path: string;
  readonly altTh: string;
  readonly altEn: string;
  /** true = ภาพยังติดลายน้ำของเจ้าของต้นทาง → ห้ามเผยแพร่ (มีคำเตือนในด่าน) */
  readonly hasWatermark: boolean;
};

/** รายการหนึ่งแถว (การ์ด/สไลด์) — ลำดับต้องไม่ซ้ำและเริ่มที่ 1 */
export type ItemContent = {
  readonly order: number;
  readonly fields: Readonly<Record<string, LocalizedValue>>;
  readonly media: Readonly<Record<string, MediaValue>>;
};

/** เนื้อหาของ section หนึ่ง */
export type SectionContent = {
  readonly fields: Readonly<Record<string, LocalizedValue>>;
  /** คีย์ = key ของ ItemSpec (กลุ่มรายการ) */
  readonly items: Readonly<Record<string, readonly ItemContent[]>>;
};

/** เนื้อหาทั้งหน้าของหนึ่งหน้าเว็บ */
export type PageContent = {
  readonly page: string;
  readonly sections: Readonly<Record<string, SectionContent>>;
};
