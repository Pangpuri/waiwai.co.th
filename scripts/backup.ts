/**
 * `npm run db:backup` — สำรองฐานข้อมูลทั้งก้อน (X2.3)
 *
 * วิธีใช้
 *   npm run db:backup                    สำรองไปที่ backups/<ชื่อ-db>-YYYYMMDD-HHMMSS.dump
 *   npm run db:backup -- --out=path.dump สำรองไปที่พาธที่กำหนด
 *   npm run db:backup -- --force         ยอมเขียนทับไฟล์ที่มีอยู่
 *   npm run db:backup -- --json          พ่นผลเป็น JSON
 *
 * ทำไมต้องมี
 * - **มติ D11:** ภาพและเรซูเม่เก็บเป็น `bytea` ในฐานข้อมูล ⇒ ไฟล์สำรองก้อนเดียวพาทุกอย่างไป
 *   (ย้ายเซิร์ฟเวอร์ = กู้คืนก้อนเดียว ไม่ต้องตามเก็บโฟลเดอร์อัปโหลด)
 * - **มติ D5/Q21:** แผนของเจ้าของคือ backup → Docker → ย้ายไปเซิร์ฟเวอร์ที่เช่าเอง
 * - ⚠️ **"แบ็กอัปที่ไม่เคยทดสอบ = ไม่มีแบ็กอัป"** ⇒ หลังสำรองต้องรัน `npm run check:restore` ด้วยเสมอ
 *
 * ⚠️ ไฟล์สำรอง **มีข้อมูลส่วนบุคคล** (ผู้ติดต่อ/ผู้สมัครงาน + เรซูเม่) ⇒
 *    1. `backups/` ถูก gitignore ไว้ — **ห้าม commit**
 *    2. เก็บตามระยะเวลาที่สมเหตุสมผล และลบเมื่อไม่ใช้ (นโยบายเดียวกับ lib/retention/plan.ts)
 *    3. เครื่องที่เก็บไฟล์ควรเป็นเครื่องที่ควบคุมได้ (ไม่ใช่พื้นที่แชร์สาธารณะ)
 *
 * ⚠️ ต้องมีเครื่องมือ `pg_dump` — เครื่อง dev ไม่มี ⇒ ตั้ง `DB_TOOLS_PREFIX=docker exec -i waiwai-pg` ใน `.env.local`
 */
import { writeFile } from "node:fs/promises";
import { join, isAbsolute, resolve } from "node:path";

import { isDatabaseConfigured } from "@/db/pool";
import { readTableStats } from "@/lib/backup/compare";
import {
  BACKUP_DIR,
  MANIFEST_VERSION,
  backupFileName,
  backupRetentionNote,
  databaseNameOf,
  manifestPathFor,
  sanitizeForLog,
  type BackupManifest,
} from "@/lib/backup/plan";
import { dumpToFile, ensureBackupDir, fileExists } from "@/lib/backup/tools";
import { formatBytes } from "@/lib/format/bytes";

type Options = {
  readonly out: string | null;
  readonly force: boolean;
  readonly json: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let out: string | null = null;
  let force = false;
  let json = false;

  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--force") force = true;
    else if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length).trim();
      out = value === "" ? null : value;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "npm run db:backup -- [--out=path.dump] [--force] [--json]\n" +
          "  --out     เก็บไปที่พาธที่กำหนด (ค่าเริ่มต้น: backups/<ชื่อ-db>-<เวลา>.dump)\n" +
          "  --force   ยอมเขียนทับไฟล์เดิม\n" +
          "  --json    พ่นผลเป็น JSON\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`✗ ไม่รู้จักอาร์กิวเมนต์: ${arg}\n`);
      process.exit(1);
    }
  }

  return { out, force, json };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ดู AGENTS.md § ตั้งค่า env)\n");
    process.exit(1);
  }

  const databaseUrl = process.env["DATABASE_URL"] ?? "";
  const databaseName = databaseNameOf(databaseUrl);
  if (databaseName === null) {
    process.stderr.write("✗ อ่านชื่อฐานข้อมูลจาก DATABASE_URL ไม่ได้ — ตรวจรูปแบบ connection string\n");
    process.exit(1);
  }

  const dir = await ensureBackupDir();
  const target =
    options.out === null
      ? join(dir, backupFileName(new Date(), databaseName))
      : isAbsolute(options.out)
        ? options.out
        : resolve(process.cwd(), options.out);

  const alreadyExists = await fileExists(target);
  if (alreadyExists && !options.force) {
    process.stderr.write(`✗ ไฟล์นี้มีอยู่แล้ว: ${target}\n  ใช้ --force ถ้าตั้งใจเขียนทับ\n`);
    process.exit(1);
  }

  if (!options.json) {
    process.stdout.write(`\nกำลังสำรองฐานข้อมูล "${databaseName}" … (${sanitizeForLog(databaseUrl)})\n`);
  }

  let result;
  try {
    result = await dumpToFile(databaseUrl, target);
  } catch (error) {
    process.stderr.write(`✗ สำรองไม่สำเร็จ\n${String(error instanceof Error ? error.message : error)}\n`);
    process.exit(1);
  }

  /*
    ลายนิ้วมือ ณ เวลาที่สำรอง — จำเป็นสำหรับการตรวจกู้คืนที่เชื่อถือได้
    (ถ้าต้นทางถูกแก้ทีหลัง การเทียบกับต้นทางปัจจุบันจะ "ไม่ผ่าน" ทั้งที่ไฟล์ดี — เคสจริง 2026-10-03)
  */
  const manifest: BackupManifest = {
    version: MANIFEST_VERSION,
    database: databaseName,
    takenAt: new Date().toISOString(),
    dumpBytes: result.bytes,
    dumpSha256: result.sha256,
    tables: await readTableStats(databaseUrl),
  };
  const manifestPath = manifestPathFor(result.filePath);

  try {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  } catch (error) {
    process.stderr.write(
      `✗ เขียนไฟล์ลายนิ้วมือไม่สำเร็จ — ไฟล์ .dump ยังอยู่แต่จะตรวจกู้คืนไม่ได้\n` +
        `  ${manifestPath}\n  ${String(error instanceof Error ? error.message : error)}\n`,
    );
    process.exit(1);
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          file: result.filePath,
          manifest: manifestPath,
          bytes: result.bytes,
          sha256: result.sha256,
          tables: manifest.tables.length,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`✓ สำรองแล้ว: ${result.filePath}\n`);
    process.stdout.write(`    ขนาด ${formatBytes(result.bytes)} · sha256 ${result.sha256}\n`);
    process.stdout.write(`    ลายนิ้วมือ ${manifest.tables.length} ตาราง → ${manifestPath}\n`);
    process.stdout.write(`    ${backupRetentionNote()}\n`);
    process.stdout.write(
      `\n⚠️ โฟลเดอร์ ${BACKUP_DIR}/ มีข้อมูลส่วนบุคคล — ห้าม commit · เก็บให้ปลอดภัย · และ **ต้องรัน\n` +
        "   npm run check:restore   เพื่อพิสูจน์ว่าไฟล์นี้กู้คืนได้จริง** (สำรองที่ไม่เคยทดสอบ = ไม่มีสำรอง)\n\n",
    );
  }
}

await main();
