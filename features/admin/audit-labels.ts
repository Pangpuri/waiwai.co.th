import type { Messages } from "@/lib/i18n/messages/th";

/**
 * แปลง "รหัสเหตุการณ์" ของ audit log → ข้อความที่อ่านรู้เรื่อง (B3 · รอบที่ 90)
 *
 * ทำไมต้องแยกไฟล์
 * - เดิมแผนที่นี้ฝังอยู่ในหน้าภาพรวมหลังบ้าน (`app/admin/page.tsx`) ที่เดียว
 *   พอเพิ่มหน้า "กิจกรรมของฉัน" + "ประวัติบัญชี" จะกลายเป็นพิมพ์ซ้ำ 3 ชุด ⇒ หลุดจากกันแน่นอน
 * - ตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test` ว่าทุก `AuditAction` มีป้ายจริง
 *
 * ⚠️ รหัสที่ไม่มีในแผนที่ = คืนรหัสดิบ (ไม่ทำให้หน้าจอว่าง) — เทสต์บังคับให้ครบทุกตัวที่ระบบเขียนจริง
 */

/** เหตุการณ์ทั้งหมดที่เกี่ยวกับบัญชีผู้ดูแล (ใช้กรอง "ประวัติบัญชี" ในหน้า `/admin/users`) */
export const ACCOUNT_AUDIT_PREFIX = "admin-user-";

/**
 * เวลาของร่องรอย (ISO จาก DB) → ข้อความสั้นที่อ่านได้
 * ⚠️ ตั้งใจแสดงเป็น UTC แบบตัดวินาที: หน้าภาพรวมหลังบ้านเดิมใช้แบบนี้ และไม่ต้องพึ่ง locale/timezone ของเซิร์ฟเวอร์
 */
export function auditStamp(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function auditActionLabel(strings: Messages["admin"], action: string): string {
  const map: Record<string, string | undefined> = {
    "login-success": strings.auditLoginSuccess,
    "login-failure": strings.auditLoginFailure,
    logout: strings.auditLogout,
    publish: strings.auditPublish,
    /* เผยแพร่โดย "ถึงกำหนดเวลา" ไม่ใช่มีคนกด (X2.7) — คนละร่องรอยกับการกดเอง */
    "publish-scheduled": strings.auditPublishScheduled,
    "restore-revision": strings.auditRestore,
    "preset-save": strings.auditPresetSave,
    "pages-update": strings.auditPagesUpdate,
    "migrate-blocks": strings.auditBlockMigrate,
    "retention-purge": strings.auditRetentionPurge,
    "erase-subject": strings.auditEraseSubject,
    "trash-move": strings.auditTrashMove,
    "trash-restore": strings.auditTrashRestore,
    "trash-delete": strings.auditTrashDelete,
    "trash-purge": strings.auditTrashPurge,
    "preview-link-create": strings.auditPreviewLinkCreate,
    "preview-link-revoke": strings.auditPreviewLinkRevoke,
    "preview-link-purge": strings.auditPreviewLinkPurge,
    "chrome-preset-save": strings.auditChromePresetSave,
    "chrome-preset-apply": strings.auditChromePresetApply,
    "chrome-preset-undo": strings.auditChromePresetUndo,
    "chrome-preset-import": strings.auditChromePresetImport,
    "admin-user-create": strings.auditAdminUserCreate,
    "admin-user-role": strings.auditAdminUserRole,
    "admin-user-disable": strings.auditAdminUserDisable,
    "admin-user-enable": strings.auditAdminUserEnable,
    "admin-user-password": strings.auditAdminUserPassword,
    "admin-user-delete": strings.auditAdminUserDelete,
    "admin-session-revoke": strings.auditAdminSessionRevoke,
  };

  return map[action] ?? action;
}
