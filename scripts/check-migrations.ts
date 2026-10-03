import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

import { checksumOf, parseMigrationFileName, sortMigrations, type MigrationFile } from "@/lib/db/migrations";

/**
 * ตรวจว่า "เซิร์ฟเวอร์ใหม่สร้างได้จาก migration เปล่า ๆ" (รอบที่ 60)
 *
 * เหตุผล: ก่อนย้ายไปเซิร์ฟเวอร์จริง เราต้องพิสูจน์ว่า `db/migrations/*.sql` สร้างฐานข้อมูลใหม่
 * ได้ครบเหมือนของที่รันอยู่ (ไม่ใช่พึ่งประวัติแก้มือของเครื่องนี้)
 *
 * วิธีทำ
 * 1. สร้างฐานข้อมูลชั่วคราวชื่อ `waiwai_migrate_check` (ลบถ้ามีอยู่)
 * 2. รัน migration ทุกไฟล์ตามลำดับ
 * 3. เทียบรายชื่อตาราง + จำนวนคอลัมน์ กับฐานข้อมูลจริง
 * 4. ลบฐานข้อมูลชั่วคราวทิ้ง (ไม่แตะข้อมูลจริง — อ่านอย่างเดียวจากของจริง)
 *
 * รันด้วย: `npm run check:migrations`  (ต้องมี DATABASE_URL)
 */

const CHECK_DB = "waiwai_migrate_check";
const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

type TableShape = { readonly table: string; readonly columns: number };

function loadMigrations(): readonly MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
  const parsed: MigrationFile[] = [];
  for (const fileName of files) {
    const info = parseMigrationFileName(fileName);
    if (info === null) throw new Error(`ชื่อไฟล์ไม่ตรงรูปแบบ: ${fileName}`);
    parsed.push({ id: info.id, name: info.name, sql: readFileSync(join(MIGRATIONS_DIR, fileName), "utf8") });
  }
  return sortMigrations(parsed);
}

/** เปลี่ยนชื่อฐานข้อมูลใน DATABASE_URL (ใช้สร้าง/เชื่อมฐานข้อมูลชั่วคราว) */
function withDatabase(url: string, databaseName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

async function shapesOf(pool: pg.Pool): Promise<readonly TableShape[]> {
  const { rows } = await pool.query<{ table_name: string; columns: string }>(
    `select table_name, (select count(*)::text from information_schema.columns c
                          where c.table_schema = t.table_schema and c.table_name = t.table_name) as columns
       from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by table_name`,
  );
  return rows.map((row) => ({ table: row.table_name, columns: Number.parseInt(row.columns, 10) }));
}

/** ตารางที่ระบบ migration สร้างเอง (ไม่นับเทียบ — มีเฉพาะในฐานข้อมูลที่เคยรัน migration ผ่านตัวรัน) */
const INTERNAL_TABLES = new Set(["schema_migration"]);

function diff(expected: readonly TableShape[], actual: readonly TableShape[]): readonly string[] {
  const problems: string[] = [];
  const expectedTables = expected.filter((entry) => !INTERNAL_TABLES.has(entry.table));
  const actualTables = actual.filter((entry) => !INTERNAL_TABLES.has(entry.table));
  const actualMap = new Map(actualTables.map((entry) => [entry.table, entry.columns]));

  for (const entry of expectedTables) {
    const found = actualMap.get(entry.table);
    if (found === undefined) {
      problems.push(`ขาดตาราง ${entry.table}`);
      continue;
    }
    if (found !== entry.columns) problems.push(`${entry.table}: คอลัมน์ไม่ตรง (จริง ${entry.columns} · ใหม่ ${found})`);
  }

  const expectedNames = new Set(expectedTables.map((entry) => entry.table));
  for (const entry of actualTables) {
    if (!expectedNames.has(entry.table)) {
      problems.push(`มีตารางเกิน ${entry.table} (ไม่ได้อยู่ในของจริง)`);
    }
  }

  return problems;
}

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (url === undefined || url.trim() === "") {
    console.error("✗ ต้องตั้ง DATABASE_URL ก่อน (ไม่เดาค่าให้)");
    process.exitCode = 1;
    return;
  }

  const migrations = loadMigrations();
  const admin = new pg.Pool({ connectionString: withDatabase(url, "postgres"), max: 1 });
  const target = new pg.Pool({ connectionString: withDatabase(url, CHECK_DB), max: 1 });

  try {
    console.log(`ตรวจ migration ${migrations.length} ไฟล์ กับฐานข้อมูลใหม่ "${CHECK_DB}"`);

    await admin.query(`drop database if exists ${CHECK_DB}`);
    await admin.query(`create database ${CHECK_DB}`);

    for (const migration of migrations) {
      await target.query(migration.sql);
      console.log(`  ✓ ${migration.id}-${migration.name} (${checksumOf(migration.sql)})`);
    }

    const live = new pg.Pool({ connectionString: url, max: 1 });
    try {
      const expected = (await shapesOf(live)).filter((entry) => !INTERNAL_TABLES.has(entry.table));
      const actual = (await shapesOf(target)).filter((entry) => !INTERNAL_TABLES.has(entry.table));
      const problems = diff(expected, actual);

      console.log(`ตารางในของจริง ${expected.length} · ในฐานข้อมูลใหม่ ${actual.length}`);
      if (problems.length > 0) {
        console.error("✗ ฐานข้อมูลใหม่ไม่ตรงกับของจริง:");
        for (const problem of problems) console.error(`  - ${problem}`);
        process.exitCode = 1;
        return;
      }
      console.log("✓ ฐานข้อมูลใหม่สร้างจาก migration ได้ครบ และตรงกับของจริงทุกตาราง");
    } finally {
      await live.end();
    }
  } finally {
    await target.end();
    await admin.query(`drop database if exists ${CHECK_DB} with (force)`).catch(() => undefined);
    await admin.end();
    console.log(`  (ลบฐานข้อมูลชั่วคราว "${CHECK_DB}" แล้ว)`);
  }
}

try {
  await main();
} catch (error) {
  console.error("✗ ตรวจไม่สำเร็จ:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
