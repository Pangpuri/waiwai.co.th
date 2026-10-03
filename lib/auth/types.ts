/**
 * ชนิดข้อมูลของ "ผู้ดูแลหลังบ้าน" (ฝั่งเซิร์ฟเวอร์เท่านั้น)
 *
 * ⚠️ ไฟล์นี้ต้องไม่มีโค้ดที่แตะ DB/DOM → ใช้ได้ทั้งในเทสต์และใน Server Component
 */

/** บทบาทตาม BACKEND_DECISIONS.md § 4 (เริ่มจาก 3 บทบาทที่ตกลงไว้) */
export type AdminRole = "editor" | "publisher" | "admin";

export const ADMIN_ROLES: readonly AdminRole[] = ["editor", "publisher", "admin"];

/** บัญชีผู้ดูแล — ไม่มีรหัสผ่าน (เก็บแยกเป็น hash) */
export type AdminUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AdminRole;
  readonly disabled: boolean;
};

/** ข้อมูลที่ใส่ในคุกกี้เซสชัน — เก็บให้น้อยที่สุด (ไม่ใส่ชื่อ/อีเมล ตามคำแนะนำของเอกสาร Next) */
export type SessionPayload = {
  readonly userId: string;
  readonly role: AdminRole;
  /** เวลาหมดอายุ (epoch ms) */
  readonly expiresAt: number;
  /**
   * รหัสเซสชันในตาราง `admin_session` (รอบที่ 95) — มีค่าเมื่อระบบมีฐานข้อมูล
   * ไม่มี = โหมดไม่มีฐานข้อมูล (เดโม) ซึ่ง **เพิกถอนไม่ได้โดยตั้งใจ** ให้ยังเข้าได้ในโหมดสาธิต
   */
  readonly sid?: string;
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}
