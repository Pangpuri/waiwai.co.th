import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  BACKUP_DIR,
  BINARY_FIXTURE_TABLE,
  MANIFEST_VERSION,
  backupFileName,
  backupRetentionNote,
  databaseNameOf,
  databaseUserOf,
  describeDiffCount,
  diffTables,
  isBackupFileName,
  manifestPathFor,
  parseBackupFileName,
  parseManifest,
  pickLatestBackup,
  sanitizeForLog,
  scratchNamesFor,
  splitToolPrefix,
  toolCommand,
  toolConnectionArgs,
  withDatabaseName,
  type TableStat,
} from "@/lib/backup/plan";
import { RETENTION_DAYS } from "@/lib/retention/plan";

/**
 * เทสต์ X2.3 — แบ็กอัป/กู้คืน (ตรรกะบริสุทธิ์)
 *
 * เน้น 3 เรื่องที่พลาดแล้วเจ็บ
 * 1. **เลือกไฟล์ผิด** — กู้คืนไฟล์เก่าโดยไม่รู้ตัว
 * 2. **เทียบไม่เห็นความต่าง** — "ผ่าน" ทั้งที่ข้อมูลหาย (มีเทสต์ทั้งทางบวกและทางลบ)
 * 3. **รหัสผ่านหลุด log** — sanitize ต้องทำงานเสมอ
 * 4. **ไฟล์สำรองขึ้น repo** — .gitignore ต้องกันไว้ (ไฟล์นี้มีข้อมูลส่วนบุคคล)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const stat = (table: string, rows: number, digest: string | null): TableStat => ({ table, rows, digest });

/* ── 1) ชื่อไฟล์สำรอง ───────────────────────────────────────────────────────── */

test("backup: ชื่อไฟล์เรียงตามเวลาได้จริง และอ่านเวลากลับได้", () => {
  const at = new Date("2026-10-03T02:13:19.000Z");
  const name = backupFileName(at, "waiwai");

  assert.equal(name, "waiwai-20261003-021319.dump");
  assert.equal(isBackupFileName(name), true);
  assert.equal(parseBackupFileName(name)?.toISOString(), at.toISOString());
});

test("backup: ชื่อฐานข้อมูลที่มีอักขระพิเศษถูกทำให้ปลอดภัย", () => {
  const name = backupFileName(new Date("2026-01-02T03:04:05.000Z"), "WaiWai-Prod!");
  assert.equal(name, "waiwai_prod_-20260102-030405.dump");
  assert.equal(isBackupFileName(name), true);
});

test("backup: ชื่อไฟล์ที่ไม่ตรงรูปแบบต้องไม่ถูกเดา", () => {
  for (const wrong of ["", "waiwai.dump", "waiwai-20261003.dump", "waiwai-20261340-000000.dump", "notes.txt"]) {
    assert.equal(parseBackupFileName(wrong), null, `${wrong} ต้องอ่านไม่ได้`);
  }
});

test("backup: เลือกไฟล์ล่าสุด และข้ามไฟล์ที่ไม่รู้จัก", () => {
  const names = [
    "waiwai-20261001-090000.dump",
    "README.md",
    "waiwai-20261003-021319.dump",
    "waiwai-20260930-235959.dump",
  ];

  assert.equal(pickLatestBackup(names), "waiwai-20261003-021319.dump");
  assert.equal(pickLatestBackup(["notes.txt"]), null, "ไม่รู้จักสักไฟล์ = null (ห้ามเดา)");
  assert.equal(pickLatestBackup([]), null);
});

/* ── 2) ฐานข้อมูลชั่วคราว / URL ─────────────────────────────────────────────── */

test("backup: ชื่อฐานข้อมูลชั่วคราวอิงชื่อฐานข้อมูลจริง (ไม่ชนกันข้ามโปรเจกต์)", () => {
  const names = scratchNamesFor("waiwai");
  assert.deepEqual(names, {
    restore: "waiwai_restore_check",
    empty: "waiwai_restore_empty",
    binary: "waiwai_restore_binary",
  });
  assert.equal(new Set(Object.values(names)).size, 3, "ต้องไม่ซ้ำกันเอง");
  assert.equal(BINARY_FIXTURE_TABLE.length > 0, true, "ต้องมีชื่อตารางทดสอบไบนารี");
});

test("backup: อ่าน/สลับชื่อฐานข้อมูลจาก connection string ได้", () => {
  const url = "postgresql://waiwai:secret@localhost:55432/waiwai";

  assert.equal(databaseNameOf(url), "waiwai");
  assert.equal(databaseUserOf(url), "waiwai");
  assert.equal(databaseNameOf("ไม่ใช่ url"), null);
  assert.equal(databaseUserOf("postgresql://localhost/waiwai"), null, "ไม่ระบุผู้ใช้ = null");

  const swapped = withDatabaseName(url, "waiwai_restore_check");
  assert.equal(databaseNameOf(swapped), "waiwai_restore_check");
  assert.equal(databaseUserOf(swapped), "waiwai", "ผู้ใช้/รหัสผ่านต้องคงเดิม");
  assert.ok(swapped.includes("localhost:55432"), "host/พอร์ตต้องคงเดิม");
});

/* ── 2b) ลายนิ้วมือตอนสำรอง (manifest) ──────────────────────────────────────── */

test("backup: ไฟล์ลายนิ้วมืออยู่ข้างไฟล์ .dump เสมอ", () => {
  assert.equal(manifestPathFor("/x/waiwai-20261003-021319.dump"), "/x/waiwai-20261003-021319.dump.manifest.json");
});

test("backup: อ่านลายนิ้วมือที่ถูกต้องได้ครบ", () => {
  const manifest = parseManifest({
    version: MANIFEST_VERSION,
    database: "waiwai",
    takenAt: "2026-10-03T02:13:19.000Z",
    dumpBytes: 39914,
    dumpSha256: "a".repeat(64),
    tables: [
      { table: "page", rows: 3, digest: "aaa" },
      { table: "media", rows: 0, digest: "empty" },
      { table: "big", rows: 5, digest: null },
    ],
  });

  assert.ok(manifest !== null, "manifest ที่ถูกต้องต้องอ่านได้");
  assert.equal(manifest.database, "waiwai");
  assert.equal(manifest.tables.length, 3);
  assert.equal(manifest.tables[1]?.digest, "empty");
});

test("backup: ลายนิ้วมือที่เพี้ยน/ไม่ครบ = ปฏิเสธ (ห้ามเดา — ไฟล์นี้คือหลักฐาน)", () => {
  const base = {
    version: MANIFEST_VERSION,
    database: "waiwai",
    takenAt: "2026-10-03T02:13:19.000Z",
    dumpBytes: 1,
    dumpSha256: "a",
    tables: [] as unknown[],
  };

  assert.equal(parseManifest(null), null);
  assert.equal(parseManifest("ไม่ใช่ object"), null);
  assert.equal(parseManifest({ ...base, version: 99 }), null, "รุ่นที่ไม่รู้จัก = ปฏิเสธ");
  assert.equal(parseManifest({ ...base, takenAt: "ไม่ใช่วันที่" }), null);
  assert.equal(parseManifest({ ...base, dumpSha256: "" }), null);
  assert.equal(parseManifest({ ...base, tables: "ไม่ใช่ลิสต์" }), null);
  assert.equal(parseManifest({ ...base, tables: [{ table: "x", rows: "3", digest: null }] }), null, "rows ต้องเป็นตัวเลข");
  assert.equal(parseManifest({ ...base, tables: [{ table: "x", rows: 1, digest: 5 }] }), null, "digest ต้องเป็นข้อความ/null");
});

test("backup: ลายนิ้วมือเก็บแค่สถิติ ไม่เก็บเนื้อหาข้อมูล", () => {
  /* ตรวจจากซอร์ส: ฟิลด์ที่เขียนลง manifest มีเท่านี้ (กันเผลอเพิ่มข้อมูลดิบ/ข้อมูลส่วนบุคคลลงไฟล์) */
  const source = sourceOf("scripts/backup.ts");
  const block = source.slice(source.indexOf("const manifest: BackupManifest"), source.indexOf("const manifestPath ="));

  for (const field of ["version", "database", "takenAt", "dumpBytes", "dumpSha256", "tables"]) {
    assert.ok(block.includes(`${field}:`), `manifest ต้องมีฟิลด์ ${field}`);
  }
  assert.ok(!/\b(content|payload|email|name)\s*:/.test(block), "manifest ห้ามมีฟิลด์เนื้อหาข้อมูล");
});

/* ── 3) ความปลอดภัยของ log ─────────────────────────────────────────────────── */

test("backup: sanitizeForLog ซ่อนรหัสผ่านเสมอ", () => {
  assert.equal(
    sanitizeForLog("postgresql://waiwai:s3cr3t@localhost:55432/waiwai"),
    "postgresql://waiwai:***@localhost:55432/waiwai",
  );
  /* รหัสผ่านที่มี @ ต้องส่งมาแบบ percent-encoded (ตามมาตรฐาน URL) */
  assert.equal(
    sanitizeForLog("postgresql://user:p%40ss@db.example/waiwai"),
    "postgresql://user:***@db.example/waiwai",
  );
  assert.equal(sanitizeForLog("ไม่มีรหัสผ่าน"), "ไม่มีรหัสผ่าน");
});

test("backup: ไฟล์สคริปต์ห้าม log รหัสผ่าน/ห้ามใช้ console.log", () => {
  for (const file of ["scripts/backup.ts", "scripts/restore-check.ts"]) {
    const source = sourceOf(file);
    assert.ok(!source.includes("console.log"), `${file}: กติกาโปรเจกต์ห้าม console.log`);

    /* ห้ามต่อ connection string ดิบเข้าไปในข้อความที่พิมพ์ — ต้องผ่าน sanitizeForLog() เสมอ */
    assert.ok(
      !/\$\{(sourceUrl|databaseUrl)\}/.test(source),
      `${file}: ห้ามพิมพ์ connection string ดิบ (ต้องผ่าน sanitizeForLog)`,
    );
  }

  /* สคริปต์ที่พิมพ์ URL ออกจอจริง ต้องมี sanitizeForLog ใช้ */
  assert.ok(sourceOf("scripts/backup.ts").includes("sanitizeForLog("), "backup.ts พิมพ์ URL ⇒ ต้องผ่าน sanitizeForLog");
});

/* ── 4) คำสั่งนำหน้าเครื่องมือ ──────────────────────────────────────────────── */

test("backup: แยกคำสั่งนำหน้า (docker exec) ได้ถูกต้อง", () => {
  assert.deepEqual(splitToolPrefix(undefined), []);
  assert.deepEqual(splitToolPrefix(""), []);
  assert.deepEqual(splitToolPrefix("   "), []);
  assert.deepEqual(splitToolPrefix("docker exec -i waiwai-pg"), ["docker", "exec", "-i", "waiwai-pg"]);
  assert.deepEqual(splitToolPrefix("  docker   exec  "), ["docker", "exec"], "ตัดช่องว่างซ้ำ/หัวท้าย");
});

test("backup: ประกอบคำสั่งเต็ม = คำสั่งนำหน้า + เครื่องมือ + อาร์กิวเมนต์", () => {
  assert.deepEqual(toolCommand("pg_dump", ["--format=custom"], "docker exec -i waiwai-pg"), [
    "docker",
    "exec",
    "-i",
    "waiwai-pg",
    "pg_dump",
    "--format=custom",
  ]);
  assert.deepEqual(toolCommand("pg_dump", ["--format=custom"], undefined), ["pg_dump", "--format=custom"]);
});

test("backup: วิธีต่อฐานข้อมูลของเครื่องมือ เลือกตามสภาพแวดล้อม", () => {
  const url = "postgresql://waiwai:secret@localhost:55432/waiwai";

  /* บนเซิร์ฟเวอร์จริง — ไม่ตั้งอะไร ⇒ ใช้ connection string ตรง ๆ */
  assert.deepEqual(toolConnectionArgs(url, {}), [`--dbname=${url}`]);

  /* เครื่อง dev — เครื่องมืออยู่ในกล่อง Docker ⇒ ต่อผ่าน socket ในกล่อง (ไม่ส่งรหัสผ่าน) */
  const inside = toolConnectionArgs(url, { prefix: "docker exec -i waiwai-pg" });
  assert.deepEqual(inside, ["--username=waiwai", "--dbname=waiwai"]);
  assert.ok(!inside.join(" ").includes("secret"), "ต้องไม่ส่งรหัสผ่านเข้าไปในคำสั่ง");

  /* ระบุ DB_TOOLS_URL เอง = คุมเองเต็มที่ */
  const explicit = "postgresql://waiwai:x@127.0.0.1:5432/waiwai";
  assert.deepEqual(toolConnectionArgs(url, { prefix: "docker exec -i waiwai-pg", toolsUrl: explicit }), [
    `--dbname=${explicit}`,
  ]);
});

/* ── 5) ตัวเทียบสองฐานข้อมูล ────────────────────────────────────────────────── */

test("backup: เทียบแล้วเจอความต่างทุกแบบ (หายไป/เกินมา/จำนวนแถว/เนื้อหา)", () => {
  const source = [stat("page", 3, "aaa"), stat("media", 2, "bbb"), stat("old", 1, "ccc")];
  const target = [
    stat("page", 3, "aaa"), // ตรงกัน
    stat("media", 2, "zzz"), // จำนวนเท่าแต่เนื้อหาต่าง
    stat("new", 1, "ddd"), // เกินมา
  ];

  const diffs = diffTables(source, target);
  assert.deepEqual(
    diffs.map((diff) => `${diff.table}:${diff.kind}`),
    ["media:content", "new:missing-in-source", "old:missing-in-target"],
    "ต้องเรียงตามชื่อตารางและระบุชนิดความต่างให้ครบ",
  );
});

test("backup: จำนวนแถวไม่เท่า = รายงานว่า rows (ไม่ใช่ content)", () => {
  const diffs = diffTables([stat("page", 3, "aaa")], [stat("page", 2, "aaa")]);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0]?.kind, "rows");
  assert.equal(diffs[0]?.source, "3 แถว");
  assert.equal(diffs[0]?.target, "2 แถว");
});

test("backup: ตรงกันเป๊ะ = ไม่มีอะไรต้องรายงาน", () => {
  const tables = [stat("page", 3, "aaa"), stat("empty", 0, "empty")];
  assert.deepEqual(diffTables(tables, tables), []);
});

test("backup: ลายนิ้วมือคำนวณไม่ได้ = เทียบแค่จำนวนแถว (ไม่รายงานผิด)", () => {
  /* digest = null เกิดกับตารางที่คำนวณไม่ได้ ⇒ ต้องไม่ทำให้ขึ้นว่า 'เนื้อหาไม่ตรง' */
  const diffs = diffTables([stat("page", 3, null)], [stat("page", 3, "bbb")]);
  assert.deepEqual(diffs, []);
});

test("backup: ข้อความสรุปผลอ่านรู้เรื่องทั้งกรณีผ่านและไม่ผ่าน", () => {
  assert.equal(describeDiffCount([], 14), "14 ตารางตรงกันทั้งหมด (จำนวนแถว + เนื้อหา)");

  const text = describeDiffCount(
    [
      { table: "media", kind: "content", source: "aaaa", target: "zzzz" },
      { table: "old", kind: "missing-in-target", source: "1 แถว", target: "-" },
    ],
    2,
  );
  assert.ok(text.includes("media: เนื้อหาไม่ตรง"));
  assert.ok(text.includes("old: หายไปจากปลายทาง"));
});

/* ── 6) ข้อความเตือนเรื่องข้อมูลส่วนบุคคล ───────────────────────────────────── */

test("backup: คำเตือนระยะเก็บดึงจากนโยบายกลาง (ไม่พิมพ์เลขเอง)", () => {
  const note = backupRetentionNote();
  assert.ok(note.includes("1 ปี"), "ต้องบอกระยะเก็บของฟอร์มติดต่อ");
  assert.ok(note.includes("6 เดือน"), "ต้องบอกระยะเก็บของใบสมัครงาน");
  assert.ok(RETENTION_DAYS.contact === 365 && RETENTION_DAYS.careers === 180, "ตัวเลขต้องตรงกับนโยบาย");
});

test("backup: โฟลเดอร์ไฟล์สำรองต้องถูก gitignore (มีข้อมูลส่วนบุคคล)", () => {
  const ignore = sourceOf(".gitignore");
  assert.ok(ignore.includes(`/${BACKUP_DIR}/`), `${BACKUP_DIR}/ ต้องอยู่ใน .gitignore`);
  assert.ok(ignore.includes("ข้อมูลส่วนบุคคล"), "ควรมีเหตุผลกำกับว่าทำไมห้าม commit");
});
