import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { LEGACY_REDIRECTS, SUPPORTED_LANGS, legacyRedirectRules, localizedPath } from "@/lib/routing/redirects";

/**
 * เทสต์ "URL เก่า → 301" (X2.7 ส่วนที่ 2 · รอบที่ 150)
 *
 * กติกา: ทุกกฎต้องอ้างที่มาได้ · เป็น 301 · ครอบทุกภาษา · ไม่ชนกับเส้นทางที่ยังใช้อยู่
 * และต้องถูกผูกกับ `next.config.ts` จริง (ไม่ใช่ไฟล์ที่ไม่มีใครเรียก)
 */

test("redirects: ทุกกฎเป็น 301 และมีที่มา (ห้ามเดา URL)", () => {
  const rules = legacyRedirectRules();
  assert.ok(rules.length > 0, "ต้องมีกฎอย่างน้อย 1 ข้อ");
  for (const rule of rules) {
    assert.equal(rule.permanent, true, `ต้องเป็น 301: ${rule.source}`);
    assert.ok(rule.source.startsWith("/th/") || rule.source.startsWith("/en/"), "ต้นทางต้องมีภาษา");
    assert.ok(rule.destination.startsWith("/th") || rule.destination.startsWith("/en"), "ปลายทางต้องมีภาษา");
    assert.notEqual(rule.source, rule.destination, "ต้นทางกับปลายทางต้องไม่ซ้ำกัน (จะวนลูป)");
  }
  for (const entry of LEGACY_REDIRECTS) {
    assert.ok(entry.reason.trim().length > 10, `ทุกกฎต้องมีเหตุผล: ${entry.from}`);
  }
});

test("redirects: ครอบทุกภาษา (th/en) ของทุกกฎ", () => {
  const rules = legacyRedirectRules();
  assert.equal(rules.length, LEGACY_REDIRECTS.length * SUPPORTED_LANGS.length, "ต้องมีกฎครบทุกภาษา");
  const sources = rules.map((rule) => rule.source);
  assert.equal(new Set(sources).size, sources.length, "ห้ามมีต้นทางซ้ำ (กฎทับกันจะสับสน)");
  for (const lang of SUPPORTED_LANGS) {
    const first = LEGACY_REDIRECTS[0];
    assert.ok(first !== undefined, "ต้องมีกฎอย่างน้อย 1 ข้อ");
    assert.ok(sources.includes(localizedPath(first.from, lang)), `ต้องมีของภาษา ${lang}`);
  }
});

test("redirects: localizedPath เติมภาษาให้ถูก (รวมหน้าแรก)", () => {
  assert.equal(localizedPath("/where-to-buy", "th"), "/th/where-to-buy");
  assert.equal(localizedPath("/#where-to-buy", "en"), "/en#where-to-buy");
  assert.equal(localizedPath("/", "th"), "/th");
});

test("redirects: ต้องถูกผูกกับ next.config.ts จริง", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.ok(config.includes("legacyRedirectRules"), "next.config ต้องใช้รายการจาก lib/routing/redirects");
  assert.ok(/async redirects\(\)/.test(config), "ต้องมี redirects() ใน next.config");
});
