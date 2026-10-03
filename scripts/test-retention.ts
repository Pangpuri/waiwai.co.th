import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { EMPTY_PAGE_SEO, type PageRecord } from "@/lib/pages/model";
import { CODE_ONLY_PAGE_PATHS } from "@/lib/pages/paths";
import { describeRetention, retentionPhrase } from "@/lib/retention/format";
import {
  FORM_RETENTION_CLASSES,
  LAZY_PURGE_INTERVAL_HOURS,
  LOG_RETENTION_CLASSES,
  PURGE_AUDIT_ACTION,
  RETENTION_CLASSES,
  RETENTION_DAYS,
  REVISIONS_KEPT_PER_PAGE,
  REVISION_RETENTION_CLASSES,
  cutoffFor,
  cutoffIsoFor,
  isExpired,
  nextPurgeDueAt,
  planPurge,
  retentionDaysFor,
  shouldRunPurge,
  summarizePurge,
  type RetentionClass,
} from "@/lib/retention/plan";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";

/**
 * เทสต์ X2b — ระยะเก็บข้อมูลส่วนบุคคล (PDPA)
 *
 * สองส่วนที่ต้องคุม
 * 1. **นโยบาย** (ระยะเวลา · เวลาตัด · ตัดสินใจว่าจะลบหรือยัง) — ตรรกะล้วน
 * 2. **การกันหลุดจากกัน**: หน้า `/privacy` ต้องประกาศเลขชุดเดียวกับที่ตัวลบใช้
 *    (ถ้าใครไปพิมพ์ "1 ปี" ไว้ในพจนานุกรม เอกสารสาธารณะจะไม่ตรงกับสิ่งที่ระบบทำจริง — เทสต์นี้จับได้)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) ตัวเลขตามมติผู้ใช้ (2026-10-03) ─────────────────────────────────────── */

test("retention: ระยะเวลาเก็บตรงตามมติผู้ใช้", () => {
  assert.equal(RETENTION_DAYS.contact, 365, "ติดต่อ = 1 ปี");
  assert.equal(RETENTION_DAYS.newsletter, 365, "ข่าวสาร = 1 ปี");
  assert.equal(RETENTION_DAYS.careers, 180, "ใบสมัครงาน = 6 เดือน");
  assert.equal(RETENTION_DAYS.loginAttempt, 30, "ร่องรอยล็อกอิน = 30 วัน (มติเดิม)");
  assert.equal(RETENTION_DAYS.auditLog, 90, "audit log = 90 วัน (มติ Q16)");
});

test("retention: รายการชั้นข้อมูลครบทุกคีย์ ไม่ซ้ำ และค่าที่ใช้ได้จริง", () => {
  const keys = Object.keys(RETENTION_DAYS) as RetentionClass[];
  assert.deepEqual([...RETENTION_CLASSES].sort(), [...keys].sort(), "RETENTION_CLASSES ต้องมีครบทุกชั้นข้อมูล");
  assert.equal(new Set(RETENTION_CLASSES).size, RETENTION_CLASSES.length, "ห้ามมีชั้นข้อมูลซ้ำ");

  for (const cls of RETENTION_CLASSES) {
    const days = retentionDaysFor(cls);
    assert.ok(Number.isInteger(days) && days >= 1, `${cls} ต้องเป็นจำนวนวันเต็มบวก`);
  }
});

/* ── 2) เวลาตัด / การหมดอายุ ────────────────────────────────────────────────── */

test("retention: เวลาตัดถอยหลังจากเวลาปัจจุบันตามจำนวนวันของชั้นนั้น", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");

  assert.equal(cutoffFor("contact", now).toISOString(), "2025-10-03T00:00:00.000Z");
  assert.equal(cutoffFor("careers", now).toISOString(), "2026-04-06T00:00:00.000Z");
  assert.equal(cutoffIsoFor("loginAttempt", now), "2026-09-03T00:00:00.000Z");
});

test("retention: isExpired ใช้ขอบเขต 'เก่ากว่าจุดตัด' เท่านั้น", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const cutoff = cutoffFor("careers", now);

  assert.equal(isExpired(new Date(cutoff.getTime() - 1), "careers", now), true, "เก่ากว่าจุดตัด 1 ms = หมดอายุ");
  assert.equal(isExpired(cutoff, "careers", now), false, "เท่าจุดตัดพอดี = ยังไม่หมดอายุ");
  assert.equal(isExpired(new Date(now.getTime() - 1000), "careers", now), false, "เพิ่งส่ง = ยังอยู่");
  assert.equal(isExpired("ไม่ใช่วันที่", "careers", now), false, "ค่าที่อ่านไม่ได้ = ไม่ลบ (ปลอดภัยกว่า)");
});

test("retention: planPurge ให้แผนครบทุกชั้น พร้อมเวลาตัดที่อ้างได้", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const plan = planPurge(now);

  assert.equal(plan.length, RETENTION_CLASSES.length);
  assert.deepEqual(
    plan.map((step) => step.cls),
    [...RETENTION_CLASSES],
  );

  for (const step of plan) {
    assert.equal(step.days, RETENTION_DAYS[step.cls]);
    assert.equal(step.cutoffIso, cutoffIsoFor(step.cls, now));
    assert.ok(Number.isFinite(new Date(step.cutoffIso).getTime()), `${step.cls}: cutoffIso ต้องเป็นวันที่จริง`);
  }
});

/* ── 3) ตัดสินใจว่าจะลบรอบนี้หรือยัง ─────────────────────────────────────────── */

test("retention: ไม่เคยลบ/ค่าเพี้ยน = ลบ (กันข้อมูลค้าง)", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");

  assert.equal(shouldRunPurge(null, now), true, "ไม่เคยลบ = ต้องลบ");
  assert.equal(shouldRunPurge("", now), true, "ค่าว่าง = ต้องลบ");
  assert.equal(shouldRunPurge("   ", now), true, "ช่องว่างล้วน = ต้องลบ");
  assert.equal(shouldRunPurge("ไม่ใช่วันที่", now), true, "อ่านวันที่ไม่ได้ = ต้องลบ");
});

test("retention: ลบไม่ถี่กว่า 24 ชม. และไม่ยิงซ้ำเมื่อนาฬิกาเพี้ยน", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const hoursAgo = (hours: number): string => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  assert.equal(shouldRunPurge(hoursAgo(1), now), false, "เพิ่งลบไป 1 ชม. = ยังไม่ต้องลบ");
  assert.equal(shouldRunPurge(hoursAgo(LAZY_PURGE_INTERVAL_HOURS - 1), now), false, "ยังไม่ครบกำหนด");
  assert.equal(shouldRunPurge(hoursAgo(LAZY_PURGE_INTERVAL_HOURS), now), true, "ครบ 24 ชม. = ลบได้");
  assert.equal(shouldRunPurge(hoursAgo(30), now), true, "30 ชม. = ลบได้");

  const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  assert.equal(shouldRunPurge(future, now), false, "เวลาอยู่ในอนาคต = ไม่ยิงซ้ำรัว ๆ");
});

test("retention: บอกรอบลบถัดไปได้ (null = ลบได้เดี๋ยวนี้)", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const last = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  assert.equal(nextPurgeDueAt(null), null);
  assert.equal(nextPurgeDueAt(""), null);
  assert.equal(nextPurgeDueAt("ไม่ใช่วันที่"), null);
  assert.equal(
    nextPurgeDueAt(last)?.toISOString(),
    new Date(new Date(last).getTime() + LAZY_PURGE_INTERVAL_HOURS * 60 * 60 * 1000).toISOString(),
  );
});

test("retention: สรุปผลลบสำหรับ audit log มีทุกชั้นข้อมูล", () => {
  const summary = summarizePurge({
    contact: 1,
    newsletter: 2,
    careers: 3,
    blockRevision: 6,
    contentRevision: 7,
    loginAttempt: 4,
    auditLog: 5,
  });
  assert.equal(summary, "contact=1 newsletter=2 careers=3 blockRevision=6 contentRevision=7 loginAttempt=4 auditLog=5");
  assert.ok(PURGE_AUDIT_ACTION.length > 0, "ต้องมีชื่อ action สำหรับบันทึก");
});

test("retention: ประวัติเนื้อหาเก็บ 1 ปี และต้องเก็บรุ่นล่าสุดของแต่ละหน้าไว้เสมอ", () => {
  /* มติรอบที่ 77 (ผู้ใช้เลือกเอง) */
  assert.equal(RETENTION_DAYS.blockRevision, 365);
  assert.equal(RETENTION_DAYS.contentRevision, 365);
  assert.ok(REVISIONS_KEPT_PER_PAGE >= 1, "ต้องเก็บรุ่นล่าสุดไว้เสมอ (ห้ามลบจนเกลี้ยง)");

  assert.deepEqual([...REVISION_RETENTION_CLASSES], ["blockRevision", "contentRevision"]);
  for (const cls of REVISION_RETENTION_CLASSES) {
    assert.ok(RETENTION_CLASSES.includes(cls), `${cls} ต้องอยู่ในรายการที่แสดงบนหน้าจอ`);
    /* ประวัติไม่ใช่ "ข้อมูลฟอร์ม" และไม่ใช่ "ร่องรอยเจ้าหน้าที่" — ห้ามถูกจัดกลุ่มผิด */
    assert.ok(!FORM_RETENTION_CLASSES.includes(cls), `${cls} ห้ามอยู่ในกลุ่มฟอร์ม`);
    assert.ok(!LOG_RETENTION_CLASSES.includes(cls), `${cls} ห้ามอยู่ในกลุ่มร่องรอยเจ้าหน้าที่`);
  }
});

/* ── 4) คำอธิบายระยะเวลาให้คนอ่าน ───────────────────────────────────────────── */

test("retention: เลือกหน่วยอ่านง่ายโดยไม่ปัดให้ดูสั้นกว่าเดิม", () => {
  assert.deepEqual(retentionPhrase(365), { count: 1, unit: "year" });
  assert.deepEqual(retentionPhrase(730), { count: 2, unit: "year" });
  assert.deepEqual(retentionPhrase(180), { count: 6, unit: "month" });
  assert.deepEqual(retentionPhrase(90), { count: 3, unit: "month" });
  assert.deepEqual(retentionPhrase(60), { count: 2, unit: "month" });
  /* 30 วันคงไว้เป็น "30 วัน" ไม่เรียกว่า "1 เดือน" (เดือนจริงไม่เท่ากับ 30 วันเสมอ) */
  assert.deepEqual(retentionPhrase(30), { count: 30, unit: "day" });
  assert.deepEqual(retentionPhrase(45), { count: 45, unit: "day" });
  assert.deepEqual(retentionPhrase(366), { count: 366, unit: "day" });
});

test("retention: คำอธิบายสองภาษาตรงกับตัวเลขที่ใช้จริง", () => {
  assert.equal(describeRetention(365, "th"), "1 ปี");
  assert.equal(describeRetention(180, "th"), "6 เดือน");
  assert.equal(describeRetention(90, "th"), "3 เดือน");
  assert.equal(describeRetention(30, "th"), "30 วัน");

  assert.equal(describeRetention(365, "en"), "1 year");
  assert.equal(describeRetention(180, "en"), "6 months");
  assert.equal(describeRetention(90, "en"), "3 months");
  assert.equal(describeRetention(30, "en"), "30 days");
});

test("retention: ค่าที่ไม่มีความหมายต้องโยน error ไม่ใช่ลบมั่ว", () => {
  assert.throws(() => retentionPhrase(0));
  assert.throws(() => retentionPhrase(-5));
  assert.throws(() => retentionPhrase(1.5));
  assert.throws(() => retentionPhrase(Number.NaN));
});

/* ── 5) กันหลุดจากกัน: หน้า /privacy ต้องใช้เลขชุดเดียวกับตัวลบ ───────────────── */

test("privacy: หน้าเว็บดึงระยะเก็บจากค่ากลาง ไม่ได้พิมพ์ตัวเลขเอง", () => {
  const page = sourceOf("app/[lang]/privacy/page.tsx");

  assert.ok(page.includes("@/lib/retention/plan"), "หน้าต้องอ้างค่ากลางของระยะเก็บ");
  assert.ok(page.includes("@/lib/retention/format"), "หน้าต้องใช้ตัวแปลงคำอธิบายระยะเวลา");
  assert.ok(page.includes("retentionDaysFor(cls)"), "หน้าต้องใช้จำนวนวันจากค่ากลาง");
  assert.ok(page.includes("RETENTION_CLASSES"), "หน้าต้องวนจากรายการชั้นข้อมูลกลาง");
});

test("privacy: พจนานุกรมต้องไม่ hardcode ตัวเลขระยะเก็บ (จะหลุดจากตัวลบ)", () => {
  for (const locale of ["th", "en"]) {
    const source = sourceOf(`lib/i18n/messages/areas/${locale}/privacy.ts`);
    for (const cls of RETENTION_CLASSES) {
      const days = String(RETENTION_DAYS[cls]);
      assert.ok(
        !source.includes(days),
        `${locale}/privacy.ts ห้ามมีตัวเลข "${days}" — ระยะเวลาต้องมาจาก lib/retention/plan.ts เท่านั้น`,
      );
    }
  }
});

test("privacy: ข้อความยินยอมของฟอร์มทั้งสามชี้ไปที่หน้านี้จริง", () => {
  /* ถ้าลิงก์ในพจนานุกรมเปลี่ยนที่ ต้องรู้ตัว — ผู้ใช้กดยินยอมแล้วต้องหานโยบายเจอ */
  assert.ok(CODE_ONLY_PAGE_PATHS.some((page) => page.path === "/privacy"), "ต้องมี /privacy ในรายการหน้าในโค้ด");
});

/* ── 6) sitemap ต้องมีหน้าด้านกฎหมาย ────────────────────────────────────────── */

test("privacy: sitemap มี /privacy ทั้งสองภาษา", () => {
  const home: PageRecord = {
    id: "home",
    nameTh: "หน้าแรก",
    nameEn: "Home",
    menuOrder: 10,
    inMenu: true,
    editor: "blocks",
    seo: EMPTY_PAGE_SEO,
  };

  const entries = buildSitemapEntries({
    siteUrl: "https://example.test/",
    pages: [home],
    locales: ["th", "en"],
  });

  const urls = entries.map((entry) => entry.url);
  assert.ok(urls.includes("https://example.test/th/privacy"), "ต้องมี /th/privacy");
  assert.ok(urls.includes("https://example.test/en/privacy"), "ต้องมี /en/privacy");

  const privacy = entries.filter((entry) => entry.url.endsWith("/privacy"));
  assert.equal(privacy.length, 2, "ต้องมีสองภาษาเท่านั้น (ไม่ซ้ำ)");
  for (const entry of privacy) {
    assert.equal(entry.changeFrequency, "yearly");
    assert.ok(entry.priority > 0 && entry.priority < 1, "ลำดับความสำคัญต้องอยู่ระหว่างกลาง ๆ");
  }

  /* หน้าแรกยังอยู่ครบ (การเพิ่มหน้าใหม่ต้องไม่ทำให้ของเดิมหาย) */
  assert.ok(urls.includes("https://example.test/th"), "หน้าแรกต้องยังอยู่ใน sitemap");
});

/* ── 7) ต่อสายจริง: ลบอัตโนมัติ + ปุ่มสั่งลบเอง + สคริปต์สำหรับ cron ───────────── */

test("retention: ล็อกอินสำเร็จแล้วลบตามรอบ (หลังบันทึก audit) และมีปุ่มสั่งลบเอง", () => {
  const actions = sourceOf("app/admin/actions.ts");

  assert.ok(actions.includes("runScheduledPurge("), "ต้องเรียกตัวลบตามรอบจาก Server Action");
  assert.ok(actions.includes("purgeRetentionNowAction"), "ต้องมี action ให้ผู้ดูแลกดลบเอง");
  assert.ok(actions.includes('requireAdminUser("retention")'), "action ที่ลบข้อมูลส่วนบุคคลต้องเป็นสิทธิ์ระดับผู้ดูแลระบบ (X1.10)");

  /* ลำดับ: บันทึก "ล็อกอินสำเร็จ" ก่อน แล้วจึงลบ — ไม่งั้นร่องรอยการเข้าใช้จะหายไปพร้อมข้อมูลเก่า */
  const auditIndex = actions.indexOf('action: "login-success"');
  const purgeIndex = actions.indexOf("runScheduledPurge(");
  assert.ok(auditIndex >= 0 && purgeIndex > auditIndex, "ต้องบันทึก audit ก่อน แล้วจึงลบตามระยะเก็บ");
});

test("retention: หน้าภาพรวมหลังบ้านแสดงตารางระยะเก็บและปุ่มลบ", () => {
  const page = sourceOf("app/admin/page.tsx");

  assert.ok(page.includes("retentionOverview("), "ต้องอ่านสถานะระยะเก็บมาแสดง");
  assert.ok(page.includes("purgeRetentionNowAction"), "ปุ่มลบต้องต่อกับ Server Action จริง");
  assert.ok(page.includes("describeRetention("), "ต้องใช้คำอธิบายระยะเวลาชุดเดียวกับหน้า /privacy");
});

test("retention: สคริปต์ db:purge มีไว้ตั้ง cron และไม่ฝังค่าเชื่อมต่อ", () => {
  const script = sourceOf("scripts/purge.ts");

  assert.ok(script.includes("--dry-run"), "ต้องมีโหมดไม่ลบจริงสำหรับตรวจก่อน");
  assert.ok(script.includes("isDatabaseConfigured"), "ต้องไม่ทำงานถ้าไม่มี DATABASE_URL");
  assert.ok(!script.includes("postgres://"), "ห้ามมี connection string ในโค้ด");
});
