
import { closePool, getPool, isDatabaseConfigured } from "@/db/pool";
import { loadMigrationFiles } from "./migration-files.ts";
import { selectTargetUrl, targetBanner } from "./target-env.ts";
import { checksumOf, describePlan, planMigrations } from "@/lib/db/migrations";

/**
 * ตัวรัน migration (รอบที่ 60) — `npm run db:migrate` / `npm run db:status`
 *
 * ผู้ใช้เลือก "คง SQL เขียนมือ + ทำระบบ migration เอง" (ไม่ใช้ ORM — ดู WORK_PLAN.md)
 * หลักการ
 * - รันไฟล์ใน `db/migrations/*.sql` **ตามลำดับเลข** · ไฟล์ละ 1 transaction
 * - จดว่าไฟล์ไหนรันแล้ว + ลายนิ้วมือ (sha256 16 ตัวแรก) ในตาราง `schema_migration`
 * - ถ้าไฟล์ที่รันไปแล้ว **ถูกแก้ทีหลัง** ⇒ เตือนและไม่รันให้ (ต้องสร้างไฟล์ใหม่แทน)
 * - ทุกไฟล์ต้อง idempotent ⇒ รันซ้ำได้ ไม่พังกับฐานข้อมูลที่มีข้อมูลอยู่
 * - ⚠️ อ่าน `DATABASE_URL` จาก env เท่านั้น (ห้ามใส่ค่าเริ่มต้น) เหมือนสคริปต์อื่นของโปรเจกต์
 */

/* โฟลเดอร์/การอ่านไฟล์ อยู่ที่ `MIGRATIONS_DIR` + `loadMigrationFiles()` ใน `migration-files.ts` */

/* การอ่านไฟล์/ตรวจชื่อ/เลขซ้ำ อยู่ที่ `loadMigrationFiles()` ตัวกลาง (รอบที่ 283) */

async function ensureTable(): Promise<void> {
  await getPool().query(`
    create table if not exists schema_migration (
      id         text        primary key,
      name       text        not null,
      checksum   text        not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function readState(): Promise<{ appliedIds: string[]; appliedChecksums: Record<string, string> }> {
  const { rows } = await getPool().query<{ id: string; checksum: string }>("select id, checksum from schema_migration");
  const appliedChecksums: Record<string, string> = {};
  for (const row of rows) appliedChecksums[row.id] = row.checksum;
  return { appliedIds: rows.map((row) => row.id), appliedChecksums };
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes("--status");

  /*
    `--target` = ยิงไป **ฐานข้อมูลปลายทาง** (คลาวด์) แทน Postgres ในเครื่อง (รอบที่ 282)
    ⚠️ ต้องเลือกโดยเจตนา (ไม่ใช่ค่าเริ่มต้น) และผ่านด่านของ `selectTargetUrl()`
       (ห้ามชี้เครื่องตัวเอง · ห้ามซ้ำกับ DATABASE_URL ของ dev · ตัด `-pooler` ให้เอง)
  */
  if (process.argv.includes("--target")) {
    const selection = selectTargetUrl(process.env);
    if (!selection.ok) {
      console.error(`✗ ${selection.message}`);
      process.exitCode = 1;
      return;
    }
    process.env["DATABASE_URL"] = selection.url;
    console.log(targetBanner(selection));
  }

  if (!isDatabaseConfigured()) {
    console.error("✗ ต้องตั้ง DATABASE_URL ก่อน (สคริปต์นี้ไม่เดาค่าให้)");
    process.exitCode = 1;
    return;
  }

  const migrations = loadMigrationFiles();
  await ensureTable();
  const state = await readState();
  const plan = planMigrations(migrations, state);

  console.log(`พบไฟล์ migration ${migrations.length} ไฟล์ ใน db/migrations/`);
  for (const line of describePlan(plan)) console.log(`  ${line}`);

  if (plan.modified.length > 0) {
    console.error("✗ หยุด: มีไฟล์ที่รันไปแล้วถูกแก้ทีหลัง — ให้ย้อนไฟล์นั้นกลับ หรือสร้างไฟล์ใหม่ถัดเลข");
    process.exitCode = 1;
    return;
  }

  if (statusOnly) return;

  if (plan.pending.length === 0) {
    console.log("✓ ไม่มีอะไรต้องรัน (ฐานข้อมูลตรงกับไฟล์ทั้งหมด)");
    return;
  }

  for (const item of plan.pending) {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      await client.query(item.sql);
      await client.query("insert into schema_migration (id, name, checksum) values ($1, $2, $3)", [
        item.id,
        item.name,
        checksumOf(item.sql),
      ]);
      await client.query("commit");
      console.log(`  ✓ รัน ${item.id}-${item.name} แล้ว`);
    } catch (error) {
      await client.query("rollback");
      console.error(`✗ ${item.id}-${item.name} ล้มเหลว — ย้อนธุรกรรมแล้ว`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }
  }

  console.log("✓ migration ครบแล้ว");
}

try {
  await main();
} finally {
  await closePool();
}
