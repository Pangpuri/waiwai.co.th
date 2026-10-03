"use server";

import { revalidatePath } from "next/cache";

import type { RbacActionState } from "@/features/admin/rbac-state";
import { generatePassword } from "@/lib/auth/credentials";
import { requireAdminUser } from "@/lib/auth/dal";
import { isAdminRoleId } from "@/lib/auth/roles";
import {
  createAdminUser,
  deleteAdminUser,
  isUsableAdminEmail,
  resetAdminUserPassword,
  setAdminUserDisabled,
  setAdminUserRole,
} from "@/lib/auth/users-repository";
import { isDatabaseConfigured } from "@/db/pool";

/**
 * Server Actions ของ **การจัดการบัญชีผู้ดูแล** (X1.10 · RBAC)
 *
 * ลำดับเดียวกันทุก action
 *   1. `requireAdminUser("users")` — เฉพาะผู้ดูแลระบบเท่านั้น (ประตูเดียวของโครงสร้างสิทธิ์)
 *   2. ตรวจค่าที่ส่งมา (อีเมล/บทบาท) — ค่าจากเบราว์เซอร์ไม่เชื่อ
 *   3. เรียก repository (ซึ่ง hash รหัสผ่าน + ลง audit ให้)
 *   4. `revalidatePath` หน้าจอ
 *
 * ⚠️ รหัสผ่านใหม่ส่งกลับไปแสดง **ครั้งเดียว** ในคำตอบของ action นี้ — ไม่มีทางอ่านซ้ำจาก DB ได้
 */

const USERS_PATH = "/admin/users";

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createUserAction(
  _previous: RbacActionState,
  formData: FormData,
): Promise<RbacActionState> {
  const actor = await requireAdminUser("users");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", password: null, email: null };

  const email = readField(formData, "email");
  const displayName = readField(formData, "displayName");
  const role = readField(formData, "role");

  if (!isUsableAdminEmail(email)) return { status: "failed", code: "bad-email", password: null, email: null };
  if (!isAdminRoleId(role)) return { status: "failed", code: "bad-role", password: null, email: null };

  /* รหัสผ่านสร้างจากฝั่งเซิร์ฟเวอร์เท่านั้น (รูปแบบอ่านออกเสียงได้) */
  const password = generatePassword();
  const result = await createAdminUser({ email, displayName, role, password, actor: actor.email });

  if (!result.ok) {
    const code =
      result.reason === "duplicate"
        ? "duplicate"
        : result.reason === "bad-email"
          ? "bad-email"
          : result.reason === "bad-password"
            ? "bad-password"
            : "failed";
    return { status: "failed", code, password: null, email: null };
  }

  revalidatePath(USERS_PATH);
  return { status: "ok", code: "created", password, email: result.user.email };
}

export async function setRoleAction(_previous: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const actor = await requireAdminUser("users");

  const id = readField(formData, "id");
  const role = readField(formData, "role");
  if (id === "" || !isAdminRoleId(role)) return { status: "failed", code: "bad-role", password: null, email: null };
  if (id === actor.id) return { status: "failed", code: "self", password: null, email: null };

  const result = await setAdminUserRole({ id, role, actor: actor.email });
  if (!result.ok) {
    const code = result.reason === "last-admin" ? "last-admin" : result.reason === "no-database" ? "no-database" : "failed";
    return { status: "failed", code, password: null, email: null };
  }

  revalidatePath(USERS_PATH);
  return { status: "ok", code: "role-saved", password: null, email: null };
}

export async function toggleUserAction(_previous: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const actor = await requireAdminUser("users");

  const id = readField(formData, "id");
  const disabled = readField(formData, "disabled") === "1";
  if (id === "") return { status: "failed", code: "failed", password: null, email: null };
  if (id === actor.id) return { status: "failed", code: "self", password: null, email: null };

  const result = await setAdminUserDisabled({ id, disabled, actor: actor.email });
  if (!result.ok) {
    const code = result.reason === "last-admin" ? "last-admin" : result.reason === "no-database" ? "no-database" : "failed";
    return { status: "failed", code, password: null, email: null };
  }

  revalidatePath(USERS_PATH);
  return { status: "ok", code: disabled ? "disabled" : "enabled", password: null, email: null };
}

/**
 * **ลบบัญชีผู้ดูแลถาวร** (B3 · รอบที่ 90)
 *
 * ด่านยืนยัน 2 ชั้นที่ผู้ใช้ต้องผ่าน (นอกเหนือจากสิทธิ์ `users` และด่านใน repository)
 * 1. พิมพ์อีเมลของบัญชีที่จะลบให้ตรง (ตรวจฝั่งเซิร์ฟเวอร์เทียบกับอีเมลจริงในฐานข้อมูล)
 * 2. ติ๊กช่องยืนยันว่ารู้ว่ากู้คืนไม่ได้
 *
 * ⚠️ ไม่มี "ถังขยะ" สำหรับบัญชี (ตั้งใจ — บัญชีไม่ใช่เนื้อหา) · ร่องรอยอยู่ใน audit log 90 วัน
 */
export async function deleteUserAction(_previous: RbacActionState, formData: FormData): Promise<RbacActionState> {
  const actor = await requireAdminUser("users");

  const id = readField(formData, "id");
  const confirmEmail = readField(formData, "confirmEmail");
  const acknowledged = readField(formData, "acknowledge") === "1";

  if (id === "") return { status: "failed", code: "failed", password: null, email: null };
  if (id === actor.id) return { status: "failed", code: "self", password: null, email: null };
  if (!acknowledged) return { status: "failed", code: "email-mismatch", password: null, email: null };

  const result = await deleteAdminUser({ id, actor: actor.email, actorId: actor.id, confirmEmail });
  if (!result.ok) {
    const code =
      result.reason === "self"
        ? "self"
        : result.reason === "last-admin"
          ? "last-admin"
          : result.reason === "email-mismatch"
            ? "email-mismatch"
            : result.reason === "no-database"
              ? "no-database"
              : "failed";
    return { status: "failed", code, password: null, email: null };
  }

  revalidatePath(USERS_PATH);
  return { status: "ok", code: "deleted", password: null, email: null };
}

export async function resetPasswordAction(
  _previous: RbacActionState,
  formData: FormData,
): Promise<RbacActionState> {
  const actor = await requireAdminUser("users");

  const id = readField(formData, "id");
  if (id === "") return { status: "failed", code: "failed", password: null, email: null };

  const password = generatePassword();
  const result = await resetAdminUserPassword({ id, password, actor: actor.email });
  if (!result.ok) {
    const code = result.reason === "no-database" ? "no-database" : "failed";
    return { status: "failed", code, password: null, email: null };
  }

  revalidatePath(USERS_PATH);
  return { status: "ok", code: "password-reset", password, email: null };
}
