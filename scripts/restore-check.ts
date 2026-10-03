/**
 * `npm run check:restore` — พิสูจน์ว่า "ไฟล์สำรองกู้คืนได้จริง" (X2.3)
 *
 * วิธีใช้
 *   npm run check:restore                   ใช้ไฟล์สำรองล่าสุดใน backups/
 *   npm run check:restore -- --file=x.dump  ใช้ไฟล์ที่กำหนด
 *   npm run check:restore -- --keep         ไม่ลบฐานข้อมูลชั่วคราว (ไว้ตรวจต่อด้วยมือ)
 *
 * ขั้นตอน (**ไม่แตะฐานข้อมูลจริงเลย** — ทุกอย่างเกิดบนฐานข้อมูลชั่วคราว)
 *   1. อ่าน "ลายนิ้วมือตอนสำรอง" (`<ไฟล์>.manifest.json`) — บังคับว่าต้องมี
 *   2. สร้างฐานข้อมูลชั่วคราว 3 ตัวจากชื่อฐานข้อมูลจริง:
 *      `<db>_restore_check` (ปลายทางกู้คืน) · `<db>_restore_empty` (ฐานเปล่า) · `<db>_restore_binary` (ชุดทดสอบไบนารี)
 *   3. `pg_restore` ไฟล์สำรองเข้า `_restore_check` + ยืนยันว่าไฟล์ .dump ตรงกับ `sha256` ใน manifest
 *   4. **เทียบกับลายนิ้วมือตอนสำรอง** (ไม่ใช่กับต้นทางปัจจุบัน) → ต้องตรงกันทุกตาราง (จำนวนแถว + ลายนิ้วมือเนื้อหา)
 *      ⚠️ ทำไมไม่เทียบกับต้นทางปัจจุบัน: เคสจริง 2026-10-03 — ต้นทางถูกสคริปต์อื่นเขียนหลังการสำรอง
 *         ทำให้ขึ้น "ไม่ผ่าน" ทั้งที่ไฟล์ดี (ต้นทางเปลี่ยน ≠ ไฟล์สำรองเสีย)
 *   4b. รายงานเพิ่ม (ไม่ถือว่าไม่ผ่าน) ว่าต้นทางเปลี่ยนไปหลังการสำรองหรือไม่
 *   5. **ทดสอบความไวของตัวเทียบ**: เทียบที่กู้คืน ↔ ฐานเปล่า → **ต้องเจอความต่าง**
 *      (ถ้าไม่เจอ = ตัวเทียบใช้งานไม่ได้ ⇒ ผลข้อ 4 เชื่อถือไม่ได้ — "หลักฐานที่ผ่านตลอด = ไม่ใช่หลักฐาน")
 *   6. **ทดสอบเส้นทางไฟล์ไบนารี (bytea)** — มติ D11 ฝากภาพและเรซูเม่ไว้ในฐานข้อมูล:
 *      สร้างตารางชั่วคราว + เขียนไบต์ 256KB ที่รู้ค่าใน `_restore_check` → `pg_dump` ฐานนั้น → `pg_restore` เข้า `_restore_binary`
 *      → เทียบ `md5(ไบต์)` กับค่า md5 ที่คำนวณในโปรเซสนี้
 *      ⇒ ข้อนี้จำเป็นเพราะ **วันนี้ตาราง `media`/`form_attachment` มี 0 แถว** การเทียบข้อมูลจริงจึงยังไม่พิสูจน์ bytea
 *   7. ลบฐานข้อมูลชั่วคราวทั้งหมด + ไฟล์ชั่วคราว (`--keep` = ไม่ลบฐานข้อมูล)
 *
 * ⚠️ ต้องมี `pg_restore` + `psql` (เครื่อง dev: ตั้ง `DB_TOOLS_PREFIX=docker exec -i waiwai-pg` ใน `.env.local`)
 * ⚠️ ใช้ `drop database ... with (force)` ⇒ ชื่อชั่วคราวอิงชื่อฐานข้อมูลจริง จึงไม่ชนกับโปรเจกต์อื่นบนเครื่องเดียวกัน
 */
import { createHash } from "node:crypto";
import { readFile, readdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute, resolve } from "node:path";

import { isDatabaseConfigured } from "@/db/pool";
import { compareDatabases, executeSql, queryScalar, readTableStats } from "@/lib/backup/compare";
import {
  BACKUP_DIR,
  BINARY_FIXTURE_BYTES,
  BINARY_FIXTURE_TABLE,
  databaseNameOf,
  describeDiffCount,
  diffTables,
  manifestPathFor,
  parseManifest,
  pickLatestBackup,
  scratchNamesFor,
  withDatabaseName,
  type BackupManifest,
} from "@/lib/backup/plan";
import { dumpToFile, fileExists, psqlAdmin, restoreFromFile, sha256OfFile } from "@/lib/backup/tools";
import { formatBytes } from "@/lib/format/bytes";

const CHECKS: string[] = [];

function done(label: string, detail = ""): void {
  CHECKS.push(`  ✓ ${label}${detail === "" ? "" : ` — ${detail}`}`);
}

type Options = {
  readonly file: string | null;
  readonly keep: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let file: string | null = null;
  let keep = false;

  for (const arg of argv) {
    if (arg === "--keep") keep = true;
    else if (arg.startsWith("--file=")) {
      const value = arg.slice("--file=".length).trim();
      file = value === "" ? null : value;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "npm run check:restore -- [--file=path.dump] [--keep]\n" +
          "  --file  ไฟล์สำรองที่จะทดสอบ (ค่าเริ่มต้น: ไฟล์ล่าสุดใน backups/)\n" +
          "  --keep  ไม่ลบฐานข้อมูลชั่วคราวหลังตรวจเสร็จ\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`✗ ไม่รู้จักอาร์กิวเมนต์: ${arg}\n`);
      process.exit(1);
    }
  }

  return { file, keep };
}

/**
 * สร้าง/ลบฐานข้อมูลผ่าน psql บนฐานข้อมูลผู้ดูแล (`postgres`)
 * ⚠️ ใช้ `psqlAdmin` (ไม่ใช่ `--dbname=<url>` ตรง ๆ) เพื่อให้ทำงานได้ทั้งบนเซิร์ฟเวอร์จริง
 *    และบนเครื่อง dev ที่เครื่องมืออยู่ในกล่อง Docker (ต่อผ่าน socket)
 */
async function adminSql(maintenanceUrl: string, sql: string): Promise<void> {
  await psqlAdmin(maintenanceUrl, sql);
}

/** อ่านลายนิ้วมือที่ `db:backup` เขียนไว้ข้างไฟล์ .dump (อ่านไม่ได้/เพี้ยน = null) */
async function loadManifest(dumpPath: string): Promise<BackupManifest | null> {
  try {
    const raw = await readFile(manifestPathFor(dumpPath), "utf8");
    return parseManifest(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** ไบต์สังเคราะห์ที่รู้ค่าแน่นอน (ไม่ใช้ random — เพื่อให้ผลซ้ำได้และเทียบ md5 ได้) */
function fixtureBytes(): Buffer {
  const buffer = Buffer.alloc(BINARY_FIXTURE_BYTES);
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] = (index * 31 + 7) % 256;
  }
  return buffer;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const started = Date.now();

  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ดู AGENTS.md § ตั้งค่า env)\n");
    process.exit(1);
  }

  const sourceUrl = process.env["DATABASE_URL"] ?? "";
  const databaseName = databaseNameOf(sourceUrl);
  if (databaseName === null) {
    process.stderr.write("✗ อ่านชื่อฐานข้อมูลจาก DATABASE_URL ไม่ได้\n");
    process.exit(1);
  }

  /* 1) หาไฟล์สำรอง */
  const filePath =
    options.file === null
      ? await (async (): Promise<string> => {
          const names = await readdir(join(process.cwd(), BACKUP_DIR)).catch(() => [] as string[]);
          const latest = pickLatestBackup(names);
          if (latest === null) {
            process.stderr.write(`✗ ไม่พบไฟล์สำรองใน ${BACKUP_DIR}/ — สร้างก่อนด้วย\n\n    npm run db:backup\n\n`);
            process.exit(1);
          }
          return join(process.cwd(), BACKUP_DIR, latest);
        })()
      : isAbsolute(options.file)
        ? options.file
        : resolve(process.cwd(), options.file);

  if (!(await fileExists(filePath))) {
    process.stderr.write(`✗ ไม่พบไฟล์: ${filePath}\n`);
    process.exit(1);
  }

  const scratch = scratchNamesFor(databaseName);
  const maintenanceUrl = withDatabaseName(sourceUrl, "postgres");
  const restoreUrl = withDatabaseName(sourceUrl, scratch.restore);
  const emptyUrl = withDatabaseName(sourceUrl, scratch.empty);
  const binaryUrl = withDatabaseName(sourceUrl, scratch.binary);

  const info = await stat(filePath);

  /* ไฟล์ 0 ไบต์ = เคยเกิดจริง (รอบที่ pg_dump ต่อฐานข้อมูลไม่ได้) ⇒ ปฏิเสธทันที ไม่ปล่อยให้ pg_restore งง */
  if (info.size === 0) {
    process.stderr.write(
      `✗ ไฟล์สำรองนี้มีขนาด 0 ไบต์ — ใช้ไม่ได้\n  ${filePath}\n  สร้างใหม่ด้วย  npm run db:backup\n`,
    );
    process.exit(1);
  }

  /* 1b) อ่านลายนิ้วมือที่บันทึกตอนสำรอง — **จำเป็น** เพราะการเทียบกับต้นทางปัจจุบันเชื่อถือไม่ได้ */
  const manifest = await loadManifest(filePath);
  if (manifest === null) {
    process.stderr.write(
      `✗ ไม่พบ/อ่านไฟล์ลายนิ้วมือไม่ได้: ${manifestPathFor(filePath)}\n` +
        "   ไฟล์นี้ไม่มีหลักฐานว่า \"ต้นทางมีอะไรตอนสำรอง\" ⇒ ตรวจกู้คืนอย่างมีความหมายไม่ได้\n" +
        "   สร้างไฟล์สำรองใหม่ด้วย  npm run db:backup\n",
    );
    process.exit(1);
  }
  if (manifest.database !== databaseName) {
    process.stderr.write(
      `✗ ไฟล์สำรองนี้มาจากฐานข้อมูล "${manifest.database}" แต่ต้นทางตอนนี้คือ "${databaseName}"\n` +
        "   (กู้คืนข้ามฐานข้อมูลทำได้ แต่ต้องตั้งใจ — สคริปต์นี้ไม่ทำเพื่อกันความผิดพลาด)\n",
    );
    process.exit(1);
  }

  /*
    1c) ยืนยันว่าไฟล์ .dump ยังเป็นไฟล์เดิมที่สำรองไว้ — **ตรวจก่อนกู้คืน**
    ⇒ ถ้าไฟล์ถูกแก้/สับเปลี่ยน จะได้ข้อความที่ตรงสาเหตุ ไม่ใช่ error ของ pg_restore ที่พังกลางทาง
  */
  const dumpSha256 = await sha256OfFile(filePath);
  if (dumpSha256 !== manifest.dumpSha256 || info.size !== manifest.dumpBytes) {
    process.stderr.write(
      `✗ ไฟล์ .dump ไม่ตรงกับลายนิ้วมือใน manifest (ไฟล์ถูกแก้/สับเปลี่ยนหลังการสำรอง?)\n` +
        `   manifest: ${manifest.dumpSha256.slice(0, 16)}… · ${manifest.dumpBytes} ไบต์\n` +
        `   ไฟล์จริง: ${dumpSha256.slice(0, 16)}… · ${info.size} ไบต์\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`\nตรวจการกู้คืน — ต้นทาง "${databaseName}" · ไฟล์ ${filePath}\n`);
  process.stdout.write(`  (ฐานข้อมูลชั่วคราว: ${scratch.restore} · ${scratch.empty} · ${scratch.binary})\n\n`);
  done("พบไฟล์สำรอง", `${formatBytes(info.size)} · แก้ไขล่าสุด ${info.mtime.toISOString().slice(0, 16).replace("T", " ")}`);
  done("พบลายนิ้วมือตอนสำรอง", `สำรองเมื่อ ${manifest.takenAt.slice(0, 16).replace("T", " ")} · ${manifest.tables.length} ตาราง`);

  const binaryDump = join(tmpdir(), `waiwai-binary-check-${Date.now()}.dump`);

  try {
    /* 2) เตรียมฐานข้อมูลชั่วคราว (ลบของเก่าก่อนเสมอ ⇒ รันซ้ำได้) */
    for (const name of [scratch.restore, scratch.empty, scratch.binary]) {
      await adminSql(maintenanceUrl, `drop database if exists "${name}" with (force)`);
      await adminSql(maintenanceUrl, `create database "${name}"`);
    }
    done("สร้างฐานข้อมูลชั่วคราว 3 ตัว", "ไม่แตะฐานข้อมูลจริง");

    /* 3) กู้คืนไฟล์สำรองจริง (ไฟล์ถูกยืนยัน sha256 ไปแล้วในข้อ 1c) */
    await restoreFromFile(filePath, restoreUrl);
    done("pg_restore สำเร็จ", `sha256 ${dumpSha256.slice(0, 12)} · ได้จากไฟล์ที่ยืนยันแล้ว`);

    /*
      4) เทียบกับ "ลายนิ้วมือตอนสำรอง" — ไม่ใช่กับต้นทางปัจจุบัน
      ⚠️ เคสจริง 2026-10-03: เทียบกับต้นทางปัจจุบันแล้วขึ้น "ไม่ผ่าน" ทั้งที่ไฟล์ดี
         เพราะสคริปต์อื่น (check:db) เขียนข้อมูลลงต้นทางหลังจากที่สำรองไปแล้ว
    */
    const restoredStats = await readTableStats(restoreUrl);
    const diffs = diffTables(manifest.tables, restoredStats);
    if (diffs.length > 0) {
      process.stderr.write(
        `\n✗ ข้อมูลที่กู้คืนไม่ตรงกับสิ่งที่ต้นทางมีตอนสำรอง:\n  ${describeDiffCount(diffs, manifest.tables.length)}\n`,
      );
      process.exit(1);
    }
    done("ข้อมูลที่กู้คืนตรงกับสิ่งที่ต้นทางมีตอนสำรอง", describeDiffCount(diffs, manifest.tables.length));

    /* 4b) ต้นทางเปลี่ยนไปหลังการสำรองไหม — รายงานเป็นข้อมูล ไม่ถือว่าไม่ผ่าน */
    const drift = diffTables(manifest.tables, await readTableStats(sourceUrl));
    done(
      "ต้นทางเปลี่ยนหลังการสำรองหรือไม่",
      drift.length === 0 ? "ไม่เปลี่ยน (เทียบกับต้นทางปัจจุบันได้ด้วย)" : `${drift.length} ตารางเปลี่ยน (ปกติ — มีการแก้ข้อมูลหลังสำรอง)`,
    );

    /* 5) ทดสอบความไวของตัวเทียบ — เทียบกับฐานเปล่าต้องเจอความต่าง */
    const emptyCompare = await compareDatabases(restoreUrl, emptyUrl);
    if (emptyCompare.diffs.length === 0) {
      process.stderr.write(
        "\n✗ ตัวเทียบใช้งานไม่ได้: เทียบกับฐานข้อมูลเปล่าแล้วยังบอกว่า 'ตรงกัน'\n" +
          "   ⇒ ผลการตรวจทั้งหมดเชื่อถือไม่ได้ (หลักฐานที่ผ่านตลอด = ไม่ใช่หลักฐาน)\n",
      );
      process.exit(1);
    }
    done("ตัวเทียบจับความต่างได้จริง (ตรวจกับฐานเปล่า)", `พบ ${emptyCompare.diffs.length} ตารางที่ไม่ตรง`);

    /* 6) เส้นทางไฟล์ไบนารี (bytea) — มติ D11 */
    const bytes = fixtureBytes();
    const expectedDigest = createHash("md5").update(bytes).digest("hex");

    await executeSql(restoreUrl, `create table ${BINARY_FIXTURE_TABLE} (id integer primary key, payload bytea not null)`);
    await executeSql(restoreUrl, `insert into ${BINARY_FIXTURE_TABLE} (id, payload) values ($1, $2)`, [1, bytes]);

    await dumpToFile(restoreUrl, binaryDump);
    await restoreFromFile(binaryDump, binaryUrl);

    const restoredDigest = await queryScalar(binaryUrl, `select md5(payload) from ${BINARY_FIXTURE_TABLE} where id = 1`);
    const restoredLength = await queryScalar(
      binaryUrl,
      `select octet_length(payload)::text from ${BINARY_FIXTURE_TABLE} where id = 1`,
    );

    if (restoredDigest !== expectedDigest || restoredLength !== String(BINARY_FIXTURE_BYTES)) {
      process.stderr.write(
        `\n✗ ไบต์ของไฟล์ไบนารีไม่ตรงหลังกู้คืน (มติ D11 — ภาพ/เรซูเม่เสี่ยงหาย)\n` +
          `   ต้นฉบับ md5 ${expectedDigest} · ${BINARY_FIXTURE_BYTES} ไบต์\n` +
          `   ปลายทาง md5 ${String(restoredDigest)} · ${String(restoredLength)} ไบต์\n`,
      );
      process.exit(1);
    }
    done(
      "ไฟล์ไบนารี (bytea) รอดการสำรอง/กู้คืนครบไบต์",
      `${formatBytes(BINARY_FIXTURE_BYTES)} · md5 ${expectedDigest.slice(0, 12)} ตรงกับต้นฉบับ`,
    );

    /* 7) บอกด้วยว่าข้อมูลจริงมีไฟล์ไบนารีให้เทียบหรือยัง (วันนี้ = 0 แถว ⇒ ข้อ 6 คือหลักฐานจริง) */
    const media = manifest.tables.find((stat) => stat.table === "media")?.rows ?? 0;
    const attachments = manifest.tables.find((stat) => stat.table === "form_attachment")?.rows ?? 0;
    done(
      "จำนวนแถวไฟล์ไบนารีในข้อมูลจริง",
      `media ${media} · form_attachment ${attachments}` +
        (media === 0 && attachments === 0 ? " (ยังไม่มี ⇒ ข้อบนคือหลักฐานเดียวที่มี)" : ""),
    );

    process.stdout.write(
      `\n${CHECKS.join("\n")}\n\n✓ check:restore ผ่าน — ไฟล์สำรองนี้กู้คืนได้จริง (${Date.now() - started} ms)\n`,
    );
  } finally {
    /* 8) เก็บกวาดเสมอ — ไม่ทิ้งฐานข้อมูลชั่วคราวหรือไฟล์ชั่วคราว */
    await unlink(binaryDump).catch(() => undefined);

    if (!options.keep) {
      for (const name of [scratch.restore, scratch.empty, scratch.binary]) {
        await adminSql(maintenanceUrl, `drop database if exists "${name}" with (force)`).catch(() => undefined);
      }
      process.stdout.write(
        `  (ลบฐานข้อมูลชั่วคราวแล้ว: ${scratch.restore} · ${scratch.empty} · ${scratch.binary} + ไฟล์ชั่วคราว)\n`,
      );
    } else {
      process.stdout.write(`  (--keep: เก็บฐานข้อมูลชั่วคราวไว้ — ตรวจต่อด้วยมือ แล้วลบเอง: ${scratch.restore})\n`);
    }
  }
}

/*
  ดัก error ระดับบนสุด — ให้ผู้ดูแลเห็นข้อความอ่านรู้เรื่อง + รหัสออกที่ไม่ใช่ 0
  (ข้อความจาก `lib/backup/tools.ts` มี stderr ของ pg_restore ติดมาด้วยอยู่แล้ว และผ่าน sanitizeForLog)
  ⚠️ การเก็บกวาดอยู่ใน `finally` ของ main() แล้ว ⇒ ฐานข้อมูลชั่วคราวถูกลบก่อนที่ error จะมาถึงตรงนี้
*/
try {
  await main();
} catch (error) {
  process.stderr.write(`\n✗ ตรวจการกู้คืนไม่สำเร็จ\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
