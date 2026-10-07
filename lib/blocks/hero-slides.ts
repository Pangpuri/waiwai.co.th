/**
 * ค่าคงที่ + พรีเซ็ต + ตัวคำนวณสไตล์ของ "สไลด์" ในบล็อก hero (รอบที่ 183)
 *
 * แยกไฟล์เพื่อให้ **หลังบ้าน (ตัวแก้)** กับ **หน้าเว็บ (ตัวเรนเดอร์)** ใช้ค่าเดียวกัน
 * และเทสต์ตรวจได้โดยไม่ต้องมี DOM/DB · ชนิดข้อมูลอยู่ที่ `lib/blocks/types.ts`
 *
 * เฟส (ก) = ชนิดข้อมูล/ตัวอ่านค่า/ตัวช่วยแก้ไข · เฟส (ข) = ตัวคำนวณสไตล์สำหรับการแสดงผล (ไฟล์นี้)
 */

import { MAX_HERO_SLIDES } from "@/lib/blocks/types";

/** เวลาที่ภาพหนึ่งใบอยู่ในกรอบ (วินาที) — ทั้งชุดใช้เวลานี้ × จำนวนภาพ */
export const HERO_SLIDE_SECONDS = 5;

/**
 * จุดโฟกัสที่ให้เลือก 9 จุด (3×3) — เก็บเป็น **เปอร์เซ็นต์ของภาพ**
 * ⚠️ ค่านี้ถูกใช้เป็น `object-position` ตรง ๆ (ไม่มีการแปลงหน่วย)
 */
export const HERO_FOCUS_PRESETS: readonly { readonly id: string; readonly x: number; readonly y: number }[] = [
  { id: "top-left", x: 0, y: 0 },
  { id: "top", x: 50, y: 0 },
  { id: "top-right", x: 100, y: 0 },
  { id: "left", x: 0, y: 50 },
  { id: "center", x: 50, y: 50 },
  { id: "right", x: 100, y: 50 },
  { id: "bottom-left", x: 0, y: 100 },
  { id: "bottom", x: 50, y: 100 },
  { id: "bottom-right", x: 100, y: 100 },
];

/** ระดับซูมที่ให้เลือก (ครอบภาพให้แน่นขึ้นโดยไม่ตัดไฟล์) — 1 = พอดีกรอบ */
export const HERO_ZOOM_PRESETS: readonly number[] = [1, 1.15, 1.3, 1.5, 1.75, 2];

/** id ของจุดโฟกัสที่ตรงกับค่าที่เก็บไว้ (ไม่ตรงกับพรีเซ็ตใด = `null` ⇒ หน้าจอเลือก "กำหนดเอง") */
export function heroFocusPresetId(x: number, y: number): string | null {
  return HERO_FOCUS_PRESETS.find((preset) => preset.x === x && preset.y === y)?.id ?? null;
}

/* ── เฟส (ข): ตัวคำนวณสไตล์สำหรับการแสดงผล (ตรรกะล้วน — เทสต์ได้โดยไม่มี DOM) ──────
   หน้าเว็บหมุนภาพเองด้วย CSS ล้วน (ไม่มี JS) ⇒ ที่นี่คำนวณ "คลาส" กับ "CSS variable" ให้แต่ละใบ
   ⚠️ ชื่อคีย์ต้องตรงกับที่ `app/globals.css` ใช้ (`--hero-delay` · `--hero-span` · `--hero-focus` · `--hero-zoom`)
*/

/** คลาสของกล่องสไลด์ (ใช้เลือกชุด keyframes ตามจำนวนใบ) — ค่าที่ไม่รู้จักถูกบีบให้อยู่ในช่วง 2..6 */
export const HERO_SLIDESHOW_CLASS = "hero-slideshow";

export function heroSlideshowClass(count: number): string {
  const safe = Math.min(MAX_HERO_SLIDES, Math.max(2, Math.round(count)));
  return `hero-slides-${safe}`;
}

/** CSS variable ที่ตัวเรนเดอร์ส่งให้แต่ละสไลด์ */
export type HeroSlideStyleVars = Readonly<Record<string, string>>;

/**
 * สร้าง CSS variable ของสไลด์ใบที่ `index` (จากทั้งหมด `count` ใบ)
 * - `--hero-delay` = ใบนี้เริ่มเมื่อไร (สล็อตของตัวเองในรอบเดียว)
 * - `--hero-span`  = ความยาวหนึ่งรอบ = เวลาต่อภาพ × จำนวนใบ
 * - `--hero-focus` = จุดโฟกัสเป็น `X% Y%` (ใช้เป็น `object-position`) · `--hero-zoom` = ตัวคูณ `scale()`
 */
export function heroSlideVars(
  index: number,
  count: number,
  slide: { readonly focusX: number; readonly focusY: number; readonly zoom: number },
): HeroSlideStyleVars {
  const safeCount = Math.max(1, Math.round(count));
  const safeIndex = Math.min(safeCount - 1, Math.max(0, Math.round(index)));
  return {
    "--hero-delay": `${safeIndex * HERO_SLIDE_SECONDS}s`,
    "--hero-span": `${safeCount * HERO_SLIDE_SECONDS}s`,
    "--hero-focus": `${slide.focusX}% ${slide.focusY}%`,
    "--hero-zoom": `${slide.zoom}`,
  };
}
