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
