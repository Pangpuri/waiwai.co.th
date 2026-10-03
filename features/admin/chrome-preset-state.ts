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
  | "undo-done"
  | "undo-missing"
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

/**
 * สถานะของ "นำเข้าชุดจากไฟล์" (W3b ต่อ · รอบที่ 91) — แยกจากสถานะเดิม
 * เพราะต้องรายงาน **จำนวนที่นำเข้า/ข้าม** ไม่ใช่แค่รหัสผลลัพธ์
 */
export type ChromePresetImportCode = "imported" | "bad-json" | "bad-format" | "empty" | "too-many" | "no-database";

export type ChromePresetImportState = {
  readonly status: "idle" | "ok" | "failed";
  readonly code: ChromePresetImportCode | null;
  readonly imported: number;
  readonly skipped: number;
};

export const INITIAL_CHROME_PRESET_IMPORT_STATE: ChromePresetImportState = {
  status: "idle",
  code: null,
  imported: 0,
  skipped: 0,
};
