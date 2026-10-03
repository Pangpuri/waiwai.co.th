/** สถานะของฟอร์มจัดการบัญชีผู้ดูแล (X1.10 · RBAC) — ใช้กับ `useActionState` */

export type RbacActionCode =
  | "created"
  | "role-saved"
  | "disabled"
  | "enabled"
  | "password-reset"
  | "bad-email"
  | "bad-role"
  | "bad-password"
  | "duplicate"
  | "last-admin"
  | "self"
  | "no-database"
  | "failed";

export type RbacActionState = {
  readonly status: "idle" | "ok" | "failed";
  readonly code: RbacActionCode | null;
  /** รหัสผ่านใหม่ — มีค่าเฉพาะตอนสร้างบัญชี/รีเซ็ต (แสดงครั้งเดียว) */
  readonly password: string | null;
  /** อีเมลของบัญชีที่เพิ่งสร้าง (ใช้ในข้อความยืนยัน) */
  readonly email: string | null;
};

export const INITIAL_RBAC_STATE: RbacActionState = {
  status: "idle",
  code: null,
  password: null,
  email: null,
};
