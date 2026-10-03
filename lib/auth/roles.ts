import { ADMIN_ROLES, type AdminRole } from "@/lib/auth/types";

/**
 * RBAC (X1.10) — **บทบาท → สิทธิ์** (ตรรกะล้วน: ไม่แตะ DB/DOM/Next)
 *
 * ทำไมต้องแยกไฟล์นี้
 * - การตัดสินสิทธิ์ต้องมี **ที่เดียว** ที่อ่านออกได้ทั้งระบบ (ไม่กระจาย if ไปทุกหน้า/ทุก action)
 * - และต้องทดสอบได้โดยไม่ต้องมีฐานข้อมูล (`node --test`) ⇒ ที่นี่เก็บ "รหัสสิทธิ์" เท่านั้น
 *   ส่วนข้อความที่ผู้ใช้เห็นอยู่ในพจนานุกรม (th/en)
 *
 * 3 บทบาท (มติ BACKEND_DECISIONS.md § 4 — ตรงกับ `admin_user.role`)
 * - `editor`    = ทำงานเนื้อหา: สร้าง/แก้บล็อก · จัดการคลังภาพ · พรีวิว · พรีเซ็ต
 * - `publisher` = editor + กล่องข้อความลูกค้า (ข้อมูลส่วนบุคคล) + SEO + ถังขยะ (กู้คืน/ลบถาวร)
 * - `admin`     = ทุกอย่าง + บัญชีผู้ใช้ + ตั้งค่าส่วนกลาง + ระยะเก็บข้อมูล/PDPA + โหมดปิดปรับปรุง
 *
 * หลักการที่ตั้งใจ
 * - **ให้สิทธิ์แบบเพิ่มขึ้น** (editor ⊂ publisher ⊂ admin) ⇒ เทสต์บังคับว่าเป็นจริงทุกคู่
 * - สิทธิ์ที่ "ทำลายข้อมูล/แตะข้อมูลส่วนบุคคล" ต้องไม่ตกอยู่กับบทบาทต่ำสุด (มีเทสต์กัน)
 * - เพิ่มสิทธิ์ใหม่แล้วลืมใส่ในบทบาทใดเลย = เทสต์แดง (ทุกสิทธิ์ต้องมีเจ้าของอย่างน้อยหนึ่งบทบาท)
 */

export const ADMIN_PERMISSIONS = [
  /** สร้าง/แก้/เผยแพร่หน้าเว็บและเนื้อหา (ตัวสร้างหน้าเว็บ · เนื้อหาแบบฟิลด์ · หน้า/SEO รายหน้า) */
  "content",
  /** คลังภาพ (อัปโหลด/แก้คำบรรยาย) */
  "media",
  /** พรีเซ็ต (บล็อกสำเร็จรูป · ส่วนกลางของเว็บ) */
  "presets",
  /** ลิงก์พรีวิวชั่วคราว (ให้คนนอกดูฉบับร่างได้โดยไม่ต้องมีบัญชี) */
  "preview",
  /** กล่องข้อความจากฟอร์ม — **ข้อมูลส่วนบุคคล** (PDPA) */
  "inbox",
  /** SEO ของทั้งเว็บ (ตั้งค่าส่วนกลาง) */
  "seo",
  /** ถังขยะ: กู้คืน / ลบถาวร */
  "trash",
  /** บัญชีผู้ดูแลหลังบ้าน (สร้าง/ปิด/เปลี่ยนบทบาท/รีเซ็ตรหัส) */
  "users",
  /** ตั้งค่าส่วนกลางของเว็บ */
  "settings",
  /** ระยะเก็บข้อมูล + ลบข้อมูลส่วนบุคคลตามคำขอ (PDPA) */
  "retention",
  /** โหมดปิดปรับปรุงเว็บ */
  "maintenance",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const EDITOR_PERMISSIONS: readonly AdminPermission[] = ["content", "media", "presets", "preview"];

const PUBLISHER_PERMISSIONS: readonly AdminPermission[] = [...EDITOR_PERMISSIONS, "inbox", "seo", "trash"];

const ADMIN_PERMISSIONS_ALL: readonly AdminPermission[] = [...ADMIN_PERMISSIONS];

/**
 * ตารางสิทธิ์จริง — **แหล่งความจริงเดียว**
 * ⚠️ ห้ามให้สิทธิ์ "retention"/"users"/"settings"/"maintenance" กับบทบาทที่ไม่ใช่ admin
 *    (แตะข้อมูลส่วนบุคคล/สิทธิ์ของคนอื่น/โครงสร้างเว็บ)
 */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly AdminPermission[]>> = {
  editor: EDITOR_PERMISSIONS,
  publisher: PUBLISHER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS_ALL,
};

/** สิทธิ์ทั้งหมดของบทบาทนั้น */
export function permissionsOf(role: AdminRole): readonly AdminPermission[] {
  return ROLE_PERMISSIONS[role];
}

/** บทบาทนี้ทำสิ่งนี้ได้ไหม */
export function can(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** รหัสบทบาทที่ถูกต้องทั้งหมด (ใช้ตรวจค่าที่ส่งมาจากฟอร์ม) */
export function isAdminRoleId(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

/** บทบาทที่ "ครอบคลุม" บทบาทอื่นทั้งหมด (ใช้ตรวจการถอดบทบาทตัวเอง) */
export function isStrongerOrEqual(role: AdminRole, other: AdminRole): boolean {
  return permissionsOf(role).length >= permissionsOf(other).length;
}
