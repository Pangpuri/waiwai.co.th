import { randomBytes } from "node:crypto";

import { getPool, isDatabaseConfigured } from "@/db/pool";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isAdminRole, type AdminRole, type AdminUser } from "@/lib/auth/types";
import type { AdminAccount, AdminUserStore } from "@/lib/auth/user-store";
import { recordAudit } from "@/lib/audit/log";
import { revokeSessionsForUser } from "@/lib/auth/sessions-repository";

/**
 * บัญชีผู้ดูแลใน **ฐานข้อมูล** (X1.10 · รอบที่ 84)
 *
 * ที่มา: ก่อนหน้านี้มีบัญชีเดียวจาก env (`.env.local` = บัญชีผู้ดูแลระบบ)
 * ⇒ เพิ่มคนที่สองไม่ได้ · เปลี่ยนบทบาทไม่ได้ · ปิดบัญชีคนที่ลาออกไม่ได้
 *
 * กติกาความปลอดภัยที่บังคับในไฟล์นี้
 * - เก็บ **เฉพาะ hash** (`hashPassword` ของโปรเจกต์ — scrypt) · ไม่มีทางคืนรหัสผ่านออกไปได้
 * - อีเมลเทียบแบบ **ไม่สนตัวพิมพ์** (`lower(email)`) และกันซ้ำด้วย unique index
 * - ตรวจบทบาทที่ส่งมาก่อนเขียนทุกครั้ง (`isAdminRole`)
 * - ทุกการเปลี่ยนแปลงบัญชี **ลง audit** (ใครทำ กับใคร เมื่อไร)
 * - **กันล็อกตัวเองออก**: ห้ามปิด/ถอดบทบาท "ผู้ดูแลคนสุดท้ายที่ยังใช้งานได้" (มีเทสต์ + ด่าน DB)
 */

/** รหัสผู้ดูแลในตาราง — แยกจาก `env-admin` ของโหมด env */
const ID_PREFIX = "usr_";
const ID_BYTES = 9;

export function newAdminUserId(): string {
  return `${ID_PREFIX}${randomBytes(ID_BYTES).toString("base64url")}`;
}

/** อีเมลที่เก็บ/เทียบ: ตัดช่องว่าง + ตัวพิมพ์เล็ก (ที่เดียว) */
export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ตรวจรูปอีเมลแบบเบา ๆ พอให้กันพิมพ์ผิด (ไม่ใช่ validator RFC) */
export function isUsableAdminEmail(email: string): boolean {
  const value = normalizeAdminEmail(email);
  return value.length >= 5 && value.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** ความยาวรหัสผ่านขั้นต่ำของผู้ดูแล (สคริปต์/หน้าจอสร้างบัญชีใช้ค่าเดียวกัน) */
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export function isUsableAdminPassword(password: string): boolean {
  return password.length >= MIN_ADMIN_PASSWORD_LENGTH;
}

type AdminUserRow = {
  readonly id: string;
  readonly email: string;
  readonly display_name: string;
  readonly password_hash: string;
  readonly role: string;
  readonly disabled: boolean;
  readonly last_login_at: Date | null;
  readonly created_at: Date;
};

const SELECT_COLUMNS = "id, email, display_name, password_hash, role, disabled, last_login_at, created_at";

function toAccount(row: AdminUserRow): AdminAccount | null {
  if (!isAdminRole(row.role)) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name === "" ? row.email : row.display_name,
    role: row.role,
    disabled: row.disabled,
    passwordHash: row.password_hash,
  };
}

export type AdminUserSummary = AdminUser & {
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
};

function toSummary(row: AdminUserRow): AdminUserSummary | null {
  if (!isAdminRole(row.role)) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name === "" ? row.email : row.display_name,
    role: row.role,
    disabled: row.disabled,
    lastLoginAt: row.last_login_at === null ? null : row.last_login_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * store สำหรับ `lib/auth/dal.ts` — อ่านบัญชีจากตาราง `admin_user`
 * คืน null เมื่อยังไม่มี `DATABASE_URL` (ผู้เรียกจะถอยไปใช้โหมด env)
 */
export function createDbUserStore(): AdminUserStore | null {
  if (!isDatabaseConfigured()) return null;

  return {
    async findByEmail(email: string): Promise<AdminAccount | null> {
      const { rows } = await getPool().query<AdminUserRow>(
        `select ${SELECT_COLUMNS} from admin_user where lower(email) = lower($1) limit 1`,
        [normalizeAdminEmail(email)],
      );
      const row = rows[0];
      return row === undefined ? null : toAccount(row);
    },
    async findById(id: string): Promise<AdminAccount | null> {
      const { rows } = await getPool().query<AdminUserRow>(
        `select ${SELECT_COLUMNS} from admin_user where id = $1 limit 1`,
        [id],
      );
      const row = rows[0];
      return row === undefined ? null : toAccount(row);
    },
  };
}

/** รายชื่อบัญชีทั้งหมด (สำหรับหน้าจอจัดการผู้ใช้) — ไม่คืน hash */
export async function listAdminUsers(): Promise<readonly AdminUserSummary[]> {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await getPool().query<AdminUserRow>(
    `select ${SELECT_COLUMNS} from admin_user order by disabled asc, created_at asc`,
  );
  return rows.map(toSummary).filter((entry): entry is AdminUserSummary => entry !== null);
}

/** จำนวนผู้ดูแล (role = admin) ที่ยังใช้งานได้ — ใช้กัน "ล็อกตัวเองออก" */
export async function countActiveAdmins(excludeId?: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const { rows } = await getPool().query<{ readonly n: string }>(
    `select count(*)::text as n from admin_user
      where role = 'admin' and disabled = false and ($1::text is null or id <> $1)`,
    [excludeId ?? null],
  );
  return Number.parseInt(rows[0]?.n ?? "0", 10);
}

export type CreateAdminUserInput = {
  readonly email: string;
  readonly displayName: string;
  readonly role: AdminRole;
  readonly password: string;
  /** ผู้ที่กดสร้าง (อีเมล) — ใช้ใน audit */
  readonly actor: string;
};

export type CreateAdminUserResult =
  | { readonly ok: true; readonly user: AdminUserSummary }
  | { readonly ok: false; readonly reason: "no-database" | "bad-email" | "bad-password" | "duplicate" | "failed" };

/** สร้างบัญชีใหม่ — hash รหัสผ่านก่อนเก็บเสมอ */
export async function createAdminUser(input: CreateAdminUserInput): Promise<CreateAdminUserResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };
  if (!isUsableAdminEmail(input.email)) return { ok: false, reason: "bad-email" };
  if (!isUsableAdminPassword(input.password)) return { ok: false, reason: "bad-password" };
  if (!isAdminRole(input.role)) return { ok: false, reason: "failed" };

  const email = normalizeAdminEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const id = newAdminUserId();

  try {
    const { rows } = await getPool().query<AdminUserRow>(
      `insert into admin_user (id, email, display_name, password_hash, role)
         values ($1, $2, $3, $4, $5)
       on conflict (email) do nothing
       returning ${SELECT_COLUMNS}`,
      [id, email, input.displayName.trim(), passwordHash, input.role],
    );
    const row = rows[0];
    if (row === undefined) return { ok: false, reason: "duplicate" };

    const summary = toSummary(row);
    if (summary === null) return { ok: false, reason: "failed" };

    await recordAudit({
      action: "admin-user-create",
      actorEmail: input.actor,
      target: summary.id,
      detail: `${summary.email} · ${summary.role}`,
    });
    return { ok: true, user: summary };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export type UpdateAdminUserResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** เปลี่ยนบทบาท — ห้ามถอดบทบาทผู้ดูแลคนสุดท้าย */
export async function setAdminUserRole(input: {
  readonly id: string;
  readonly role: AdminRole;
  readonly actor: string;
}): Promise<UpdateAdminUserResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };
  if (!isAdminRole(input.role)) return { ok: false, reason: "bad-role" };

  if (input.role !== "admin") {
    const remaining = await countActiveAdmins(input.id);
    const { rows: current } = await getPool().query<{ readonly role: string; readonly disabled: boolean }>(
      "select role, disabled from admin_user where id = $1",
      [input.id],
    );
    const isLastAdmin = current[0]?.role === "admin" && current[0].disabled === false && remaining === 0;
    if (isLastAdmin) return { ok: false, reason: "last-admin" };
  }

  const { rowCount } = await getPool().query(
    "update admin_user set role = $2 where id = $1",
    [input.id, input.role],
  );
  if (rowCount === 0) return { ok: false, reason: "not-found" };

  await recordAudit({ action: "admin-user-role", actorEmail: input.actor, target: input.id, detail: input.role });
  return { ok: true };
}

/** เปิด/ปิดบัญชี — ห้ามปิดผู้ดูแลคนสุดท้าย */
export async function setAdminUserDisabled(input: {
  readonly id: string;
  readonly disabled: boolean;
  readonly actor: string;
}): Promise<UpdateAdminUserResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };

  if (input.disabled) {
    const remaining = await countActiveAdmins(input.id);
    const { rows: current } = await getPool().query<{ readonly role: string; readonly disabled: boolean }>(
      "select role, disabled from admin_user where id = $1",
      [input.id],
    );
    const isLastAdmin = current[0]?.role === "admin" && current[0].disabled === false && remaining === 0;
    if (isLastAdmin) return { ok: false, reason: "last-admin" };
  }

  const { rowCount } = await getPool().query(
    "update admin_user set disabled = $2 where id = $1",
    [input.id, input.disabled],
  );
  if (rowCount === 0) return { ok: false, reason: "not-found" };

  await recordAudit({
    action: input.disabled ? "admin-user-disable" : "admin-user-enable",
    actorEmail: input.actor,
    target: input.id,
    detail: null,
  });

  /* ปิดบัญชี = ตัดเซสชันที่ค้างอยู่ทันที (รอบที่ 95) — ไม่งั้นเครื่องที่ล็อกอินค้างไว้ยังใช้ได้จนหมดอายุ */
  if (input.disabled) {
    await revokeSessionsForUser({ userId: input.id, actor: input.actor, detail: "disabled" });
  }
  return { ok: true };
}

/**
 * **ลบบัญชีผู้ดูแลถาวร** (B3 · รอบที่ 90) — ต่างจากการ "ปิดบัญชี"
 *
 * ด่านที่บังคับ (เรียงตามความเสียหายถ้าพลาด)
 * 1. `no-database` — ไม่มีฐานข้อมูล = ทำไม่ได้
 * 2. `self` — **ห้ามลบบัญชีตัวเอง** (กันล็อกตัวเองออกกลางทาง · ใช้ "ปิดบัญชี" ไม่ได้เช่นกัน)
 * 3. `last-admin` — ห้ามลบผู้ดูแลระบบที่ยังใช้งานได้คนสุดท้าย
 * 4. `not-found` — ไม่มีบัญชีนี้ในตาราง
 *
 * ⚠️ บัญชีจาก env (`ADMIN_EMAIL`) **ไม่ถูกแตะ** — ไม่ได้อยู่ในตารางนี้ (เป็นประตูหลังกันถูกล็อกออกโดยตั้งใจ)
 * ⚠️ ลบแล้ว**กู้คืนไม่ได้ผ่าน UI** (ต่างจากถังขยะ) — ผู้เรียกต้องยืนยันให้ครบก่อนเรียกฟังก์ชันนี้
 */
export async function deleteAdminUser(input: {
  readonly id: string;
  readonly actor: string;
  /** id ของผู้ที่กำลังทำรายการ (จากเซสชัน) — ใช้กัน "ลบตัวเอง" */
  readonly actorId: string;
  /** อีเมลที่ผู้ใช้พิมพ์ยืนยัน — ต้องตรงกับบัญชีปลายทาง (ด่านกันกดพลาด · ตรวจฝั่งเซิร์ฟเวอร์) */
  readonly confirmEmail: string;
}): Promise<UpdateAdminUserResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };
  if (input.id === input.actorId) return { ok: false, reason: "self" };

  const { rows } = await getPool().query<{ readonly role: string; readonly disabled: boolean; readonly email: string }>(
    "select role, disabled, email from admin_user where id = $1",
    [input.id],
  );
  const target = rows[0];
  if (target === undefined) return { ok: false, reason: "not-found" };

  /* ด่านยืนยัน: อีเมลที่พิมพ์ต้องตรงกับบัญชีจริง (เทียบแบบ normalize — ตัวพิมพ์ใหญ่/ช่องว่างไม่ช่วยให้ผ่าน) */
  if (normalizeAdminEmail(input.confirmEmail) !== normalizeAdminEmail(target.email)) {
    return { ok: false, reason: "email-mismatch" };
  }

  if (target.role === "admin" && !target.disabled) {
    const remaining = await countActiveAdmins(input.id);
    if (remaining === 0) return { ok: false, reason: "last-admin" };
  }

  const { rowCount } = await getPool().query("delete from admin_user where id = $1", [input.id]);
  if (rowCount === 0) return { ok: false, reason: "not-found" };

  /* อีเมลของบัญชีที่ถูกลบอยู่ใน detail — ร่องรอยว่า "ลบบัญชีใคร" (audit เก็บ 90 วัน) */
  await recordAudit({ action: "admin-user-delete", actorEmail: input.actor, target: input.id, detail: target.email });
  return { ok: true };
}

/** ตั้งรหัสผ่านใหม่ (ใช้ทั้งหน้าจอรีเซ็ตและ CLI) — คืนรหัสผ่านใหม่ให้แสดงครั้งเดียวที่ผู้เรียก */
export async function resetAdminUserPassword(input: {
  readonly id: string;
  readonly password: string;
  readonly actor: string;
}): Promise<UpdateAdminUserResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };
  if (!isUsableAdminPassword(input.password)) return { ok: false, reason: "bad-password" };

  const passwordHash = await hashPassword(input.password);
  const { rowCount } = await getPool().query("update admin_user set password_hash = $2 where id = $1", [
    input.id,
    passwordHash,
  ]);
  if (rowCount === 0) return { ok: false, reason: "not-found" };

  await recordAudit({ action: "admin-user-password", actorEmail: input.actor, target: input.id, detail: null });

  /* ตั้งรหัสผ่านใหม่ = ตัดเซสชันเดิมทั้งหมด (มาตรฐานความปลอดภัย · รอบที่ 95) */
  await revokeSessionsForUser({ userId: input.id, actor: input.actor, detail: "password-reset" });
  return { ok: true };
}

/** เปลี่ยนรหัสผ่านของตัวเอง (ต้องยืนยันรหัสเดิม) */
export async function changeOwnPassword(input: {
  readonly id: string;
  readonly currentPassword: string;
  readonly nextPassword: string;
  readonly actor: string;
}): Promise<UpdateAdminUserResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };
  if (!isUsableAdminPassword(input.nextPassword)) return { ok: false, reason: "bad-password" };

  const { rows } = await getPool().query<{ readonly password_hash: string }>(
    "select password_hash from admin_user where id = $1",
    [input.id],
  );
  const current = rows[0];
  if (current === undefined) return { ok: false, reason: "not-found" };

  const matches = await verifyPassword(input.currentPassword, current.password_hash);
  if (!matches) return { ok: false, reason: "wrong-password" };

  return await resetAdminUserPassword({ id: input.id, password: input.nextPassword, actor: input.actor });
}

/** บันทึกเวลาล็อกอินสำเร็จ (เฉพาะบัญชีใน DB — โหมด env ไม่มีแถวให้เขียน) */
export async function touchAdminLastLogin(id: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (id.startsWith("env-")) return;
  await getPool().query("update admin_user set last_login_at = now() where id = $1", [id]).catch(() => undefined);
}
