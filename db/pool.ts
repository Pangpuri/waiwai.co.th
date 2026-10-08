import { Pool } from "pg";
import type { PoolClient } from "pg";

/**
 * Connection pool ของ Postgres — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * กติกาโปรเจกต์
 * - อ่าน URL จาก env เท่านั้น · **ห้ามมีค่าเริ่มต้น** (ค่า default ลับ ๆ = ช่องโหว่)
 * - ใช้ connection pool เดียวต่อโปรเซส (Next hot reload จะสร้างซ้ำได้ → เก็บไว้บน globalThis)
 * - ทุกงานที่เขียนข้อมูลต้องอยู่ใน transaction (มี helper `withTransaction`)
 *
 * ── Least privilege (รอบที่ 169) ─────────────────────────────────────────────
 * แยก "บทบาทการเชื่อมต่อ" ตามงาน เพื่อจำกัดขอบเขตความเสียหาย (blast radius)
 *   · write = หลังบ้าน (`DATABASE_URL`)              → เขียนได้ทุกตาราง
 *   · read  = หน้าเว็บสาธารณะ (`PUBLIC_DATABASE_URL`) → SELECT เฉพาะตารางสาธารณะ (role `waiwai_public_ro`)
 *   · form  = ฟอร์มสาธารณะ (`FORM_DATABASE_URL`)      → INSERT/SELECT เฉพาะตารางฟอร์ม (role `waiwai_public_form`)
 *
 * ⚠️ ไม่ตั้ง env ของ read/form = **ถอยไปใช้ connection เดียวกัน** (เดโม/เครื่อง dev ยังทำงานได้)
 *    ⇒ ยังไม่มี isolation จนกว่าจะตั้ง — ดู `databaseRoleStatus()` และ `scripts/db-roles.ts`
 *
 * มติ D9: ที่เก็บบทบาท/พาธไม่ได้อยู่ที่นี่ — ที่นี่เก็บเฉพาะ "แถวเนื้อหา" (path ไม่ใช่ URL)
 */

export type DatabaseRole = "write" | "read" | "form";

type PoolGlobal = typeof globalThis & {
  __waiwaiPool?: Pool;
  __waiwaiReadPool?: Pool;
  __waiwaiFormPool?: Pool;
};

/** ค่าที่อ่านจาก env — แยกเป็น type เพื่อทดสอบ `resolveRoleUrl()` แบบ pure ได้ */
export type DatabaseEnv = {
  readonly [key: string]: string | undefined;
  readonly DATABASE_URL?: string;
  readonly PUBLIC_DATABASE_URL?: string;
  readonly FORM_DATABASE_URL?: string;
};

export type ResolvedRoleUrl = {
  readonly url: string;
  /** true = ใช้ credential/role เฉพาะทาง (isolated จริง) · false = ถอยไปใช้ `DATABASE_URL` ตัวเดียว */
  readonly isolated: boolean;
};

function clean(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * เลือก URL ต่อบทบาท (ตรรกะล้วน — ทดสอบได้โดยไม่ต้องมี DB)
 * - ไม่ตั้ง URL ของบทบาทนั้น → ถอยไปใช้ `DATABASE_URL` (`isolated:false`)
 * - ไม่มีอะไรเลย → `null` (ผู้เรียกต้อง fail-closed เอง)
 */
export function resolveRoleUrl(role: DatabaseRole, env: DatabaseEnv): ResolvedRoleUrl | null {
  const admin = clean(env.DATABASE_URL);
  const dedicated = role === "read" ? clean(env.PUBLIC_DATABASE_URL) : role === "form" ? clean(env.FORM_DATABASE_URL) : "";
  if (dedicated !== "") return { url: dedicated, isolated: true };
  if (admin === "") return null;
  return { url: admin, isolated: false };
}

/** สถานะว่าตั้ง role เฉพาะทางไว้หรือยัง (ใช้รายงานบนหลังบ้าน/เทสต์) */
export function databaseRoleStatus(env: DatabaseEnv = process.env): {
  readonly read: ResolvedRoleUrl | null;
  readonly form: ResolvedRoleUrl | null;
} {
  return { read: resolveRoleUrl("read", env), form: resolveRoleUrl("form", env) };
}

export function isDatabaseConfigured(): boolean {
  return clean(process.env.DATABASE_URL) !== "";
}

/** ตั้ง `PUBLIC_DATABASE_URL` (role อ่านอย่างเดียว) แล้วหรือยัง */
export function isReadOnlyConfigured(): boolean {
  return resolveRoleUrl("read", process.env)?.isolated === true;
}

/** ตั้ง `FORM_DATABASE_URL` (role สิทธิ์แคบของฟอร์ม) แล้วหรือยัง */
export function isFormRoleConfigured(): boolean {
  return resolveRoleUrl("form", process.env)?.isolated === true;
}

function createPool(url: string): Pool {
  return new Pool({
    connectionString: url,
    /* เดโม/เซิร์ฟเวอร์เล็ก: pool ไม่ต้องใหญ่ · ปิด idle เร็วเพื่อไม่ค้าง connection */
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * รหัส error ของ Postgres ที่แปลว่า "credential ของ role นี้ใช้ไม่ได้"
 * · `28P01` = invalid_password · `28000` = invalid_authorization_specification
 */
const ROLE_AUTH_FAILURE_CODES: readonly string[] = ["28P01", "28000"];

/**
 * error นี้เกิดจากรหัสผ่าน/สิทธิ์ของ role หรือไม่ (ตรรกะล้วน — ทดสอบได้โดยไม่ต้องมี DB)
 */
export function isRoleAuthFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" && ROLE_AUTH_FAILURE_CODES.includes(code);
}

/**
 * ทิ้ง pool ที่ค้างของบทบาทนั้น ⇒ คำขอถัดไปสร้าง pool ใหม่จาก env ปัจจุบัน
 *
 * ⚠️ บทเรียนรอบที่ 196 (เคสจริง): `npm run db:roles` เปลี่ยนรหัสผ่านของ role **ขณะที่ dev ยังรันอยู่**
 *    แล้วอัปเดต `.env.local` — Next รีโหลด env ให้ แต่ pool ถูกเก็บไว้บน `globalThis` ต่อโปรเซส
 *    ⇒ ตัวเก่ายังใช้รหัสผ่านเดิมต่อไป ⇒ ทุกหน้าอ่านผ่านประตูอ่านพังด้วย `28P01` (หน้าเว็บสาธารณะเงียบเป็นข้อมูลตัวอย่าง)
 */
export function resetRolePool(role: DatabaseRole): void {
  const scope = globalThis as PoolGlobal;
  const key = role === "read" ? "__waiwaiReadPool" : role === "form" ? "__waiwaiFormPool" : "__waiwaiPool";
  const pool = scope[key];
  if (pool === undefined) return;
  scope[key] = undefined;
  /* ปิดแบบไม่รอคำตอบ — คำขอที่ค้างอยู่จบเอง · error ตอนปิดต้องไม่ทำให้คำขอหลักล้ม */
  void pool.end().catch(() => {});
}

/**
 * ข้อความบอกทางแก้เมื่อ credential ของ role ใช้ไม่ได้ (สำหรับ server log / หน้า error ของ dev — ไม่ใช่ข้อความ UI)
 * มีเทสต์คุมว่าต้องบอกทั้ง "env key" และ "คำสั่งที่ต้องรัน" เสมอ
 */
export function roleCredentialHint(role: DatabaseRole): string {
  const envKey = role === "read" ? "PUBLIC_DATABASE_URL" : role === "form" ? "FORM_DATABASE_URL" : "DATABASE_URL";
  const label = role === "read" ? "อ่านอย่างเดียว (หน้าเว็บสาธารณะ)" : role === "form" ? "ฟอร์มสาธารณะ" : "หลังบ้าน";
  return [
    `เชื่อมต่อฐานข้อมูลด้วย role ${label} ไม่สำเร็จ — รหัสผ่านใน ${envKey} ไม่ตรงกับที่ตั้งไว้ในฐานข้อมูล`,
    "แก้: รัน `npm run db:roles -- --reveal` แล้วอัปเดตค่าใน .env.local ให้ตรงกัน",
    "ถ้าเพิ่งแก้ .env.local ขณะที่เซิร์ฟเวอร์ยังรันอยู่ ⇒ รีสตาร์ต (`npm run dev:clean` แล้ว `npm run dev`)",
  ].join(" · ");
}

/** pool ของหลังบ้าน (อ่าน/เขียนเต็มสิทธิ์) */
export function getPool(): Pool {
  const resolved = resolveRoleUrl("write", process.env);
  if (resolved === null) throw new Error("DATABASE_URL is not set");

  const scope = globalThis as PoolGlobal;
  const existing = scope.__waiwaiPool;
  if (existing !== undefined) return existing;

  const pool = createPool(resolved.url);
  scope.__waiwaiPool = pool;
  return pool;
}

/**
 * pool สำหรับ **อ่านอย่างเดียว** — หน้าเว็บสาธารณะใช้ตัวนี้ (ผ่าน `readQuery()`)
 * ไม่ตั้ง `PUBLIC_DATABASE_URL` = คืน pool เดียวกับหลังบ้าน (พฤติกรรมเดิม · ไม่มี isolation)
 */
export function getReadPool(): Pool {
  const resolved = resolveRoleUrl("read", process.env);
  if (resolved === null) throw new Error("DATABASE_URL is not set");
  if (!resolved.isolated) return getPool();

  const scope = globalThis as PoolGlobal;
  const existing = scope.__waiwaiReadPool;
  if (existing !== undefined) return existing;

  const pool = createPool(resolved.url);
  scope.__waiwaiReadPool = pool;
  return pool;
}

/**
 * pool สำหรับ **ฟอร์มสาธารณะ** — สิทธิ์แคบสุด (INSERT เฉพาะตารางฟอร์ม)
 * ไม่ตั้ง `FORM_DATABASE_URL` = คืน pool เดียวกับหลังบ้าน (พฤติกรรมเดิม · ไม่มี isolation)
 */
export function getFormPool(): Pool {
  const resolved = resolveRoleUrl("form", process.env);
  if (resolved === null) throw new Error("DATABASE_URL is not set");
  if (!resolved.isolated) return getPool();

  const scope = globalThis as PoolGlobal;
  const existing = scope.__waiwaiFormPool;
  if (existing !== undefined) return existing;

  const pool = createPool(resolved.url);
  scope.__waiwaiFormPool = pool;
  return pool;
}

/** รันงานใน transaction — rollback อัตโนมัติถ้ามี error (ใช้ตอนบันทึกเนื้อหา) */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* ถ้า rollback ไม่ได้ ก็ยังต้องโยน error เดิมกลับไป (ห้ามกลืน) */
    }
    throw error;
  } finally {
    client.release();
  }
}

/** ปิด pool ทั้งหมด — ใช้ในสคริปต์ CLI เพื่อให้โปรเซสจบจริง */
export async function closePool(): Promise<void> {
  const scope = globalThis as PoolGlobal;
  const pools = [scope.__waiwaiPool, scope.__waiwaiReadPool, scope.__waiwaiFormPool];
  scope.__waiwaiPool = undefined;
  scope.__waiwaiReadPool = undefined;
  scope.__waiwaiFormPool = undefined;

  await Promise.all(
    pools.map(async (pool) => {
      if (pool !== undefined) await pool.end();
    }),
  );
}
