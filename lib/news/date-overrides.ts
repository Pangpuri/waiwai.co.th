/**
 * ตารางแก้ไขวันที่ของข่าวที่ **ต้นทางลงผิด** (หน้า /news · รอบที่ 106) — **ตรรกะล้วน ทดสอบได้**
 *
 * ทำไมต้องมีไฟล์นี้ (ไม่แก้ที่ฐานข้อมูลอย่างเดียว)
 * - `npm run news:import` เป็น idempotent: รันซ้ำจะเขียนทับด้วยค่าจากต้นทาง ⇒ ถ้าแก้แค่ใน DB
 *   **การนำเข้าครั้งถัดไปจะทำให้ผิดกลับมาอีก** ⇒ ที่แก้ต้องอยู่ในโค้ด (แหล่งความจริง)
 * - migration `0019` ใช้ชุดเดียวกันนี้ซ่อมแถวที่มีอยู่แล้ว (ทั้งสองทางต้องตรงกัน — มีเทสต์คุม)
 *
 * กติกา
 * - ใส่เท่าที่ **เจ้าของยืนยันแล้ว** เท่านั้น (ห้ามเดา/ห้ามปรับเพราะ "ดูไม่น่าใช่") · ต้องมีเหตุผลกำกับ
 * - `publishedLocal` = เวลาไทย `YYYY-MM-DDTHH:MM` (รูปแบบเดียวกับที่ตัวนำเข้าใช้)
 * - `published_label` (ข้อความดิบจากต้นทาง) **คงไว้ตามเดิม** ⇒ ยังตรวจย้อนหลังได้ว่าต้นทางเขียนอะไร
 */

export type NewsDateOverride = {
  readonly sourceId: string;
  /** วันที่ที่ถูกต้อง (เวลาไทย) */
  readonly publishedLocal: string;
  /** สิ่งที่ต้นทางเขียนไว้ (เก็บไว้เทียบให้เห็นชัด ๆ) */
  readonly sourceLocal: string;
  readonly reason: string;
};

export const NEWS_DATE_OVERRIDES: readonly NewsDateOverride[] = [
  {
    sourceId: "146142",
    sourceLocal: "2026-12-29T17:36",
    publishedLocal: "2025-12-29T17:36",
    reason:
      "ต้นทางลงปีผิด: หน้าเว็บเดิมเขียน \"29 ธันวาคม 2026 at 17:36\" ซึ่งเป็น **อนาคต** (วันที่ตรวจจริง 5 ต.ค. 2026) — " +
      "เจ้าของยืนยัน 2026-10-05 ว่าเป็นข่าวส่งท้ายปี 2568 ⇒ ต้องเป็น 29 ธันวาคม 2568",
  },
];

/** ค่าที่แก้ไว้สำหรับข่าวนี้ (ไม่มี = null ⇒ ใช้ค่าจากต้นทาง) */
export function newsDateOverrideOf(sourceId: string): NewsDateOverride | null {
  return NEWS_DATE_OVERRIDES.find((entry) => entry.sourceId === sourceId.trim()) ?? null;
}

/**
 * คืนวันที่ที่ควรใช้จริง — ถ้ามีในตารางแก้ไขจะคืนค่านั้น ไม่งั้นคืนค่าจากต้นทาง
 * @returns `{ publishedLocal, override }` โดย `override` มีค่าเมื่อถูกแก้
 */
export function applyNewsDateOverride(
  sourceId: string,
  publishedLocal: string | null,
): { readonly publishedLocal: string | null; readonly override: NewsDateOverride | null } {
  const override = newsDateOverrideOf(sourceId);
  if (override === null) return { publishedLocal, override: null };
  return { publishedLocal: override.publishedLocal, override };
}
