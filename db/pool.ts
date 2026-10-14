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
  /** เวลาที่รีเซ็ตล่าสุด (กัน reset storm — เคสจริง 2026-10-14) */
  __waiwaiPoolResetAt?: number;
  __waiwaiReadPoolResetAt?: number;
  __waiwaiFormPoolResetAt?: number;
};

/** ค่าที่อ่านจาก env — แยกเป็น type เพื่อทดสอบ `resolveRoleUrl()` แบบ pure ได้ */
export type DatabaseEnv = {
  readonly [key: string]: string | undefined;
  readonly DATABASE_URL?: string;
  readonly PUBLIC_DATABASE_URL?: string;
  readonly FORM_DATABASE_URL?: string;
  /** เพดาน connection ต่อ pool (ค่าเริ่มต้น 3) */
  readonly PG_POOL_MAX?: string;
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

/**
 * เพดาน connection ต่อ pool ของโปรเซสนี้ (env `PG_POOL_MAX` · ค่าเริ่มต้น 3 · 1..20)
 *
 * ⚠️ เคสจริง 2026-10-14: ผู้ใช้กดเพิ่ม/เผยแพร่ภาพป้ายประกาศ แล้วเจอ
 * `sorry, too many clients already (53300)` จาก Postgres
 *   · ต้นเหตุ: ต่อ 1 โปรเซสมีได้ถึง **3 pool** (หลังบ้าน/อ่าน/ฟอร์ม) × `max` เดิม 5 = 15 connection
 *     และ dev รันคำขอขนานกันหลายใบ ⇒ pool โตถึงเพดานเร็ว · พอมีหลายโปรเซส (dev ค้าง + build + สคริปต์)
 *     ก็ชน `max_connections = 100` ของกล่อง Postgres ⇒ คำขอใหม่ถูกปฏิเสธทันที
 *   · แก้: ลดเพดานต่อ pool + คืน connection เร็วขึ้น + กันการรีเซ็ตถี่ (ดู `resetRolePool`)
 */
export function poolMaxOf(env: DatabaseEnv = process.env): number {
  const raw = Number.parseInt(clean(env.PG_POOL_MAX), 10);
  if (!Number.isFinite(raw)) return 3;
  return Math.min(20, Math.max(1, raw));
}

function createPool(url: string): Pool {
  return new Pool({
    connectionString: url,
    /* เดโม/เซิร์ฟเวอร์เล็ก: pool ไม่ต้องใหญ่ · ปิด idle เร็วเพื่อไม่ค้าง connection */
    max: poolMaxOf(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    /* ปิด connection ที่ว่างทันทีเมื่อไม่มีงานค้าง (คืน slot ให้ Postgres) */
    allowExitOnIdle: false,
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
const POOL_RESET_MIN_INTERVAL_MS = 2_000;

export function resetRolePool(role: DatabaseRole): boolean {
  const scope = globalThis as PoolGlobal;
  const key = role === "read" ? "__waiwaiReadPool" : role === "form" ? "__waiwaiFormPool" : "__waiwaiPool";
  const stampKey = role === "read" ? "__waiwaiReadPoolResetAt" : role === "form" ? "__waiwaiFormPoolResetAt" : "__waiwaiPoolResetAt";
  const pool = scope[key];
  if (pool === undefined) return false;

  /*
    ⚠️ กัน "reset storm": ถ้าเพิ่งรีเซ็ตไปไม่ถึง 2 วินาที ให้ใช้ pool เดิมต่อ
    (รีเซ็ตถี่ = สร้าง Pool ใหม่ทับเรื่อย ๆ ⇒ connection ค้างสะสมจนชนเพดาน Postgres — เคสจริง 2026-10-14)
  */
  const now = Date.now();
  const last = scope[stampKey] ?? 0;
  if (now - last < POOL_RESET_MIN_INTERVAL_MS) return false;
  scope[stampKey] = now;

  scope[key] = undefined;
  /* ปิดแบบไม่รอคำตอบ — คำขอที่ค้างอยู่จบเอง · error ตอนปิดต้องไม่ทำให้คำขอหลักล้ม */
  void pool.end().catch(() => {});
  return true;
}

/**
 * error นี้แปลว่า "Postgres ไม่รับ connection ใหม่แล้ว" (ชน `max_connections`)
 * ⇒ คำแนะนำ: ปิดโปรเซส dev ที่ค้าง / ลด `PG_POOL_MAX` / เพิ่ม `max_connections` ของกล่อง
 */
export function isConnectionExhausted(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { readonly code?: unknown }).code === "53300";
}

export function connectionExhaustedHint(): string {
  return [
    "ฐานข้อมูลปฏิเสธ connection ใหม่ (Postgres: too many clients already)",
    "สาเหตุที่พบบ่อย: มีโปรเซส dev/สคริปต์ค้างหลายตัว และแต่ละตัวถือ pool ได้ถึง 3 ใบ",
    "แก้: ปิดโปรเซสที่ค้าง · ตั้ง PG_POOL_MAX=1..3 ใน .env.local · หรือเพิ่ม max_connections ของ Postgres",
  ].join(" · ");
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
