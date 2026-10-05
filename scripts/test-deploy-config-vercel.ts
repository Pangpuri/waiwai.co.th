import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * เทสต์กันพลาดก่อน deploy ขึ้น Vercel (รอบที่ 117)
 *
 * เคสจริงที่ต้องกัน: deploy ด้วย **Vercel CLI** จะอัปไฟล์จากเครื่องขึ้น build
 * ⇒ ถ้า `.env.local` หลุดขึ้นไป build จะอ่าน `DATABASE_URL` ของเครื่อง (localhost) แทนค่าของโปรเจกต์
 *   แล้วหน้าเว็บ prerender แบบ **ว่างเปล่าแต่ตอบ 200** (จับได้ยากมาก) · และ `backups/` มีข้อมูลส่วนบุคคล
 */
const ignore = readFileSync(".vercelignore", "utf8");
const lines = ignore.split(/\r?\n/).map((line) => line.trim());

const hasRule = (rule: string): boolean => lines.includes(rule);

test("vercelignore: ต้องกันไฟล์ความลับและข้อมูลส่วนบุคคลออกจาก build", () => {
  for (const rule of [".env*", "backups/", ".vercel", ".deepcode/"]) {
    assert.ok(hasRule(rule), `.vercelignore ต้องมีกฎ "${rule}"`);
  }
});

test("vercelignore: ต้องกันข้อมูลต้นทางบริษัทที่ห้ามเผยแพร่", () => {
  for (const rule of ["cer/", "provider/", "products/", "contact/", "company.txt", "logo/", "rip/", "promo/"]) {
    assert.ok(hasRule(rule), `.vercelignore ต้องมีกฎ "${rule}"`);
  }
});

test("vercelignore: ต้องกันเอกสารภายในและของที่สร้างใหม่ได้", () => {
  for (const rule of ["AGENTS.md", "PRODUCT_ROADMAP.md", "WORK_PLAN.md", ".next/", "node_modules/", "scripts/tmp-*"]) {
    assert.ok(hasRule(rule), `.vercelignore ต้องมีกฎ "${rule}"`);
  }
});

test("vercelignore: .env* ต้องอยู่จริงและไม่ถูกยกเว้นด้วย !", () => {
  const negations = lines.filter((line) => line.startsWith("!"));
  assert.deepEqual(negations, [], "ห้ามมีกฎยกเว้น (!) ที่อาจทำให้ .env หลุดขึ้นไป");
  assert.ok(!hasRule("!.env.local"), "ห้ามยกเว้น .env.local เด็ดขาด");
});

test("package.json: ต้องล็อก Node 22 ให้ตรงกับที่พัฒนา (Vercel ใช้ค่านี้เลือกเวอร์ชัน)", () => {
  const pkg: unknown = JSON.parse(readFileSync("package.json", "utf8"));
  const engines = (pkg as { engines?: { node?: string } }).engines;
  assert.ok(engines !== undefined, "ต้องมี engines ใน package.json");
  assert.match(engines.node ?? "", /^22\.x$/, "ต้องล็อกเป็น 22.x ให้ตรงกับที่ทดสอบ");
});
