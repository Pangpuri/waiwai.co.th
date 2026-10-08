/**
 * รหัสผลลัพธ์หลังบันทึกของโมดูล "สไลด์ & แคมเปญ" (รอบที่ 192 · ขยายรอบที่ 195)
 *
 * มติเจ้าของ: *"อย่างน้อยควรขึ้นข้อความบันทึกสำเร็จหรือไม่สำเร็จเมื่อทำการบันทึกเสมอ"*
 * ⇒ ทุก action ที่เขียนฐานข้อมูล **Redirect กลับพร้อมรหัส** แล้วหน้าจอแสดงแบนเนอร์
 *    (ทำงานได้แม้ปิด JavaScript — ไม่ต้องพึ่ง toast/JS)
 *
 * รอบที่ 195 (บั๊กจริงที่เจ้าของเจอ): ข้อความ "ข้อมูลไม่ครบหรือไม่ถูกต้อง" **ไม่บอกว่าช่องไหน**
 * เจ้าของจึงเห็นว่า "ใส่ครบทุกช่องแล้วแต่บันทึกไม่สำเร็จ" ⇒ เพิ่มการส่ง **รหัสฟิลด์ที่ทำให้ไม่ผ่าน**
 * กลับมาที่หน้าจอ (query `fields=…`) แล้วโชว์เป็นรายการใต้แบนเนอร์
 *
 * ⚠️ รหัสต้องอยู่ในรายการนี้เท่านั้น (หน้าจอ map เป็นข้อความจากพจนานุกรม — TS บังคับให้ครบ)
 */

import { CAMPAIGN_FIELD_CODES, campaignProblemFields, type CampaignFieldCode } from "@/lib/campaigns/model";

export const HERO_SAVED_CODES = [
  "slide-added",
  "slide-removed",
  "slide-moved",
  "slide-reordered",
  "slide-saved",
  "effect-saved",
  "slide-restored",
  "slide-purged",
  "campaign-added",
  "campaign-saved",
  "campaign-status",
  "campaign-trashed",
  /* รอบที่ 203 — บันทึกการ์ด PR (การ์ดที่ขยับบนหน้าแรก) จากหน้าแคมเปญ */
  "card-saved",
] as const;
export type HeroSavedCode = (typeof HERO_SAVED_CODES)[number];

export const HERO_ERROR_CODES = ["invalid", "save-failed"] as const;
export type HeroErrorCode = (typeof HERO_ERROR_CODES)[number];

export type HeroFeedback =
  | { readonly kind: "saved"; readonly code: HeroSavedCode }
  /** `fields` = ช่องที่ทำให้ไม่ผ่าน (ว่างได้ = ยังไม่รู้สาเหตุ เป็นแค่รหัสรวม) */
  | { readonly kind: "error"; readonly code: HeroErrorCode; readonly fields: readonly CampaignFieldCode[] };

export function isHeroSavedCode(value: string): value is HeroSavedCode {
  return (HERO_SAVED_CODES as readonly string[]).includes(value);
}

export function isHeroErrorCode(value: string): value is HeroErrorCode {
  return (HERO_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * อ่านรายการ "ช่องที่ต้องแก้" จาก query (`fields=a,b`)
 * · ค่าที่ไม่รู้จัก/ซ้ำ = ตัดทิ้ง · เรียงตามทะเบียนกลางเสมอ (หน้าจอไม่สลับที่)
 */
export function heroFieldsOf(query: { readonly fields?: string }): readonly CampaignFieldCode[] {
  const found = new Set<CampaignFieldCode>();
  for (const item of (query.fields ?? "").split(",")) {
    const code = item.trim();
    if ((CAMPAIGN_FIELD_CODES as readonly string[]).includes(code)) found.add(code as CampaignFieldCode);
  }
  return CAMPAIGN_FIELD_CODES.filter((code) => found.has(code));
}

/** อ่านผลลัพธ์จาก query ของหน้าจอ — ไม่มี/ค่าเพี้ยน = null (ไม่แสดงแบนเนอร์) */
export function feedbackOf(query: {
  readonly saved?: string;
  readonly error?: string;
  readonly fields?: string;
}): HeroFeedback | null {
  const saved = (query.saved ?? "").trim();
  const error = (query.error ?? "").trim();
  if (isHeroErrorCode(error)) return { kind: "error", code: error, fields: heroFieldsOf(query) };
  if (isHeroSavedCode(saved)) return { kind: "saved", code: saved };
  return null;
}

/**
 * ปลายทางกลับเมื่อค่าที่ส่งมาไม่ผ่าน — **บอกด้วยว่าช่องไหน** (รอบที่ 195)
 * ใช้ร่วมกันทุก action ของแคมเปญ (บันทึก · เผยแพร่) เพื่อให้ข้อความบนหน้าจอตรงกัน
 */
export function invalidCampaignHref(problems: readonly string[]): string {
  const fields = campaignProblemFields(problems).join(",");
  return `/admin/hero?tab=campaigns&error=invalid${fields === "" ? "" : `&fields=${fields}`}`;
}
