import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อมูลเชิงโครงสร้างของหน้าแรก — เป็น pure module (ไม่แตะ DOM/DB/Next.js)
 *
 * หลักการ: ที่นี่เก็บเฉพาะ "รหัส/ลิงก์" ส่วนข้อความที่ต้องแปลอยู่ในพจนานุกรม
 * การผูกกันทำผ่าน id ที่มี type มาจากพจนานุกรม → พิมพ์ id ผิด = compile error
 *
 * ⚠️ **รอบที่ 108 — สินค้าออกจากไฟล์นี้แล้ว**
 *   เดิมที่นี่มี `PRODUCT_CATEGORIES` + `FEATURED_PRODUCTS` ที่ฝัง slug เอง (`/products/cup-noodles` ฯลฯ)
 *   ซึ่ง **ไม่มีอยู่จริง** ⇒ หน้าแรกมีลิงก์เสีย 4 เส้น และการ์ดสินค้าทั้งหมดเป็น "ข้อมูลทดสอบ"
 *   ตอนนี้ใช้ของจริง: **slug/ชื่อ/ลำดับ มาจาก `features/products/catalog.ts`** (แหล่งเดียว)
 *   และภาพ/คำอธิบาย/จำนวนสินค้ามาจากฐานข้อมูล — ดู `features/home/view-models.ts`
 *
 * ⚠️ เมนูอาหาร + ข่าว ยังมี "ข้อมูลทดสอบ" ไว้เป็น **ทางถอยเมื่อไม่มีฐานข้อมูล** (เดโมไม่พัง)
 *   หน้าเว็บจริงจะแสดงของจริงก่อนเสมอถ้ามี (มีเทสต์คุมว่าเลข/วันที่ทดสอบไม่โผล่เมื่อมีข้อมูลจริง)
 */

/* ── ชนิดข้อมูลที่ผูกกับพจนานุกรม ─────────────────────────── */

export type RecipeId = keyof Messages["recipes"]["items"];
export type NewsId = keyof Messages["news"]["items"];
/* ── เมนูอาหาร (ทางถอยเมื่อไม่มีฐานข้อมูล) ────────────────── */

export const RECIPE_ORDER: readonly RecipeId[] = [
  "dryTomYum",
  "boatNoodleBowl",
  "crispyNoodleSalad",
];

/* ── ข่าวสาร (ทางถอยเมื่อไม่มีฐานข้อมูล) ──────────────────── */

export type NewsEntry = {
  readonly id: NewsId;
  /** วันที่ในรูปแบบ ISO — จัดรูปแบบตามภาษาด้วย lib/format.ts */
  readonly date: string;
};

/**
 * ⚠️ วันที่เป็นข้อมูลตัวอย่างสำหรับจัดวาง — ใช้เฉพาะตอน **ไม่มีฐานข้อมูล** (ฐานข้อมูลว่าง/ยังไม่ตั้งค่า)
 *    ถ้ามีข่าวจริง หน้าแรกจะแสดงข่าวจริงแทนทั้งชุด (ไม่ผสมกัน)
 */
export const NEWS_ENTRIES: readonly NewsEntry[] = [
  { id: "community", date: "2026-08-19" },
  { id: "exhibition", date: "2026-07-02" },
  { id: "certification", date: "2026-05-27" },
];
