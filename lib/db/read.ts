import type { Pool, QueryResult, QueryResultRow } from "pg";

import {
  getFormPool,
  getReadPool,
  isRoleAuthFailure,
  resetRolePool,
  roleCredentialHint,
  type DatabaseRole,
} from "@/db/pool";

/**
 * "ประตูอ่าน" ของชั้นข้อมูล (รอบที่ 169 · least privilege · ทบทวนรอบที่ 196)
 *
 * ทำไมต้องมี
 * - หน้าเว็บสาธารณะควรอ่านผ่าน role ที่ **เขียนไม่ได้** (`waiwai_public_ro`) ⇒ ถ้ามีช่องโหว่ที่ทำให้
 *   เส้นทางสาธารณะสั่งเขียนได้ Postgres จะปฏิเสธด้วย `insufficient_privilege` (fail-closed)
 *   ไม่ใช่เขียนทับข้อมูลจริง
 * - ฟอร์มสาธารณะ (ทางเขียนเดียวที่คนนอกแตะได้) ใช้ role สิทธิ์แคบกว่านั้น (`waiwai_public_form`)
 *   ⇒ INSERT ได้แค่ `form_submission`/`form_attachment`
 *
 * กติกา
 * 1. ฟังก์ชันที่ใช้ `readQuery()` ต้องเป็น **SELECT ล้วน** — ห้าม insert/update/delete ในฟังก์ชันเดียวกัน
 *    (มีเทสต์สแกนกันถอยหลังที่ `scripts/test-db-roles.ts`)
 * 2. งานเขียน + transaction ใช้ `getPool()` (หลังบ้าน) เท่านั้น
 * 3. ไม่ตั้ง `PUBLIC_DATABASE_URL`/`FORM_DATABASE_URL` = ถอยไปใช้ pool หลังบ้าน (พฤติกรรมเดิม)
 *    ⇒ ยังไม่มี isolation จนกว่าจะตั้ง; ดู `isReadOnlyConfigured()` + `npm run db:roles`
 * 4. **credential เปลี่ยนกลางคัน** (รอบที่ 196): `npm run db:roles` เปลี่ยนรหัสผ่านของ role
 *    ขณะที่เซิร์ฟเวอร์ยังรันอยู่ ⇒ pool เก่าบน `globalThis` ยังใช้รหัสเดิมอยู่ ⇒ ล้มด้วย `28P01`
 *    ที่นี่จึง "ทิ้ง pool แล้วลองใหม่ 1 ครั้ง" และถ้ายังไม่ผ่าน = โยน error ที่ **บอกทางแก้** (ไม่ปล่อย error ดิบ)
 */

/** เตือนได้ไม่เกิน 1 ครั้งต่อบทบาทต่อโปรเซส (กัน log ท่วมตอนฐานข้อมูลล่มยาว) */
const warnedRoles = new Set<DatabaseRole>();

function warnOnce(role: DatabaseRole, error: unknown): void {
  if (warnedRoles.has(role)) return;
  warnedRoles.add(role);
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[db] ${roleCredentialHint(role)} — ${detail}`);
}

/**
 * รันคำสั่งผ่าน pool ของบทบาทนั้น (ประตูอ่าน/ฟอร์ม)
 * - ล้มด้วย "credential ใช้ไม่ได้" = **ทิ้ง pool แล้วลองใหม่ 1 ครั้ง** (กรณีเพิ่งรัน `db:roles` ระหว่างเซิร์ฟเวอร์รัน)
 * - ล้มซ้ำ = เตือนครั้งเดียว + โยน error ที่บอกทางแก้ (ผู้ใช้/admin รู้ว่าต้องทำอะไรต่อ)
 */
/** คำสั่งเดียวที่ต้องรันผ่าน pool ของบทบาทหนึ่ง (แยกออกมาให้เทสต์ได้โดยไม่ต้องมี DB) */
export type RoleQueryRun<T> = {
  readonly role: DatabaseRole;
  /** รันคำสั่งด้วย pool ปัจจุบัน */
  readonly query: () => Promise<T>;
  /** ทิ้ง pool ที่ค้าง ⇒ คำสั่งถัดไปสร้างใหม่จาก env ปัจจุบัน */
  readonly reset: () => void;
};

export async function runWithRoleRetry<T>(run: RoleQueryRun<T>): Promise<T> {
  try {
    return await run.query();
  } catch (error) {
    if (!isRoleAuthFailure(error)) throw error;

    run.reset();
    try {
      return await run.query();
    } catch (retryError) {
      warnOnce(run.role, retryError);
      throw new Error(roleCredentialHint(run.role), { cause: retryError });
    }
  }
}

export async function queryWithRole<T extends QueryResultRow = QueryResultRow>(
  role: DatabaseRole,
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const pool = (): Pool => (role === "read" ? getReadPool() : getFormPool());

  return runWithRoleRetry({
    role,
    query: () => pool().query<T>(text, params),
    reset: () => resetRolePool(role),
  });
}

/** อ่านข้อมูลผ่าน pool "อ่านอย่างเดียว" (หน้าเว็บสาธารณะ) */
export async function readQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return queryWithRole<T>("read", text, params);
}

/** อ่าน/เขียนเฉพาะตารางฟอร์ม ผ่าน pool สิทธิ์แคบ (ฟอร์มสาธารณะ) */
export async function formQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return queryWithRole<T>("form", text, params);
}
