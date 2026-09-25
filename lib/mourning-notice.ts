/**
 * ประกาศไว้อาลัย — กติกาว่า "รอบนี้จะแสดงไหม" และ "ผู้ใช้ขอปิดไว้ถึงเมื่อไหร่"
 *
 * โครงเดียวกับ lib/cookie-consent.ts (ตั้งใจ) เพราะแก้ปัญหาเดียวกัน:
 * ค่าจริงอยู่ใน storage ของเบราว์เซอร์ ซึ่งเซิร์ฟเวอร์ไม่รู้ ถ้าปล่อยให้ React ค่อยตัดสินหลัง hydrate
 * หน้าต่างจะวาบขึ้นมาแล้วหายไป → จึงใช้ attribute บน <html> ที่ตั้งโดยสคริปต์ก่อน paint
 *
 * ⚠️ ต่างจากแถบคุกกี้หนึ่งจุด: หน้าต่างนี้ **บังทั้งจอ** ถ้าปิดไม่ได้ผู้ใช้จะใช้งานเว็บไม่ได้เลย
 * จึงเลือก "ซ่อนไว้ก่อน แล้วค่อยโชว์" — CSS จะแสดงก็ต่อเมื่อสคริปต์ยืนยันแล้ว
 * (ถ้าเบราว์เซอร์ไม่รัน JavaScript เลย หน้าต่างจะไม่ขึ้น — ดีกว่าเปิด modal ที่กดปิดไม่ได้)
 *
 * ── กติกาที่ตกลงกับผู้ใช้ (รอบที่ 21) ──────────────────────────────────────────
 * ค่าเริ่มต้น: **แสดงทุกครั้งที่โหลดหน้า** (รีเฟรช = เห็นอีก)
 * แต่ผู้ใช้เลือกได้ตอนกดปิด: ติ๊ก "ไม่แสดงอีกในวันนี้" → เก็บ "วันที่ที่ปิด" ไว้
 * แล้วสคริปต์จะเทียบกับวันที่ของเครื่องผู้ใช้ (เวลาท้องถิ่น) → วันที่ตรงกัน = ไม่แสดง
 * พอขึ้นวันใหม่ก็แสดงอีกเองโดยไม่ต้องมีใครมาล้างค่า
 *
 * หมายเหตุ: การกดลิงก์ไปหน้าอื่นในเว็บ (client-side navigation) **ไม่**ทำให้หน้าต่างเด้งซ้ำ
 * เพราะสคริปต์นี้รันตอน "โหลดเอกสาร" เท่านั้น (ดู features/shell/ui/inline-script.tsx)
 */

export const MOURNING_STORAGE_KEY = "waiwai-mourning-muted-date";

/** attribute ที่ติดบน <html> — ต้องตรงกับกฎ CSS ใน app/globals.css */
export const MOURNING_ATTRIBUTE = "data-mourning";

/** สคริปต์ตั้งค่านี้เมื่อรอบนี้ต้องแสดง → CSS เปิดหน้าต่าง */
export const MOURNING_STATE_SHOWN = "shown";

/** ค่าที่ตั้งหลังผู้ใช้กดปิด (CSS ไม่แสดงผลแล้ว และอ่านใน devtools ได้ว่าปิดรอบนี้ไปแล้ว) */
export const MOURNING_STATE_MUTED = "muted";

/**
 * วันนี้ในรูปแบบ `YYYY-MM-DD` ตาม **เวลาท้องถิ่น** ของเครื่องผู้ใช้
 *
 * จงใจไม่ใช้ `toISOString()` เพราะค่านั้นเป็น UTC — ผู้ใช้ในไทย (UTC+7) ที่เปิดเว็บช่วงเช้าตรู่
 * จะได้ "เมื่อวาน" แล้วหน้าต่างจะเด้งทั้งวันที่ตั้งใจปิดไว้
 */
export function mourningDateStamp(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** ผู้ใช้ขอปิดไว้ "ถึงสิ้นวันนี้" และวันนี้คือวันเดียวกับที่ปิดไว้หรือไม่ */
export function isMourningMuted(stored: unknown, today: string): boolean {
  return typeof stored === "string" && stored === today;
}

/**
 * สคริปต์ก่อน paint: แสดงเป็นค่าเริ่มต้น เว้นแต่ผู้ใช้เคยกดปิดไว้ "ในวันเดียวกัน"
 *
 * - เทียบวันที่แบบเวลาท้องถิ่น (สร้างสตริงเองให้ตรงกับ `mourningDateStamp`)
 * - ถ้าอ่าน storage ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) → **ยังคงแสดง** เพราะยังรัน JS อยู่
 *   จึงกดปิดได้ปกติ และการ "พลาดประกาศ" เสียหายกว่าการเห็นซ้ำหนึ่งครั้ง
 *   (ต่างจากกรณีไม่มี JavaScript เลย ซึ่งสคริปต์ไม่ทำงานและหน้าต่างไม่ขึ้น — เลี่ยง modal ที่ปิดไม่ได้)
 */
export const MOURNING_INIT_SCRIPT = `(function(){try{var d=new Date(),today=d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);if(localStorage.getItem(${JSON.stringify(
  MOURNING_STORAGE_KEY,
)})===today)return;}catch(_){}document.documentElement.setAttribute(${JSON.stringify(
  MOURNING_ATTRIBUTE,
)},${JSON.stringify(MOURNING_STATE_SHOWN)});})();`;
