/**
 * สถานะของปุ่มในหน้าลิงก์พรีวิว (X2.6) — แยกจากไฟล์ Server Action
 * (`"use server"` ส่งออกได้เฉพาะ async function — มีด่าน `check:actions` คุมอยู่)
 *
 * `code` เป็น "รหัส" ไม่ใช่ข้อความ ⇒ หน้าจอแปลจากพจนานุกรม
 */

export type PreviewLinkActionCode = "created" | "revoked" | "too-many" | "no-database" | "invalid" | "missing";

export type PreviewLinkActionState = {
  readonly status: "idle" | "ok" | "failed";
  readonly code: PreviewLinkActionCode | null;
  /**
   * ⚠️ ลิงก์เต็ม **แสดงครั้งเดียว** หลังสร้าง (ฐานข้อมูลเก็บแต่ hash)
   * ⇒ เก็บเฉพาะในหน่วยความจำของหน้าจอ ไม่เขียนลงที่อื่น
   */
  readonly path: string | null;
};

export const INITIAL_PREVIEW_LINK_STATE: PreviewLinkActionState = { status: "idle", code: null, path: null };
