/**
 * ตรรกะกลางของ "สไลด์" — ใช้ทั้งสไลด์ภาพหน้าแรก และหน้าต่างประกาศไว้อาลัย
 *
 * เป็น pure module (ไม่แตะ DOM/React/Next.js) เพื่อให้ `node --test` ตรวจได้ตรง ๆ
 * — บังคับด้วยกฎข้อ 11 ของโปรเจกต์: เทสต์ import ได้เฉพาะไฟล์ `.ts` ที่ไม่มี JSX
 */

/**
 * เวลาต่อภาพของสไลด์หน้าแรก
 *
 * ตั้งใจให้ช้ากว่าที่พบทั่วไป (~3–5 วินาที) เพราะผู้ใช้สั่งว่า "ค่อย ๆ เลื่อน"
 * และฉากหลังไม่ควรแย่งความสนใจจากข้อความ/ปุ่มที่ทับอยู่
 */
export const HERO_SLIDE_INTERVAL_MS = 7000;

/**
 * ระยะจางข้ามภาพ (ms) — ต้องตรงกับ transition ของ `[data-hero-slide]` ใน app/globals.css
 * (CSS import ค่าจากไฟล์นี้ไม่ได้ จึงมี unit test คอยเทียบให้ตรงกัน)
 */
export const HERO_SLIDE_FADE_MS = 1400;

/**
 * เลื่อน index แบบวนรอบ — ไม่มีทางหลุดช่วง แม้ `current` จะเพี้ยน
 *
 * `step` ติดลบได้ (ใช้กับปุ่ม "ก่อนหน้า") และค่าที่ไม่ใช่จำนวนเต็ม/ไม่ใช่ตัวเลข
 * จะถูกปรับให้เป็น 0 แทนที่จะคืน NaN ซึ่งจะทำให้ `slides[NaN]` เป็น undefined
 */
export function advanceIndex(current: number, total: number, step = 1): number {
  if (!Number.isInteger(total) || total <= 0) return 0;

  const safeCurrent = Number.isFinite(current) ? Math.trunc(current) : 0;
  const safeStep = Number.isFinite(step) ? Math.trunc(step) : 0;

  // เศษที่ติดลบ (JS ให้ -1 % 3 = -1) ต้องบวก total กลับให้อยู่ในช่วง 0..total-1
  return (((safeCurrent + safeStep) % total) + total) % total;
}

/**
 * ควรแสดงปุ่มลูกศร/จุดบอกตำแหน่งหรือไม่
 *
 * มีภาพเดียว = ไม่มีอะไรให้เลื่อน → ซ่อนตัวควบคุมทั้งหมด
 * (ผู้ใช้เลือกทางนี้ไว้สำหรับหน้าต่างไว้อาลัยที่ตอนนี้มีภาพเดียว แต่จะเพิ่มภาพที่ 2 ภายหลัง)
 */
export function hasSlideControls(total: number): boolean {
  return Number.isInteger(total) && total > 1;
}

/**
 * ตอนนี้อยู่ภาพสุดท้ายแล้วหรือยัง
 *
 * ใช้กับการ์ดที่บังคับให้ "ดูให้ครบทุกภาพก่อนปิด" — ปุ่มหลักของหน้าต่างนั้น
 * จะเป็น "ไปภาพถัดไป" จนกว่าจะถึงภาพสุดท้าย แล้วจึงเปลี่ยนเป็น "ปิด"
 *
 * - มีภาพเดียว (หรือไม่มีภาพ) → ถือว่าอยู่ภาพสุดท้ายแล้ว → ปุ่มปิดทำงานทันที (พฤติกรรมเดิม)
 * - index หลุดช่วง (เช่น เกินไปเพราะข้อมูลเปลี่ยน) → ถือว่าถึงภาพสุดท้าย ไม่ให้ค้างปิดไม่ได้
 */
export function isLastSlide(index: number, total: number): boolean {
  if (!Number.isInteger(total) || total <= 0) return true;
  if (!Number.isFinite(index)) return true;
  return Math.trunc(index) >= total - 1;
}
