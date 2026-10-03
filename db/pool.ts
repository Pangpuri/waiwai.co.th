import { Pool } from "pg";
import type { PoolClient } from "pg";

/**
 * Connection pool ของ Postgres — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * กติกาโปรเจกต์
 * - อ่าน `DATABASE_URL` จาก env เท่านั้น · **ห้ามมีค่าเริ่มต้น** (ค่า default ลับ ๆ = ช่องโหว่)
 * - ใช้ connection pool เดียวต่อโปรเซส (Next hot reload จะสร้างซ้ำได้ → เก็บไว้บน globalThis)
 * - ทุกงานที่เขียนข้อมูลต้องอยู่ใน transaction (มี helper `withTransaction`)
 *
 * มติ D9: ที่เก็บบทบาท/พาธไม่ได้อยู่ที่นี่ — ที่นี่เก็บเฉพาะ "แถวเนื้อหา" (path ไม่ใช่ URL)
 */

type PoolGlobal = typeof globalThis & { __waiwaiPool?: Pool };

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return typeof url === "string" && url.trim() !== "";
}

export function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("DATABASE_URL is not set");
  }

  const scope = globalThis as PoolGlobal;
  const existing = scope.__waiwaiPool;
  if (existing !== undefined) return existing;

  const pool = new Pool({
    connectionString: url,
    /* เดโม/เซิร์ฟเวอร์เล็ก: pool ไม่ต้องใหญ่ · ปิด idle เร็วเพื่อไม่ค้าง connection */
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  scope.__waiwaiPool = pool;
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

/** ปิด pool — ใช้ในสคริปต์ CLI เพื่อให้โปรเซสจบจริง */
export async function closePool(): Promise<void> {
  const scope = globalThis as PoolGlobal;
  const pool = scope.__waiwaiPool;
  if (pool === undefined) return;
  scope.__waiwaiPool = undefined;
  await pool.end();
}
