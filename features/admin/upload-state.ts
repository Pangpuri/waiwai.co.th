/**
 * สถานะการอัปโหลดภาพ — แยกจากไฟล์ Server Action (`"use server"` ส่งออกได้เฉพาะ async function)
 *
 * `reason` เป็น "รหัส" ไม่ใช่ข้อความ ⇒ หน้าจอแปลเป็นภาษาไทย/อังกฤษจากพจนานุกรม
 */

export type UploadFailure =
  | "no-file"
  | "empty-file"
  | "too-large"
  | "not-image"
  | "database"
  | "unauthorized";

export type UploadState = {
  readonly status: "idle" | "ok" | "error";
  /** พาธที่บันทึกได้ เช่น `/media/AbC123xyz` (พาธ ไม่ใช่ URL เต็ม — มติ D9) */
  readonly path: string | null;
  readonly filename: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly reason: UploadFailure | null;
};

export const INITIAL_UPLOAD_STATE: UploadState = {
  status: "idle",
  path: null,
  filename: null,
  width: null,
  height: null,
  reason: null,
};
