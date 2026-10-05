import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * เทสต์กันพลาดก่อน deploy ขึ้น Vercel
 *
 * เคสจริง 2 เคสที่ต้องกัน
 * 1. deploy ด้วย **Vercel CLI** จะอัปไฟล์จากเครื่องขึ้น build ⇒ ถ้า `.env.local` หลุดขึ้นไป
 *    build จะอ่าน `DATABASE_URL` ของเครื่อง (localhost) ⇒ หน้าเว็บ prerender แบบ **ว่างเปล่าแต่ตอบ 200**
 *    · และ `backups/` มีข้อมูลส่วนบุคคล (ผู้ติดต่อ/ผู้สมัครงาน + เรซูเม่) ⇒ ห้ามอัปขึ้นที่ใด
 * 2. ⚠️ **เคสที่เกิดจริง 2026-10-05: build บน Vercel ล้มทั้งบิลด์** เพราะเขียนกฎ `.vercelignore`
 *    แบบไม่มี `/` นำหน้า (`products/` · `contact/`) ⇒ ไปตัด `features/products/` และ `features/contact/`
 *    ⇒ "Module not found: @/features/products/catalog · @/features/contact/content"
 *    ⇒ เทสต์นี้จึง **จำลองการแมตช์แบบ gitignore** แล้วยืนยันว่า "ไฟล์ของแอปไม่ถูกตัด"
 */

const raw = readFileSync(".vercelignore", "utf8");
const rules = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));

/** จำลองการแมตช์ของ gitignore (พอเพียงกับกฎที่เราใช้: `*` เดียว, ลงท้ายด้วย `/` = โฟลเดอร์) */
function ignoredBy(rule: string, path: string): boolean {
  const isDir = rule.endsWith("/");
  const body = isDir ? rule.slice(0, -1) : rule;
  const anchored = body.startsWith("/");
  const clean = body.replace(/^\//, "");

  const escaped = clean.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  /* ไม่มี / นำหน้า = แมตช์ที่ชั้นใดก็ได้ (ความหมายแบบ gitignore) */
  const prefix = anchored ? "^" : "^(?:.*/)?";
  /*
    กฎที่ไม่ลงท้ายด้วย `/` ใน gitignore ยังแมตช์ "โฟลเดอร์" ชื่อนั้นด้วย (จึงกันไฟล์ข้างในทั้งหมด)
    เช่น `.vercel` ต้องกัน `.vercel/project.json` — จำเป็นต่อเทสต์นี้
  */
  const suffix = "(?:/.*)?$";
  return new RegExp(`${prefix}${escaped}${suffix}`).test(path);
}

function ignoredRuleFor(path: string): string | null {
  for (const rule of rules) if (ignoredBy(rule, path)) return rule;
  return null;
}

test("vercelignore: ต้องกันไฟล์ความลับและข้อมูลส่วนบุคคลออกจาก build", () => {
  for (const path of [
    ".env.local",
    ".env",
    ".vercel/project.json",
    "backups/waiwai.dump",
    "BACKEND_DECISIONS.md",
    "PRODUCT_ROADMAP.md",
    "AGENTS.md",
    "WORK_PLAN.md",
  ]) {
    assert.ok(ignoredRuleFor(path) !== null, `${path} ต้องถูกกันออกจาก build`);
  }
});

test("vercelignore: ต้องกันข้อมูลต้นทางบริษัทที่ห้ามเผยแพร่", () => {
  for (const path of [
    "cer/x.pdf",
    "provider/x.pdf",
    "products/pack.png",
    "contact/map.jpg",
    "company.txt",
    "logo/icon_web.png",
    "rip/a.jpg",
    "promo/b.png",
    "slide/c.jpg",
    ".next/build-manifest.json",
    "node_modules/pg/index.js",
    "scripts/tmp-docs.mjs",
  ]) {
    assert.ok(ignoredRuleFor(path) !== null, `${path} ต้องถูกกันออกจาก build`);
  }
});

test("vercelignore: ⚠️ ต้องไม่ตัดไฟล์ของแอป (เคสจริงที่ทำให้ build ล้มทั้งบิลด์)", () => {
  const mustShip = [
    /* เคสจริง: กฎ `products/`/`contact/` แบบไม่นำหน้าตัดไฟล์พวกนี้ ⇒ Module not found */
    "features/products/catalog.ts",
    "features/products/ui/product-list.tsx",
    "features/contact/content.ts",
    "features/careers/jobs.ts",
    "features/home/view-models.ts",
    "lib/products/repository.ts",
    "lib/blocks/products-template.ts",
    "public/products/pack-1.png",
    "public/contact/om-yai-map.jpg",
    "public/logo/x.png",
    /* ของพื้นฐานที่ต้องขึ้น build เสมอ */
    "app/[lang]/page.tsx",
    "next.config.ts",
    "package.json",
    "public/brand/logo-navbar.png",
    "public/favicon.ico",
    "lib/i18n/messages/areas/th/catalog.ts",
  ];

  for (const path of mustShip) {
    const rule = ignoredRuleFor(path);
    assert.equal(rule, null, `${path} ถูกตัดโดยกฎ "${String(rule)}" — ไฟล์นี้ต้องขึ้น build`);
  }
});

test("vercelignore: กฎที่เป็นชื่อโฟลเดอร์ต้องยึดราก (/ นำหน้า) เสมอ", () => {
  const bareDirRules = rules.filter((rule) => rule.endsWith("/") && !rule.startsWith("/") && !rule.startsWith("."));
  assert.deepEqual(
    bareDirRules,
    [],
    `กฎโฟลเดอร์ที่ไม่ยึดรากจะตัดโฟลเดอร์ชื่อซ้ำในแอปด้วย: ${bareDirRules.join(", ")}`,
  );
});

test("vercelignore: ห้ามมีกฎยกเว้น (!) ที่อาจทำให้ .env หลุดขึ้นไป", () => {
  assert.deepEqual(rules.filter((rule) => rule.startsWith("!")), [], "ห้ามมีกฎยกเว้น");
});

test("package.json: ต้องล็อก Node 22 ให้ตรงกับที่พัฒนา (Vercel ใช้ค่านี้เลือกเวอร์ชัน)", () => {
  const pkg: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  const engines = (pkg as { engines?: { node?: string } }).engines;
  assert.ok(engines !== undefined, "ต้องมี engines ใน package.json");
  assert.match(engines.node ?? "", /^22\.x$/, "ต้องล็อกเป็น 22.x ให้ตรงกับที่ทดสอบ");
});
