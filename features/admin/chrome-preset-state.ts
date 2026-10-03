/**
 * สถานะของปุ่มในแผง "พรีเซ็ตของส่วนกลาง" (W3b) — แยกจากไฟล์ Server Action
 * (`"use server"` ส่งออกได้เฉพาะ async function — มีด่าน `check:actions` คุมอยู่)
 *
 * `code` เป็น "รหัส" ไม่ใช่ข้อความ ⇒ หน้าจอแปลจากพจนานุกรม (สองภาษา)
 */

export type ChromePresetActionCode =
  | "saved"
  | "saved-default"
  | "overwritten"
  | "applied"
  | "deleted"
  | "bad-name"
  | "invalid"
  | "too-many"
  | "not-found"
  | "no-database";

export type ChromePresetActionState = {
  readonly status: "idle" | "ok" | "failed";
  readonly code: ChromePresetActionCode | null;
};

export const INITIAL_CHROME_PRESET_STATE: ChromePresetActionState = { status: "idle", code: null };
