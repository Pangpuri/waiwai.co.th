/**
 * สถานะของฟอร์มล็อกอิน — **แยกจากไฟล์ Server Action**
 *
 * เหตุผล: ไฟล์ที่ขึ้นต้นด้วย `"use server"` ส่งออกได้เฉพาะ async function เท่านั้น
 * (ถ้าส่งออกค่าคงที่/type จากไฟล์นั้น build จะฟ้อง) จึงวาง type + ค่าเริ่มต้นไว้ที่นี่
 */

/** รหัสข้อผิดพลาด — ไม่ใช่ข้อความ (หน้าจอแปลเองจากพจนานุกรม) */
export type LoginErrorKey = "required" | "invalid" | "notConfigured" | "server" | "locked";

/** ล็อกอยู่ = ต้องบอกผู้ใช้ให้รู้ว่ารออีกกี่นาที (ไม่บอกว่าใครถูกล็อก/มีบัญชีไหม) */
export type LockedInfo = { readonly minutes: number };

export type LoginState = {
  readonly error: LoginErrorKey | null;
  readonly locked?: LockedInfo | null;
};

export const INITIAL_LOGIN_STATE: LoginState = { error: null };
