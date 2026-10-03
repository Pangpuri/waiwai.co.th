import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { EMPTY_PAGE_SEO, type PageRecord } from "@/lib/pages/model";
import { PREVIEWABLE_PAGE_IDS, isPreviewablePage } from "@/lib/pages/paths";
import {
  PREVIEW_LINK_AUDIT_ACTIONS,
  PREVIEW_LINK_KEEP_DAYS,
  PREVIEW_LINK_MAX_ACTIVE,
  PREVIEW_LINK_TTL_HOURS,
  PREVIEW_TOKEN_BYTES,
  canCreateMoreLinks,
  hoursLeftInPreviewLink,
  isPreviewLinkExpired,
  isPreviewTokenShape,
  previewLinkCleanupCutoff,
  previewLinkPath,
  previewLinkStatus,
} from "@/lib/preview-link/plan";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";

/**
 * เทสต์ X2.6 — ลิงก์พรีวิวชั่วคราว (ให้ผู้จัดการดูฉบับร่างโดยไม่ต้องมีบัญชี)
 *
 * จุดที่ต้องคุมให้แน่น (เพราะลิงก์นี้ **ไม่ต้องล็อกอิน**)
 * 1. **ความลับของโทเคน**: เก็บแค่ hash · ตรวจรูปแบบก่อนคิวรี · ไม่โผล่ใน audit/ลิสต์
 * 2. **หมดอายุ/ยกเลิก**: ตรวจที่เซิร์ฟเวอร์ทุกครั้ง · ขอบเขตเวลาไม่กำกวม
 * 3. **ห้ามถูกจัดทำดัชนี/แคช**: noindex + `x-robots-tag` + `force-dynamic` + ไม่อยู่ใน sitemap
 * 4. **จำกัดสิทธิ์**: สร้างได้เฉพาะหน้าที่อยู่ในรายการที่พรีวิวได้ · ตัวสร้างต้องล็อกอิน
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) นโยบาย: อายุ · เพดาน · การหมดอายุ ─────────────────────────────────────── */

test("preview-link: อายุ 24 ชั่วโมง และเวลาหมดอายุคำนวณจากค่ากลาง", () => {
  assert.equal(PREVIEW_LINK_TTL_HOURS, 24, "มติรอบที่ 79: ลิงก์อายุสั้น 24 ชม.");
  assert.ok(PREVIEW_LINK_MAX_ACTIVE >= 1, "ต้องมีเพดานลิงก์ที่ยังใช้ได้");
  assert.ok(PREVIEW_LINK_KEEP_DAYS >= 1, "ต้องมีอายุเก็บกวาดหลังปิดลิงก์");
  assert.equal(PREVIEW_TOKEN_BYTES, 32, "โทเคน 32 ไบต์ (เดาไม่ได้)");
});

test("preview-link: หมดอายุใช้ขอบเขต 'ถึงเวลาแล้ว = ปิดทันที' + ค่าที่อ่านไม่ได้ = ปิด", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  const at = (iso: string): string => iso;

  assert.equal(isPreviewLinkExpired("2026-10-03T12:00:00.001Z", now), false, "ยังไม่ถึงเวลา = ใช้ได้");
  assert.equal(isPreviewLinkExpired("2026-10-03T12:00:00.000Z", now), true, "เท่าเวลาพอดี = ปิด (ต่างจากระยะเก็บข้อมูล)");
  assert.equal(isPreviewLinkExpired("2026-10-03T11:59:59.999Z", now), true, "ผ่านไปแล้ว = ปิด");

  /* ค่าที่อ่านไม่ได้ → ถือว่าหมดอายุ (fail-closed เพราะลิงก์คือสิทธิ์เข้าถึง) */
  assert.equal(isPreviewLinkExpired(null, now), true);
  assert.equal(isPreviewLinkExpired("", now), true);
  assert.equal(isPreviewLinkExpired("   ", now), true);
  assert.equal(isPreviewLinkExpired("ไม่ใช่วันที่", now), true);

  assert.equal(hoursLeftInPreviewLink(at("2026-10-03T13:00:00.000Z"), now), 1);
  assert.equal(hoursLeftInPreviewLink(at("2026-10-04T11:00:00.000Z"), now), 23, "ปัดขึ้น ⇒ ไม่บอกว่าหมดก่อนเวลา");
  assert.equal(hoursLeftInPreviewLink(at("2026-10-03T12:00:00.000Z"), now), 0);
  assert.equal(hoursLeftInPreviewLink(at("ไม่ใช่วันที่"), now), 0);
});

test("preview-link: สถานะที่ผู้ดูแลเห็น — ยกเลิกมาก่อนหมดอายุเสมอ", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  const future = "2026-10-04T12:00:00.000Z";
  const past = "2026-10-02T12:00:00.000Z";

  assert.equal(previewLinkStatus({ expiresAt: future, revokedAt: null }, now), "active");
  assert.equal(previewLinkStatus({ expiresAt: past, revokedAt: null }, now), "expired");
  assert.equal(previewLinkStatus({ expiresAt: future, revokedAt: past }, now), "revoked");
  assert.equal(previewLinkStatus({ expiresAt: past, revokedAt: past }, now), "revoked", "ยกเลิกต้องบอกว่ายกเลิก");
  assert.equal(previewLinkStatus({ expiresAt: future, revokedAt: "" }, now), "active", "ค่าว่าง = ยังไม่ยกเลิก");
});

test("preview-link: รูปแบบโทเคนเข้มพอ และค่าขยะไม่ผ่าน", () => {
  assert.equal(isPreviewTokenShape("a".repeat(43)), true, "base64url 43 ตัว = ผ่าน");

  for (const bad of ["", "a".repeat(42), "a".repeat(44), "a".repeat(42) + "/", "โทเคนภาษาไทย", "has space".padEnd(43, "a")]) {
    assert.equal(isPreviewTokenShape(bad), false, `"${bad.slice(0, 12)}…" ต้องไม่ผ่าน`);
  }
});

test("preview-link: เพดานลิงก์ที่ยังใช้ได้ และพาธพรีวิว", () => {
  assert.equal(canCreateMoreLinks(0), true);
  assert.equal(canCreateMoreLinks(PREVIEW_LINK_MAX_ACTIVE - 1), true);
  assert.equal(canCreateMoreLinks(PREVIEW_LINK_MAX_ACTIVE), false);

  assert.equal(previewLinkPath("th", "T"), "/th/preview/t/T");
  assert.equal(previewLinkPath("en", "T"), "/en/preview/t/T");
});

test("preview-link: เวลาตัดเก็บกวาดถอยหลังจากตอนนี้ตามอายุเก็บ", () => {
  const now = new Date("2026-10-03T00:00:00.000Z");
  const cutoff = previewLinkCleanupCutoff(now);
  assert.equal(cutoff.toISOString(), new Date(now.getTime() - PREVIEW_LINK_KEEP_DAYS * 86_400_000).toISOString());
});

/* ── 2) ความลับของโทเคน ──────────────────────────────────────────────────────── */

test("preview-link: ฐานข้อมูลเก็บเฉพาะ hash และไม่คืนโทเคน/hash ออกไปที่หน้าจอ", () => {
  const repo = sourceOf("lib/preview-link/repository.ts");

  assert.ok(repo.includes("createHash(\"sha256\")"), "ต้อง hash โทเคนก่อนเก็บ");
  assert.ok(repo.includes("hashPreviewToken(token)"), "insert ต้องใช้ค่า hash");
  assert.ok(!/insert into preview_link[\s\S]{0,200}\bvalues\b\s*\([^)]*\btoken\b/.test(repo), "ห้าม insert โทเคนดิบ");

  /* รายการที่ส่งให้หน้าจอต้องไม่มีคอลัมน์โทเคน/hash */
  const select = repo.slice(repo.indexOf("select id, page, expires_at"), repo.indexOf("order by created_at desc"));
  assert.ok(!select.includes("token_hash"), "รายการที่แสดงต้องไม่ดึง token_hash");
  assert.ok(!select.includes("token,"), "รายการที่แสดงต้องไม่ดึงโทเคน");

  /* audit ต้องไม่เก็บโทเคน */
  assert.ok(repo.includes("ห้ามเขียนโทเคนลง audit"), "ต้องมีข้อเตือนในโค้ดเรื่อง audit");
  assert.ok(!/detail:.*\$\{token\}/.test(repo), "ห้ามเอาโทเคนไปใส่ detail ของ audit");
});

test("preview-link: ตรวจรูปทรงโทเคนก่อนแตะฐานข้อมูลทั้งสองฝั่ง", () => {
  const repo = sourceOf("lib/preview-link/repository.ts");
  assert.ok(repo.includes("isPreviewTokenShape(token)"), "ตัวอ่านต้องตรวจรูปแบบก่อนคิวรี");

  const route = sourceOf("app/[lang]/preview/t/[token]/page.tsx");
  assert.ok(route.includes("isPreviewTokenShape(token)"), "เส้นทางสาธารณะต้องตรวจรูปแบบก่อนเช่นกัน");
});

/* ── 3) ห้ามถูกจัดทำดัชนี/แคช ────────────────────────────────────────────────── */

test("preview-link: หน้าลิงก์ต้อง dynamic + noindex + ไม่มีใน sitemap", () => {
  const route = sourceOf("app/[lang]/preview/t/[token]/page.tsx");

  assert.ok(route.includes('export const dynamic = "force-dynamic"'), "ห้าม prerender/แคชหน้าโทเคน");
  assert.ok(route.includes("robots: { index: false, follow: false }"), "ต้องสั่ง noindex ที่ metadata");
  assert.ok(route.includes("resolvePreviewLink("), "ต้องตรวจสิทธิ์จากฐานข้อมูล ไม่ใช่จาก URL อย่างเดียว");
  assert.ok(route.includes("notFound()"), "ใช้ไม่ได้ทุกกรณี = 404");

  /* ไม่อยู่ใน sitemap — ตรวจจากตัวสร้างจริง (ไม่ใช่เดาจากซอร์ส) */
  const home: PageRecord = {
    id: "home",
    nameTh: "หน้าแรก",
    nameEn: "Home",
    menuOrder: 10,
    inMenu: true,
    editor: "blocks",
    seo: EMPTY_PAGE_SEO,
  };
  const entries = buildSitemapEntries({ siteUrl: "https://example.test/", pages: [home], locales: ["th", "en"] });
  for (const entry of entries) {
    assert.ok(!entry.url.includes("/preview"), `sitemap ห้ามมีพรีวิว (พบ ${entry.url})`);
  }

  /* ส่วนหัวกันเครื่องค้นหา ตั้งที่ next.config (ชั้นที่สอง กันลืมตั้ง metadata) */
  const config = sourceOf("next.config.ts");
  assert.ok(config.includes("X-Robots-Tag"), "ต้องสั่ง x-robots-tag ที่ระดับ header ด้วย");
  assert.ok(config.includes("preview/:path*"), "กฎ header ต้องครอบเส้นทางพรีวิว");
  const previewRuleIndex = config.indexOf("preview/:path*");
  const catchAllIndex = config.indexOf('source: "/(.*)"');
  assert.ok(previewRuleIndex >= 0 && previewRuleIndex < catchAllIndex, "กฎพรีวิวต้องอยู่ก่อนกฎ catch-all");
});

/* ── 4) สิทธิ์และขอบเขต ──────────────────────────────────────────────────────── */

test("preview-link: ตัวสร้างต้องล็อกอิน และสร้างได้เฉพาะหน้าที่อนุญาต", () => {
  const actions = sourceOf("app/admin/preview-links/actions.ts");

  const required = actions.match(/await requireAdminUser\(\)/g) ?? [];
  const exported = actions.match(/export async function/g) ?? [];
  assert.equal(exported.length, 2, "ต้องมี 2 action (สร้าง · ยกเลิก)");
  assert.equal(required.length, exported.length, "ทุก action ต้องตรวจสิทธิ์ก่อนทำงาน");
  assert.ok(actions.includes("isPreviewablePage(page)"), "ต้องตรวจว่าหน้านั้นพรีวิวได้");
  assert.ok(actions.includes("isLocale(locale)"), "ต้องตรวจภาษาก่อนสร้างพาธ");

  const page = sourceOf("app/admin/preview-links/page.tsx");
  assert.ok(page.includes("requireAdminUser()"), "หน้าจอต้องล็อกอินก่อน");
  assert.ok(page.includes("PREVIEW_LINK_TTL_HOURS"), "หน้าจอต้องบอกอายุจากค่ากลาง (ไม่พิมพ์เลขเอง)");
  assert.ok(page.includes("PREVIEW_LINK_MAX_ACTIVE"), "หน้าจอต้องใช้เพดานจากค่ากลาง");
});

test("preview-link: รายการหน้าที่พรีวิวได้เป็นแหล่งเดียว และพรีวิวในหลังบ้านใช้ร่วมกัน", () => {
  assert.ok(PREVIEWABLE_PAGE_IDS.includes("home"), "หน้าแรกต้องพรีวิวได้");
  assert.equal(isPreviewablePage("home"), true);
  assert.equal(isPreviewablePage("privacy"), false, "หน้าที่ไม่มีเอกสารบล็อกต้องไม่พรีวิวได้");

  const adminPreview = sourceOf("app/[lang]/preview/[page]/page.tsx");
  assert.ok(adminPreview.includes("isPreviewablePage(page)"), "พรีวิวในหลังบ้านต้องใช้รายการกลาง");
  assert.ok(!adminPreview.includes("PREVIEWABLE_PAGES"), "ห้ามมีรายการซ้ำในไฟล์หน้า");
});

test("preview-link: เก็บกวาดโดยตัวลบกลาง (ไม่ต้องมีคนกดเอง)", () => {
  const purge = sourceOf("lib/retention/purge.ts");
  assert.ok(purge.includes("purgeExpiredPreviewLinks("), "ตัวลบกลางต้องเก็บกวาดลิงก์ที่ปิดแล้ว");

  const repo = sourceOf("lib/preview-link/repository.ts");
  assert.ok(repo.includes("previewLinkCleanupCutoff"), "ต้องใช้อายุเก็บจากค่ากลาง");
  assert.ok(repo.includes("revoked_at is not null or expires_at <= $1"), "ต้องเก็บกวาดเฉพาะลิงก์ที่ปิดแล้ว");

  const actions = Object.values(PREVIEW_LINK_AUDIT_ACTIONS);
  assert.equal(new Set(actions).size, actions.length, "ชื่อ action ต้องไม่ซ้ำ");
  for (const action of actions) assert.ok(action.startsWith("preview-link-"), `action "${action}" ต้องขึ้นต้นด้วย preview-link-`);
});

test("preview-link: สคีมาและด่าน DB", () => {
  const migration = sourceOf("db/migrations/0009-preview-link.sql");

  assert.ok(migration.includes("token_hash   text        not null unique"), "ต้องมี hash แบบ unique");
  assert.ok(migration.includes("expires_at   timestamptz not null"), "ต้องมีวันหมดอายุ");
  assert.ok(migration.includes("revoked_at   timestamptz"), "ต้องยกเลิกได้");
  assert.ok(!/\btoken\b\s+text/.test(migration), "ห้ามมีคอลัมน์เก็บโทเคนดิบ");

  for (const line of migration.split("\n")) {
    const statement = line.trim();
    if (statement.startsWith("alter table") || statement.startsWith("create index") || statement.startsWith("create table")) {
      assert.ok(statement.includes("if not exists"), `คำสั่งไม่ idempotent: ${statement}`);
    }
  }

  const checkDb = sourceOf("scripts/check-db.ts");
  assert.ok(checkDb.includes("checkPreviewLinks"), "check:db ต้องมีด่านลิงก์พรีวิว");
});

test("preview-link: พจนานุกรมสองภาษาห้ามพิมพ์ตัวเลข (อายุ/เพดาน) เอง", () => {
  for (const locale of ["th", "en"]) {
    const admin = sourceOf(`lib/i18n/messages/areas/${locale}/adminPreviewLink.ts`);
    assert.ok(!admin.includes(String(PREVIEW_LINK_TTL_HOURS)), `${locale}: ห้ามพิมพ์ชั่วโมงอายุในพจนานุกรม`);
    assert.ok(!admin.includes(String(PREVIEW_LINK_MAX_ACTIVE)), `${locale}: ห้ามพิมพ์เพดานในพจนานุกรม`);
    assert.ok(admin.includes("{hours}"), `${locale}: ต้องใช้ตัวเติม {hours}`);
  }
});
