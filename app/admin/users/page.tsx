import { UserCreateForm, UserList, type RbacRow, type RbacStrings } from "@/features/admin/ui/user-manager";
import { ACCOUNT_AUDIT_PREFIX, auditActionLabel, auditStamp } from "@/features/admin/audit-labels";
import { roleLabelOf } from "@/features/admin/rbac-labels";
import { isDatabaseConfigured } from "@/db/pool";
import { listAuditForActionPrefix } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { MIN_ADMIN_PASSWORD_LENGTH, listAdminUsers } from "@/lib/auth/users-repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/** จำนวนบรรทัดประวัติบัญชีที่แสดง (พอเห็นภาพการเปลี่ยนแปลงล่าสุดโดยไม่ยาวเกิน) */
const ACCOUNT_HISTORY_LIMIT = 10;

/**
 * หน้าจอ **จัดการบัญชีผู้ดูแล** (X1.10 · RBAC) — เฉพาะบทบาท `admin`
 *
 * ทำไมหน้านี้สำคัญ
 * - ก่อนหน้านี้มีบัญชีเดียวจาก env ⇒ เพิ่มคนที่สองไม่ได้ เปลี่ยนบทบาทไม่ได้ ปิดบัญชีคนที่ลาออกไม่ได้
 * - ตอนนี้บัญชีงานประจำอยู่ในตาราง `admin_user` · บัญชีจาก env ยังเป็น "ประตูหลัง" กันถูกล็อกออก
 *
 * ⚠️ รหัสผ่าน **ไม่มีทางแสดงย้อนหลังได้** (เก็บเฉพาะ hash) — การรีเซ็ตคือสร้างใหม่แล้วโชว์ครั้งเดียว
 */
export default async function AdminUsersPage() {
  const actor = await requireAdminUser("users");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const dbMissing = !isDatabaseConfigured();
  const users = dbMissing ? [] : await listAdminUsers();
  const history = dbMissing ? [] : await listAuditForActionPrefix(ACCOUNT_AUDIT_PREFIX, ACCOUNT_HISTORY_LIMIT);

  const rbacStrings: RbacStrings = {
    rbacRoleLabel: strings.rbacRoleLabel,
    rbacRoleEditorName: strings.rbacRoleEditorName,
    rbacRolePublisherName: strings.rbacRolePublisherName,
    rbacRoleAdminName: strings.rbacRoleAdminName,
    rbacRoleEditorHint: strings.rbacRoleEditorHint,
    rbacRolePublisherHint: strings.rbacRolePublisherHint,
    rbacRoleAdminHint: strings.rbacRoleAdminHint,
    rbacCreateTitle: strings.rbacCreateTitle,
    rbacCreateHint: strings.rbacCreateHint,
    rbacEmailLabel: strings.rbacEmailLabel,
    rbacEmailPlaceholder: strings.rbacEmailPlaceholder,
    rbacNameLabel: strings.rbacNameLabel,
    rbacNamePlaceholder: strings.rbacNamePlaceholder,
    rbacCreate: strings.rbacCreate,
    rbacCreated: strings.rbacCreated,
    rbacPasswordOnce: strings.rbacPasswordOnce,
    rbacDuplicate: strings.rbacDuplicate,
    rbacBadEmail: strings.rbacBadEmail,
    rbacBadRole: strings.rbacRoleUnknown,
    rbacBadPassword: strings.rbacBadPassword,
    rbacFailed: strings.rbacFailed,
    rbacListTitle: strings.rbacListTitle,
    rbacEmpty: strings.rbacEmpty,
    rbacColEmail: strings.rbacColEmail,
    rbacColName: strings.rbacColName,
    rbacColStatus: strings.rbacColStatus,
    rbacColLastLogin: strings.rbacColLastLogin,
    rbacStatusActive: strings.rbacStatusActive,
    rbacStatusDisabled: strings.rbacStatusDisabled,
    rbacNeverLoggedIn: strings.rbacNeverLoggedIn,
    rbacSaveRole: strings.rbacSaveRole,
    rbacDisable: strings.rbacDisable,
    rbacEnable: strings.rbacEnable,
    rbacReset: strings.rbacReset,
    rbacResetDone: strings.rbacResetDone,
    rbacRoleSaved: strings.rbacRoleSaved,
    rbacDisabledDone: strings.rbacDisabledDone,
    rbacEnabledDone: strings.rbacEnabledDone,
    rbacLastAdminBlocked: strings.rbacLastAdminBlocked,
    rbacSelfBlocked: strings.rbacSelfBlocked,
    rbacEnvAccountNote: strings.rbacEnvAccountNote,
    rbacDbMissing: strings.rbacDbMissing,
    rbacRoleUnknown: strings.rbacRoleUnknown,
    rbacDelete: strings.rbacDelete,
    rbacDeleteHint: strings.rbacDeleteHint,
    rbacDeleteConfirmLabel: strings.rbacDeleteConfirmLabel,
    rbacDeleteAcknowledge: strings.rbacDeleteAcknowledge,
    rbacDeletedDone: strings.rbacDeletedDone,
    rbacEmailMismatch: strings.rbacEmailMismatch,
  };

  const rows: readonly RbacRow[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    roleLabel: roleLabelOf(user.role, strings),
    disabled: user.disabled,
    lastLoginLabel: user.lastLoginAt === null ? strings.rbacNeverLoggedIn : user.lastLoginAt.slice(0, 16).replace("T", " "),
  }));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.rbacUsersTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.rbacUsersHint}</p>
        <p className="text-fg-muted text-xs">{strings.rbacEnvAccountNote}</p>
      </header>

      <UserCreateForm strings={rbacStrings} dbMissing={dbMissing} minLength={MIN_ADMIN_PASSWORD_LENGTH} />

      {dbMissing ? null : <UserList rows={rows} selfId={actor.id} strings={rbacStrings} minLength={MIN_ADMIN_PASSWORD_LENGTH} />}

      {/*
        ประวัติการเปลี่ยนบัญชี/สิทธิ์ (B3 · รอบที่ 90) — มาจาก audit log ที่ระบบเขียนอยู่แล้ว
        ⚠️ ไม่มีตารางใหม่: audit log คือ "ประวัติย้อนหลัง" ที่ตรวจสอบได้ (เก็บ 90 วันตามนโยบาย)
      */}
      <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-5">
        <h2 className="text-fg text-lg font-semibold">{strings.rbacHistoryTitle}</h2>
        {history.length === 0 ? (
          <p className="text-fg-muted text-sm">{strings.rbacHistoryEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs">
            {history.map((entry, index) => (
              <li
                key={`${entry.createdAt}-${index}`}
                className="border-line flex flex-wrap items-baseline gap-2 border-b pb-1.5 last:border-0"
              >
                <span className="text-fg font-semibold">{auditActionLabel(strings, entry.action)}</span>
                <span className="text-fg-muted font-mono">{entry.target ?? "-"}</span>
                <span className="text-fg-muted">{entry.detail ?? ""}</span>
                <span className="text-fg-muted">{entry.actorEmail ?? "-"}</span>
                <span className="text-fg-muted ml-auto">{auditStamp(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
