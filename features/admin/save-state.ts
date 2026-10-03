/**
 * สถานะของฟอร์มแก้เนื้อหา — แยกจากไฟล์ Server Action
 * (ไฟล์ `"use server"` ส่งออกได้เฉพาะ async function เท่านั้น)
 */

/** ปัญหาหนึ่งข้อที่แสดงให้ผู้ใช้เห็น (แปลจากรหัสของ validator) */
export type ShownIssue = {
  readonly code: string;
  readonly path: string;
};

export type SaveState = {
  readonly status: "idle" | "saved" | "invalid" | "failed";
  readonly written: number;
  readonly deleted: number;
  readonly errors: readonly ShownIssue[];
  /** จำนวนคำเตือน (placeholder/ลายน้ำ) — ไม่บล็อกการบันทึก */
  readonly warnings: number;
  /** ปัญหาด้านเทคนิค เช่น payload ไม่ใช่ JSON (แสดงเป็นข้อความสั้น ๆ) */
  readonly problems: readonly string[];
};

export const INITIAL_SAVE_STATE: SaveState = {
  status: "idle",
  written: 0,
  deleted: 0,
  errors: [],
  warnings: 0,
  problems: [],
};
