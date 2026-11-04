/**
 * สถานะของปุ่มในหน้าลิงก์พรีวิว (X2.6) — แยกจากไฟล์ Server Action
 * (`"use server"` ส่งออกได้เฉพาะ async function — มีด่าน `check:actions` คุมอยู่)
 *
 * `code` เป็น "รหัส" ไม่ใช่ข้อความ ⇒ หน้าจอแปลจากพจนานุกรม
 */

export type PreviewLinkActionCode =
  | "created"
  | "revoked"
  | "deleted"
  | "deleted-many"
  | "too-many"
  | "no-database"
  | "invalid"
  | "missing"
  | "not-closed"
  | "confirm-required";

export type PreviewLinkActionState = {
  readonly status: "idle" | "ok" | "failed";
  readonly code: PreviewLinkActionCode | null;
  /**
   * ⚠️ ลิงก์เต็ม **แสดงครั้งเดียว** หลังสร้าง (ฐานข้อมูลเก็บแต่ hash)
   * ⇒ เก็บเฉพาะในหน่วยความจำของหน้าจอ ไม่เขียนลงที่อื่น
   */
  readonly path: string | null;
  /** จำนวนแถวที่ลบจริง (ใช้กับ `deleted-many`) — null = ไม่เกี่ยวกับการลบ */
  readonly deleted: number | null;
};

export const INITIAL_PREVIEW_LINK_STATE: PreviewLinkActionState = { status: "idle", code: null, path: null, deleted: null };
