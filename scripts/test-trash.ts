import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { TRASH_RETENTION_DAYS, RETENTION_CLASSES, trashCutoffFor } from "@/lib/retention/plan";
import { can } from "@/lib/auth/roles";
import {
  CONTENT_TRASH_KINDS,
  CONTENT_TRASH_SCREENS,
  TRASH_AUDIT_ACTIONS,
  TRASH_KINDS,
  TRASH_VIEW_KINDS,
  contentTrashTotal,
  daysLeftInTrash,
  emptyContentTrashCounts,
  emptyTrashCounts,
  isContentTrashKind,
  isTrashExpired,
  isTrashKind,
  isTrashViewKind,
  mergeTrashEntries,
  summarizeContentTrash,
  summarizeTrash,
  trashTotal,
  type TrashEntryLike,
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
  const required = actions.match(/await requireAdminUser\("[a-z]+"\)/g) ?? [];
  const exported = actions.match(/export async function/g) ?? [];
  assert.equal(exported.length, 4, "ต้องมี 4 action (กู้คืน · ลบถาวร · ล้างถัง · ลบตามกำหนด)");
  assert.equal(required.length, exported.length, "ทุก action ต้องตรวจสิทธิ์ก่อนทำงาน");
  /* รอบที่ 176: หน้าถังขยะรับ "ชนิดรวม" (เนื้อหาด้วย) ⇒ ต้องตรวจด้วย isTrashViewKind แล้วแยกทางที่ชั้นล่าง */
  assert.ok(actions.includes("isTrashViewKind(kind)"), "ต้องตรวจชนิดรวม (ครอบเนื้อหา) ก่อนแตะฐานข้อมูล");
  assert.ok(actions.includes("isTrashKind(kind)"), "ต้องยังแยกทางไป repository ของภาพ/พรีเซ็ต");

  const page = sourceOf("app/admin/trash/page.tsx");
  assert.ok(page.includes('requireAdminUser("trash")'), "หน้าถังขยะต้องมีสิทธิ์ถังขยะ (X1.10)");
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

test("trash: ตัวอย่างภาพของในถัง — ต้องล็อกอิน + มีสิทธิ์ถังขยะเท่านั้น (ปิดหนี้ รอบที่ 81 · เพิ่มสิทธิ์ X1.10)", () => {
  const route = sourceOf("app/admin/trash/thumbnail/[id]/route.ts");

  assert.ok(route.includes("getSessionUser()"), "ต้องตรวจเซสชันผู้ดูแล");
  assert.ok(route.includes('can(user.role, "trash")'), "ต้องตรวจสิทธิ์ถังขยะด้วย (ไม่ใช่แค่ล็อกอิน — X1.10)");
  assert.ok(route.includes("getTrashedMediaBinary"), "ต้องอ่านผ่านฟังก์ชันที่เจาะจงของในถัง");
  assert.ok(route.includes('dynamic = "force-dynamic"'), "ห้ามแคชตัวอย่างของในถัง");
  assert.ok(route.includes('"cache-control": "no-store"'), "ต้องไม่ให้แคช");
  assert.ok(route.includes('"x-content-type-options": "nosniff"'), "ต้องกันเบราว์เซอร์ตีความผิด");
  assert.ok(!route.includes('"content-disposition"'), "ไม่ต้องส่งชื่อไฟล์ออกไป");
  assert.ok(route.includes("user === null || !can(user.role"), "ไม่มีเซสชัน/สิทธิ์ไม่พอ = 404 (ไม่เปิดเผยว่ามีของในถัง)");

  /* ฝั่งสาธารณะต้องไม่เปลี่ยน: ของในถังยัง 404 */
  const publicRoute = sourceOf("app/media/[id]/route.ts");
  assert.ok(publicRoute.includes("getMediaBinary"), "เส้นทางสาธารณะใช้ตัวอ่านปกติ");
  assert.ok(!publicRoute.includes("getTrashedMediaBinary"), "ห้ามใช้ตัวอ่านของในถังบนเส้นทางสาธารณะ");

  const mediaRepo = sourceOf("lib/media/repository.ts");
  assert.ok(mediaRepo.includes("export async function getTrashedMediaBinary"), "ต้องมีตัวอ่านของในถัง");
  assert.ok(mediaRepo.includes("where id = $1 and deleted_at is not null"), "ตัวอ่านของในถังต้องกรองเฉพาะของในถัง");
  assert.ok(mediaRepo.includes("where id = $1 and deleted_at is null"), "ตัวอ่านปกติต้องไม่เห็นของในถัง");

  const list = sourceOf("features/admin/ui/trash-list.tsx");
  assert.ok(list.includes("/admin/trash/thumbnail/"), "หน้าถังขยะต้องแสดงตัวอย่างภาพ");
  assert.ok(list.includes('row.kind === "media"'), "แสดงตัวอย่างเฉพาะแถวที่เป็นภาพ");
});

/* ── 3) ถังขยะ "เนื้อหา" (รอบที่ 170) — สินค้า/เมนูอาหาร/ข่าว ─────────────────── */

test("trash-content: ชนิด/ยอด/สรุปของถังขยะเนื้อหา", () => {
  assert.deepEqual([...CONTENT_TRASH_KINDS], ["product", "recipe", "news"]);

  const counts = { product: 2, recipe: 1, news: 4 };
  assert.equal(contentTrashTotal(counts), 7);
  assert.equal(summarizeContentTrash(counts), "product=2 recipe=1 news=4");
  assert.equal(contentTrashTotal(emptyContentTrashCounts()), 0);
  assert.equal(summarizeContentTrash(emptyContentTrashCounts()), "product=0 recipe=0 news=0");

  /* ต้องเป็นคนละชุดกับถังขยะรวม (/admin/trash) — ของ 3 ชนิดนี้มีแท็บของตัวเอง */
  for (const kind of CONTENT_TRASH_KINDS) {
    assert.ok(!(TRASH_KINDS as readonly string[]).includes(kind), `${kind} ต้องไม่อยู่ใน TRASH_KINDS ของ /admin/trash`);
  }
});

test("trash-content: ตัวลบต้องมีประตู 'อยู่ในถังเท่านั้น' + ใช้เวลาตัดจากค่ากลาง + dryRun เส้นทางเดียว", () => {
  const content = sourceOf("lib/trash/content.ts");

  /* ประตูอยู่ที่ SQL — ของที่ยังใช้งานอยู่ต้องลบไม่ได้แม้เรียกฟังก์ชันตรง ๆ */
  const deletes = content.match(/delete from \$\{table\} where deleted_at is not null and deleted_at < \$1/g) ?? [];
  const counts = content.match(/select count\(\*\)::int as n from \$\{table\} where deleted_at is not null and deleted_at < \$1/g) ?? [];
  assert.equal(deletes.length, 1, "ต้องมีคำสั่งลบเดียวที่ครอบทุกชนิด");
  assert.equal(counts.length, 1, "dryRun ต้องใช้เงื่อนไขเดียวกับตอนลบจริง");
  assert.ok(content.includes("trashCutoffIsoFor"), "เวลาตัดต้องมาจาก lib/retention/plan.ts (ค่ากลางเดียว)");
  assert.ok(content.includes("recordAudit"), "การลบถาวรต้องมีร่องรอย");
  assert.ok(content.includes("if (!dryRun && total > 0)"), "dry run ต้องไม่บันทึก audit");
  assert.ok(content.includes("const table = CONTENT_TABLES[kind]"), "ชื่อตารางต้องมาจากค่าคงที่ (ไม่รับจากผู้ใช้)");
  assert.ok(content.includes("if (!isDatabaseConfigured()) return null"), "ไม่มี DB = คืน null ไม่โยน error");

  /* ตารางทั้งสามต้องมีจริงในสคีมาและมี deleted_at (รอบ 123/135/139) */
  const schema = sourceOf("db/schema.sql");
  for (const table of ["product", "recipe", "news"]) {
    assert.ok(schema.includes(`create table if not exists ${table} (`), `${table} ต้องมีในสคีมา`);
  }
});

test("trash-content: ตัวลบกลางต้องเรียกด้วย (cron/ล็อกอิน) ไม่ต้องมีคนกดเอง", () => {
  const purge = sourceOf("lib/retention/purge.ts");
  assert.ok(purge.includes("purgeExpiredContentTrash("), "ตัวลบกลางต้องเก็บกวาดถังขยะเนื้อหาด้วย");
  assert.ok(!purge.includes("delete from product"), "การลบถาวรต้องอยู่ใน lib/trash/content.ts ที่เดียว");

  const cli = sourceOf("scripts/purge.ts");
  assert.ok(cli.includes("purgeExpiredContentTrash("), "CLI db:purge ต้องรายงาน/ลบถังขยะเนื้อหาด้วย");
  assert.ok(cli.includes("summarizeContentTrash("), "ต้องสรุปผลลงรายงาน");

  /* ด่าน DB ต้องพิสูจน์วงจรจริง (ลบเฉพาะของพ้นกำหนด · cascade ส่วนผสม · คืนสภาพ) */
  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkContentTrashPurge"), "check:db ต้องมีวงจรถังขยะเนื้อหา");
  assert.ok(checkDb.includes("purgeExpiredContentTrash"), "ต้องพิสูจน์ตัวลบกับ DB จริง");
  assert.ok(checkDb.includes("product_ingredient where product_id"), "ต้องพิสูจน์ว่าส่วนผสมหายตามสินค้า (cascade)");

  /* สคีมาของ 3 ชนิดต้องมีดัชนีที่ใช้กรองของในถัง (ประสิทธิภาพตอนเก็บกวาด) */
  const schema = sourceOf("db/schema.sql");
  assert.ok(schema.includes("product_admin_idx"), "สินค้าต้องมีดัชนีของถังขยะ");
  assert.ok(schema.includes("recipe_admin_idx"), "เมนูอาหารต้องมีดัชนีของถังขยะ");
  assert.ok(schema.includes("news_admin_idx"), "ข่าวต้องมีดัชนีของถังขยะ");
});

/* ── 4) ดัชนีถังขยะเนื้อหา + ทางไปถึง (รอบที่ 175) ──────────────────────────────
 *
 * ที่มา: รอบที่ 174 ปิด "ลบถาวรของข่าว" แล้ว แต่ผู้ดูแลยัง **มองไม่เห็นจากที่เดียว** ว่าถังมีอะไรบ้าง
 * (การ์ด `/admin` นับแค่ภาพ/พรีเซ็ต) ⇒ รอบนี้เพิ่มตัวนับ + ทะเบียนลิงก์
 * เทสต์ชุดนี้กัน 3 เรื่องที่พังเงียบได้:
 *   1. ลิงก์พาไปแท็บที่ไม่มีจริง (เปลี่ยนชื่อแท็บแล้วลืมแก้)
 *   2. ชนิดหนึ่งไม่มีปุ่มลบถาวร / ลบได้แม้ของยังใช้งานอยู่ (ประตู SQL หาย)
 *   3. ตัวเติม `{placeholder}` ไม่ครบ ⇒ หน้าจอโชว์ `{chrome}` ดิบ ๆ ให้ผู้ใช้เห็น
 */

const CONTENT_SCREEN_FILES: Readonly<Record<string, string>> = {
  product: "app/admin/products/page.tsx",
  recipe: "app/admin/recipes/page.tsx",
  news: "app/admin/news/page.tsx",
};

const CONTENT_REPOSITORY_FILES: Readonly<Record<string, string>> = {
  product: "lib/products/repository.ts",
  recipe: "lib/recipes/repository.ts",
  news: "lib/news/repository.ts",
};

test("trash-content: ทะเบียนหน้าจอของถังขยะเนื้อหา — ครบทุกชนิด และชี้ไปแท็บที่มีจริง", () => {
  assert.deepEqual(
    Object.keys(CONTENT_TRASH_SCREENS).sort(),
    [...CONTENT_TRASH_KINDS].sort(),
    "ทุกชนิดต้องมีหน้าจอของตัวเอง (เพิ่มชนิดใหม่แล้วลืมใส่ = แดง)",
  );

  for (const kind of CONTENT_TRASH_KINDS) {
    const path = CONTENT_TRASH_SCREENS[kind];
    assert.ok(path.endsWith("?tab=trash"), `${kind}: ต้องชี้ไปแท็บถังขยะ (พบ ${path})`);

    const file = CONTENT_SCREEN_FILES[kind];
    assert.ok(file !== undefined, `${kind}: ต้องประกาศไฟล์หน้าจอในเทสต์ด้วย`);
    const source = sourceOf(file);

    /* แท็บต้องมีจริงในหน้าจอนั้น — ตรวจทั้งแบบ TAB_IDS และแบบเทียบสตริงตรง (products ใช้แบบหลัง) */
    const hasTabId = /\["all", "draft", "published", "trash"\]/.test(source) || source.includes('tab === "trash"');
    assert.ok(hasTabId, `${file}: ต้องรองรับแท็บ "trash"`);

    /* พาธฐานต้องตรงกับทะเบียนกลาง
       (products เขียนพาธเต็มที่รวม `?tab=trash` · recipes/news สร้างแท็บจาก `TAB_IDS`/`tabHref`
        ⇒ ตรวจพาธฐานพอ ส่วน "แท็บมีจริงไหม" ตรวจด้วย `hasTabId` ด้านบน) */
    const basePath = path.split("?")[0];
    assert.ok(source.includes(`"${basePath}"`), `${file}: ต้องมีพาธฐานตรงกับทะเบียนกลาง (${basePath})`);
  }
});

test("trash-content: ทุกชนิดมีปุ่มลบถาวร และประตู 'ต้องอยู่ในถัง' อยู่ที่ SQL", () => {
  for (const kind of CONTENT_TRASH_KINDS) {
    const pageFile = CONTENT_SCREEN_FILES[kind];
    assert.ok(pageFile !== undefined, `${kind}: ต้องประกาศไฟล์หน้าจอในเทสต์ด้วย`);
    const page = sourceOf(pageFile);
    const action = `delete${kind[0]?.toUpperCase()}${kind.slice(1)}ForeverAction`;
    assert.ok(page.includes(action), `${pageFile}: ต้องมีปุ่มลบถาวร (${action})`);

    /* ปุ่มต้องแสดงเฉพาะของในถัง (ไม่ให้ผู้ใช้กดลบของที่ยังใช้งานอยู่) */
    assert.ok(
      /item\.trashed \? \(|entry\.trashed \? \(/.test(page) || page.includes("trashed ?"),
      `${pageFile}: ปุ่มลบถาวรต้องผูกกับสถานะ "อยู่ในถัง"`,
    );

    const repoFile = CONTENT_REPOSITORY_FILES[kind];
    assert.ok(repoFile !== undefined, `${kind}: ต้องประกาศไฟล์ repository ในเทสต์ด้วย`);
    const repo = sourceOf(repoFile);
    const fn = `delete${kind[0]?.toUpperCase()}${kind.slice(1)}Forever`;
    assert.ok(repo.includes(fn), `${repoFile}: ต้องมี ${fn}()`);
    assert.ok(repo.includes(`and deleted_at is not null`), `${repoFile}: ${fn}() ต้องมีประตู "ต้องอยู่ในถัง" ที่ SQL`);
  }
});

test("trash-content: การ์ด /admin และหน้าถังขยะ ต้องโชว์ครบทุกชนิด + ลิงก์ไปถึง", () => {
  for (const file of ["app/admin/page.tsx", "app/admin/trash/page.tsx"]) {
    const source = sourceOf(file);
    assert.ok(source.includes("contentTrashStats("), `${file}: ต้องนับของในถังเนื้อหาด้วย`);
    assert.ok(source.includes("CONTENT_TRASH_SCREENS"), `${file}: ต้องลิงก์จากทะเบียนกลาง (ไม่พิมพ์พาธเอง)`);
    assert.ok(source.includes("CONTENT_TRASH_KINDS.map("), `${file}: ต้องวนทุกชนิด (เพิ่มชนิดใหม่แล้วโผล่เอง)`);
  }

  /* ยอดรวมบนการ์ดต้องรวมเนื้อหา (ไม่งั้นผู้ดูแลเห็น "ว่าง" ทั้งที่มีของ) */
  const overview = sourceOf("app/admin/page.tsx");
  assert.ok(overview.includes("trashTotalAll"), "การ์ดต้องมียอดรวมของทุกถัง ไม่ใช่แค่ภาพ/พรีเซ็ต");

  /* สิทธิ์: ใครที่เห็นการ์ด (trash ⊂ publisher) ต้องเข้าแท็บเนื้อหาทุกแท็บได้ (content ⊂ editor)
     ⇒ ไม่มีลิงก์ "กดแล้วเด้ง /admin/denied" (บทเรียนรอบที่ 85) */
  assert.ok(can("publisher", "trash"), "ผู้ที่เห็นการ์ดถังขยะคือ publisher ขึ้นไป");
  for (const permission of ["content", "media", "presets"] as const) {
    assert.ok(can("publisher", permission), `publisher ต้องมีสิทธิ์ ${permission} (เปิดหน้าจอที่ลิงก์ไปถึงได้)`);
  }
  assert.ok(!can("editor", "trash"), "editor ต้องไม่เห็นการ์ดถังขยะ (ตรวจสิทธิ์จริงฝั่งเซิร์ฟเวอร์อยู่ที่ requireAdminUser)");

  /* ด่าน DB ต้องพิสูจน์ตัวนับกับข้อมูลจริง */
  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkContentTrashStats"), "check:db ต้องมีวงจรตัวนับถังขยะเนื้อหา");
});

test("trash-content: ตัวเติม {placeholder} ต้องครบทั้ง TH/EN (กันหน้าจอโชว์ {chrome} ดิบ)", () => {
  const placeholders: Readonly<Record<string, readonly string[]>> = {
    trashStats: ["{media}", "{preset}", "{chrome}"],
    trashContentStats: ["{product}", "{recipe}", "{news}"],
  };

  for (const locale of ["th", "en"]) {
    const dictionary = sourceOf(`lib/i18n/messages/areas/${locale}/adminTrash.ts`);
    for (const [key, tokens] of Object.entries(placeholders)) {
      const match = dictionary.match(new RegExp(`${key}: "([^"]+)"`));
      assert.ok(match !== null, `${locale}/adminTrash.ts: ต้องมีคีย์ ${key}`);
      const body = match[1] ?? "";
      for (const token of tokens) {
        assert.ok(body.includes(token), `${locale}/${key} ต้องมี ${token}`);
      }
    }
  }

  /* ทุกจุดที่เติมคีย์นี้ต้องส่งค่าครบทุกตัว (ไม่งั้นผู้ใช้เห็นวงเล็บปีกกาค้างบนจอ) */
  for (const file of ["app/admin/page.tsx", "app/admin/trash/page.tsx"]) {
    const source = sourceOf(file);
    if (source.includes("strings.trashStats")) {
      for (const key of ["media:", "preset:", "chrome:"]) {
        assert.ok(source.includes(key), `${file}: fillTemplate(strings.trashStats) ต้องส่ง ${key}`);
      }
    }
    if (source.includes("strings.trashContentStats")) {
      for (const key of ["product:", "recipe:", "news:"]) {
        assert.ok(source.includes(key), `${file}: fillTemplate(strings.trashContentStats) ต้องส่ง ${key}`);
      }
    }
  }
});

/* ── 5) ตารางรวมที่ /admin/trash (รอบที่ 176) ───────────────────────────────────
 *
 * มติเจ้าของ: "เห็นและจัดการจากที่เดียว" ⇒ หน้าถังขยะแสดง 6 ชนิดในตารางเดียว
 * เทสต์ชุดนี้กัน 4 เรื่องที่พังเงียบได้:
 *   1. ชนิดรวมไม่ครบ/ซ้ำ ⇒ แถวบางชนิดกดแล้วไม่ทำงาน (หรือกดซ้ำไปโดนของผิดชนิด)
 *   2. merge ไม่นิ่งเมื่อเวลาซ้าย Migration ชนกัน ⇒ ตารางสลับตำแหน่งเองทุกครั้งที่เรนเดอร์
 *   3. คำสั่งของเนื้อหาหลงประตู `deleted_at is not null` ⇒ ลบของที่ยังใช้งานอยู่ได้
 *   4. ป้ายชนิด/คำเตือน "ลบทั้งหมด" หาย ⇒ ผู้ใช้กดลบทั้งถังโดยไม่รู้ว่าครอบเนื้อหาด้วย
 */

test("trash-view: ชนิดรวมครอบทั้งสองชุด ไม่ซ้ำ และตรวจค่าจากฟอร์มได้", () => {
  assert.deepEqual([...TRASH_VIEW_KINDS], ["media", "preset", "chromePreset", "product", "recipe", "news"]);
  assert.equal(new Set(TRASH_VIEW_KINDS).size, TRASH_VIEW_KINDS.length, "ชนิดรวมต้องไม่ซ้ำ");

  for (const kind of TRASH_KINDS) {
    assert.equal(isTrashViewKind(kind), true, `${kind} ต้องผ่านตัวตรวจรวม`);
  }
  for (const kind of CONTENT_TRASH_KINDS) {
    assert.equal(isTrashKind(kind), false, `${kind} ไม่ใช่ชนิดของถังรวม (คนละชุดโดยเจตนา)`);
    assert.equal(isContentTrashKind(kind), true, `${kind} ต้องผ่านตัวตรวจของเนื้อหา`);
    assert.equal(isTrashViewKind(kind), true, `${kind} ต้องผ่านตัวตรวจรวม (หน้าถังขยะรับค่านี้)`);
  }

  /* ค่าที่ไม่รู้จักต้องไม่ผ่าน — กันการยิงฟอร์มปลอมมาหาชนิดอื่น */
  for (const bad of ["", "MEDIA", "product ", " products", "products", "news; drop table news", "trash", "users"]) {
    assert.equal(isTrashViewKind(bad), false, `"${bad}" ต้องไม่ใช่ชนิดที่รู้จัก`);
  }
  assert.equal(isContentTrashKind("media"), false, "ภาพไม่ใช่ชนิดของเนื้อหา");
});

test("trash-view: mergeTrashEntries เรียงใหม่สุดก่อน · นิ่งเมื่อเวลาซ้ำ · ไม่แก้ของเดิม", () => {
  const rows: readonly TrashEntryLike[] = [
    {
      kind: "news",
      id: "n2",
      label: "ข่าว",
      detail: null,
      sizeBytes: null,
      deletedAt: "2026-10-01T00:00:00.000Z",
      deletedBy: null,
    },
    {
      kind: "media",
      id: "m1",
      label: "ภาพ",
      detail: "image/webp",
      sizeBytes: 1024,
      deletedAt: "2026-10-03T00:00:00.000Z",
      deletedBy: "a@example.invalid",
    },
    {
      kind: "product",
      id: "p1",
      label: "สินค้า",
      detail: null,
      sizeBytes: null,
      deletedAt: "2026-10-03T00:00:00.000Z",
      deletedBy: null,
    },
  ];

  const merged = mergeTrashEntries(rows);
  assert.equal(merged.length, 3, "ต้องครบทุกแถว");
  assert.equal(merged[0]?.deletedAt, "2026-10-03T00:00:00.000Z", "ใหม่สุดต้องอยู่บน");
  /* สองแถวเวลาซ้ำ ⇒ เรียงด้วย kind (media < product) ให้ผลนิ่งทุกครั้ง */
  assert.deepEqual(merged.map((row) => row.kind), ["media", "product", "news"], "ลำดับต้องนิ่ง: ใหม่→เก่า แล้วตัดสินด้วย kind");

  /* pure: ไม่แก้ลิสต์ที่ส่งเข้ามา และเรียกซ้ำได้ผลเท่าเดิม */
  assert.equal(rows[0]?.kind, "news", "ห้ามแก้ลิสต์ต้นทาง");
  assert.deepEqual(mergeTrashEntries(rows), merged, "เรียกซ้ำต้องได้ผลเดิม (นิ่ง)");
  assert.deepEqual(mergeTrashEntries([]), [], "ไม่มีของ ⇒ ว่าง ไม่โยน error");
});

test("trash-view: คำสั่งของเนื้อหามีประตู 'อยู่ในถังเท่านั้น' และไม่รับชื่อตารางจากผู้ใช้", () => {
  const content = sourceOf("lib/trash/content.ts");

  assert.ok(content.includes("export async function listContentTrash"), "ต้องมีตัวอ่านรายการของในถังเนื้อหา");
  for (const guard of [
    "where deleted_at is not null", // listContentTrash
    "where id = $1 and deleted_at is not null", // restore + delete ถาวร
    "delete from ${CONTENT_TABLES[kind]} where deleted_at is not null", // ลบทั้งถังของเนื้อหา
  ]) {
    assert.ok(content.includes(guard), `ต้องมีประตู SQL: ${guard}`);
  }

  assert.ok(content.includes("const CONTENT_TABLES"), "ชื่อตารางต้องมาจากค่าคงที่ (ไม่รับจากฟอร์ม)");
  assert.ok(content.includes("recordAudit"), "กู้คืน/ลบถาวรต้องมีร่องรอยใน audit log");
  assert.ok(content.includes("if (!isDatabaseConfigured()) return []"), "ไม่มี DB = คืน [] ไม่โยน error");

  /* actions ต้องเรียกตัวของเนื้อหา (ไม่ใช่ยัด logic ไว้ในไฟล์ action) */
  const actions = sourceOf("app/admin/trash/actions.ts");
  for (const fn of ["restoreContentTrashItem(", "deleteContentTrashItemPermanently(", "emptyContentTrash("]) {
    assert.ok(actions.includes(fn), `action ต้องเรียก ${fn}`);
  }
  assert.ok(actions.includes("revalidatePath(path)"), "ต้อง revalidate แท็บถังขยะของจอเนื้อหาด้วย");
});

test("trash-view: ตารางรวม + ป้ายชนิดครบ 6 + คำเตือนก่อนกดลบทั้งถัง", () => {
  const page = sourceOf("app/admin/trash/page.tsx");
  assert.ok(page.includes("listContentTrash("), "หน้าถังขยะต้องดึงรายการเนื้อหาด้วย");
  assert.ok(page.includes("mergeTrashEntries("), "ต้องรวมเป็นตารางเดียว");
  assert.ok(page.includes("daysLeftInTrash("), "แถวเนื้อหาต้องมีเวลาก่อนลบถาวรเหมือนภาพ/พรีเซ็ต");
  assert.equal(page.match(/listContentTrash\(\)/g)?.length, 1, "ต้องอ่านเนื้อหาครั้งเดียว (ไม่ยิงคิวรีซ้ำ)");

  const list = sourceOf("features/admin/ui/trash-list.tsx");
  for (const key of [
    "trashKindMedia",
    "trashKindPreset",
    "trashKindChromePreset",
    "trashKindProduct",
    "trashKindRecipe",
    "trashKindNews",
  ]) {
    assert.ok(list.includes(key), `ป้ายชนิดต้องมีครบทั้ง 6 (${key})`);
  }
  assert.ok(list.includes("trashEmptyIncludesContent"), "ปุ่มลบทั้งหมดต้องเตือนว่าครอบเนื้อหาด้วย");
  assert.ok(!list.includes("dangerouslySetInnerHTML"), "ห้ามฝัง HTML ดิบในตารางถังขยะ");

  /* พจนานุกรมต้องมีคีย์ครบทั้งสองภาษา (ด่าน check:i18n ตรวจคู่กันอยู่แล้ว — ย้ำที่ระดับนี้ด้วย) */
  for (const locale of ["th", "en"]) {
    const dictionary = sourceOf(`lib/i18n/messages/areas/${locale}/adminTrash.ts`);
    for (const key of ["trashKindProduct", "trashKindRecipe", "trashKindNews", "trashEmptyIncludesContent", "trashTableHint"]) {
      assert.ok(dictionary.includes(`${key}:`), `${locale}/adminTrash.ts ต้องมีคีย์ ${key}`);
    }
  }

  /* ด่าน DB ต้องพิสูจน์วงจรจริงของตารางรวม */
  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkContentTrashTable"), "check:db ต้องมีวงจรตารางรวมถังขยะ");
  assert.ok(checkDb.includes("restoreContentTrashItem("), "ต้องพิสูจน์กู้คืนจากตารางรวมกับ DB จริง");
  assert.ok(checkDb.includes("deleteContentTrashItemPermanently("), "ต้องพิสูจน์ลบถาวรจากตารางรวมกับ DB จริง");
});

/* ── 6) ปิดหนี้รอบ 176: ประตูสองทาง + `deleted_by` ของเนื้อหา (รอบที่ 177) ──────
 *
 * เดิม `setProductTrashed/setRecipeTrashed/setNewsTrashed` เป็น `update ... where id = $1`
 * ⇒ "กู้คืน" ของที่ยังใช้งานอยู่ก็เข้าเงื่อนไข (ไม่มีอะไรเสียหาย แต่ประตูไม่ได้อยู่ที่ SQL ตามหลักโปรเจกต์)
 * และตารางเนื้อหาไม่มี `deleted_by` ⇒ หน้าถังขยะโชว์ "ทำโดย" จาก `updated_by` (เปลี่ยนได้ถ้ามีคนแก้ของในถัง)
 */

const CONTENT_TRASH_WRITERS: readonly { readonly file: string; readonly fn: string; readonly table: string }[] = [
  { file: "lib/products/repository.ts", fn: "setProductTrashed", table: "product" },
  { file: "lib/recipes/repository.ts", fn: "setRecipeTrashed", table: "recipe" },
  { file: "lib/news/repository.ts", fn: "setNewsTrashed", table: "news" },
];

test("trash-guard: ทั้ง 3 ตารางมีประตูสองทางที่ SQL + บันทึก deleted_by เป็นคู่กัน", () => {
  for (const { file, fn, table } of CONTENT_TRASH_WRITERS) {
    const source = sourceOf(file);

    assert.ok(source.includes(`export async function ${fn}`), `${file}: ต้องมี ${fn}()`);
    assert.ok(
      source.includes(`export async function ${fn}(id: string, trashed: boolean, actor: string): Promise<boolean>`),
      `${file}: ${fn}() ต้องคืน boolean (ผู้เรียกต้องรู้ว่าสำเร็จไหม)`,
    );

    /* ประตูเลือกจากสองสตริงคงที่ ⇒ ไม่มีค่าจากผู้ใช้ใน SQL */
    assert.ok(
      source.includes('const guard = trashed ? "deleted_at is null" : "deleted_at is not null";'),
      `${file}: ต้องมี guard สองทางแบบสตริงคงที่`,
    );
    assert.ok(source.includes("where id = $1 and ${guard}"), `${file}: SQL ต้องใช้ ${'${guard}'} ในเงื่อนไข`);

    /* deleted_at กับ deleted_by ต้องถูกตั้ง/ล้างพร้อมกัน */
    assert.ok(source.includes("deleted_at = case when $2 then now() else null end"), `${file}: ต้องตั้ง deleted_at ตามทิศทาง`);
    assert.ok(
      source.includes("deleted_by = case when $2 then $3 else null end"),
      `${file}: ต้องตั้ง/ล้าง deleted_by พร้อมกับ deleted_at`,
    );
    assert.ok(source.includes(`update ${table}`), `${file}: ต้องอัปเดตตาราง ${table} ของตัวเอง`);
  }

  /* listContentTrash: อ่าน deleted_by เป็นหลัก — ถอยไป updated_by เฉพาะแถวที่ลบก่อน migration */
  const content = sourceOf("lib/trash/content.ts");
  assert.ok(
    content.includes("coalesce(deleted_by, updated_by) as deleted_by"),
    "ตารางรวมต้องอ่าน deleted_by เป็นหลัก (ถอยไป updated_by เฉพาะของเก่า)",
  );
  assert.ok(
    !/deletedBy: row\.updated_by/.test(content),
    "ห้ามใช้ updated_by ตรง ๆ (จะโชว์ชื่อคนแก้แทนคนลบ — เคสจริงที่ทำให้ต้องเพิ่มคอลัมน์)",
  );
});

test("trash-guard: migration 0026 เพิ่ม deleted_by ให้ 3 ตาราง + backfill ที่รันซ้ำได้", () => {
  const migration = sourceOf("db/migrations/0026-content-deleted-by.sql");

  for (const table of ["product", "recipe", "news"]) {
    assert.ok(
      migration.includes(`alter table ${table} add column if not exists deleted_by text;`),
      `migration ต้องเพิ่ม ${table}.deleted_by แบบ idempotent`,
    );
    assert.ok(
      migration.includes(`update ${table} set deleted_by = updated_by where deleted_at is not null and deleted_by is null;`),
      `migration ต้องเติมค่าย้อนหลังของ ${table} แบบมีเงื่อนไข (รันซ้ำไม่มีผล)`,
    );
  }
  assert.ok(migration.includes("idempotent: conditional-update"), "ต้องประกาศกลไกกันรันซ้ำตามกติกาด่าน migration");

  /* เอกสารอ้างอิง (schema.sql) ต้องตรงกับของจริง — ไม่ปล่อยให้เอกสารหลุด */
  const schema = sourceOf("db/schema.sql");
  const columns = schema.match(/deleted_by +text/g) ?? [];
  assert.ok(columns.length >= 6, `schema.sql ต้องมี deleted_by ครบทุกตารางที่มีถังขยะ (พบ ${columns.length} ที่)`);
  assert.ok(schema.includes("0026"), "schema.sql ต้องอ้างเลข migration ที่เพิ่มคอลัมน์นี้");

  /* ด่าน DB ต้องพิสูจน์วงจรจริงของประตูสองทาง */
  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkContentTrashGuard"), "check:db ต้องมีวงจรประตูสองทาง");
  assert.ok(
    checkDb.includes("ย้ายเข้าถังซ้ำต้องไม่สำเร็จ"),
    "ต้องพิสูจน์ว่าย้ายเข้าซ้ำไม่ทับเวลาที่ลบเดิม/ชื่อคนเดิม",
  );
});
