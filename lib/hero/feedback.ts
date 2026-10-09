/**
 * รหัสผลลัพธ์หลังบันทึกของโมดูล "สไลด์ & แคมเปญ" (รอบที่ 192 · ขยายรอบที่ 195)
 *
 * มติเจ้าของ: *"อย่างน้อยควรขึ้นข้อความบันทึกสำเร็จหรือไม่สำเร็จเมื่อทำการบันทึกเสมอ"*
 * ⇒ ทุก action ที่เขียนฐานข้อมูล **Redirect กลับพร้อมรหัส** แล้วหน้าจอแสดงแบนเนอร์
 *    (ทำงานได้แม้ปิด JavaScript — ไม่ต้องพึ่ง toast/JS)
 *
 * ⚠️ รหัสต้องอยู่ในรายการนี้เท่านั้น (หน้าจอ map เป็นข้อความจากพจนานุกรม — TS บังคับให้ครบ)
 */


export const HERO_SAVED_CODES = [
  "slide-added",
  "slide-removed",
  "slide-moved",
  "slide-reordered",
  "slide-saved",
  "effect-saved",
  "slide-restored",
  "slide-purged",
  /* รอบที่ 203 — บันทึกการ์ด PR (การ์ดที่ขยับบนหน้าแรก) จากหน้าแคมเปญ */
  "card-saved",
  /* รอบที่ 251 — บันทึกข้อความหัวเว็บไซต์ (hero) จากหน้าจอสไลด์ */
  "texts-saved",
] as const;
export type HeroSavedCode = (typeof HERO_SAVED_CODES)[number];

export const HERO_ERROR_CODES = ["invalid", "save-failed"] as const;
export type HeroErrorCode = (typeof HERO_ERROR_CODES)[number];

export type HeroFeedback =
  | { readonly kind: "saved"; readonly code: HeroSavedCode }
  /* (รอบที่ 205) ถอดกลไก "ช่องที่ทำให้ไม่ผ่าน" ออกพร้อมโมดูลแคมเปญ */
  | { readonly kind: "error"; readonly code: HeroErrorCode };

export function isHeroSavedCode(value: string): value is HeroSavedCode {
  return (HERO_SAVED_CODES as readonly string[]).includes(value);
}

export function isHeroErrorCode(value: string): value is HeroErrorCode {
  return (HERO_ERROR_CODES as readonly string[]).includes(value);
}


/** อ่านผลลัพธ์จาก query ของหน้าจอ — ไม่มี/ค่าเพี้ยน = null (ไม่แสดงแบนเนอร์) */
export function feedbackOf(query: {
  readonly saved?: string;
  readonly error?: string;
}): HeroFeedback | null {
  const saved = (query.saved ?? "").trim();
  const error = (query.error ?? "").trim();
  if (isHeroErrorCode(error)) return { kind: "error", code: error };
  if (isHeroSavedCode(saved)) return { kind: "saved", code: saved };
  return null;
}

