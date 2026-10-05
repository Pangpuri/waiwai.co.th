/**
 * สถานะการบันทึกข่าว (รอบที่ 123) — ใช้กับ `useActionState` ของฟอร์มแก้ข่าว
 *
 * แยกไฟล์ตามแบบเดียวกับ `features/admin/upload-state.ts`
 * - Server Action **ไม่ส่งข้อความ** กลับไป (ไม่มีพจนานุกรมฝั่งนั้น) → ส่งแค่ "รหัสเหตุผล"
 * - ฝั่งจอภาพแปลงรหัส → ข้อความจากพจนานุกรมเอง (krit: ข้อความทั้งหมดมาจากพจนานุกรม)
 */

export type NewsSaveReason = "title" | "body" | "database" | "not-found" | null;

export type NewsSaveStatus = "idle" | "saved" | "draft" | "error";

export type NewsSaveState = {
  readonly status: NewsSaveStatus;
  readonly reason: NewsSaveReason;
  /** id ของข่าวที่เพิ่งสร้าง (ใช้พาไปหน้าแก้ไขต่อ) */
  readonly createdId: string | null;
};

export const INITIAL_NEWS_SAVE_STATE: NewsSaveState = { status: "idle", reason: null, createdId: null };
