/**
 * จำนวนวินาทีที่ Next ต่ออายุเพจเอง (X1.7) — ตาข่ายกันลืม
 *
 * แยกเป็นไฟล์เดี่ยวโดยตั้งใจ: หน้าเว็บหลายหน้าต้อง `export const revalidate = PAGE_REVALIDATE_SECONDS`
 * ถ้า import จาก `lib/cache/plan.ts` ตรง ๆ หน้าเว็บจะลาก `lib/rebuild.ts` (node:child_process) เข้าไปในกราฟด้วย
 * ⇒ ไฟล์นี้ **ไม่มี dependency ใด ๆ** จึง import ได้จากทุกที่ (หน้าเว็บ/route handler/เทสต์)
 *
 * ค่า 300 วิ = 5 นาที
 * - ISR ทำให้เพจถูกสร้างใหม่ "ตามเวลา" แม้ไม่มีใครกดเผยแพร่ (กันข้อมูลค้างถ้าลืมกด)
 * - และการกดเผยแพร่จากหลังบ้านจะสั่ง `revalidatePath()` ให้สร้างใหม่ทันที (ไม่ต้องรอ 5 นาที)
 */
export const PAGE_REVALIDATE_SECONDS = 300;
