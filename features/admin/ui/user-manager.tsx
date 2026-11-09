"use client";

import { useActionState, useState } from "react";

import {
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  revokeSessionsAction,
  setRoleAction,
  toggleUserAction,
} from "@/app/admin/users/actions";
import { AdminToast } from "@/features/admin/ui/admin-toast";
import { INITIAL_RBAC_STATE, type RbacActionState } from "@/features/admin/rbac-state";
import { isAdminRole, type AdminRole } from "@/lib/auth/types";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * หน้าจอจัดการบัญชีผู้ดูแล (client component — X1.10 · RBAC)
 *
 * ข้อควรระวังที่ออกแบบไว้
 * - รหัสผ่านที่ระบบสร้าง **แสดงครั้งเดียว** ในกล่องอ่านอย่างเดียว (ไม่ใส่ใน URL/ไม่เก็บใน DB แบบอ่านซ้ำได้)
 * - ปุ่มของแถวตัวเอง (เปลี่ยนบทบาท/ปิดบัญชี) ถูก **ปิดไว้** — ตรงกับด่านฝั่งเซิร์ฟเวอร์ (self-blocked)
 * - ข้อความทุกแบบมาจากพจนานุกรมที่ส่งเข้ามา (ไม่มีข้อความฝังในคอมโพเนนต์)
 */

/** ตัวเลือกบทบาทที่คำนวณจากตารางสิทธิ์จริงฝั่งเซิร์ฟเวอร์ (ส่งเข้ามาเป็นก้อนเดียว) */
export type RbacRoleOption = {
  readonly role: AdminRole;
  readonly name: string;
  readonly scope: readonly string[];
};

export type RbacStrings = {
  readonly rbacRoleLabel: string;
  readonly rbacRoleScopeTitle: string;
  readonly rbacRoleScopeHint: string;
  readonly rbacRoleSelectedScope: string;
  readonly rbacCreateTitle: string;
  readonly rbacCreateHint: string;
  readonly rbacEmailLabel: string;
  readonly rbacEmailPlaceholder: string;
  readonly rbacNameLabel: string;
  readonly rbacNamePlaceholder: string;
  readonly rbacCreate: string;
  readonly rbacCreated: string;
  readonly rbacPasswordOnce: string;
  readonly rbacDuplicate: string;
  readonly rbacBadEmail: string;
  readonly rbacBadRole: string;
  readonly rbacBadPassword: string;
  readonly rbacFailed: string;
  readonly rbacListTitle: string;
  readonly rbacEmpty: string;
  readonly rbacColEmail: string;
  readonly rbacColName: string;
  readonly rbacColStatus: string;
  readonly rbacColLastLogin: string;
  readonly rbacStatusActive: string;
  readonly rbacStatusDisabled: string;
  readonly rbacNeverLoggedIn: string;
  readonly rbacSaveRole: string;
  readonly rbacDisable: string;
  readonly rbacEnable: string;
  readonly rbacReset: string;
  readonly rbacResetDone: string;
  readonly rbacRoleSaved: string;
  readonly rbacDisabledDone: string;
  readonly rbacEnabledDone: string;
  readonly rbacLastAdminBlocked: string;
  readonly rbacSelfBlocked: string;
  readonly rbacEnvAccountNote: string;
  readonly rbacDbMissing: string;
  readonly rbacRoleUnknown: string;
  readonly rbacDelete: string;
  readonly rbacDeleteHint: string;
  readonly rbacDeleteConfirmLabel: string;
  readonly rbacDeleteAcknowledge: string;
  readonly rbacDeletedDone: string;
  readonly rbacEmailMismatch: string;
  readonly rbacSessionsTitle: string;
  readonly rbacSessionsEmpty: string;
  readonly rbacSessionLastSeen: string;
  readonly rbacSessionExpires: string;
  readonly rbacSessionStarted: string;
  readonly rbacSessionRevoke: string;
  readonly rbacSessionRevokeAll: string;
  readonly rbacSessionRevoked: string;
  readonly rbacSessionRevokeNotFound: string;
  readonly rbacSessionsCount: string;
};

/** แถวเซสชันที่แสดงบนหน้าจอ (id = sha256 ของ sid · ไม่ใช่รหัสลับที่เอาไปสวมรอยได้) */
export type RbacSessionRow = {
  readonly id: string;
  readonly startedLabel: string;
  readonly lastSeenLabel: string;
  readonly expiresLabel: string;
  readonly device: string;
};

export type RbacRow = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AdminRole;
  readonly roleLabel: string;
  readonly disabled: boolean;
  readonly lastLoginLabel: string;
  /** เซสชันที่ใช้งานได้ของบัญชีนี้ (รอบที่ 95) */
  readonly sessions: readonly RbacSessionRow[];
};

const FIELD_CLASS =
  "border-line-strong bg-surface text-fg placeholder:text-fg-muted/70 focus:border-brand-red w-full rounded-xl border-2 px-3 py-2 text-sm outline-none";

function messageOf(state: RbacActionState, strings: RbacStrings, minLength: number): string | null {
  switch (state.code) {
    case null:
      return null;
    case "created":
      return state.email === null ? strings.rbacCreate : fillTemplate(strings.rbacCreated, { email: state.email });
    case "role-saved":
      return strings.rbacRoleSaved;
    case "disabled":
      return strings.rbacDisabledDone;
    case "enabled":
      return strings.rbacEnabledDone;
    case "password-reset":
      return strings.rbacResetDone;
    case "deleted":
      return strings.rbacDeletedDone;
    case "email-mismatch":
      return strings.rbacEmailMismatch;
    case "duplicate":
      return strings.rbacDuplicate;
    case "bad-email":
      return strings.rbacBadEmail;
    case "bad-role":
      return strings.rbacBadRole;
    case "bad-password":
      return fillTemplate(strings.rbacBadPassword, { min: minLength });
    case "last-admin":
      return strings.rbacLastAdminBlocked;
    case "self":
      return strings.rbacSelfBlocked;
    case "no-database":
      return strings.rbacDbMissing;
    case "failed":
      return strings.rbacFailed;
    case "sessions-revoked":
      return strings.rbacSessionRevoked;
    case "sessions-none":
      return strings.rbacSessionRevokeNotFound;
  }
}

function StatusLine({
  state,
  strings,
  minLength,
}: {
  readonly state: RbacActionState;
  readonly strings: RbacStrings;
  readonly minLength: number;
}) {
  if (state.status === "idle") return null;
  const text = messageOf(state, strings, minLength);

  return (
    <span className={state.status === "ok" ? "text-fg-muted text-xs" : "text-brand-red text-xs"}>
      <AdminToast message={text ?? ""} tone={state.status === "ok" ? "success" : "error"} trigger={state} />
      {text}
      {/* รหัสผ่านที่ระบบสร้าง: แสดงครั้งเดียวในกล่องอ่านอย่างเดียว */}
      {state.password === null ? null : (
        <span className="mt-1 flex flex-col gap-1">
          <span>{strings.rbacPasswordOnce}</span>
          <input readOnly value={state.password} className={FIELD_CLASS} />
        </span>
      )}
    </span>
  );
}

function RoleSelect({
  name,
  value,
  options,
  disabled = false,
  onChange,
}: {
  readonly name: string;
  readonly value: AdminRole;
  readonly options: readonly RbacRoleOption[];
  readonly disabled?: boolean;
  readonly onChange: (role: AdminRole) => void;
}) {
  return (
    <select
      name={name}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        if (isAdminRole(event.target.value)) onChange(event.target.value);
      }}
      className={FIELD_CLASS}
    >
      {options.map((option) => (
        <option key={option.role} value={option.role}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

/** ขอบเขตงานแบบข้อย่อย — ใช้ทั้งในฟอร์ม (บทบาทที่เลือก) และสรุปทุกบทบาท */
function RoleScopeList({ option }: { readonly option: RbacRoleOption }) {
  return (
    <ul className="text-fg-muted flex list-disc flex-col gap-1 pl-5 text-xs">
      {option.scope.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SelectedRoleScope({
  option,
  strings,
}: {
  readonly option: RbacRoleOption | null;
  readonly strings: RbacStrings;
}) {
  if (option === null) return null;

  return (
    <div className="border-line bg-surface rounded-xl border p-3">
      <p className="text-fg text-xs font-semibold">
        {fillTemplate(strings.rbacRoleSelectedScope, { role: option.name })}
      </p>
      <div className="mt-2">
        <RoleScopeList option={option} />
      </div>
    </div>
  );
}

/** สรุปขอบเขตของทุกบทบาท — เว้นบรรทัดระหว่างบทบาทให้อ่านและเทียบกันได้ชัด */
export function RoleScopeOverview({
  options,
  strings,
}: {
  readonly options: readonly RbacRoleOption[];
  readonly strings: RbacStrings;
}) {
  return (
    <section className="border-line bg-surface-raised flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-fg text-lg font-semibold">{strings.rbacRoleScopeTitle}</h2>
        <p className="text-fg-muted text-sm">{strings.rbacRoleScopeHint}</p>
      </div>
      <div className="flex flex-col gap-5">
        {options.map((option) => (
          <div key={option.role} className="border-line border-t pt-4 first:border-t-0 first:pt-0">
            <h3 className="text-fg text-sm font-semibold">{option.name}</h3>
            <div className="mt-2">
              <RoleScopeList option={option} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function UserCreateForm({
  strings,
  roleOptions,
  dbMissing,
  minLength,
}: {
  readonly strings: RbacStrings;
  readonly roleOptions: readonly RbacRoleOption[];
  readonly dbMissing: boolean;
  readonly minLength: number;
}) {
  const [state, action] = useActionState(createUserAction, INITIAL_RBAC_STATE);
  const [role, setRole] = useState<AdminRole>("editor");
  const selectedRole = roleOptions.find((option) => option.role === role) ?? null;

  return (
    <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5">
      <h2 className="text-fg text-lg font-semibold">{strings.rbacCreateTitle}</h2>
      <p className="text-fg-muted text-sm">{strings.rbacCreateHint}</p>

      {dbMissing ? (
        <p className="text-brand-red text-sm">{strings.rbacDbMissing}</p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg font-semibold">{strings.rbacEmailLabel}</span>
            <input name="email" type="email" placeholder={strings.rbacEmailPlaceholder} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg font-semibold">{strings.rbacNameLabel}</span>
            <input name="displayName" placeholder={strings.rbacNamePlaceholder} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg font-semibold">{strings.rbacRoleLabel}</span>
            <RoleSelect name="role" value={role} options={roleOptions} onChange={setRole} />
          </label>
          <SelectedRoleScope option={selectedRole} strings={strings} />
          <span className="flex items-center gap-3">
            <button
              type="submit"
              className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {strings.rbacCreate}
            </button>
            <StatusLine state={state} strings={strings} minLength={minLength} />
          </span>
        </form>
      )}
    </section>
  );
}

function UserRow({
  row,
  isSelf,
  strings,
  roleOptions,
  minLength,
}: {
  readonly row: RbacRow;
  readonly isSelf: boolean;
  readonly strings: RbacStrings;
  readonly roleOptions: readonly RbacRoleOption[];
  readonly minLength: number;
}) {
  const [roleState, roleAction] = useActionState(setRoleAction, INITIAL_RBAC_STATE);
  const [toggleState, toggleActionResult] = useActionState(toggleUserAction, INITIAL_RBAC_STATE);
  const [resetState, resetAction] = useActionState(resetPasswordAction, INITIAL_RBAC_STATE);
  const [deleteState, deleteActionResult] = useActionState(deleteUserAction, INITIAL_RBAC_STATE);
  const [sessionState, sessionAction] = useActionState(revokeSessionsAction, INITIAL_RBAC_STATE);
  const [role, setRole] = useState<AdminRole>(row.role);
  const selectedRole = roleOptions.find((option) => option.role === role) ?? null;

  return (
    <li className="border-line flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-fg text-sm font-semibold">{row.email}</span>
        <span className="text-fg-muted text-xs">{row.displayName}</span>
        <span className="text-fg-muted text-xs">
          {strings.rbacRoleLabel}: {row.roleLabel}
        </span>
        <span className="text-fg-muted text-xs">
          {strings.rbacColStatus}: {row.disabled ? strings.rbacStatusDisabled : strings.rbacStatusActive}
        </span>
        <span className="text-fg-muted text-xs">
          {strings.rbacColLastLogin}: {row.lastLoginLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form action={roleAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={row.id} />
          <RoleSelect name="role" value={role} options={roleOptions} onChange={setRole} disabled={isSelf} />
          <button
            type="submit"
            disabled={isSelf}
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {strings.rbacSaveRole}
          </button>
        </form>

        <form action={toggleActionResult}>
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="disabled" value={row.disabled ? "0" : "1"} />
          <button
            type="submit"
            disabled={isSelf}
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {row.disabled ? strings.rbacEnable : strings.rbacDisable}
          </button>
        </form>

        <form action={resetAction}>
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.rbacReset}
          </button>
        </form>
      </div>

      {/* ขอบเขตของบทบาทที่กำลังจะบันทึก — เปิดดูได้ก่อนกด "บันทึกบทบาท" */}
      <details className="border-line rounded-lg border p-2">
        <summary className="text-fg-muted cursor-pointer text-xs font-semibold">
          {fillTemplate(strings.rbacRoleSelectedScope, { role: selectedRole?.name ?? row.roleLabel })}
        </summary>
        {selectedRole === null ? null : (
          <div className="mt-2">
            <RoleScopeList option={selectedRole} />
          </div>
        )}
      </details>

      {/* เซสชันที่ล็อกอินอยู่ (รอบที่ 95) — เห็นว่า "เครื่องไหน" และตัดได้ทันที */}
      <details className="border-line rounded-lg border p-2">
        <summary className="text-fg-muted cursor-pointer text-xs font-semibold">
          {strings.rbacSessionsTitle} · {fillTemplate(strings.rbacSessionsCount, { n: row.sessions.length })}
        </summary>
        {row.sessions.length === 0 ? (
          <p className="text-fg-muted mt-1 text-xs">{strings.rbacSessionsEmpty}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {row.sessions.map((session) => (
              <li key={session.id} className="border-line flex flex-wrap items-center gap-2 border-b pb-1 text-[11px] last:border-0">
                <span className="text-fg-muted">
                  {strings.rbacSessionStarted} {session.startedLabel} · {strings.rbacSessionLastSeen} {session.lastSeenLabel} ·{' '}
                  {strings.rbacSessionExpires} {session.expiresLabel}
                </span>
                <span className="text-fg-muted font-mono">{session.device}</span>
                <form action={sessionAction} className="ml-auto">
                  <input type="hidden" name="hash" value={session.id} />
                  <button
                    type="submit"
                    className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {strings.rbacSessionRevoke}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {row.sessions.length === 0 ? null : (
          <form action={sessionAction} className="mt-1">
            <input type="hidden" name="userId" value={row.id} />
            <button
              type="submit"
              className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-0.5 text-[11px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              {strings.rbacSessionRevokeAll}
            </button>
          </form>
        )}
        <StatusLine state={sessionState} strings={strings} minLength={minLength} />
      </details>

      {isSelf ? <p className="text-fg-muted text-xs">{strings.rbacSelfBlocked}</p> : null}

      {/*
        ลบบัญชีถาวร (B3) — ซ่อนไว้ใน <details> + ต้องพิมพ์อีเมลให้ตรง + ติ๊กยืนยัน
        (กู้คืนไม่ได้ ⇒ ต้องเป็นการกระทำที่ตั้งใจ ไม่ใช่กดพลาด)
      */}
      {isSelf ? null : (
        <details className="border-line rounded-lg border p-2">
          <summary className="text-brand-red cursor-pointer text-xs font-semibold">{strings.rbacDelete}</summary>
          <form action={deleteActionResult} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="id" value={row.id} />
            <p className="text-fg-muted text-xs">{strings.rbacDeleteHint}</p>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-fg font-semibold">{strings.rbacDeleteConfirmLabel}</span>
              <input name="confirmEmail" placeholder={row.email} className={FIELD_CLASS} />
            </label>
            <label className="text-fg-muted flex items-start gap-2 text-xs">
              <input type="checkbox" name="acknowledge" value="1" className="border-line accent-brand-red mt-0.5 size-4 rounded border" />
              {strings.rbacDeleteAcknowledge}
            </label>
            <button
              type="submit"
              className="bg-brand-red text-on-brand focus-visible:ring-ring self-start rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {strings.rbacDelete}
            </button>
          </form>
        </details>
      )}

      <StatusLine state={roleState} strings={strings} minLength={minLength} />
      <StatusLine state={toggleState} strings={strings} minLength={minLength} />
      <StatusLine state={resetState} strings={strings} minLength={minLength} />
      <StatusLine state={deleteState} strings={strings} minLength={minLength} />
    </li>
  );
}

export function UserList({
  rows,
  selfId,
  strings,
  roleOptions,
  minLength,
}: {
  readonly rows: readonly RbacRow[];
  readonly selfId: string;
  readonly strings: RbacStrings;
  readonly roleOptions: readonly RbacRoleOption[];
  readonly minLength: number;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-fg text-lg font-semibold">{strings.rbacListTitle}</h2>
      {rows.length === 0 ? (
        <p className="text-fg-muted text-sm">{strings.rbacEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <UserRow
              key={row.id}
              row={row}
              isSelf={row.id === selfId}
              strings={strings}
              roleOptions={roleOptions}
              minLength={minLength}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
