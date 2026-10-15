import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 288 — **ห้ามเหลือข้อความที่อ้างถึง "เว็บเดิม" ในข้อความที่ผู้ใช้เห็น**
 *
 * ที่มา (คำเจ้าของ 2026-10-15): *"หน้าเมนูอาหาร (ของจริงจากเว็บเดิมของแบรนด์)
 *    หน้าข่าวสารและกิจกรรม เอาออกนะครับ ไม่รู้ว่าอยู่ตามหน้าไหนบ้าง
 *    ตอนเปิดเว็บจริงปิดเว็บเก่า เว็บนี้จะเป็นเว็บหลักนะ ต้องเอาออกก่อน ...
 *    เดี๋ยวคนถามหาเว็บเดิมให้วุ่น"*
 *
 * ⇒ ข้อความทำนอง "(ของจริงจากเว็บเดิมของแบรนด์)" เคยอยู่ในพจนานุกรม (`contentPages` th/en)
 *    ซึ่งขึ้นทั้ง `<meta name="description">` และข้อความเปิดหน้า ⇒ ถอดออกทั้งชุดในรอบนี้
 *
 * ด่านนี้ตอบคำถาม "อยู่หน้าไหนบ้าง" แทนคนอ่านทุกครั้ง:
 *   1. สแกน **ไฟล์พจนานุกรมทุกไฟล์** (`lib/i18n/messages/**`) — สตริงที่ผู้ใช้เห็นห้ามมีคำต้องห้าม
 *      · ตัดคอมเมนต์ออกก่อน (`codeOf`) เพราะบันทึกเหตุผลภายในยังพูดถึงที่มาได้ แต่ **สตริงจริงห้าม**
 *   2. สแกน **ตัว seed / ตัวนำเข้า** ที่อาจเขียนข้อความลงฐานข้อมูล (seed หน้าแรก · content fixture)
 *      ⇒ กันกรณี "แก้ที่พจนานุกรมแล้ว แต่ seed ยังเขียนข้อความเดิมกลับเข้า DB"
 *
 * ⚠️ ตรวจแล้ว (2026-10-15): ข้อความนี้ **ไม่มีสำเนาในฐานข้อมูล** ทั้งในเครื่องและบนคลาวด์
 *    (`content_field` · `page_document` · `hero_setting` = 0 แถว) ⇒ พจนานุกรมคือแหล่งเดียวที่ต้องคุม
 */

/** คำต้องห้าม — สื่อว่า "มีเว็บอื่น/เว็บก่อนหน้าอยู่" (คนอ่านจะไปตามหาเว็บนั้น) */
const FORBIDDEN: readonly string[] = [
  "เว็บเดิม",
  "เว็บเก่า",
  "previous site",
  "old site",
  "original site",
  "legacy site",
];

/** ไฟล์ที่ต้องสแกน: พจนานุกรมทั้งหมด + ตัว seed ที่เขียนเนื้อหาลงฐานข้อมูล */
function scanTargets(): readonly string[] {
  const targets: string[] = [];
  const i18nRoot = path.join(process.cwd(), "lib", "i18n", "messages");

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else if (entry.endsWith(".ts")) targets.push(path.relative(process.cwd(), full).replace(/\\/g, "/"));
    }
  };
  walk(i18nRoot);

  targets.push("lib/content/home-seed.ts");
  targets.push("scripts/content-fixture.ts");
  return targets;
}

test("พจนานุกรม + seed: ห้ามเหลือข้อความที่อ้างถึงเว็บเดิม (คำที่ผู้ใช้เห็น)", () => {
  const hits: string[] = [];

  for (const file of scanTargets()) {
    const source = codeOf(file).replace(/\r\n/g, "\n");
    for (const phrase of FORBIDDEN) {
      if (!source.includes(phrase)) continue;
      /* อ้างบรรทัดที่มีคำนั้น เพื่อให้แก้ได้ตรงจุด */
      source.split("\n").forEach((line, index) => {
        if (line.includes(phrase)) hits.push(`${file}:${index + 1} → ${line.trim().slice(0, 110)}`);
      });
    }
  }

  assert.deepEqual(hits, [], `พบข้อความที่อ้างถึงเว็บเดิม:\n${hits.join("\n")}`);
});

test("หน้า /recipes และ /news: ข้อความเปิดหน้าห้ามพูดถึงที่มา (ต้องอ่านได้ด้วยตัวเอง)", () => {
  const th = codeOf("lib/i18n/messages/areas/th/contentPages.ts");
  const en = codeOf("lib/i18n/messages/areas/en/contentPages.ts");

  assert.ok(th.includes('intro: "เมนูอาหารและไอเดียการทำอาหารจากไวไว"'), "TH: recipes intro ต้องไม่มีวงเล็บที่มา");
  assert.ok(th.includes('intro: "ข่าวสารและกิจกรรมของไวไว"'), "TH: news intro ต้องไม่มีวงเล็บที่มา");
  assert.ok(en.includes('intro: "Wai Wai recipe videos and cooking ideas."'), "EN: recipes intro ต้องไม่มีที่มา");
  assert.ok(en.includes('intro: "Wai Wai news and activities."'), "EN: news intro ต้องไม่มีที่มา");
});

test("ป้ายในหลังบ้าน (คลังภาพ/เทมเพลต/หมวด) ก็ไม่พูดถึงเว็บเดิมเช่นกัน", () => {
  const thMedia = codeOf("lib/i18n/messages/areas/th/adminMedia.ts");
  const enMedia = codeOf("lib/i18n/messages/areas/en/adminMedia.ts");
  assert.ok(thMedia.includes('mediaUsageProduct: "สินค้า"'), "TH: ป้ายคลังภาพต้องสั้น ไม่มีวงเล็บที่มา");
  assert.ok(enMedia.includes('mediaUsageProduct: "Product"'), "EN: ป้ายคลังภาพต้องสั้น ไม่มีวงเล็บที่มา");

  const enTemplate = codeOf("lib/i18n/messages/areas/en/adminTemplate.ts");
  assert.ok(
    enTemplate.includes("is not built from a template"),
    "EN: คำอธิบายเทมเพลตต้องบอกสถานะ (ไม่มีเทมเพลต) ไม่ใช่ที่มาของเนื้อหา",
  );
});
