/**
 * ค่าคงที่ + พรีเซ็ตของ "สไลด์" ในบล็อก hero (รอบที่ 183 · เฟส 2 ส่วน (ก))
 *
 * แยกไฟล์เพื่อให้ **หลังบ้าน (ตัวแก้)** กับ **หน้าเว็บ (ตัวเรนเดอร์)** ใช้ค่าเดียวกัน
 * และเทสต์ตรวจได้โดยไม่ต้องมี DOM/DB · ชนิดข้อมูลอยู่ที่ `lib/blocks/types.ts`
 *
 * ⚠️ เฟสนี้ยังไม่แตะหน้าจอ: มีแค่ชนิดข้อมูล · ตัวอ่านค่า (parse) · ตัวช่วยแก้ไข (edit) ที่ทดสอบได้
 */

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
