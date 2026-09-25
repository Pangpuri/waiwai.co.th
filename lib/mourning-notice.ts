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
 * พอขึ้นวันใหม่ก็แสดงอีกเองโดยไม่มีใครมาล้างค่า
 *
 * ตรรกะวัน/สคริปต์ย้ายไปอยู่ที่ `lib/day-mute.ts` (ใช้ร่วมกับการ์ดประกาศบน hero)
 * ที่นี่เหลือแค่ชื่อเฉพาะของประกาศชุดนี้
 *
 * หมายเหตุ: การกดลิงก์ไปหน้าอื่นในเว็บ (client-side navigation) **ไม่**ทำให้หน้าต่างเด้งซ้ำ
 * เพราะสคริปต์นี้รันตอน "โหลดเอกสาร" เท่านั้น (ดู features/shell/ui/inline-script.tsx)
 */

import { buildDayMuteInitScript, dayStamp, isMutedToday } from "@/lib/day-mute";

export const MOURNING_STORAGE_KEY = "waiwai-mourning-muted-date";

/** attribute ที่ติดบน <html> — ต้องตรงกับกฎ CSS ใน app/globals.css */
export const MOURNING_ATTRIBUTE = "data-mourning";

/** สคริปต์ตั้งค่านี้เมื่อรอบนี้ต้องแสดง → CSS เปิดหน้าต่าง */
export const MOURNING_STATE_SHOWN = "shown";

/** ค่าที่ตั้งหลังผู้ใช้กดปิด (CSS ไม่แสดงผลแล้ว และอ่านใน devtools ได้ว่าปิดรอบนี้ไปแล้ว) */
export const MOURNING_STATE_MUTED = "muted";

/** วันที่ในรูปแบบ `YYYY-MM-DD` ตามเวลาท้องถิ่น (ดู lib/day-mute.ts) */
export const mourningDateStamp = dayStamp;

/** ผู้ใช้ขอปิดไว้ "ถึงสิ้นวันนี้" หรือไม่ */
export const isMourningMuted = isMutedToday;

/**
 * สคริปต์ก่อน paint ของประกาศไว้อาลัย (รายละเอียดกติกาอยู่ใน lib/day-mute.ts)
 */
export const MOURNING_INIT_SCRIPT = buildDayMuteInitScript({
  storageKey: MOURNING_STORAGE_KEY,
  attribute: MOURNING_ATTRIBUTE,
  shownValue: MOURNING_STATE_SHOWN,
});
