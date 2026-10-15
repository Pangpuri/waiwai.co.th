import assert from "node:assert/strict";
import { test } from "node:test";

import { codeOf, rawOf } from "./source-scan.ts";
import { loadMigrationFiles } from "./migration-files.ts";
import { planMigrations } from "@/lib/db/migrations";
import { isProbeTableName } from "./role-probe.ts";

/**
 * เทสต์ด่าน "ปลายทางพร้อมไหม" (`npm run check:target` · รอบที่ 283 · ปิดหนี้ D-282-2)
 *
 * ⚠️ เทสต์ชุดนี้ **ไม่ต่อฐานข้อมูลปลายทาง** — ตรวจตรรกะที่พิสูจน์ได้ในเครื่อง + สแกนซอร์ส
 * (ตัวด่านจริงถูกยิงกับ Neon แล้วในรอบงาน: พบว่าล้าหลัง 5 migration + ขาด role `waiwai_public_form`)
 *
 * ด่านที่สำคัญที่สุดในไฟล์นี้คือ **"ตัวตรวจต้องไม่เขียนอะไรลงปลายทาง"** — เครื่องมือที่ตั้งใจให้รัน
 * ถี่ ๆ (ก่อน deploy) ต้องไม่มีทางแก้ข้อมูลได้เลย
 */

test("check:target — เทียบไฟล์ migration กับสถานะจริงได้ (trạngะว่าง = ทุกไฟล์ค้าง)", () => {
  const files = loadMigrationFiles();
  assert.ok(files.length >= 43, "ต้องอ่านไฟล์ migration ได้ (รวม 0043)");

  /* ปลายทางที่ยังไม่เคยรันเลย */
  const empty = planMigrations(files, { appliedIds: [], appliedChecksums: {} });
  assert.equal(empty.pending.length, files.length, "ยังไม่รันเลย ⇒ ค้างทุกไฟล์");
  assert.equal(empty.modified.length, 0);

  /* ปลายทางที่รันครบ (checksum ตรง) */
  const full = planMigrations(files, {
    appliedIds: files.map((file) => file.id),
    appliedChecksums: Object.fromEntries(empty.clean.concat(empty.pending).map((item) => [item.id, item.checksum])),
  });
  assert.equal(full.pending.length, 0, "รันครบแล้ว ⇒ ไม่มีค้าง");
  assert.equal(full.modified.length, 0);
});

test("check:target — ตรวจเจอ 'ไฟล์ที่รันแล้วถูกแก้ทีหลัง' ด้วย (อันตรายกว่า migration ขาด)", () => {
  const files = loadMigrationFiles();
  const first = files[0];
  assert.ok(first !== undefined);
  const plan = planMigrations(files, {
    appliedIds: [first.id],
    appliedChecksums: { [first.id]: "checksum-ไม่ตรงแล้ว" },
  });
  assert.equal(plan.modified.length, 1, "checksum ไม่ตรง ⇒ ต้องรายงานเป็น modified");
});

test("check:target — **ห้ามเขียนฐานข้อมูลปลายทาง** (อ่านเท่านั้น)", () => {
  const source = codeOf("scripts/check-target.ts");

  /* คำสั่งที่ไม่ควรมีอยู่ในเครื่องมือตรวจ (ทั้ง SQL และฟังก์ชันที่เขียนตาราง) */
  const writePatterns: readonly [RegExp, string][] = [
    [/\binsert\s+into\b/i, "insert into"],
    [/\bupdate\s+[a-z_]+\s+set\b/i, "update … set"],
    [/\bdelete\s+from\b/i, "delete from"],
    [/\bcreate\s+table\b/i, "create table"],
    [/\balter\s+table\b/i, "alter table"],
    [/\bdrop\s+table\b/i, "drop table"],
    [/\bgrant\s+/i, "grant"],
    [/\brevoke\s+/i, "revoke"],
    [/ensureTable/, "ensureTable() ของ db:migrate"],
  ];
  for (const [pattern, label] of writePatterns) {
    assert.equal(pattern.test(source), false, `check:target ต้องไม่มี "${label}" (ด่านต้องอ่านเท่านั้น)`);
  }

  /* ต้องอ่านผ่าน pool เดียวกับเครื่องมืออื่น + ต้องบอกผู้ใช้ว่าปลายทางคือที่ไหน */
  assert.ok(source.includes("select "), "ต้องใช้คำสั่งอ่าน");
  assert.ok(source.includes("targetBanner(selection)"), "ต้องพิมพ์โฮสต์ปลายทางให้เห็น");
  assert.ok(source.includes("selectTargetUrl(process.env)"), "ต้องเลือกปลายทางด้วยตัวช่วยกลาง");
});

test("check:target — migration ขาด/ไฟล์ถูกแก้ = ตก (exit 1) · role ขาด = เตือน (หรือตกเมื่อ --strict)", () => {
  const source = codeOf("scripts/check-target.ts");
  assert.ok(source.includes("if (failures.length > 0) process.exitCode = 1"), "ต้องมีรหัสออกที่ไม่ใช่ 0 เมื่อไม่ผ่าน");
  assert.ok(source.includes("--strict"), "role ขาดต้องบังคับให้ตกได้ด้วย --strict");
  assert.ok(source.includes("--json"), "ต้องมีโหมด JSON ให้ใช้ในงานอัตโนมัติ");
  /* role ต้องมาจากค่ากลาง (ห้ามพิมพ์ชื่อ role ซ้ำ) */
  assert.ok(source.includes("READ_ROLE") && source.includes("FORM_ROLE"), "ชื่อ role ต้องมาจาก db-roles.ts");
  const roles = codeOf("scripts/db-roles.ts");
  assert.ok(roles.includes("export const READ_ROLE"), "db-roles.ts ต้อง export ชื่อ role (แหล่งเดียว)");
  assert.ok(roles.includes("export const FORM_ROLE"), "db-roles.ts ต้อง export ชื่อ role (แหล่งเดียว)");
});

test("check:target — ไฟล์นี้ต้องไม่ถูกนับเป็นด่านที่ต้องมี DB (รันในเครื่องเปล่าได้)", () => {
  /* ชื่อไฟล์ห้ามขึ้นต้นด้วย test- (จะถูกกวาดเป็นเทสต์) และห้ามถูกเรียกจากด่าน 10 ข้อ */
  const pkg = JSON.parse(rawOf("package.json")) as { scripts: Record<string, string> };
  assert.ok(pkg.scripts["check:target"]?.includes("check-target.ts"), "ต้องมีสคริปต์ npm run check:target");
  assert.equal(
    Object.values(pkg.scripts).some((command) => command.includes("check-target.ts") && command.includes("check:db")),
    false,
    "ห้ามผูกกับ check:db (ต้องมี credential ของคลาวด์เท่านั้นจึงจะรันได้)",
  );
});

test("check:deploy — ชี้ทางไปด่านปลายทางให้ผู้ใช้ (ไม่ดึง DB เข้า check:deploy)", () => {
  const deploy = codeOf("scripts/check-deploy.ts");
  assert.ok(deploy.includes("check:target"), "ต้องบอกให้รัน check:target ต่อ");
  /* ย้ำสัญญาเดิม: check:deploy ตรวจจาก HTTP เท่านั้น */
  const dbPatterns = [/\bgetPool\b/, /@\/db\/pool/, /\bpg\b/, /\binsert\s+into\b/i, /\bselect\s+/i];
  for (const pattern of dbPatterns) {
    assert.equal(pattern.test(deploy), false, `check:deploy ต้องไม่แตะฐานข้อมูล (${String(pattern)})`);
  }
});

test("migration-files — ตัวอ่านไฟล์ใช้ร่วมกัน (ไม่มีสำเนาในสคริปต์อื่นอีก)", () => {
  const loader = codeOf("scripts/migration-files.ts");
  assert.ok(loader.includes("export function loadMigrationFiles"), "ต้องมีตัวอ่านกลาง");
  assert.ok(loader.includes("findDuplicateIds"), "ต้องตรวจเลขซ้ำ");
  assert.ok(loader.includes("sortMigrations"), "ต้องเรียงตามเลขเสมอ");

  for (const file of ["scripts/migrate.ts", "scripts/check-migrations.ts", "scripts/check-target.ts"]) {
    const source = codeOf(file);
    assert.ok(source.includes("loadMigrationFiles()"), `${file}: ต้องใช้ตัวอ่านกลาง`);
    assert.equal(
      source.includes("readdirSync"),
      false,
      `${file}: ห้ามมีสำเนาการอ่านโฟลเดอร์เอง (จุดเริ่มของ "ด่านไม่ตรงกัน")`,
    );
  }
});

/* ── รอบที่ 286 (ปิดหนี้ D-283-2): พิสูจน์สิทธิ์ role จริง ───────────────────────── */

test("check:target — ต้องพิสูจน์ 'role อ่านได้จริง' ด้วยการต่อด้วย role นั้น (ไม่ใช่แค่มีชื่อใน pg_roles)", () => {
  const source = codeOf("scripts/check-target.ts");
  assert.ok(source.includes("probeReadRole("), "ต้องพิสูจน์ role อ่าน");
  assert.ok(source.includes("probeFormRole("), "ต้องพิสูจน์ role ฟอร์ม");
  assert.ok(source.includes("TARGET_PUBLIC_DATABASE_URL"), "รับ URL ของ role อ่านจาก env (ไม่เดาค่าให้)");
  assert.ok(source.includes("TARGET_FORM_DATABASE_URL"), "รับ URL ของ role ฟอร์มจาก env");
  assert.ok(source.includes('"--read-url="'), "รับ URL ทาง flag ได้ด้วย");
  assert.ok(source.includes("ข้ามการพิสูจน์สิทธิ์"), "ไม่มี URL = **ข้ามอย่างเปิดเผย** ไม่ใช่ผ่านเงียบ ๆ");
  assert.ok(source.includes("PUBLIC_READ_TABLES"), "รายการตารางต้องมาจาก db-roles.ts (แหล่งเดียว)");
});

test("check:target — role-probe ต้องอ่านเท่านั้น (ตรวจการเขียนด้วย catalog ไม่ใช่ลองเขียนจริง)", () => {
  const probe = codeOf("scripts/role-probe.ts");

  const writePatterns: readonly [RegExp, string][] = [
    [/\binsert\s+into\b/i, "insert into"],
    [/\bupdate\s+[a-z_]+\s+set\b/i, "update … set"],
    [/\bdelete\s+from\b/i, "delete from"],
    [/\bcreate\s+(table|index)\b/i, "create table/index"],
    [/\balter\s+table\b/i, "alter table"],
    [/\bdrop\s+table\b/i, "drop table"],
    [/\bgrant\s+/i, "grant"],
    [/\brevoke\s+/i, "revoke"],
  ];
  for (const [pattern, label] of writePatterns) {
    assert.equal(pattern.test(probe), false, `role-probe ต้องไม่มี "${label}" (ต้องไม่แตะข้อมูลปลายทาง)`);
  }

  assert.ok(probe.includes("has_table_privilege"), "ตรวจ 'เขียนไม่ได้' จาก catalog");
  assert.ok(probe.includes("client.end()"), "ต้องปิด connection ทุกครั้ง (ไม่ค้าง pool)");
  assert.ok(probe.includes("FORBIDDEN_FOR_PUBLIC_READ"), "รายชื่อตารางอ่อนไหวต้องมาจาก db-roles.ts");
});

test("role-probe — ชื่อตารางต้องผ่านด่านก่อนใส่ในคำสั่ง (กันชื่อแปลกจากภายนอก)", () => {
  for (const good of ["page_document", "form_submission", "product_category_slug_history", "a1_b2"]) {
    assert.equal(isProbeTableName(good), true, `${good} ต้องผ่าน`);
  }
  for (const bad of [
    "Page", // ตัวพิมพ์ใหญ่ = ไม่ใช่ชื่อที่ Postgres สร้าง
    "page-document",
    "page document",
    'page"; drop table x; --',
    "public.page",
    "_leading",
    "",
  ]) {
    assert.equal(isProbeTableName(bad), false, `${JSON.stringify(bad)} ต้องไม่ผ่าน`);
  }
});

test("db-roles --target — บอกทางเก็บ URL ของ role ให้ check:target พิสูจน์สิทธิ์ต่อ", () => {
  const source = codeOf("scripts/db-roles.ts");
  assert.ok(source.includes("TARGET_PUBLIC_DATABASE_URL"), "ต้องบอกชื่อ env ที่ check:target ใช้");
});
