/**
 * ประกาศไว้อาลัย — สถานะ "ปิดแล้ว" ของผู้ใช้
 *
 * โครงเดียวกับ lib/cookie-consent.ts (ตั้งใจ) เพราะแก้ปัญหาเดียวกัน:
 * ค่าจริงอยู่ใน localStorage ซึ่งเซิร์ฟเวอร์ไม่รู้ ถ้าปล่อยให้ React ค่อยตัดสินหลัง hydrate
 * หน้าต่างจะวาบขึ้นมาแล้วหายไป → จึงใช้ attribute บน <html> ที่ตั้งโดยสคริปต์ก่อน paint
 *
 * ⚠️ ต่างจากแถบคุกกี้หนึ่งจุด: หน้าต่างนี้ **บังทั้งจอ** ถ้าปิดไม่ได้ผู้ใช้จะใช้งานเว็บไม่ได้เลย
 * จึงเลือก "ซ่อนไว้ก่อน แล้วค่อยโชว์" — CSS จะแสดงก็ต่อเมื่อสคริปต์ยืนยันแล้วว่าผู้ใช้ยังไม่เคยกดปิด
 * (ถ้าเบราว์เซอร์ไม่รัน JavaScript เลย หน้าต่างจะไม่ขึ้น — ดีกว่าเปิด modal ที่กดปิดไม่ได้)
 */

export const MOURNING_STORAGE_KEY = "waiwai-mourning-dismissed";

/** attribute ที่ติดบน <html> — ต้องตรงกับกฎ CSS ใน app/globals.css */
export const MOURNING_ATTRIBUTE = "data-mourning";

/** สคริปต์ตั้งค่านี้เมื่อยังไม่เคยปิด → CSS เปิดหน้าต่าง */
export const MOURNING_STATE_SHOWN = "shown";

/** ค่าที่ตั้งหลังผู้ใช้กดปิด (CSS จะไม่แสดงผลแล้ว และอ่านใน devtools ได้ว่าปิดไปแล้ว) */
export const MOURNING_STATE_DISMISSED = "dismissed";

/**
 * ค่าที่ถือว่า "ผู้ใช้ปิดแล้ว" — สคริปต์ก่อน paint และตัวคอมโพเนนต์ใช้ตัวเดียวกัน
 * กันเคสที่สองฝั่งตีความค่าไม่ตรงกัน (หน้าต่างจะเด้งขึ้นมาทั้งที่เพิ่งกดปิดไป)
 */
export function isMourningDismissed(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

/**
 * สคริปต์ก่อน paint: ถ้าผู้ใช้เคยกดปิดแล้ว → ไม่ต้องติด attribute (หน้าต่างจะไม่ขึ้นเลย)
 * ถ้ายังไม่เคย → ติด attribute ให้ CSS เปิดหน้าต่างตั้งแต่เฟรมแรก ไม่มีอาการวาบ
 */
export const MOURNING_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(
  MOURNING_STORAGE_KEY,
)});if(v)return;document.documentElement.setAttribute(${JSON.stringify(
  MOURNING_ATTRIBUTE,
)},${JSON.stringify(MOURNING_STATE_SHOWN)});}catch(_){}})();`;
