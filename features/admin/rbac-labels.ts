import { permissionsOf, type AdminPermission } from "@/lib/auth/roles";
import type { AdminRole } from "@/lib/auth/types";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ป้ายชื่อบทบาท (ไทย) — **ที่เดียว** ที่แปลงรหัสบทบาทเป็นข้อความ
 *
 * ทำไมต้องมี: มีหลายหน้าจอที่ต้องแสดงบทบาท (เมนูหลังบ้าน · หน้าไม่มีสิทธิ์ · หน้าจัดการบัญชี)
 * ถ้าต่างคนต่างเขียน switch เอง เดี๋ยวเพิ่มบทบาทแล้วมีที่ลืม ⇒ แบบ exhaustive ที่นี่ที่เดียว
 */
export function roleLabelOf(role: AdminRole, strings: Messages["admin"]): string {
  switch (role) {
    case "editor":
      return strings.rbacRoleEditorName;
    case "publisher":
      return strings.rbacRolePublisherName;
    case "admin":
      return strings.rbacRoleAdminName;
  }
}

/**
 * ป้ายชื่อ "สิทธิ์" หนึ่งรายการ (ไทย/อังกฤษมาจากพจนานุกรม)
 *
 * ⚠️ ต้องเป็น switch แบบ exhaustive: เพิ่มสิทธิ์ใหม่ใน `ADMIN_PERMISSIONS` แล้วลืมใส่ป้าย
 * = TypeScript error ทันที (ไม่ปล่อยให้หน้าจอแสดงขอบเขตไม่ครบ)
 */
export function permissionLabelOf(permission: AdminPermission, strings: Messages["admin"]): string {
  switch (permission) {
    case "content":
      return strings.rbacPermissionContent;
    case "media":
      return strings.rbacPermissionMedia;
    case "presets":
      return strings.rbacPermissionPresets;
    case "preview":
      return strings.rbacPermissionPreview;
    case "inbox":
      return strings.rbacPermissionInbox;
    case "seo":
      return strings.rbacPermissionSeo;
    case "trash":
      return strings.rbacPermissionTrash;
    case "users":
      return strings.rbacPermissionUsers;
    case "settings":
      return strings.rbacPermissionSettings;
    case "retention":
      return strings.rbacPermissionRetention;
    case "maintenance":
      return strings.rbacPermissionMaintenance;
  }
}

/**
 * ขอบเขตงานของบทบาท = รายการสิทธิ์จริงจาก `ROLE_PERMISSIONS`
 *
 * ทำไมต้อง derive จากตารางสิทธิ์แทนการพิมพ์ข้อความแยก
 * - ข้อความเดิมถูกเขียนไว้เป็นก้อนเดียวและหน้าจอโชว์ก้อนของบรรณาธิการทุกบทบาท
 * - ถ้าพิมพ์ซ้ำ คนแก้สิทธิ์แล้วลืมแก้ข้อความ = ผู้ดูแลเห็นขอบเขตผิดและให้สิทธิ์ผิดคน
 */
export function roleScopeOf(role: AdminRole, strings: Messages["admin"]): readonly string[] {
  return permissionsOf(role).map((permission) => permissionLabelOf(permission, strings));
}
