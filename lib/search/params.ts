/**
 * อ่านค่า `searchParams` อย่างปลอดภัย (รอบที่ 291 — ปิดบั๊กที่เจอจากการยิงจริง)
 *
 * ## ทำไมต้องมี (เคสจริง)
 * 1. **พารามิเตอร์ซ้ำ** — `?q=a&q=b` ⇒ Next คืน **array** ไม่ใช่สตริง
 *    · ของเดิมเขียน `(query.q ?? "").trim()` ⇒ `array.trim is not a function` ⇒ **HTTP 500**
 *    (เจอจริง: `/admin/products?q=…&q=…` · `category` · `/admin/news|recipes|careers?q=…&q=…` ·
 *     `/admin/inbox?erase=…&erase=…` · `/admin/hero?saved|error|fields=…` · `/th/preview/home?parts=…`)
 * 2. **อักขระควบคุม/NUL** — `?q=%00` ⇒ Postgres ไม่รับ `\u0000` ในข้อความ ⇒ คำสั่ง `ilike` โยน error ⇒ **HTTP 500**
 *    (เจอจริง: `/admin/media?q=%00`)
 *
 * ⇒ กติกาของโปรเจกต์: **ห้ามเชื่อค่าที่มาจาก URL** — ทุกหน้าจอที่อ่าน `searchParams` ต้องผ่านที่นี่
 *    และชั้นข้อมูล (repository) ก็กรองซ้ำด้วย `normalizeSearchText()` เป็นประตูที่สอง
 *
 * ## ชนิดที่ซื่อสัตย์
 * หน้าที่ประกาศ `searchParams` ควรใช้ `Readonly<Record<string, string | readonly string[] | undefined>>`
 * (ไม่ใช่ `q?: string` ซึ่งโกหกความจริง) ⇒ ถ้าลืมใช้ตัวช่วยนี้ **typecheck จะฟ้อง** ไม่ต้องรอ runtime
 */

/** ค่าที่ Next ส่งมาให้ได้จริง (สตริง · หลายค่า · ไม่มี) */
export type SearchParamValue = string | readonly string[] | undefined;

/** ความยาวสูงสุดเริ่มต้นของค่าค้นหา (กัน URL ยาวผิดปกติ + prompt/ข้อความยาวเกินจำเป็น) */
export const DEFAULT_SEARCH_MAX_LENGTH = 120;

/**
 * ตัดอักขระควบคุมทั้งหมดออกจากข้อความดิบ (รวม NUL) · ยุบช่องว่างซ้อน · trim · จำกัดความยาว
 *
 * เขียนแบบวนอักขระ ไม่ใช้ regex `\u0000-\u001F` เพราะ ESLint (`no-control-regex`) ห้ามไว้
 * และการวนอ่านง่ายกว่าการไล่ escape ใน regex
 */
export function normalizeSearchText(raw: string, maxLength: number = DEFAULT_SEARCH_MAX_LENGTH): string {
  const limit = Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : DEFAULT_SEARCH_MAX_LENGTH;

  let withoutControls = "";
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    /* อักขระควบคุม ASCII (0–31) และ DEL (127) → ช่องว่าง แล้วค่อยยุบทีหลัง */
    withoutControls += code < 32 || code === 127 ? " " : character;
  }

  const collapsed = withoutControls.replace(/\s+/g, " ").trim();
  return collapsed.length > limit ? collapsed.slice(0, limit) : collapsed;
}

/**
 * อ่านค่าเดียวจาก `searchParams` แบบไม่เชื่อชนิด
 * - ค่าซ้ำ (`string[]`) ⇒ ใช้ **ค่าแรก** (พฤติกรรมเดียวกับที่เบราว์เซอร์/ฟอร์มให้ความสำคัญ)
 * - ไม่ใช่สตริง (undefined/number/object) ⇒ `""` (ไม่โยน error)
 * - ตัดอักขระควบคุม + จำกัดความยาวเสมอ ⇒ ส่งลง SQL ได้ปลอดภัย
 */
export function searchParamText(value: SearchParamValue, maxLength?: number): string {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string") return "";
  return normalizeSearchText(first, maxLength);
}
