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

/**
 * สถานะการอัปโหลดภาพเข้าคลังจากในหน้าจอแก้ข่าว (รอบที่ 126)
 * - เจ้าของขอ: "จะใช้ได้แค่ภาพที่เอามาจากอัลบั้มหรือใน database แต่ไม่สามารถอัปโหลดจากเครื่องเข้ามาใส่ข่าวได้"
 * ⇒ เพิ่มปุ่มอัปโหลดจากเครื่องในตัวแก้ข่าว (ผ่านท่อกลางเดิม: ย่อภาพ + ตรวจหัวไฟล์ + เพดาน 5MB)
 * - คืน **พาธ** `/media/<id>` กลับมา เพื่อให้ตัวแก้เอาไปใส่การ์ดได้ทันทีโดยไม่ต้องรีเฟรช
 */
export type NewsUploadState = {
  readonly status: "idle" | "ok" | "invalid" | "failed";
  /** พาธ `/media/<id>` เมื่อสำเร็จ */
  readonly path: string;
  /** รหัสเหตุผล (ข้อความจริงมาจากพจนานุกรมฝั่งจอภาพ) */
  readonly reason: string;
};

export const INITIAL_NEWS_UPLOAD_STATE: NewsUploadState = { status: "idle", path: "", reason: "" };
