/**
 * สถานะของปุ่มในถังขยะ (X2.4) — แยกจากไฟล์ Server Action
 * (`"use server"` ส่งออกได้เฉพาะ async function — มีด่าน `check:actions` คุมอยู่)
 *
 * `code` เป็น "รหัส" ไม่ใช่ข้อความ ⇒ หน้าจอแปลจากพจนานุกรม
 */

export type TrashActionCode =
  | "restored"
  | "deleted"
  | "emptied"
  | "missing"
  | "invalid"
  | "db-missing";

export type TrashActionState = {
  readonly status: "idle" | "ok" | "failed";
  readonly code: TrashActionCode | null;
  /** ใช้กับข้อความที่มีตัวเลข (เช่น "ลบถาวรทั้งหมดแล้ว N รายการ") */
  readonly count: number | null;
};

export const INITIAL_TRASH_STATE: TrashActionState = { status: "idle", code: null, count: null };
