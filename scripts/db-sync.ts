import pg from "pg";

import {
  SYNC_PRUNE_TABLES,
  SYNC_TABLES,
  buildDeleteSql,
  buildUpsertSql,
  copyColumnsOf,
  needsSequenceSync,
  rowKeyOf,
  type UpsertColumn,
} from "@/lib/db/sync";
import { hostOf, redactUrl } from "@/lib/db/target";

/**
 * `npm run db:sync [-- --apply] [-- --prune]` (รอบที่ 298) — ดัน **ข้อมูลเนื้อหา** จากเครื่องขึ้นปลายทาง
 *
 * ทำไมต้องมี ทั้งที่มี `npm run db:push`
 * - `db:push` ใช้ `pg_dump`/`pg_restore` ในกล่อง Docker ซึ่งเป็น **Postgres 17** แต่ Neon เป็น **18.6**
 *   ⇒ `pg_dump` ปฏิเสธ ("server version mismatch")
 * - เครื่องมือนี้คัดลอกทีละแถวผ่านไดรเวอร์ `pg` ⇒ ไม่ผูกกับเวอร์ชันไคลเอนต์ และเลือกได้ว่าจะดันตารางไหน
 *
 * ความปลอดภัย (บังคับ)
 * - **ค่าเริ่มต้น = dry-run** ต้องสั่ง `--apply` จึงเขียน
 * - **ห้ามลบโดยปริยาย** — แถวที่ปลายทางมีเกินจะถูก *รายงาน* เสมอ · จะลบเฉพาะเมื่อสั่ง `--prune`
 *   **และตารางนั้นอยู่ใน `SYNC_PRUNE_TABLES`** (มติเจ้าของ 2026-10-16: "ลบให้ตรงกับเครื่อง")
 * - ไม่แตะตารางของแต่ละสภาพแวดล้อม (audit · เซสชัน · ความพยายามล็อกอิน · ลิงก์พรีวิว) และตารางเนื้อหา
 *   ที่มีเครื่องมือเฉพาะ (สินค้า/ข่าว/เมนู/ภาพ) — ดู `SYNC_FORBIDDEN_TABLES`
 * - ห้ามพิมพ์รหัสผ่าน: ใช้ `redactUrl()` เท่านั้น
 */

/* ตัวคั่นคีย์ในรายงาน (ตรงกับ `rowKeyOf` ใน lib/db/sync) — ใช้แสดงเป็นจุดกลางเพื่ออ่านง่าย */
const SEPARATOR = "\u0001";
const APPLY = process.argv.includes("--apply");
const PRUNE = process.argv.includes("--prune");
const LOCAL_URL = process.env.DATABASE_URL ?? "";
const TARGET_URL = process.env.TARGET_DATABASE_URL ?? "";

if (LOCAL_URL === "" || TARGET_URL === "") {
  process.stdout.write("✗ ต้องมี DATABASE_URL (เครื่อง) และ TARGET_DATABASE_URL (ปลายทาง) ใน .env.local\n");
  process.exitCode = 1;
} else {
  process.stdout.write(
    `ℹ️ ต้นทาง: ${redactUrl(LOCAL_URL)}\nℹ️ ปลายทาง: ${redactUrl(TARGET_URL)} (${hostOf(TARGET_URL)})\n` +
      `ℹ️ โหมด: ${APPLY ? "เขียนจริง (--apply)" : "dry-run (ยังไม่เขียนอะไร)"}` +
      `${PRUNE ? " · ลบแถวที่ปลายทางมีเกิน (--prune)" : ""}\n\n`,
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
  let pruned = 0;

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
    let failed = 0;

    for (const row of localRows.rows) {
      if (targetKeys.has(rowKeyOf(plan, row))) updated += 1;
      else fresh += 1;

      if (!APPLY) continue;
      try {
        await target.query(sql, copied.map((column) => row[column.name]));
        written += 1;
      } catch (error) {
        failed += 1;
        process.stdout.write(`  ✗ ${plan.table}: เขียนแถวไม่สำเร็จ — ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }

    process.stdout.write(
      `${APPLY ? "✓" : "แผน"} ${plan.table}: เครื่อง ${String(localRows.rows.length)} แถว · ` +
        `มีที่ปลายทาง ${String(updated)} (อัปเดตทับ) · ใหม่ ${String(fresh)}${failed > 0 ? ` · ล้มเหลว ${String(failed)}` : ""}\n`,
    );

    /* ตารางที่คง id เดิม ⇒ ดันลำดับต่อ ไม่ให้ insert ใหม่ชน */
    if (APPLY && needsSequenceSync(plan, columns)) {
      const { rows } = await target.query<{ next: string }>(
        `select setval(pg_get_serial_sequence($1, 'id'), coalesce((select max(id) from "${plan.table}"), 1)) as next`,
        [plan.table],
      );
      process.stdout.write(`  ↳ ตั้งลำดับ id ต่อจาก ${rows[0]?.next ?? "?"}\n`);
    }

    /* แถวที่ปลายทางมีเกิน: รายงานเสมอ · ลบเฉพาะเมื่อสั่ง --prune และตารางอยู่ในรายการที่อนุญาต */
    const extra = targetRows.rows.filter(
      (row) => !localRows.rows.some((localRow) => rowKeyOf(plan, localRow) === rowKeyOf(plan, row)),
    );
    const mayPrune = PRUNE && SYNC_PRUNE_TABLES.includes(plan.table);

    if (extra.length > 0) {
      missing += extra.length;
      process.stdout.write(
        `  ${mayPrune ? "🧹" : "ℹ️"} ปลายทางมี ${String(extra.length)} แถวที่เครื่องไม่มี` +
          `${mayPrune ? " (จะลบให้ตรงกับเครื่อง)" : " (ไม่ลบให้ — ต้องสั่ง --prune และตารางต้องอยู่ในรายการที่อนุญาต)"}\n`,
      );

      /* ⚠️ ต้องลบ "ทุกแถว" ที่เกิน — การพิมพ์จำกัด 10 แถวเป็นแค่การอ่านง่าย
         (เจอจริงรอบ 298: เคยจำกัดการลบไว้ที่ 10 ⇒ ลบไม่ครบแล้วเข้าใจว่าลบหมด) */
      const printable = extra.slice(0, 10);
      for (const row of printable) process.stdout.write(`     · ${rowKeyOf(plan, row).split(SEPARATOR).join(" · ")}\n`);
      if (extra.length > printable.length) process.stdout.write(`     … อีก ${String(extra.length - printable.length)} แถว\n`);

      if (mayPrune && APPLY) {
        for (const row of extra) {
          const removed = await target.query(buildDeleteSql(plan), plan.conflictOn.map((key) => row[key]));
          pruned += removed.rowCount ?? 0;
        }
      }
    }
  }

  process.stdout.write(
    `\n${APPLY ? `เขียน ${String(written)} แถว` : "dry-run: ยังไม่เขียนอะไร"}` +
      `${missing > 0 ? ` · ปลายทางมีเกิน ${String(missing)} แถว${pruned > 0 ? ` (ลบแล้ว ${String(pruned)})` : " (ไม่ลบ)"}` : ""}\n`,
  );

  await local.end();
  await target.end();
}
