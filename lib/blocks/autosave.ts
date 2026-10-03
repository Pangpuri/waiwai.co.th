/**
 * นโยบาย "บันทึกอัตโนมัติ" (X1.5) — ตรรกะล้วน ทดสอบได้โดยไม่ต้องมี React
 *
 * ทำไมแยกออกมา: ตัวตัดสินใจมีกติกาที่ **ห้ามพลาด** (บันทึกทับงานที่มีข้อผิดพลาด = ผู้ใช้เสียของ)
 * จึงต้องมีที่เดียวที่ตัดสิน และมีเทสต์คุม — ส่วนหน้าจอมีหน้าที่แค่ตั้งเวลาแล้วเรียก
 *
 * กติกาที่ตกลง
 * | สถานการณ์ | ผล |
 * |---|---|
 * | ผู้ใช้ปิดสวิตช์ "บันทึกอัตโนมัติ" | ไม่บันทึก |
 * | ยังไม่มีความต่างจากฉบับที่บันทึกไว้ | ไม่บันทึก (ไม่ยิง DB เปล่า ๆ) |
 * | มี error ที่ทำให้บันทึกไม่ได้ | **ไม่บันทึก** แล้วรอให้ผู้ใช้แก้ก่อน (โชว์เหตุผลบนหน้าจอ) |
 * | กำลังบันทึกอยู่ | รอรอบถัดไป (ไม่ยิงซ้อน) |
 * | เหลือกรณีเดียว | ตั้งเวลาแล้วบันทึก |
 */

/** หน่วงหลังผู้ใช้หยุดแก้ ก่อนบันทึกอัตโนมัติ (มิลลิวินาที) */
export const AUTOSAVE_DELAY_MS = 3000;

export type AutosaveDecision = "schedule" | "not-needed" | "blocked-errors" | "disabled" | "in-flight";

export type AutosaveInput = {
  /** สวิตช์ในหน้าจอ (ผู้ใช้ปิดได้) */
  readonly enabled: boolean;
  /** มีความต่างจากฉบับที่บันทึกล่าสุดหรือไม่ */
  readonly dirty: boolean;
  /** จำนวน error ของ validator (0 = บันทึกได้) */
  readonly errorCount: number;
  /** กำลังบันทึกอยู่หรือไม่ */
  readonly saving: boolean;
};

export function decideAutosave(input: AutosaveInput): AutosaveDecision {
  if (!input.enabled) return "disabled";
  if (!input.dirty) return "not-needed";
  if (input.errorCount > 0) return "blocked-errors";
  if (input.saving) return "in-flight";
  return "schedule";
}

/** ต้องเตือนผู้ใช้ก่อนออกจากหน้านี้หรือไม่ (ใช้ทั้งตัวเตือนและตัวโชว์สถานะ) */
export function needsLeaveWarning(dirty: boolean): boolean {
  return dirty;
}

/** ข้อความเวลาสั้น ๆ จาก ISO (YYYY-MM-DDTHH:MM:SS…) — ให้ตรงกับรูปแบบที่หน้าจออื่นใช้อยู่ */
export function shortTimeOf(iso: string | null): string | null {
  if (iso === null) return null;
  return iso.slice(0, 16).replace("T", " ");
}
