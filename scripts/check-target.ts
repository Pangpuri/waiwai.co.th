import { getPool, closePool } from "@/db/pool";
import { describePlan, planMigrations, type MigrationState } from "@/lib/db/migrations";
import { FORM_ROLE, READ_ROLE } from "./db-roles.ts";
import { loadMigrationFiles } from "./migration-files.ts";
import { selectTargetUrl, targetBanner } from "./target-env.ts";

/**
 * `npm run check:target` (รอบที่ 283 · ปิดหนี้ D-282-2)
 *
 * ## ปัญหาที่ปิด
 * ก่อนรอบนี้ **ไม่มีด่านไหนรู้ว่าฐานข้อมูลปลายทาง (Neon) ล้าหลัง migration** — ต้องมีคนนึกได้แล้วรัน
 * `db:status --target` เอง ⇒ 2026-10-14 ตรวจพบว่าคลาวด์รันแล้ว **38/43** (ขาด 0039–0043)
 * อาการที่จะเกิดบนเดโมถ้าไม่รู้: คำสั่งอ่านล้มด้วย "column/table does not exist" แล้ว **ถูกกลืนเป็นว่าง**
 * ⇒ หน้าเว็บ 200 แต่ไม่มีข้อมูล (กับดักเดียวกับรอบ 121/137 — ตรวจไม่เจอด้วยตา)
 *
 * ## ตรวจอะไร (อ่านเท่านั้น — ห้ามเขียนทุกกรณี)
 * 1. **migration ครบไหม** — เทียบ `schema_migration` บนปลายทางกับไฟล์ใน `db/migrations/`
 *    · ขาด = **ตก** (ต้องรัน `npm run db:migrate --target`)
 *    · ไฟล์ที่รันแล้วถูกแก้ทีหลัง (checksum ไม่ตรง) = **ตก** (อันตรายกว่า: DB กับไฟล์ไม่ตรงกันแล้ว)
 *    · ยังไม่มีตาราง `schema_migration` เลย = **ตก** (ปลายทางว่าง/ยังไม่เคย migrate)
 * 2. **role แบบ least privilege มีจริงไหม** (`waiwai_public_ro` · `waiwai_public_form`)
 *    · ขาด = **เตือน**โดยค่าเริ่มต้น (เว็บยังทำงานได้แต่ไม่มีการแยกสิทธิ์ — มติ D23)
 *    · ใส่ `--strict` = ถือเป็น **ตก** (ใช้ก่อนเปิดใช้จริง/ใน CI ที่มี credential)
 * 3. **ข้อมูลสรุป**: โฮสต์ปลายทาง · จำนวนตารางใน schema public (ไว้เทียบกับในเครื่อง)
 *
 * ⚠️ **ต้องตั้ง `TARGET_DATABASE_URL`** (ปลายทาง) — ตัวเลือก `--url=` สำหรับตรวจเว็บที่ deploy อยู่ที่ `check:deploy`
 * ⚠️ ตัวเลือก: `--json` (ผลเป็น JSON) · `--strict` (role ขาด = ตก)
 */

type Options = {
  readonly json: boolean;
  readonly strict: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let json = false;
  let strict = false;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--strict") strict = true;
    else if (arg.trim() !== "") throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
  }
  return { json, strict };
}

/** สถานะ migration ของปลายทาง — `hasTable = false` = ยังไม่เคยรันด้วยระบบนี้ */
type TargetState = MigrationState & { readonly hasTable: boolean };

async function readTargetState(): Promise<TargetState> {
  /*
    ⚠️ อ่านอย่างเดียว: ตรวจก่อนว่ามีตารางไหม (ฐานข้อมูลปลายทางที่ยังไม่เคย migrate จะไม่มี)
    — **ห้ามเรียก `ensureTable()`** แบบ `db:migrate` เพราะนั่นเขียนตารางลงปลายทาง
  */
  const table = await getPool().query<{ hasTable: boolean }>(
    `select to_regclass('public.schema_migration') is not null as "hasTable"`,
  );
  if (table.rows[0]?.hasTable !== true) {
    return { hasTable: false, appliedIds: [], appliedChecksums: {} };
  }

  const { rows } = await getPool().query<{ id: string; checksum: string }>(
    `select id, checksum from schema_migration order by id`,
  );
  const appliedChecksums: Record<string, string> = {};
  for (const row of rows) appliedChecksums[row.id] = row.checksum;
  return { hasTable: true, appliedIds: rows.map((row) => row.id), appliedChecksums };
}

async function readPublicTableCount(): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
  );
  return rows[0]?.n ?? 0;
}

async function readMissingRoles(): Promise<readonly string[]> {
  const wanted = [READ_ROLE, FORM_ROLE];
  const { rows } = await getPool().query<{ rolname: string }>(
    `select rolname from pg_roles where rolname = any($1::text[])`,
    [wanted],
  );
  const found = new Set(rows.map((row) => row.rolname));
  return wanted.filter((role) => !found.has(role));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const selection = selectTargetUrl(process.env);
  if (!selection.ok) {
    process.stderr.write(`✗ ${selection.message}\n`);
    process.exitCode = 1;
    return;
  }
  process.env["DATABASE_URL"] = selection.url;
  if (!options.json) process.stdout.write(`${targetBanner(selection)}\n`);

  const files = loadMigrationFiles();
  const state = await readTargetState();
  const plan = state.hasTable ? planMigrations(files, state) : null;
  const tableCount = await readPublicTableCount();
  const missingRoles = await readMissingRoles();

  const failures: string[] = [];
  if (plan === null) {
    failures.push(
      `ปลายทางยังไม่มีตาราง schema_migration — ยังไม่เคยรัน migration ด้วยระบบนี้ ⇒ รัน \`npm run db:migrate --target\``,
    );
  } else {
    if (plan.pending.length > 0) {
      const ids = plan.pending.map((item) => item.id).join(" · ");
      failures.push(`ปลายทางล้าหลัง ${String(plan.pending.length)} migration: ${ids} ⇒ รัน \`npm run db:migrate --target\``);
    }
    if (plan.modified.length > 0) {
      const ids = plan.modified.map((item) => item.id).join(" · ");
      failures.push(`ไฟล์ที่รันแล้วถูกแก้ทีหลัง: ${ids} ⇒ ฐานข้อมูลจริงกับไฟล์ไม่ตรงกันแล้ว (ห้ามแก้ไฟล์ที่รันไปแล้ว)`);
    }
  }

  const warnings: string[] = [];
  if (missingRoles.length > 0) {
    warnings.push(
      `ยังไม่มี role: ${missingRoles.join(" · ")} ⇒ รัน \`npm run db:roles --target --reveal\` แล้วตั้ง PUBLIC_DATABASE_URL/FORM_DATABASE_URL บนโฮสต์ (มติ D23)`,
    );
  }
  if (options.strict && warnings.length > 0) {
    failures.push(...warnings);
    warnings.length = 0;
  }

  const appliedCount = state.appliedIds.length;

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: failures.length === 0,
          host: selection.host,
          convertedFromPooler: selection.convertedFromPooler,
          files: files.length,
          applied: appliedCount,
          pending: plan?.pending.map((item) => item.id) ?? [],
          modified: plan?.modified.map((item) => item.id) ?? [],
          publicTables: tableCount,
          missingRoles,
          failures,
          warnings,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`ไฟล์ migration ${String(files.length)} ไฟล์\n`);
    if (plan !== null) {
      for (const line of describePlan(plan)) process.stdout.write(`  ${line}\n`);
    } else {
      process.stdout.write("  (ยังไม่มีตาราง schema_migration — ยังไม่เคยรันด้วยระบบนี้)\n");
    }
    process.stdout.write(`ตารางใน schema public: ${String(tableCount)}\n`);
    process.stdout.write(
      missingRoles.length === 0
        ? "role least privilege: ครบ (waiwai_public_ro · waiwai_public_form)\n"
        : `role least privilege: ขาด ${missingRoles.join(" · ")}\n`,
    );

    for (const line of warnings) process.stdout.write(`\n⚠️ ${line}\n`);
    if (failures.length > 0) {
      process.stdout.write(`\n✗ ปลายทางยังไม่พร้อม ${String(failures.length)} ข้อ:\n`);
      for (const line of failures) process.stdout.write(`    ${line}\n`);
    } else {
      process.stdout.write("\n✓ ปลายทางพร้อม — migration ตรงกับไฟล์ทั้งหมด\n");
    }
    process.stdout.write("\nℹ️ ตรวจหน้าเว็บที่ deploy อยู่ต่อด้วย: npm run check:deploy -- --url=<โดเมน>\n");
  }

  if (failures.length > 0) process.exitCode = 1;
}

try {
  await main();
} finally {
  await closePool();
}
