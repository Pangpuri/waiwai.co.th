import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import {
  MS_PER_DAY,
  SCHEDULE_MAX_AHEAD_DAYS,
  SCHEDULE_PAST_GRACE_MS,
  isDueAt,
  parseScheduleEpoch,
} from "@/lib/blocks/schedule";

/**
 * เทสต์ "ตั้งเวลาเผยแพร่" (X2.7 ส่วนที่ 1 · รอบที่ 100)
 *
 * สองชั้น
 *  1. **ตรรกะล้วน** (`lib/blocks/schedule.ts`) — happy path + edge case ของการอ่านค่าเวลา
 *  2. **สแกนซอร์สกันลืม** — จุดที่เคยพลาดจริงในโปรเจกต์นี้: เขียนเส้นทางที่สองขึ้นมาเอง,
 *     ลืมผูกตัวเรียกตามกำหนด, ลืมป้ายในพจนานุกรม, หรือเผลอ import `next/cache` ในไฟล์ที่ CLI ใช้
 *
 * ⚠️ รันได้โดยไม่ต้องมีฐานข้อมูล (อ่านไฟล์ + ตรรกะล้วน) · วงจรจริงกับ DB อยู่ใน `npm run check:db`
 */

const ROOT = join(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const NOW = new Date("2026-10-03T12:00:00.000Z");

function mustParse(raw: string, now: Date): Date {
  const parsed = parseScheduleEpoch(raw, now);
  assert.ok(parsed.ok, `ต้องอ่านค่าเวลาได้: ${raw}`);
  return parsed.at;
}

/* ── 1) ตรรกะล้วน ─────────────────────────────────────────────────────────── */

test("schedule: รับเวลาอนาคตที่ถูกต้อง และคืนเป็น UTC เดิม (ไม่เลื่อนเขตเวลา)", () => {
  const at = new Date(NOW.getTime() + 60 * 60 * 1000);
  assert.equal(mustParse(String(at.getTime()), NOW).toISOString(), at.toISOString());
});

test("schedule: ค่าว่าง/ไม่ใช่สตริง/ไม่ใช่จำนวนเต็มบวก = ใช้ไม่ได้", () => {
  assert.deepEqual(parseScheduleEpoch("", NOW), { ok: false, problem: "missing" });
  assert.deepEqual(parseScheduleEpoch("   ", NOW), { ok: false, problem: "missing" });
  assert.deepEqual(parseScheduleEpoch(undefined, NOW), { ok: false, problem: "missing" });
  assert.deepEqual(parseScheduleEpoch(null, NOW), { ok: false, problem: "missing" });
  /* เลขดิบ ๆ จาก JS (ไม่ใช่สตริงจากฟอร์ม) = ยังไม่ผ่าน */
  assert.deepEqual(parseScheduleEpoch(1_700_000_000_000, NOW), { ok: false, problem: "missing" });

  assert.deepEqual(parseScheduleEpoch("abc", NOW), { ok: false, problem: "invalid" });
  assert.deepEqual(parseScheduleEpoch("12.5", NOW), { ok: false, problem: "invalid" });
  assert.deepEqual(parseScheduleEpoch("-5", NOW), { ok: false, problem: "invalid" });
  assert.deepEqual(parseScheduleEpoch("0", NOW), { ok: false, problem: "invalid" });
  /* ไม่รับสัญกรณ์วิทยาศาสตร์ — กันค่าที่หลุดจาก Number() แบบหลวม ๆ */
  assert.deepEqual(parseScheduleEpoch("1e12", NOW), { ok: false, problem: "invalid" });
});

test("schedule: เวลาที่ผ่านมาแล้วถูกปฏิเสธ แต่ยอมเหลื่อม 1 นาที (กันการปัดนาทีของช่องเวลา)", () => {
  const tooOld = NOW.getTime() - SCHEDULE_PAST_GRACE_MS - 1000;
  assert.deepEqual(parseScheduleEpoch(String(tooOld), NOW), { ok: false, problem: "past" });

  const justInside = NOW.getTime() - SCHEDULE_PAST_GRACE_MS + 1000;
  assert.equal(mustParse(String(justInside), NOW).getTime(), justInside);
});

test("schedule: ไกลเกิน 1 ปีถูกปฏิเสธ (กันพิมพ์ปีผิดแล้วค้างไปตลอด)", () => {
  const limit = NOW.getTime() + SCHEDULE_MAX_AHEAD_DAYS * MS_PER_DAY;
  assert.equal(mustParse(String(limit), NOW).getTime(), limit);
  assert.deepEqual(parseScheduleEpoch(String(limit + 1000), NOW), { ok: false, problem: "too-far" });
});

test("schedule: isDueAt ตัดสินครบกำหนด และค่าที่อ่านไม่ได้ถือว่า 'ยังไม่ครบ'", () => {
  assert.equal(isDueAt(new Date(NOW.getTime() - 1), NOW), true);
  assert.equal(isDueAt(new Date(NOW.getTime()), NOW), true);
  assert.equal(isDueAt(new Date(NOW.getTime() + 1), NOW), false);
  assert.equal(isDueAt("2026-10-03T11:59:59.000Z", NOW), true);
  assert.equal(isDueAt("not-a-date", NOW), false);
});

/* ── 2) ชั้นข้อมูล: ที่เก็บ + ความปลอดภัยของการเผยแพร่ ─────────────────────── */

test("schedule: ที่เก็บกำหนดเวลาตรงกับ migration/schema (draft row · มีดัชนี)", () => {
  const migration = sourceOf("db/migrations/0014-scheduled-publish.sql");
  assert.ok(migration.includes("add column if not exists publish_at"), "migration ต้องเพิ่ม publish_at");
  assert.ok(migration.includes("add column if not exists scheduled_by"), "migration ต้องเพิ่ม scheduled_by");
  assert.ok(migration.includes("page_document_due_idx"), "ต้องมีดัชนีช่วยหางานครบกำหนด");

  /* schema.sql เป็นเอกสารอ้างอิง — ต้องไม่หลุดจาก migration */
  const schema = sourceOf("db/schema.sql");
  assert.ok(schema.includes("add column if not exists publish_at"), "schema.sql ต้องตรงกับ migration");
});

test("schedule: การเผยแพร่มีเส้นทางเดียว และ 'กดเผยแพร่เอง' ล้างกำหนดเวลาเดิม", () => {
  const repo = sourceOf("lib/blocks/repository.ts");

  /* ฉบับเผยแพร่ + ประวัติ ถูกเขียนที่เดียวเท่านั้น (ทั้งกดเองและตามกำหนดเรียกฟังก์ชันเดียวกัน) */
  assert.equal(
    repo.split("insert into page_document_revision").length - 1,
    1,
    "ต้องมีที่เขียนประวัติการเผยแพร่ที่เดียว (ห้ามแตกเส้นทางที่สอง)",
  );
  assert.ok(repo.includes("export async function publishDuePage("), "มีทางเผยแพร่ตามกำหนด");
  assert.ok(repo.includes("clearScheduleInTransaction(client, page)"), "กดเผยแพร่เองต้องล้างกำหนดเวลาเดิม");

  /* ยึดกำหนดเวลาแบบ atomic: อัปเดตเฉพาะแถวที่ยังครบกำหนด ⇒ รันพร้อมกันเผยแพร่หน้าละครั้งเดียว */
  assert.ok(
    repo.includes("publish_at is not null and publish_at <= $2::timestamptz"),
    "claim ต้องยึดเฉพาะแถวที่ครบกำหนดจริง (idempotent)",
  );
  /*
    ⚠️ กับดักที่เจอจากการยิง CLI จริง: `returning scheduled_by` ตรง ๆ จะได้ null (ค่าหลัง update)
    ⇒ ต้องคืนค่าจาก CTE `due` ที่อ่านมาก่อนล้าง
  */
  assert.ok(repo.includes("returning due.scheduled_by"), "ต้องอ่านค่า scheduled_by เดิมก่อนล้าง (returning คืนค่าหลัง update)");
});

test("schedule: ตัวเผยแพร่ตามกำหนดไม่แตะ next/cache ⇒ เรียกจาก CLI ได้", () => {
  const scheduler = sourceOf("lib/blocks/publish-scheduler.ts");
  assert.ok(!/from\s+"next\/cache"/.test(scheduler), "ไฟล์ที่สคริปต์ CLI ใช้ห้าม import next/cache");
  assert.ok(scheduler.includes('action: "publish-scheduled"'), "ต้องทิ้งร่องรอยใน audit log");
  assert.ok(scheduler.includes("export async function runScheduledPublish("), "มีตัวเรียกแบบกันลืม");
});

/* ── 3) หน้าจอ: แผงตั้งเวลา + ตัวเรียกครบทุกทาง ───────────────────────────── */

test("schedule: ตัวสร้างหน้าเว็บอ่านกำหนดเวลาและมีแผงตั้งค่า (ตั้ง/ยกเลิก ฟอร์มเดียว)", () => {
  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("readPublishSchedule(page)"), "หน้าจอต้องอ่านกำหนดเวลาจากฐานข้อมูล");
  assert.ok(page.includes("schedule={schedule}"), "ต้องส่งค่าลงแผงตั้งเวลา");

  const builder = sourceOf("features/admin/ui/block-builder.tsx");
  assert.ok(builder.includes("schedulePublishAction"), "แผงตั้งเวลาต้องเรียก Server Action");
  assert.ok(builder.includes('value="set"') && builder.includes('value="clear"'), "ต้องมีทั้งตั้งและยกเลิก");
  assert.ok(builder.includes('type="datetime-local"'), "ช่องเลือกเวลาต้องเป็นเวลาท้องถิ่นของผู้ใช้");

  const actions = sourceOf("app/admin/builder/actions.ts");
  assert.ok(actions.includes('requireAdminUser("content")'), "การตั้งเวลาเป็นการเผยแพร่เนื้อหา = สิทธิ์ content");
  assert.ok(actions.includes("setPublishSchedule("), "action ต้องเขียนกำหนดเวลาลงฐานข้อมูล");
  assert.ok(actions.includes("parseScheduleEpoch("), "action ต้องตรวจค่าที่ส่งมาก่อนใช้");
});

test("schedule: มีตัวเรียกครบ 3 ทาง (ล็อกอิน · ปุ่มบน /admin · สคริปต์ cron)", () => {
  const adminActions = sourceOf("app/admin/actions.ts");
  assert.ok(adminActions.includes("runScheduledPublish("), "ตอนล็อกอินต้องเป็นตาข่ายกันลืม");
  assert.ok(adminActions.includes("export async function publishScheduledNowAction"), "มี action สำหรับปุ่มบน /admin");
  assert.ok(adminActions.includes('requireAdminUser("content")'), "ปุ่มเผยแพร่ใช้สิทธิ์ content");

  const dashboard = sourceOf("app/admin/page.tsx");
  assert.ok(dashboard.includes("publishScheduledNowAction"), "การ์ดบน /admin ต้องมีปุ่มสั่งเผยแพร่");
  assert.ok(dashboard.includes("scheduledPublishOverview()"), "การ์ดต้องอ่านรายการที่ตั้งเวลาไว้");

  const pkg = sourceOf("package.json");
  assert.ok(pkg.includes('"db:publish-scheduled"'), "ต้องมีสคริปต์สำหรับ cron");
  assert.ok(sourceOf("scripts/publish-scheduled.ts").includes("publishDueScheduled("), "สคริปต์ต้องเรียกตัวเผยแพร่ตัวจริง");
});

/* ── 4) ข้อความ: ไม่มีรหัสดิบหลุดถึงผู้ใช้ ─────────────────────────────────── */

test("schedule: รหัสเหตุผลทุกตัวที่ action คืนได้ มีชนิดรองรับ (ไม่หลุดจากกัน)", () => {
  const actions = sourceOf("app/admin/builder/actions.ts");
  const state = sourceOf("features/admin/schedule-state.ts");

  /* สแกนเฉพาะฟังก์ชันของงานนี้ (ไฟล์เดียวกันมี action อื่นที่ใช้ชื่อฟิลด์ `problem` เหมือนกัน — เช่นการเทียบรุ่น) */
  const start = actions.indexOf("export async function schedulePublishAction");
  const end = actions.indexOf("export async function restoreRevisionAction");
  assert.ok(start >= 0 && end > start, "ไม่พบฟังก์ชัน schedulePublishAction ในไฟล์ action");

  const codes = [...actions.slice(start, end).matchAll(/problem: "([a-z-]+)"/g)].map((match) => match[1] ?? "");
  assert.ok(codes.length >= 3, `action ต้องคืนรหัสเหตุผลหลายกรณี (เจอ ${codes.length})`);

  for (const code of new Set(codes)) {
    assert.ok(state.includes(`"${code}"`), `รหัส "${code}" ไม่มีในชนิด ScheduleProblem`);
  }
});

test("schedule: ข้อความตั้งเวลามีครบทั้งไทยและอังกฤษ (รวมป้าย audit)", () => {
  for (const dict of [th.admin, en.admin]) {
    for (const value of [
      dict.scheduleTitle,
      dict.scheduleHint,
      dict.scheduleProblemPast,
      dict.scheduleProblemTooFar,
      dict.scheduleCardTitle,
      dict.schedulePublishNow,
      dict.auditPublishScheduled,
    ]) {
      assert.ok(value.trim().length > 0, "ข้อความตั้งเวลาต้องไม่ว่าง");
    }
  }
});
