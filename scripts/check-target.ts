import { getPool, closePool } from "@/db/pool";
import { describePlan, planMigrations, type MigrationState } from "@/lib/db/migrations";
import { FORM_ROLE, PUBLIC_FORM_TABLES, PUBLIC_READ_TABLES, READ_ROLE } from "./db-roles.ts";
import { loadMigrationFiles } from "./migration-files.ts";
import { probeFormRole, probeReadRole, type RoleProbeOutcome } from "./role-probe.ts";
import { selectTargetUrl, targetBanner } from "./target-env.ts";

/**
 * `npm run check:target` (รอบที่ 283 · ปิดหนี้ D-282-2 · ขยายรอบที่ 286)
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
 * 3. **role อ่าน/ฟอร์มอ่านได้จริงไหม** (รอบที่ 286 · ปิดหนี้ D-283-2 — เก็บแค่ "มี role" ไม่พอ)
 *    ต้องมี **URL ของ role** ให้ด่านนี้ด้วย (คนละใบกับ URL เจ้าของตาราง):
 *    · `TARGET_PUBLIC_DATABASE_URL` / `TARGET_FORM_DATABASE_URL` (หรือ `--read-url=` / `--form-url=`)
 *    · วิธีได้มา: `npm run db:roles -- --target --reveal` → เก็บค่าที่พิมพ์ลง `.env.local` (ห้าม commit)
 *    · ไม่มี URL = **ข้ามอย่างเปิดเผย** (พิมพ์ว่า "ข้าม: …") ไม่ใช่ผ่านเงียบ ๆ
 * 4. **ข้อมูลสรุป**: โฮสต์ปลายทาง · จำนวนตารางใน schema public (ไว้เทียบกับในเครื่อง)
 *
 * ⚠️ **ต้องตั้ง `TARGET_DATABASE_URL`** (ปลายทาง) — ตัวเลือก `--url=` สำหรับตรวจเว็บที่ deploy อยู่ที่ `check:deploy`
 * ⚠️ ตัวเลือก: `--json` (ผลเป็น JSON) · `--strict` (role ขาด/ข้ามการพิสูจน์ role = ตก)
 * ⚠️ ไฟล์นี้ต้องไม่มีคำสั่งเขียน SQL เลย (มีเทสต์สแกนบังคับ 8 รูปแบบ) — ตัวพิสูจน์สิทธิ์อยู่ใน `role-probe.ts`
 *    ซึ่งใช้ `has_table_privilege` (catalog) ไม่ใช่การลองเขียนจริง
 */

type Options = {
  readonly json: boolean;
  readonly strict: boolean;
  /** URL ของ role อ่านบนปลายทาง (ถ้าไม่ส่ง = ข้ามการพิสูจน์) */
  readonly readUrl: string;
  readonly formUrl: string;
};

function parseArgs(argv: readonly string[]): Options {
  let json = false;
  let strict = false;
  let readUrl = process.env["TARGET_PUBLIC_DATABASE_URL"]?.trim() ?? "";
  let formUrl = process.env["TARGET_FORM_DATABASE_URL"]?.trim() ?? "";
  for (const arg of argv) {
    if (arg === "--json") json = true;
    /* `check:target` ยิงปลายทางเสมอ ⇒ รับ `--target` ไว้ได้ (กันผู้ใช้พิมพ์ตามคำสั่งอื่นแล้ว 500) */
    else if (arg === "--target") continue;
    else if (arg === "--strict") strict = true;
    else if (arg.startsWith("--read-url=")) readUrl = arg.slice("--read-url=".length).trim();
    else if (arg.startsWith("--form-url=")) formUrl = arg.slice("--form-url=".length).trim();
    else if (arg.trim() !== "") throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
  }
  return { json, strict, readUrl, formUrl };
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

  /*
    ── ③ พิสูจน์ว่าอ่านได้จริง (รอบที่ 286 · ปิดหนี้ D-283-2) ─────────────────────────
    "มี role" ≠ "role อ่านได้" ⇒ ต้องลองต่อด้วย role นั้นจริง (URL มาจาก env/flag · ห้ามเดา)
    ไม่มี URL = **ข้ามอย่างเปิดเผย** (ไม่ใช่ผ่านเงียบ ๆ) — และ `--strict` ถือว่าการข้าม = ตก
  */
  const readProbe = options.readUrl === "" ? null : await probeReadRole(options.readUrl, PUBLIC_READ_TABLES);
  const formProbe = options.formUrl === "" ? null : await probeFormRole(options.formUrl, PUBLIC_FORM_TABLES);
  const skippedProbes: string[] = [];
  if (readProbe === null) skippedProbes.push("role อ่าน (TARGET_PUBLIC_DATABASE_URL)");
  if (formProbe === null) skippedProbes.push("role ฟอร์ม (TARGET_FORM_DATABASE_URL)");
  if (skippedProbes.length > 0) {
    warnings.push(
      `ข้ามการพิสูจน์สิทธิ์: ${skippedProbes.join(" · ")} ⇒ เอามาจาก \`npm run db:roles -- --target --reveal\` แล้วเก็บใน .env.local (ห้าม commit)`,
    );
  }
  for (const [label, outcome] of [
    ["role อ่าน", readProbe],
    ["role ฟอร์ม", formProbe],
  ] as const) {
    if (outcome === null) continue;
    if (outcome.ok) continue;
    for (const line of outcome.failures) failures.push(`${label}: ${line}`);
  }

  if (options.strict && warnings.length > 0) {
    failures.push(...warnings);
    warnings.length = 0;
  }

  const appliedCount = state.appliedIds.length;

  const probeJson = (outcome: RoleProbeOutcome | null): unknown =>
    outcome === null ? null : { ok: outcome.ok, role: outcome.role, readable: outcome.readable, failures: outcome.failures };

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
          probes: { read: probeJson(readProbe), form: probeJson(formProbe) },
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
    /* ผลการพิสูจน์สิทธิ์จริง (ต่อด้วย role นั้น) — ข้ามจะบอกตรง ๆ ว่าไม่ได้พิสูจน์ */
    if (readProbe !== null) {
      process.stdout.write(
        `  · role อ่าน: ${readProbe.ok ? "✓" : "✗"} ต่อด้วย ${readProbe.role} · อ่านได้ ${String(readProbe.readable)}/${String(PUBLIC_READ_TABLES.length)} ตาราง\n`,
      );
    }
    if (formProbe !== null) {
      process.stdout.write(
        `  · role ฟอร์ม: ${formProbe.ok ? "✓" : "✗"} ต่อด้วย ${formProbe.role} · อ่านได้ ${String(formProbe.readable)}/${String(PUBLIC_FORM_TABLES.length)} ตาราง\n`,
      );
    }

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
