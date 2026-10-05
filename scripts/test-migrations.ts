import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  checksumOf,
  describePlan,
  findDuplicateIds,
  parseMigrationFileName,
  planMigrations,
  sortMigrations,
  type MigrationFile,
} from "@/lib/db/migrations";

/** เทสต์ระบบ migration (รอบที่ 60) — ตรรกะล้วน ไม่ต้องมีฐานข้อมูล */

const ROOT = join(import.meta.dirname, "..");

const file = (id: string, name: string, sql: string): MigrationFile => ({ id, name, sql });

test("parseMigrationFileName: อ่านรหัส/ชื่อได้ และปฏิเสธชื่อที่ไม่ตรงรูปแบบ", () => {
  assert.deepEqual(parseMigrationFileName("0001-init.sql"), { id: "0001", name: "init" });
  assert.deepEqual(parseMigrationFileName("0012-chrome_navbar.sql"), { id: "0012", name: "chrome_navbar" });
  assert.equal(parseMigrationFileName("init.sql"), null, "ไม่มีเลขนำหน้า = ใช้ไม่ได้");
  assert.equal(parseMigrationFileName("0001-init.txt"), null, "ไม่ใช่ .sql = ใช้ไม่ได้");
});

test("checksumOf: คงที่เมื่อเนื้อหาเดิม · เปลี่ยนเมื่อเนื้อหาเปลี่ยน · ไม่สน CRLF/ช่องว่างหัวท้าย", () => {
  const a = checksumOf("create table t (id text);");
  const b = checksumOf("  create table t (id text);\r\n");
  const c = checksumOf("create table t (id text, name text);");

  assert.equal(a, b, "ตัดช่องว่าง + แปลง CRLF แล้วต้องได้ค่าเดิม");
  assert.notEqual(a, c, "เนื้อหาเปลี่ยน = ลายนิ้วมือเปลี่ยน");
  assert.equal(a.length, 16);
});

test("sortMigrations: เรียงตามตัวเลข ไม่ใช่ตามตัวอักษร (0002 มาก่อน 0010)", () => {
  const sorted = sortMigrations([
    file("0010", "later", "select 1"),
    file("0002", "early", "select 2"),
    file("0001", "first", "select 3"),
  ]);
  assert.deepEqual(sorted.map((entry) => entry.id), ["0001", "0002", "0010"]);
});

test("findDuplicateIds: จับเลขซ้ำได้", () => {
  assert.deepEqual(findDuplicateIds([file("0001", "a", "select 1"), file("0001", "b", "select 2")]), ["0001"]);
  assert.deepEqual(findDuplicateIds([file("0001", "a", "select 1"), file("0002", "b", "select 2")]), []);
});

test("planMigrations: ฐานข้อมูลว่าง = รันทั้งหมด · รันแล้ว = ไม่รันซ้ำ", () => {
  const files = [file("0001", "init", "create table a (id text);"), file("0002", "more", "create table b (id text);")];

  const fresh = planMigrations(files, { appliedIds: [], appliedChecksums: {} });
  assert.deepEqual(fresh.pending.map((entry) => entry.id), ["0001", "0002"]);
  assert.equal(fresh.clean.length, 0);

  const done = planMigrations(files, {
    appliedIds: ["0001", "0002"],
    appliedChecksums: { "0001": checksumOf(files[0]?.sql ?? ""), "0002": checksumOf(files[1]?.sql ?? "") },
  });
  assert.equal(done.pending.length, 0, "รันครบแล้วต้องไม่มีอะไรต้องรัน");
  assert.equal(done.clean.length, 2);
  assert.equal(done.modified.length, 0);
});

test("planMigrations: ไฟล์ที่รันแล้วถูกแก้ทีหลัง ⇒ รายงานเป็น modified (ไม่รันให้)", () => {
  const original = file("0001", "init", "create table a (id text);");
  const state = { appliedIds: ["0001"], appliedChecksums: { "0001": checksumOf(original.sql) } };

  const changed = planMigrations([file("0001", "init", "create table a (id text, x text);")], state);
  assert.equal(changed.pending.length, 0);
  assert.equal(changed.modified.length, 1);
  assert.equal(changed.modified[0]?.id, "0001");
  assert.notEqual(changed.modified[0]?.was, changed.modified[0]?.now);

  /* จดไว้แต่ไม่มีลายนิ้วมือ (ข้อมูลเก่า) = ถือว่าตรงกัน ไม่ทำให้ทั้งระบบหยุด */
  const legacy = planMigrations([original], { appliedIds: ["0001"], appliedChecksums: {} });
  assert.equal(legacy.modified.length, 0);
  assert.equal(legacy.clean.length, 1);
});

test("describePlan: สรุปเป็นบรรทัดอ่านรู้เรื่อง และเตือนเมื่อมีไฟล์ถูกแก้", () => {
  const files = [file("0001", "init", "select 1"), file("0002", "more", "select 2")];
  const lines = describePlan(planMigrations(files, { appliedIds: [], appliedChecksums: {} }));
  assert.ok(lines.some((line) => line.includes("ยังไม่รัน 2")));
  assert.ok(lines.some((line) => line.includes("+ 0001-init")));

  const warned = describePlan(
    planMigrations([file("0001", "init", "select 9")], { appliedIds: ["0001"], appliedChecksums: { "0001": "abc" } }),
  );
  assert.ok(warned.some((line) => line.includes("ถูกแก้ทีหลัง")));
});

test("ไฟล์ migration จริงในโปรเจกต์: ชื่อถูกต้อง · เลขไม่ซ้ำ · เรียงลำดับได้", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const dir = join(process.cwd(), "db", "migrations");
  const names = readdirSync(dir).filter((name) => name.endsWith(".sql"));
  assert.ok(names.length >= 3, "ต้องมีไฟล์ migration อย่างน้อย 3 ไฟล์");

  const parsed: MigrationFile[] = [];
  for (const fileName of names) {
    const info = parseMigrationFileName(fileName);
    assert.ok(info !== null, `${fileName} ต้องตั้งชื่อตามรูปแบบ 0001-ชื่อ.sql`);
    if (info === null) continue;
    parsed.push({ id: info.id, name: info.name, sql: readFileSync(join(dir, fileName), "utf8") });
  }

  assert.deepEqual(findDuplicateIds(parsed), []);
  const sorted = sortMigrations(parsed);

  /* เรียงตามเลขจริงและเพิ่มขึ้นเสมอ (ไม่ผูกกับจำนวนไฟล์ — เพิ่ม migration ใหม่ได้โดยไม่ต้องแก้เทสต์) */
  assert.equal(sorted[0]?.id, "0001", "ต้องเริ่มที่ 0001");
  const numbers = sorted.map((entry) => Number.parseInt(entry.id, 10));
  assert.deepEqual(numbers, [...numbers].sort((left, right) => left - right));
  assert.equal(new Set(numbers).size, numbers.length);

  /* ทุกไฟล์ต้อง idempotent (กันรันซ้ำแล้วพัง) */
  for (const entry of parsed) {
    const usesGuard =
      entry.sql.includes("if not exists") ||
      entry.sql.includes("add column if not exists") ||
      entry.sql.includes("create or replace") ||
      /* insert ที่รันซ้ำได้ (รอบที่ 102): `on conflict … do nothing/update` = กลไก idempotent ของการเพิ่มข้อมูล */
      entry.sql.includes("on conflict");
    assert.ok(usesGuard, `${entry.id}-${entry.name} ต้องกันรันซ้ำ (if not exists / on conflict / create or replace)`);
  }
});

test("check:migrations — ข้อความวินิจฉัยต้องบอกจุดเชื่อมต่อและลองซ้ำได้ (บทเรียน CI รอบที่ 83)", () => {
  const source = readFileSync(join(ROOT, "scripts", "check-migrations.ts"), "utf8");

  /* ตรวจที่ไหน ต้องรู้ได้จาก log (และห้ามมีรหัสผ่านโผล่) */
  assert.ok(source.includes("function describeTarget"), "ต้องมีตัวอธิบายจุดเชื่อมต่อ");
  assert.ok(source.includes('parsed.hostname}:${parsed.port || "5432"}'), "ต้องบอก host/port");
  assert.ok(!source.includes("parsed.password"), "ห้ามเอารหัสผ่านมาแสดง");

  /* ขั้น "สร้างฐานข้อมูลชั่วคราว" ต้องลองซ้ำได้ (เป็น environment setup ไม่ใช่สมบัติที่ตรวจ) */
  assert.ok(source.includes("with (force)`);\n      await admin.query(`create database"), "ต้อง drop แบบ force ก่อนสร้าง");
  assert.ok(source.includes("await delay(500)"), "ต้องหน่วงก่อนลองซ้ำ");
  assert.ok(source.includes("ต้องมีสิทธิ์ CREATEDB"), "ข้อความ error ต้องบอกสิ่งที่ต้องมี");
});
