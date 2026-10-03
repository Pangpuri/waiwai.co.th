import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { TRASH_RETENTION_DAYS, RETENTION_CLASSES, trashCutoffFor } from "@/lib/retention/plan";
import {
  TRASH_AUDIT_ACTIONS,
  TRASH_KINDS,
  daysLeftInTrash,
  emptyTrashCounts,
  isTrashExpired,
  isTrashKind,
  summarizeTrash,
  trashTotal,
} from "@/lib/trash/plan";

/**
 * เทสต์ X2.4 — ถังขยะ (soft delete + กู้คืน + ลบถาวรตามระยะเก็บ)
 *
 * สองส่วนที่ต้องคุม
 * 1. **นโยบาย** (กี่วัน · เหลือกี่วัน · อะไรหมดอายุ) — ตรรกะล้วน ไม่ต้องมี DB
 * 2. **การต่อสายจริง** — ลบทุกจุดต้องผ่านถังก่อน, ของที่อยู่ในถังต้องไม่หลุดไปหน้าเว็บ,
 *    การลบถาวรต้องมีเงื่อนไข ≥ 2 ชั้น (ตรวจสิทธิ์ + ต้องอยู่ในถังแล้ว) และ
 *    ตัวลบตามกำหนดต้องถูกเรียกจากตัวลบกลาง (cron/ล็อกอิน) ไม่ใช่ต้องมีคนกดเอง
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) นโยบายระยะเก็บของถังขยะ ──────────────────────────────────────────────── */

test("trash: ระยะเก็บของถังขยะ = 30 วัน และเป็นค่ากลางที่เดียว", () => {
  assert.equal(TRASH_RETENTION_DAYS, 30, "มติรอบที่ 78: ของในถังเก็บ 30 วันก่อนลบถาวร");

  const now = new Date("2026-10-03T00:00:00.000Z");
  assert.equal(trashCutoffFor(now).toISOString(), "2026-09-03T00:00:00.000Z");
});

test("trash: ถังขยะไม่ใช่ชั้นข้อมูลส่วนบุคคล ⇒ ต้องไม่อยู่ในตาราง /privacy", () => {
  /* ถ้าเผลอเพิ่มเข้า RETENTION_CLASSES หน้า /privacy จะประกาศเรื่องที่ไม่ใช่ข้อมูลส่วนบุคคล */
  assert.ok(
    !(RETENTION_CLASSES as readonly string[]).includes("trash"),
    "ห้ามเอา \"trash\" ไปปนกับชั้นข้อมูลส่วนบุคคล (คนละนโยบายกัน)",
  );

  const privacy = sourceOf("app/[lang]/privacy/page.tsx");
  assert.ok(!privacy.includes("TRASH_RETENTION_DAYS"), "หน้า /privacy ห้ามดึงระยะเก็บของถังขยะมาแสดง");
});

test("trash: เหลือเวลากี่วันก่อนลบถาวร — ปัดขึ้น และไม่เดาค่าที่อ่านไม่ได้", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const agoDays = (days: number): string => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(daysLeftInTrash(agoDays(0), now), 30, "เพิ่งลบ = เหลือเต็มระยะ");
  assert.equal(daysLeftInTrash(agoDays(1), now), 29);
  assert.equal(daysLeftInTrash(agoDays(29), now), 1, "ปัดขึ้น ⇒ ยังกู้คืนได้ในวันสุดท้าย");
  assert.equal(daysLeftInTrash(agoDays(30), now), 0, "ครบกำหนด = 0 (จะถูกลบในรอบถัดไป)");
  assert.equal(daysLeftInTrash(agoDays(60), now), 0);

  assert.equal(daysLeftInTrash(null, now), null, "ไม่มีวันที่ = ไม่เดา");
  assert.equal(daysLeftInTrash("", now), null);
  assert.equal(daysLeftInTrash("   ", now), null);
  assert.equal(daysLeftInTrash("ไม่ใช่วันที่", now), null);
});

test("trash: หมดอายุใช้ขอบเขต 'เก่ากว่าจุดตัด' เท่านั้น (ของเพิ่งลบต้องไม่หาย)", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const cutoff = trashCutoffFor(now);

  assert.equal(isTrashExpired(new Date(cutoff.getTime() - 1).toISOString(), now), true, "เก่ากว่าจุดตัด 1 ms = หมดอายุ");
  assert.equal(isTrashExpired(cutoff.toISOString(), now), false, "เท่าจุดตัดพอดี = ยังอยู่");
  assert.equal(isTrashExpired(new Date(now.getTime() - 1000).toISOString(), now), false, "เพิ่งลบ = ยังอยู่");

  /* ค่าที่อ่านไม่ได้ → ไม่ลบ (กู้คืนได้เสมอ ปลอดภัยกว่าสำหรับถังขยะ) */
  assert.equal(isTrashExpired(null, now), false);
  assert.equal(isTrashExpired("", now), false);
  assert.equal(isTrashExpired("ไม่ใช่วันที่", now), false);
});

test("trash: ชนิดของที่อยู่ในถัง — ตรวจค่าจากฟอร์มก่อนเสมอ", () => {
  assert.deepEqual([...TRASH_KINDS], ["media", "preset", "chromePreset"]);
  assert.equal(isTrashKind("media"), true);
  assert.equal(isTrashKind("preset"), true);
  assert.equal(isTrashKind("chromePreset"), true);

  /* ค่าที่ไม่รู้จักต้องไม่ผ่าน (กันการยิงฟอร์มปลอมมาหา kind อื่น) */
  for (const bad of ["", "MEDIA", "media ", "users", "media; drop table media", "form_submission", "presets", "chromepreset"]) {
    assert.equal(isTrashKind(bad), false, `"${bad}" ต้องไม่ใช่ชนิดที่รู้จัก`);
  }
});

test("trash: สรุปยอดสำหรับ audit log มีทุกชนิด และยอดรวมถูก", () => {
  const counts = { media: 2, preset: 3, chromePreset: 1 };
  assert.equal(trashTotal(counts), 6);
  assert.equal(summarizeTrash(counts), "media=2 preset=3 chromePreset=1");
  assert.equal(summarizeTrash(emptyTrashCounts()), "media=0 preset=0 chromePreset=0");
  assert.equal(trashTotal(emptyTrashCounts()), 0);

  /* ชื่อ action ต้องไม่ว่างและไม่ซ้ำกัน (ใช้แยกแยะใน audit log) */
  const actions = Object.values(TRASH_AUDIT_ACTIONS);
  assert.equal(new Set(actions).size, actions.length, "action ของถังขยะต้องไม่ซ้ำกัน");
  for (const action of actions) assert.ok(action.startsWith("trash-"), `action "${action}" ต้องขึ้นต้นด้วย trash-`);
});

/* ── 2) ต่อสายจริง: ลบทุกจุดต้องผ่านถัง ─────────────────────────────────────── */

test("trash: คลังภาพไม่มีการลบถาวรอีกต่อไป — ทุกคำสั่งอ่านกรอง deleted_at", () => {
  const media = sourceOf("lib/media/repository.ts");

  assert.ok(!/export\s+async\s+function\s+deleteMedia\b/.test(media), "ห้ามมีฟังก์ชันลบภาพถาวรในคลังภาพ");
  assert.ok(!media.includes("delete from media"), "ห้ามมี SQL ลบภาพตรง ๆ ในคลังภาพ");

  /* อ่าน 4 ทาง (ไบนารี · รายการ · ค้นหา · สถิติ) ต้องกรองของในถังออกทั้งหมด */
  const guards = media.match(/deleted_at is null/g) ?? [];
  assert.ok(guards.length >= 4, `ทุกคำสั่งอ่านต้องกรอง deleted_at is null (พบ ${guards.length})`);
});

test("trash: ไฟล์ภาพที่อยู่ในถังต้องไม่ถูกเสิร์ฟให้หน้าเว็บ", () => {
  const route = sourceOf("app/media/[id]/route.ts");

  assert.ok(route.includes("getMediaBinary"), "เส้นทางเสิร์ฟภาพต้องอ่านผ่าน repository ตัวเดียว");
  assert.ok(!route.includes("from media"), "ห้ามคิวรีตาราง media เองในเส้นทางนี้ (จะลืมกรองของในถัง)");
});

test("trash: การลบถาวรมีเงื่อนไข 'ต้องอยู่ในถังแล้ว' + ตรวจสิทธิ์ทุก action", () => {
  const repo = sourceOf("lib/trash/repository.ts");

  /* ลบถาวรทีละรายการ + ล้างถัง ต้องมีเงื่อนไข deleted_at is not null */
  assert.ok(repo.includes("delete from ${TABLES[kind]} where id = $1 and deleted_at is not null"), "ลบถาวรต้องกันของที่ยังใช้งานอยู่");
  assert.ok(repo.includes("delete from ${TABLES[kind]} where deleted_at is not null"), "ล้างถังต้องลบเฉพาะของในถัง");
  assert.ok(repo.includes("update ${TABLES[kind]} set deleted_at = null, deleted_by = null where id = $1 and deleted_at is not null"), "กู้คืนต้องทำได้เฉพาะของในถัง");

  /* ชื่อตารางต้องมาจากค่าคงที่เท่านั้น */
  assert.ok(repo.includes("const TABLES"), "ต้องมีตารางแบบค่าคงที่");
  assert.ok(repo.includes("${TABLES[kind]}"), "SQL ต้องอ้างตารางผ่านค่าคงที่ TABLES");
  assert.ok(repo.includes("const table = TABLES[kind]"), "alias ของตารางต้องมาจาก TABLES");
  for (const match of repo.matchAll(/(from|into|update|join)\s+\$\{([A-Za-z_.[\]]+)\}/g)) {
    const source = match[2];
    assert.ok(
      source === "TABLES[kind]" || source === "table",
      `ชื่อตารางต้องมาจาก TABLES เท่านั้น (พบ \${${source}})`,
    );
  }

  const actions = sourceOf("app/admin/trash/actions.ts");
  const required = actions.match(/await requireAdminUser\(\)/g) ?? [];
  const exported = actions.match(/export async function/g) ?? [];
  assert.equal(exported.length, 4, "ต้องมี 4 action (กู้คืน · ลบถาวร · ล้างถัง · ลบตามกำหนด)");
  assert.equal(required.length, exported.length, "ทุก action ต้องตรวจสิทธิ์ก่อนทำงาน");
  assert.ok(actions.includes("isTrashKind("), "ต้องตรวจชนิดของก่อนแตะฐานข้อมูล");

  const page = sourceOf("app/admin/trash/page.tsx");
  assert.ok(page.includes("requireAdminUser()"), "หน้าถังขยะต้องล็อกอินก่อน");
  assert.ok(page.includes("TRASH_RETENTION_DAYS"), "หน้าต้องบอกระยะเก็บจากค่ากลาง");
});

test("trash: 'ลบ' จากคลังภาพและพรีเซ็ต ต้องย้ายเข้าถัง (ไม่ลบถาวร)", () => {
  const library = sourceOf("app/admin/media/library-actions.ts");
  assert.ok(library.includes("trashMedia("), "ปุ่มลบภาพต้องเรียก trashMedia");
  assert.ok(!library.includes("deleteMedia("), "ห้ามเรียกตัวลบถาวรของเดิม");

  const presets = sourceOf("lib/blocks/presets.ts");
  assert.ok(!presets.includes("export async function deleteBlockPreset"), "ห้ามมีตัวลบพรีเซ็ตถาวร");
  assert.ok(presets.includes("deleted_at = null"), "บันทึกพรีเซ็ตชื่อเดิมต้องกู้คืนของที่อยู่ในถังกลับมาใช้");

  const presetActions = sourceOf("app/admin/builder/preset-actions.ts");
  assert.ok(presetActions.includes("trashBlockPreset("), "ปุ่มลบพรีเซ็ตต้องย้ายเข้าถัง");
});

test("trash: ตัวลบตามกำหนดถูกเรียกจากตัวลบกลาง (cron/ล็อกอิน) ไม่ต้องรอกดเอง", () => {
  const purge = sourceOf("lib/retention/purge.ts");
  assert.ok(purge.includes("purgeExpiredTrash("), "ตัวลบกลางต้องลบของในถังที่พ้นกำหนดด้วย");
  assert.ok(!purge.includes("delete from media"), "การลบถาวรต้องอยู่ใน lib/trash/repository.ts ที่เดียว");

  const repo = sourceOf("lib/trash/repository.ts");
  assert.ok(repo.includes("deleted_at < $1"), "ตัวลบต้องเทียบเวลาตัดจากค่ากลาง");
  assert.ok(repo.includes("trashCutoffIsoFor"), "เวลาตัดต้องมาจาก lib/retention/plan.ts");
  assert.ok(repo.includes("recordAudit"), "การลบถาวรต้องมีร่องรอย");
});

test("trash: สคีมา/ดัชนีของถังขยะ และด่านตรวจกับ DB", () => {
  const migration = sourceOf("db/migrations/0008-trash.sql");

  for (const table of ["media", "block_preset"]) {
    assert.ok(migration.includes(`alter table ${table} add column if not exists deleted_at`), `${table} ต้องมี deleted_at`);
    assert.ok(migration.includes(`alter table ${table} add column if not exists deleted_by`), `${table} ต้องมี deleted_by`);
  }
  assert.ok(migration.includes("where deleted_at is null"), "ต้องมีดัชนีสำหรับของที่ใช้งานอยู่");
  assert.ok(migration.includes("where deleted_at is not null"), "ต้องมีดัชนีสำหรับของในถัง");

  /* ทุกคำสั่งต้อง idempotent (รันซ้ำได้ ไม่พังกับฐานข้อมูลที่มีข้อมูลแล้ว) */
  for (const line of migration.split("\n")) {
    const statement = line.trim();
    if (statement.startsWith("alter table") || statement.startsWith("create index") || statement.startsWith("create table")) {
      assert.ok(statement.includes("if not exists"), `คำสั่งไม่ idempotent: ${statement}`);
    }
  }

  /* ด่าน DB ต้องพิสูจน์วงจรจริง (เข้า → ซ่อน → กู้คืน → ลบถาวร → ลบตามกำหนด) */
  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkTrash"), "check:db ต้องมีด่านถังขยะ");
  assert.ok(checkDb.includes("purgeExpiredTrash"), "ต้องพิสูจน์ตัวลบตามกำหนดกับ DB จริง");
});

test("trash: มีทางเข้าใช้จากหลังบ้าน (เมนู + การ์ดหน้าภาพรวม)", () => {
  const layout = sourceOf("app/admin/layout.tsx");
  assert.ok(layout.includes('"/admin/trash"'), "เมนูหลังบ้านต้องมีถังขยะ");

  const overview = sourceOf("app/admin/page.tsx");
  assert.ok(overview.includes("trashStats("), "หน้าภาพรวมต้องนับของในถัง");
  assert.ok(overview.includes('"/admin/trash"'), "การ์ดต้องมีลิงก์ไปถังขยะ");
});

test("trash: พจนานุกรมต้องไม่ hardcode จำนวนวัน (ต้องดึงจากค่ากลาง)", () => {
  for (const locale of ["th", "en"]) {
    const source = sourceOf(`lib/i18n/messages/areas/${locale}/adminTrash.ts`);
    assert.ok(!source.includes(String(TRASH_RETENTION_DAYS)), `${locale}/adminTrash.ts ห้ามมีตัวเลขระยะเก็บ`);
    assert.ok(source.includes("{days}"), `${locale}/adminTrash.ts ต้องใช้ตัวเติม {days}`);
  }
});
