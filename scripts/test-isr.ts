import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { PAGE_REVALIDATE_SECONDS, PUBLISH_KINDS, activeRefreshMode, localeRoots, refreshPlan, shouldRunRebuild } from "@/lib/cache/plan";

/**
 * เทสต์ X1.7 — ISR / on-demand revalidate
 *
 * สองส่วนที่ต้องคุม
 * 1. **นโยบาย** (แผนทำให้สดใหม่ + ตัดสินใจว่าจะสั่ง rebuild ไหม) — ตรรกะล้วน
 * 2. **การกันลืม**: หน้าที่อ่านฐานข้อมูลต้องประกาศ `export const revalidate` เสมอ
 *    (ถ้าลืม เพจนั้นจะกลายเป็น static ที่ค้างตลอดกาลโดยไม่มีใครรู้ — ตรวจจากซอร์สจริงในเทสต์นี้)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

/* ── 1) นโยบาย ───────────────────────────────────────────────────────────── */

test("isr: ทุกชนิดการเผยแพร่ต้องทำให้หน้าเว็บสาธารณะสดใหม่ทั้งเว็บ", () => {
  for (const kind of PUBLISH_KINDS) {
    const plan = refreshPlan(kind);
    assert.equal(plan.kind, kind);
    /* เปลือกเว็บ (หัวเว็บ/ท้ายเว็บ/ป้าย/ตั้งค่า) อยู่ทุกหน้า ⇒ ต้อง revalidate ทั้งเว็บ */
    assert.equal(plan.revalidateAll, true, `${kind} ต้อง revalidate ทั้งเว็บ`);
  }
});

test("isr: แผนบอก path ที่ผู้ใช้จะเห็น (รากทุกภาษา + หน้าแรก + sitemap)", () => {
  const plan = refreshPlan("page");
  for (const expected of ["/th", "/en", "/", "/sitemap.xml"]) {
    assert.ok(plan.paths.includes(expected), `แผนต้องมี ${expected}`);
  }
  assert.deepEqual(localeRoots(), ["/th", "/en"]);
});

test("isr: หน้าต่างต่ออายุอัตโนมัติต้องมากพอและมีค่าเดียวที่อ้างได้", () => {
  assert.ok(Number.isInteger(PAGE_REVALIDATE_SECONDS));
  assert.ok(PAGE_REVALIDATE_SECONDS >= 60, "สั้นกว่านี้ = สร้างใหม่ถี่เกินจำเป็นบนเซิร์ฟเวอร์ตัวเอง");
  assert.ok(PAGE_REVALIDATE_SECONDS <= 3600, "นานกว่านี้ = ข้อมูลค้างนานถ้าลืมกดเผยแพร่");
});

test("isr: ไม่ตั้ง env = ไม่ต้องสั่ง rebuild (ISR จัดการเอง) · ตั้ง env = ยิงตามที่ตั้ง", () => {
  assert.equal(shouldRunRebuild({}), false);
  assert.equal(shouldRunRebuild({ REBUILD_HOOK_URL: "   " }), false, "ช่องว่างล้วน = ถือว่าไม่ได้ตั้ง");
  assert.equal(shouldRunRebuild({ REBUILD_HOOK_URL: "https://example.test/hook" }), true);
  assert.equal(shouldRunRebuild({ REBUILD_COMMAND: "npm run build" }), true);
});

test("isr: โหมดที่ใช้จริงบอกได้ว่ากำลังใช้ทางไหน", () => {
  assert.equal(activeRefreshMode({}).kind, "manual");
  assert.equal(activeRefreshMode({ REBUILD_COMMAND: "npm run build" }).kind, "command");
  assert.equal(activeRefreshMode({ REBUILD_HOOK_URL: "https://example.test/hook" }).kind, "hook");
});

/* ── 2) กันลืม: หน้าที่อ่าน DB ต้องมี revalidate ─────────────────────────────── */

const DATABASE_MARKERS = [
  "@/lib/blocks/page-loader",
  "@/lib/content/repository",
  "@/lib/chrome/loader",
  "@/lib/site-settings/loader",
  "@/lib/mourning/loader",
  "@/lib/pages/repository",
];

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("isr: ทุกหน้า/เลย์เอาต์สาธารณะที่อ่านฐานข้อมูลประกาศ `export const revalidate`", () => {
  const candidates = [
    "app/[lang]/layout.tsx",
    "app/[lang]/page.tsx",
    "app/[lang]/about/page.tsx",
    "app/[lang]/about/certifications/page.tsx",
    "app/[lang]/about/executives/page.tsx",
    "app/[lang]/careers/page.tsx",
    "app/[lang]/contact/page.tsx",
    "app/[lang]/news/page.tsx",
    "app/[lang]/privacy/page.tsx",
    "app/[lang]/maintenance/page.tsx",
    "app/[lang]/products/page.tsx",
    "app/[lang]/products/[slug]/page.tsx",
    "app/[lang]/recipes/page.tsx",
    "app/sitemap.ts",
  ];

  const missing: string[] = [];
  for (const file of candidates) {
    const source = sourceOf(file);
    assert.ok(
      source.includes(`export const revalidate = ${PAGE_REVALIDATE_SECONDS};`),
      `${file} ต้องมี export const revalidate = ${PAGE_REVALIDATE_SECONDS}; (ค่าคงที่ literal เท่านั้น)`,
    );

    /* หน้าที่อ้าง loader ของ DB ต้องอยู่ในรายการนี้ (กันลืมหน้าใหม่) */
    if (DATABASE_MARKERS.some((marker) => source.includes(marker))) continue;
    missing.push(file);
  }

  /* ทุกไฟล์ในรายการต้องเป็น "หน้าที่อ่าน DB" จริง (ไม่ใช่ไฟล์ที่ใส่ revalidate เกินจำเป็น) */
  assert.deepEqual(missing, [], `ไฟล์ที่ไม่พบการอ่าน DB: ${missing.join(", ")}`);
});

test("isr: ไฟล์ที่อ่าน DB ในเส้นทางสาธารณะทั้งหมดอยู่ในรายการเฝ้าดู", () => {
  /* ตรวจว่าไม่มีหน้าใหม่ที่อ่าน DB แล้วหลุดจากรายการ (ลิสต์เดียวกับเทสต์บน แต่กลับทาง) */
  const watched = new Set([
    "app/[lang]/layout.tsx",
    "app/[lang]/page.tsx",
    "app/[lang]/about/page.tsx",
    "app/[lang]/about/certifications/page.tsx",
    "app/[lang]/about/executives/page.tsx",
    "app/[lang]/careers/page.tsx",
    "app/[lang]/contact/page.tsx",
    "app/[lang]/news/page.tsx",
    "app/[lang]/privacy/page.tsx",
    "app/[lang]/maintenance/page.tsx",
    "app/[lang]/products/page.tsx",
    "app/[lang]/products/[slug]/page.tsx",
    "app/[lang]/recipes/page.tsx",
    "app/sitemap.ts",
  ]);

  for (const file of watched) {
    const source = sourceOf(file);
    assert.ok(
      DATABASE_MARKERS.some((marker) => source.includes(marker)) || source.includes("loadLiveBlockDocument"),
      `${file} อยู่ในรายการเฝ้าดูแต่ไม่พบการอ่าน DB — ถ้าไม่ใช้ DB แล้วให้ถอดออกจากรายการ`,
    );
  }
});

test("isr: ค่า revalidate ในหน้าเว็บต้องเป็น literal และตรงกับค่าคงที่กลาง", () => {
  /* Next อ่าน segment config จากซอร์ส ⇒ ห้ามอ้างตัวแปร · เทสต์นี้กันคนเผลอเปลี่ยนไปใช้ค่าคงที่ */
  const watched = [
    "app/[lang]/layout.tsx",
    "app/[lang]/page.tsx",
    "app/[lang]/about/page.tsx",
    "app/[lang]/about/certifications/page.tsx",
    "app/[lang]/about/executives/page.tsx",
    "app/[lang]/careers/page.tsx",
    "app/[lang]/contact/page.tsx",
    "app/[lang]/news/page.tsx",
    "app/[lang]/privacy/page.tsx",
    "app/[lang]/maintenance/page.tsx",
    "app/[lang]/products/page.tsx",
    "app/[lang]/products/[slug]/page.tsx",
    "app/[lang]/recipes/page.tsx",
    "app/sitemap.ts",
  ];

  for (const file of watched) {
    const source = sourceOf(file);
    assert.ok(
      source.includes(`export const revalidate = ${PAGE_REVALIDATE_SECONDS};`),
      `${file} ต้องเขียนค่าตรง ๆ ว่า ${PAGE_REVALIDATE_SECONDS}`,
    );
    assert.ok(!/export const revalidate = [A-Za-z_]/.test(source), `${file}: ห้ามอ้างตัวแปรในค่า revalidate`);
  }
});

test("isr: หน้าจอออกรายงาน (rebuild) ต้องมีสตริงบอกผู้ใช้ว่าไม่ต้องรอ build", () => {
  for (const locale of ["th", "en"]) {
    const source = sourceOf(`lib/i18n/messages/areas/${locale}/admin.ts`);
    assert.ok(source.includes("rebuildIsr:"), `${locale}: ต้องมีคีย์ rebuildIsr`);
  }
});
