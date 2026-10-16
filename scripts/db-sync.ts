import pg from "pg";

import { SYNC_TABLES, buildUpsertSql, copyColumnsOf, rowKeyOf, type UpsertColumn } from "@/lib/db/sync";
import { hostOf, redactUrl } from "@/lib/db/target";

/**
 * `npm run db:sync [-- --apply]` (รอบที่ 298) — ดัน **ข้อมูลเนื้อหา** จากเครื่องขึ้นปลายทาง (Neon)
 *
 * ทำไมต้องมี ทั้งที่มี `npm run db:push`
 * - `db:push` ใช้ `pg_dump`/`pg_restore` ในกล่อง Docker ซึ่งเป็น **Postgres 17**
 *   แต่ Neon อัปเกรดเป็น **18.6** แล้ว ⇒ `pg_dump` ปฏิเสธ ("server version mismatch")
 * - เครื่องมือนี้คัดลอก **ทีละแถวผ่านไดรเวอร์ `pg`** ⇒ ไม่ผูกกับเวอร์ชันไคลเอนต์ และเลือกได้ว่า
 *   จะดันเฉพาะตารางเนื้อหาที่ต่างกันจริง (ไม่ทับทั้งฐานข้อมูล)
 *
 * ความปลอดภัย (บังคับ)
 * - **ค่าเริ่มต้น = dry-run** ต้องสั่ง `--apply` จึงเขียน
 * - **ไม่มีคำสั่งลบใด ๆ** (มีเทสต์สแกน) — แถวที่ปลายทางมีเกินจะ *รายงาน* ให้เห็นเฉย ๆ
 * - ไม่แตะตารางของแต่ละสภาพแวดล้อม (audit · เซสชัน · ความพยายามล็อกอิน · ลิงก์พรีวิว) และไม่แตะ
 *   ตารางเนื้อหาหลักที่จัดการด้วยเครื่องมือเฉพาะ (สินค้า/ข่าว/เมนู/ภาพ) — ดู `SYNC_FORBIDDEN_TABLES`
 * - ห้ามพิมพ์รหัสผ่าน: ใช้ `redactUrl()` เท่านั้น
 */

const APPLY = process.argv.includes("--apply");
const LOCAL_URL = process.env.DATABASE_URL ?? "";
const TARGET_URL = process.env.TARGET_DATABASE_URL ?? "";

if (LOCAL_URL === "" || TARGET_URL === "") {
  process.stdout.write("✗ ต้องมี DATABASE_URL (เครื่อง) และ TARGET_DATABASE_URL (ปลายทาง) ใน .env.local\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    `ℹ️ ต้นทาง: ${redactUrl(LOCAL_URL)}\nℹ️ ปลายทาง: ${redactUrl(TARGET_URL)} (${hostOf(TARGET_URL)})\n` +
      `ℹ️ โหมด: ${APPLY ? "เขียนจริง (--apply)" : "dry-run (ยังไม่เขียนอะไร)"}\n\n`,
  );

  const local = new pg.Client({ connectionString: LOCAL_URL });
  const target = new pg.Client({ connectionString: TARGET_URL });
  await local.connect();
  await target.connect();

  const columnsOf = async (table: string): Promise<readonly UpsertColumn[]> => {
    const { rows } = await target.query<{ column_name: string; identity_generation: string | null }>(
      `select column_name, identity_generation
         from information_schema.columns
        where table_schema = 'public' and table_name = $1
        order by ordinal_position`,
      [table],
    );
    return rows.map((row) => ({ name: row.column_name, identityAlways: row.identity_generation === "ALWAYS" }));
  };

  let written = 0;
  let missing = 0;

  for (const plan of SYNC_TABLES) {
    const columns = await columnsOf(plan.table);
    if (columns.length === 0) {
      process.stdout.write(`⚠️ ข้าม ${plan.table}: ไม่มีตารางนี้ที่ปลายทาง\n`);
      continue;
    }

    const copied = copyColumnsOf(plan, columns);
    const sql = buildUpsertSql(plan, columns);
    const localRows = await local.query<Record<string, unknown>>(`select * from "${plan.table}"`);
    const targetRows = await target.query<Record<string, unknown>>(
      `select ${plan.conflictOn.map((key) => `"${key}"`).join(", ")} from "${plan.table}"`,
    );
    const targetKeys = new Set(targetRows.rows.map((row) => rowKeyOf(plan, row)));

    let fresh = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of localRows.rows) {
      const exists = targetKeys.has(rowKeyOf(plan, row));
      if (exists) updated += 1;
      else fresh += 1;

      /* แถวที่ผลลัพธ์เหมือนกันอยู่แล้ว = ไม่ต้องเขียน (ลดการเขียนโดยไม่จำเป็น) */
      if (APPLY) {
        try {
          await target.query(sql, copied.map((column) => row[column.name]));
          written += 1;
        } catch (error) {
          skipped += 1;
          process.stdout.write(`  ✗ ${plan.table}: เขียนแถวไม่สำเร็จ — ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
    }

    process.stdout.write(
      `${APPLY ? "✓" : "แผน"} ${plan.table}: เครื่อง ${String(localRows.rows.length)} แถว · ` +
        `มีที่ปลายทาง ${String(updated)} (อัปเดตทับ) · ใหม่ ${String(fresh)}${skipped > 0 ? ` · ล้มเหลว ${String(skipped)}` : ""}\n`,
    );

    /* ตารางที่คง id เดิม ⇒ ต้องดันลำดับต่อ ไม่ให้ insert ใหม่ชน */
    if (APPLY && plan.conflictOn.includes("id")) {
      const { rows } = await target.query<{ next: string }>(
        `select setval(pg_get_serial_sequence($1, 'id'), coalesce((select max(id) from "${plan.table}"), 1)) as next`,
        [plan.table],
      );
      process.stdout.write(`  ↳ ตั้งลำดับ id ต่อจาก ${rows[0]?.next ?? "?"}\n`);
    }

    /* แถวที่ปลายทางมีเกิน (เครื่องไม่มี) = รายงานอย่างเดียว ห้ามลบ */
    const extra = targetRows.rows.filter((row) => !localRows.rows.some((localRow) => rowKeyOf(plan, localRow) === rowKeyOf(plan, row)));
    if (extra.length > 0) {
      missing += extra.length;
      process.stdout.write(`  ℹ️ ปลายทางมี ${String(extra.length)} แถวที่เครื่องไม่มี (ไม่ลบให้ — ตรวจด้วยตาแล้วตัดสินใจ)\n`);
      for (const row of extra.slice(0, 5)) process.stdout.write(`     · ${rowKeyOf(plan, row).replace("\u0001", " · ")}\n`);
    }
  }

  process.stdout.write(
    `\n${APPLY ? `เขียนทั้งหมด ${String(written)} แถว` : "dry-run: ยังไม่เขียนอะไร"}` +
      `${missing > 0 ? ` · ปลายทางมีเกิน ${String(missing)} แถว (ไม่ลบ)` : ""}\n`,
  );

  await local.end();
  await target.end();
}
