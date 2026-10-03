import { Pool } from "pg";

import { diffTables, type TableDiff, type TableStat } from "@/lib/backup/plan";

/**
 * เทียบ "เนื้อหา" ของสองฐานข้อมูล (X2.3) — ใช้ตอนพิสูจน์ว่ากู้คืนได้จริง
 *
 * ทำไมต้องเทียบมากกว่าจำนวนตาราง
 * - "กู้คืนสำเร็จ" ที่ดูแค่ "pg_restore ไม่ error" ไม่พอ — เคยมีเคสกู้คืนได้ครึ่งเดียว
 *   (ตารางครบแต่ข้อมูลหาย) ⇒ ต้องเทียบ **จำนวนแถว + ลายนิ้วมือของเนื้อหา** ทีละตาราง
 * - ลายนิ้วมือ = `md5` ของผลรวมแฮชของทุกแถว (`to_jsonb(แถว)`) ⇒ ไม่ขึ้นกับลำดับแถว
 *   และจับได้แม้จำนวนแถวเท่ากันแต่เนื้อหาต่าง · ถ้าคำนวณไม่ได้ (ตารางใหญ่ผิดปกติ) จะคืน `null`
 *   แล้วการเทียบจะลดเหลือ "จำนวนแถว" พร้อมรายงานให้รู้ว่าลดระดับลง
 *
 * ⚠️ ใช้เฉพาะกับฐานข้อมูลที่เชื่อถือได้ (สคริปต์ของผู้ดูแล) — ไม่ได้ออกแบบให้รับอินพุตจากผู้ใช้ปลายทาง
 */

export type CompareResult = {
  readonly sourceTables: readonly TableStat[];
  readonly targetTables: readonly TableStat[];
  readonly diffs: readonly TableDiff[];
  /** ตารางที่เทียบได้แค่จำนวนแถว (คำนวณลายนิ้วมือไม่ได้) — รายงานเพื่อไม่ให้เข้าใจผิดว่าเทียบครบ */
  readonly digestSkipped: readonly string[];
};

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * อ่านสถิติของทุกตารางใน schema `public`
 * - จำนวนแถว: ตรงไปตรงมา
 * - ลายนิ้วมือ: ผลรวมแฮชของทุกแถว (ไม่ขึ้นกับลำดับ) — ล้มเหลว = `null` ไม่ทำให้ทั้งงานพัง
 */
export async function readTableStats(connectionString: string): Promise<readonly TableStat[]> {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const { rows: tables } = await pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );

    const stats: TableStat[] = [];
    for (const { tablename } of tables) {
      const table = quoteIdentifier(tablename);

      const counted = await pool.query<{ rows: number }>(`select count(*)::int as rows from ${table}`);
      const rows = counted.rows[0]?.rows ?? 0;

      /*
        ตารางว่าง = ลายนิ้วมือ "empty" (ไม่ใช่ null) เพื่อไม่ให้รายงานว่า "เทียบไม่ได้"
        (ตารางว่างสองฝั่งเท่ากันได้จริง — เดิมปล่อยเป็น null ทำให้รายงานดูน่าตกใจเกินเหตุ)
      */
      let digest: string | null = rows === 0 ? "empty" : null;
      if (rows > 0) {
        try {
          const digested = await pool.query<{ digest: string | null }>(
            `select md5(string_agg(md5(to_jsonb(entry)::text), '' order by md5(to_jsonb(entry)::text))) as digest from ${table} entry`,
          );
          digest = digested.rows[0]?.digest ?? null;
        } catch {
          digest = null;
        }
      }

      stats.push({ table: tablename, rows, digest });
    }

    return stats;
  } finally {
    await pool.end();
  }
}

export async function compareDatabases(sourceUrl: string, targetUrl: string): Promise<CompareResult> {
  const [sourceTables, targetTables] = await Promise.all([readTableStats(sourceUrl), readTableStats(targetUrl)]);

  const digestSkipped = [...sourceTables, ...targetTables]
    .filter((stat) => stat.digest === null)
    .map((stat) => stat.table);

  return {
    sourceTables,
    targetTables,
    diffs: diffTables(sourceTables, targetTables),
    digestSkipped: [...new Set(digestSkipped)].sort(),
  };
}

/* ── คำสั่ง SQL ตรง ๆ (ใช้กับฐานข้อมูลชั่วคราวเท่านั้น) ────────────────────────── */

/**
 * รันคำสั่ง SQL ที่ไม่คืนผลลัพธ์ — ใช้เตรียม/ตรวจฐานข้อมูลชั่วคราวในชุดทดสอบไฟล์ไบนารี
 * ⚠️ รับ `params` เสมอ (ห้ามต่อสตริงจากค่าที่คำนวณ) เพื่อไม่ให้เกิด SQL injection แม้จะรันกับฐานชั่วคราว
 */
export async function executeSql(connectionString: string, sql: string, params: readonly unknown[] = []): Promise<void> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(sql, [...params]);
  } finally {
    await pool.end();
  }
}

/** อ่านค่าเดียวจากคำสั่ง SQL (`null` = ไม่มีแถว/ค่าเป็น null) */
export async function queryScalar(
  connectionString: string,
  sql: string,
  params: readonly unknown[] = [],
): Promise<string | null> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const { rows } = await pool.query<Record<string, unknown>>(sql, [...params]);
    const first = rows[0];
    if (first === undefined) return null;
    const value = Object.values(first)[0];
    return value === null || value === undefined ? null : String(value);
  } finally {
    await pool.end();
  }
}
