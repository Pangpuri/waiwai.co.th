/**
 * สถานะของฟอร์ม "ประกาศรับสมัครงาน" (รอบที่ 265 · มติ D26) — **ตรรกะล้วน ไม่มี Next/DB**
 *
 * แยกไฟล์แบบเดียวกับ `features/admin/{category,product,news}-state.ts`
 * เพื่อให้ client component import ได้โดยไม่ดึงโค้ด `"use server"` เข้ามาในบันเดิล
 */

/** เหตุผลที่บันทึกไม่สำเร็จ — จอแสดงข้อความจากพจนานุกรมตามรหัสนี้ (ไม่ส่งข้อความจากเซิร์ฟเวอร์) */
export type JobFormReason = "" | "database" | "invalid" | "missing" | "duplicate";

export type JobFormState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: JobFormReason;
  /** รหัสประกาศที่เพิ่งสร้าง (ใช้พาไปหน้าแก้ต่อ) — "" = ไม่มี */
  readonly createdId: string;
};

export const INITIAL_JOB_FORM_STATE: JobFormState = { status: "idle", reason: "", createdId: "" };

/** สถานะของปุ่มจัดลำดับ (ใช้ร่วมกับ `SortableList` ของเดิม) */
export type JobReorderState = { readonly saved: number; readonly failed: boolean };

export const INITIAL_JOB_REORDER_STATE: JobReorderState = { saved: 0, failed: false };
