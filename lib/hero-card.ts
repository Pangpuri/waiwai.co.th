/**
 * การ์ดประกาศบน hero หน้าแรก — สถานะ "ปิดไว้ถึงสิ้นวัน"
 *
 * โครงเดียวกับ `lib/mourning-notice.ts` (และใช้ตรรกะวันชุดเดียวกันจาก `lib/day-mute.ts`):
 * ค่าจริงอยู่ใน storage ของเบราว์เซอร์ → สคริปต์ก่อน paint เป็นคนติด attribute บน <html>
 * แล้ว CSS เป็นคนตัดสินว่าแสดงหรือไม่ → ไม่มีอาการ "การ์ดวาบขึ้นมาแล้วหายไป"
 *
 * ── กติกาที่ตกลงกับผู้ใช้ (รอบที่ 21) ──────────────────────────────────────────
 * เหมือนประกาศไว้อาลัย: **แสดงทุกครั้งที่โหลดหน้า** และผู้ใช้เลือกตอนกดปิดได้ว่า
 * "ไม่แสดงอีกในวันนี้" → เก็บวันที่ที่ปิดไว้ เทียบกับวันที่ของเครื่องผู้ใช้ (เวลาท้องถิ่น)
 * พอขึ้นวันใหม่การ์ดก็กลับมาเอง
 *
 * ทำไมต้องมีสคริปต์ก่อน paint ทั้งที่การ์ดเล็ก: การ์ดนี้ลอยทับภาพ hero ซึ่งเป็นสิ่งที่ผู้ใช้
 * เห็นเป็นอย่างแรก ๆ ถ้าปล่อยให้โผล่หลัง hydrate จะเห็น "การ์ดตุ๊บขึ้นมา" กลางจอ
 */

import { buildDayMuteInitScript, dayStamp, isMutedToday } from "@/lib/day-mute";

export const HERO_CARD_STORAGE_KEY = "waiwai-hero-card-muted-date";

/** attribute ที่ติดบน <html> — ต้องตรงกับกฎ CSS ใน app/globals.css */
export const HERO_CARD_ATTRIBUTE = "data-hero-card";

/** สคริปต์ตั้งค่านี้เมื่อรอบนี้ต้องแสดง → CSS เปิดการ์ด */
export const HERO_CARD_STATE_SHOWN = "shown";

/** ค่าที่ตั้งหลังผู้ใช้กดปิด (CSS ไม่แสดงผลแล้ว) */
export const HERO_CARD_STATE_MUTED = "muted";

/** วันที่ในรูปแบบ `YYYY-MM-DD` ตามเวลาท้องถิ่น (ดู lib/day-mute.ts) */
export const heroCardDateStamp = dayStamp;

/** ผู้ใช้ขอปิดการ์ดไว้ "ถึงสิ้นวันนี้" หรือไม่ */
export const isHeroCardMuted = isMutedToday;

/** สคริปต์ก่อน paint ของการ์ดประกาศบน hero */
export const HERO_CARD_INIT_SCRIPT = buildDayMuteInitScript({
  storageKey: HERO_CARD_STORAGE_KEY,
  attribute: HERO_CARD_ATTRIBUTE,
  shownValue: HERO_CARD_STATE_SHOWN,
});
