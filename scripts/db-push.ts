import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";

import { readTableStats } from "@/lib/backup/compare";
import { TOOLS_URL_VAR, diffTables, manifestPathFor, parseManifest, type BackupManifest } from "@/lib/backup/plan";
import { listBackupFiles, restoreFromFile } from "@/lib/backup/tools";
import { directEndpointOf, hostOf, redactUrl, validateRemoteTarget } from "@/lib/db/target";
import { formatBytes } from "@/lib/format/bytes";

/**
 * `npm run db:push` (รอบที่ 114) — **ดันข้อมูลจริงขึ้นฐานข้อมูลปลายทาง** (คลาวด์/เซิร์ฟเวอร์)
 *
 * ใช้ทำอะไร: ให้การตลาดดูตัวอย่างหน้าเว็บที่มีข้อมูลจริง (สินค้า 54 · เมนู 18 · ข่าว 151 · ภาพ 843)
 * โดยไม่ต้องพึ่งฐานข้อมูลในเครื่องของนักพัฒนา
 *
 * ลำดับงาน (ตามกติกาโปรเจกต์)
 *   1. `npm run db:backup`        — สำรองข้อมูลในเครื่อง (ได้ไฟล์ .dump + .manifest.json)
 *   2. `npm run check:restore`    — **ต้องผ่านก่อน** (สำรองที่ไม่เคยทดสอบ = ไม่มีสำรอง)
 *   3. ใส่ `TARGET_DATABASE_URL` ใน `.env.local` (ห้าม commit)
 *   4. `npm run db:push`          — สคริปต์นี้: ดันข้อมูลขึ้น + ตรวจว่าได้ครบจริง
 *
 * ⚠️ การ์ดกันพลาด (ดู `lib/db/target.ts` — มีเทสต์)
 * - ปลายทางห้ามซ้ำกับ `DATABASE_URL` (ฐานข้อมูลพัฒนา) และห้ามเป็น localhost/เครือข่ายภายใน
 * - ปลายทางต้อง **ว่าง** (ยังไม่มีตาราง) ยกเว้นสั่ง `--allow-existing` — กันเขียนทับของเดิม
 * - ห้ามพิมพ์รหัสผ่าน: ทุกข้อความใช้ `redactUrl()` เท่านั้น
 * - **ไม่แตะฐานข้อมูลต้นทางเลย** (อ่านอย่างเดียว) — ต้นทางมาจากไฟล์สำรอง
 *
 * ตัวเลือก: `--file=<path>` เลือกไฟล์สำรองเอง · `--allow-existing` ยอมให้ปลายทางมีตารางอยู่แล้ว
 *          `--dry-run` ตรวจทุกอย่างแล้วหยุด (ไม่เขียนอะไร) · `--json` พิมพ์ผลแบบเครื่องอ่าน
 *          `--allow-local` ⚠️ ทดสอบบนเครื่องเท่านั้น (ยอมให้ปลายทางเป็น localhost) — ยังห้ามซ้ำกับ DATABASE_URL
 *          `--verify-only` ตรวจว่าปลายทางมีข้อมูลครบ (ไม่เขียนทับ) — ใช้ตรวจซ้ำหลังอัปโหลดไปแล้ว
 */

const TARGET_VAR = "TARGET_DATABASE_URL";
const DEV_VAR = "DATABASE_URL";

type Options = {
  readonly file: string | null;
  readonly allowExisting: boolean;
  readonly dryRun: boolean;
  readonly json: boolean;
  /** ⚠️ สำหรับ "ทดสอบบนเครื่อง" เท่านั้น — ยอมให้ปลายทางเป็น localhost (ยังห้ามซ้ำกับ DATABASE_URL) */
  readonly allowLocal: boolean;
  /** true = ไม่เขียนอะไรลงปลายทาง แค่ตรวจว่าข้อมูลครบ (ใช้ตรวจซ้ำหลังอัปโหลดไปแล้ว) */
  readonly verifyOnly: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let file: string | null = null;
  let allowExisting = false;
  let dryRun = false;
  let json = false;
  let allowLocal = false;
  let verifyOnly = false;

  for (const arg of argv) {
    if (arg.startsWith("--file=")) file = arg.slice("--file=".length).trim();
    else if (arg === "--allow-existing") allowExisting = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--allow-local") allowLocal = true;
    else if (arg === "--verify-only") verifyOnly = true;
    else if (arg === "--json") json = true;
    else if (arg.trim() !== "") throw new Error(`ไม่รู้จักตัวเลือก: ${arg}`);
  }

  return { file, allowExisting, dryRun, json, allowLocal, verifyOnly };
}

/** ไฟล์สำรองล่าสุดใน `backups/` (ตามชื่อไฟล์ที่มีเวลา) */
async function newestDump(): Promise<string | null> {
  const files = await listBackupFiles(process.cwd());
  const dumps = files.filter((name) => name.endsWith(".dump")).sort();
  const last = dumps[dumps.length - 1];
  return last === undefined ? null : path.join(process.cwd(), "backups", last);
}

function countPublicTables(url: string): Promise<number> {
  const client = new pg.Client({ connectionString: url });
  return client
    .connect()
    .then(() =>
      client.query<{ count: string }>(
        "select count(*)::text as count from information_schema.tables where table_schema = 'public'",
      ),
    )
    .then((result) => Number(result.rows[0]?.count ?? "0"))
    .finally(() => client.end());
}

function countRows(url: string, table: string): Promise<number> {
  const client = new pg.Client({ connectionString: url });
  return client
    .connect()
    .then(() => client.query<{ count: string }>(`select count(*)::text as count from "${table}"`))
    .then((result) => Number(result.rows[0]?.count ?? "0"))
    .finally(() => client.end());
}

/** นับเฉพาะแถว (fallback เมื่อเทียบลายนิ้วมือไม่ได้) */
async function countAllRows(url: string, tables: readonly string[]): Promise<readonly number[]> {
  const counts: number[] = [];
  for (const table of tables) counts.push(await countRows(url, table));
  return counts;
}

/** รันคำสั่ง migration เดิม (เส้นทางที่ทดสอบแล้ว) โดยชี้ไปปลายทาง — ไม่เขียนตรรกะซ้ำ */
function runMigrationsAgainst(targetUrl: string): void {
  const result = spawnSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, [DEV_VAR]: targetUrl },
  });

  if (result.status !== 0) {
    throw new Error(`db:migrate บนปลายทางล้มเหลว (exit ${String(result.status)})`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const target = process.env[TARGET_VAR];
  const issues = validateRemoteTarget(target, process.env[DEV_VAR]).filter(
    /* --allow-local: ใช้เฉพาะตอนทดสอบคำสั่งบนเครื่อง (ต้องสั่งเองทุกครั้ง) */
    (issue) => !(options.allowLocal && issue.code === "local-host"),
  );

  if (issues.length > 0) {
    process.stderr.write("✗ ปลายทางยังใช้ไม่ได้ — ตรวจแล้วพบปัญหา\n");
    for (const issue of issues) process.stderr.write(`    [${issue.code}] ${issue.message}\n`);
    process.stderr.write(`\n  ตัวอย่างค่าใน .env.local (ห้าม commit):\n    ${TARGET_VAR}=postgresql://user:รหัส@host/db?sslmode=require\n`);
    process.exit(1);
  }

  const targetUrl = (target ?? "").trim();
  /* งานที่รัน SQL ไม่ระบุ schema (migration/นับแถว/ลายนิ้วมือ) ต้องใช้ endpoint ตรง — ดู directEndpointOf() */
  const sqlUrl = directEndpointOf(targetUrl);
  const host = hostOf(targetUrl) ?? "?";
  const out = (line: string): void => {
    if (!options.json) process.stdout.write(line);
  };

  const dumpPath = options.file === null ? await newestDump() : options.file;

  if (dumpPath === null || !existsSync(dumpPath)) {
    process.stderr.write(
      "✗ ไม่พบไฟล์สำรอง — รัน `npm run db:backup` ก่อน (แล้ว `npm run check:restore` ให้ผ่าน)\n",
    );
    process.exit(1);
  }

  const manifestRaw: unknown = existsSync(manifestPathFor(dumpPath))
    ? (JSON.parse(readFileSync(manifestPathFor(dumpPath), "utf8")) as unknown)
    : null;
  const manifest: BackupManifest | null = manifestRaw === null ? null : parseManifest(manifestRaw);

  if (manifest === null) {
    process.stderr.write(
      `✗ ไม่พบ/อ่าน manifest ของไฟล์สำรองไม่ได้ (${path.basename(manifestPathFor(dumpPath))})\n` +
        "   ไฟล์นี้คือหลักฐานว่าปลายทางได้ข้อมูลครบ — สำรองใหม่ด้วย `npm run db:backup`\n",
    );
    process.exit(1);
  }

  out(`ปลายทาง : ${redactUrl(targetUrl)}\n`);
  out(`ไฟล์สำรอง: ${path.basename(dumpPath)} (${formatBytes(manifest.dumpBytes)} · ${manifest.tables.length} ตาราง · สำรองเมื่อ ${manifest.takenAt})\n`);

  const existingTables = await countPublicTables(sqlUrl);
  out(`ตารางที่มีอยู่แล้วบนปลายทาง: ${existingTables}\n`);

  /* --verify-only: ปลายทางมีข้อมูลอยู่แล้วได้ เพราะโหมดนี้ไม่เขียนทับ */
  if (existingTables > 0 && !options.allowExisting && !options.verifyOnly) {
    process.stderr.write(
      "✗ ปลายทางมีตารางอยู่แล้ว — ปฏิเสธเพื่อกันเขียนทับข้อมูลเดิม\n" +
        "   ถ้าตั้งใจจะเขียนทับจริง ๆ ให้สั่ง `-- --allow-existing` (ตรวจให้แน่ใจก่อน)\n",
    );
    process.exit(1);
  }

  if (options.dryRun && !options.verifyOnly) {
    out("✓ ตรวจทุกอย่างผ่านแล้ว (dry-run) — ยังไม่ได้เขียนอะไรลงปลายทาง\n");
    return;
  }

  out("\n1) กู้คืนข้อมูลขึ้นปลายทาง (pg_restore --no-owner --no-privileges)…\n");
  /*
    ⚠️ รอบที่ 114 — บั๊กจริงที่การซ้อมจับได้
    `toolConnectionArgs()` (ใช้ร่วมกับ db:backup/check:restore) มี 2 โหมด
      1. ตั้ง `DB_TOOLS_URL` → ส่ง `--dbname=<URL เต็ม>` (ใช้เมื่อปลายทางอยู่นอกกล่องเครื่องมือ)
      2. มีแต่ `DB_TOOLS_PREFIX` (รันในกล่อง Docker) → ส่งแค่ `--username` + `--dbname` **ไม่มี host/รหัสผ่าน**
         เพราะโหมดนั้นออกแบบให้ต่อฐานข้อมูล *ในกล่องเอง* ผ่าน socket
    ⇒ งาน "ดันขึ้นคลาวด์" ต้องบังคับโหมดที่ 1 ไม่งั้น pg_restore จะพยายามต่อฐานข้อมูลในกล่องด้วยชื่อผู้ใช้ของคลาวด์
      แล้วตายทันที (เดิมผู้ใช้เห็นแค่ `write EPIPE` — แก้การรายงาน error ที่ lib/backup/tools.ts แล้ว)
  */
  process.env[TOOLS_URL_VAR] = sqlUrl;
  if (options.verifyOnly) {
    out("\n(โหมดตรวจซ้ำ: ข้ามการกู้คืนข้อมูล — ตรวจอย่างเดียวว่าได้ครบจริง)\n");
  } else {
    await restoreFromFile(dumpPath, targetUrl);

    out("2) ตรวจว่า schema ตรงกับโค้ด (migration ไม่ค้าง)…\n");
    runMigrationsAgainst(sqlUrl);
  }

  /*
    ตรวจว่า "ได้ข้อมูลครบจริง" — ใช้ตัวเทียบกลางของโปรเจกต์ (`readTableStats` + `diffTables`)
    เทียบกับ **manifest ของไฟล์สำรอง** (ไม่ใช่ต้นทางปัจจุบัน ซึ่งอาจถูกแก้หลังเวลาสำรอง)
    ⇒ ตรวจทั้งจำนวนแถว **และลายนิ้วมือเนื้อหา** (md5 ของ to_jsonb) ต่อตาราง
  */
  out("3) เทียบข้อมูลกับไฟล์สำรอง (จำนวนแถว + ลายนิ้วมือเนื้อหา)…\n");
  const targetStats = await readTableStats(sqlUrl);
  const diffs = diffTables(manifest.tables, targetStats);

  if (diffs.length > 0) {
    process.stderr.write(`✗ ข้อมูลบนปลายทางไม่ตรงกับไฟล์สำรอง (${diffs.length} ความต่าง)\n`);
    for (const diff of diffs) {
      process.stderr.write(`    [${diff.kind}] ${diff.table} — สำรองไว้ ${diff.source} · ปลายทาง ${diff.target}\n`);
    }
    process.exit(1);
  }

  /* ตรวจซ้ำอีกชั้นด้วยการนับแถวตรง ๆ (อ่านง่าย + กันกรณี digest ถูกข้ามเพราะตารางใหญ่) */
  const counts = await countAllRows(
    sqlUrl,
    manifest.tables.map((table) => table.table),
  );
  const rowMismatch = manifest.tables.findIndex((table, index) => table.rows !== counts[index]);
  if (rowMismatch >= 0) {
    const table = manifest.tables[rowMismatch];
    process.stderr.write(
      `✗ จำนวนแถวไม่ตรง: ${table?.table ?? "?"} สำรองไว้ ${String(table?.rows ?? -1)} · ปลายทาง ${String(counts[rowMismatch] ?? -1)}\n`,
    );
    process.exit(1);
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, host, tables: manifest.tables.length, dumpBytes: manifest.dumpBytes })}\n`,
    );
    return;
  }

  out(
    `\n✓ ดันข้อมูลขึ้นปลายทางสำเร็จ — ${manifest.tables.length} ตารางตรงกับไฟล์สำรองทั้งหมด\n` +
      `   โฮสต์: ${host}\n` +
      `   ขั้นต่อไป: ตั้ง ${DEV_VAR} เดียวกันนี้ใน env ของโฮสต์ที่รันเว็บ (เช่น Vercel) แล้วเปิดหน้าเว็บตรวจ\n`,
  );
}

await main();
