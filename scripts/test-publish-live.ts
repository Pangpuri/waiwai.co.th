import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import {
  PUBLISH_GOES_LIVE_PAGES,
  expectedLiveOf,
  publishGoesLive,
  publishOutcomeOf,
} from "@/lib/blocks/live-scope";

/**
 * เทสต์รอบที่ 240 — มติเจ้าของ 2026-10-09: "กดเผยแพร่ = ขึ้นเว็บเลย (หน้าแรก)" + ถอดปุ่มซ้ำซ้อน
 *
 * ที่มา (ต่อจากรอบ 238/239 — สองรอบนั้นแก้ "อาการ" ของสวิตช์สองขั้น):
 *   เจ้าของ: *"ลองทดสอบขยับบล็อกแล้วกดเผยแพร่ ยังไม่ติด"* ⇒ ต้นเหตุจริงคือ **สองขั้นที่ต้องเปิดทั้งคู่**
 *   ⇒ รอบนี้แก้ที่ต้นเหตุ: ถอดสวิตช์ "ใช้กับหน้าเว็บจริง" ออก + ถอดปุ่ม "บันทึกฉบับร่าง"
 *     · หน้าแรก = 1 ขั้น (เผยแพร่ ⇒ ขึ้นเว็บทันที)
 *     · หน้าอื่น = ยังไม่ขึ้นเว็บ (เจ้าของ: "ยังไม่เริ่มจริงจัง") ⇒ กดเผยแพร่ = บันทึกไว้
 *
 * เทสต์กันถอยหลัง 4 เรื่อง
 *   1. นโยบายกลาง (ตรรกะล้วน) — หน้าไหนขึ้นเว็บ หน้าไหนไม่
 *   2. Server Action ใช้ **นโยบายตัวเดียวกัน** + ตั้ง is_live **ก่อน** สั่ง refresh
 *   3. จอ: ไม่มีสวิตช์/ปุ่มบันทึกฉบับร่างแล้ว + คำใบ้ใต้ปุ่มตรงกับนโยบาย + บอกผลหลังกดตามจริง
 *   4. พจนานุกรมครบทั้ง TH/EN และไม่มีข้อความสัญญาว่า "ขึ้นเว็บ" ในหน้าที่ไม่ขึ้นเว็บ
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/**
 * ⚠️ ต้องใช้ `codeOf()` จากตัวช่วยกลาง (`scripts/source-scan.ts`) — คอมเมนต์ที่อธิบายว่าอะไรถูกถอดออก
 *   (เช่น `useActionState(saveDraftAction)`) ทำให้การสแกนแบบดิบหลอกว่าโค้ดยังอยู่ (รอบที่ 243 รวมตัวช่วยเป็นชุดเดียว)
 */

/* ── 1) นโยบายกลาง ─────────────────────────────────────────────────────────── */

test("publish-live: หน้าแรกเท่านั้นที่กดเผยแพร่แล้วขึ้นเว็บ", () => {
  assert.deepEqual([...PUBLISH_GOES_LIVE_PAGES], ["home"], "มติเจ้าของ: เฉพาะหน้าแรก (หน้าอื่นยังไม่เริ่มจริงจัง)");

  assert.equal(publishGoesLive("home"), true);
  assert.equal(publishGoesLive("about"), false);
  assert.equal(publishGoesLive("products"), false);
  assert.equal(publishGoesLive(""), false, "ค่าที่ไม่รู้จักต้องไม่ทำให้ขึ้นเว็บ (fail-closed)");

  assert.equal(publishOutcomeOf("home"), "goes-live");
  assert.equal(publishOutcomeOf("careers"), "saved-only");
  assert.equal(expectedLiveOf("home"), true);
  assert.equal(expectedLiveOf("news"), false);
});

/* ── 2) Server Action ─────────────────────────────────────────────────────── */

test("publish-live: action ใช้ (ก) นโยบายกลาง (ข) เปิด is_live ก่อน refresh", () => {
  const actions = codeOf("app/admin/builder/actions.ts");

  assert.ok(actions.includes("if (publishGoesLive(page)) await setPageLive(page, true, user.email);"), "เปิด is_live ให้เองในขั้นเดียว");
  assert.ok(actions.includes('import { publishGoesLive } from "@/lib/blocks/live-scope";'), "ใช้นโยบายกลาง (ไม่พิมพ์ชื่อหน้าเอง)");
  assert.ok(
    actions.indexOf("publishGoesLive(page)") < actions.indexOf('refreshPublicSite("page")'),
    "ต้องเปิด is_live ก่อนสั่ง refresh ⇒ หน้าใหม่ที่ ISR สร้างจะเห็นว่าหน้านี้ live แล้ว",
  );
  assert.ok(actions.includes("const live = await isPageLive(page);"), "อ่านสถานะจริงหลังเผยแพร่เพื่อบอกผู้ใช้");

  /* ⚠️ สวิตช์ถูกถอดออกแล้ว — action ของมันต้องไม่หลงเหลือ (ไฟล์ use server ที่ไม่มีใครเรียก = ทางตัน) */
  assert.equal(actions.includes("setPageLiveAction"), false, "ต้องไม่มี action สวิตช์เหลืออยู่");
  assert.equal(actions.includes("readPageLiveAction"), false, "ต้องไม่มี action อ่านสถานะสวิตช์เหลืออยู่");
  assert.equal(actions.includes("live-guard"), false, "ไม่ต้องมี live-guard แล้ว (ไม่มีสวิตช์ให้กัน)");
});

/* ── 3) จอ: ถอดปุ่มซ้ำซ้อน + บอกผลตรง ────────────────────────────────────── */

test("publish-live: จอเหลือปุ่มเดียว (ไม่มีสวิตช์/ปุ่มบันทึกฉบับร่าง) และคำใบ้ตรงนโยบาย", () => {
  const builder = codeOf("features/admin/ui/block-builder.tsx");

  /* ถอดของซ้ำซ้อนออกจริง */
  assert.equal(builder.includes("setPageLiveAction"), false, "ไม่มีฟอร์มสวิตช์ในจอ");
  assert.equal(builder.includes("data-live-form"), false, "ไม่มีจุดตรวจสวิตช์เดิม");
  assert.equal(builder.includes("useActionState(saveDraftAction"), false, "ถอดปุ่มบันทึกฉบับร่างออกจาก useActionState");
  assert.equal(builder.includes("strings.saveDraft"), false, "ไม่มีปุ่มบันทึกฉบับร่างบนจอนี้");
  assert.ok(builder.includes("saveDraftAction(INITIAL_BUILDER_STATE, body)"), "บันทึกอัตโนมัติยังใช้ Server Action ตัวเดิม");
  assert.ok(builder.includes("strings.draftAutosaveOn"), "อัตโนมัติบันทึกยังอยู่ (เป็นตัวเก็บงานที่ยังไม่เผยแพร่)");

  /* เหลือปุ่มเผยแพร่ปุ่มเดียว + คำใบ้ที่มาจากนโยบายเดียวกัน */
  assert.ok(builder.includes("action={publishActionState}"), "มีฟอร์มเผยแพร่");
  assert.ok(builder.includes('data-publish-hint={publishLive ? "live" : "saved-only"}'), "คำใบ้ต้องผูกกับนโยบาย (ตรวจด้วย HTTP ได้)");
  assert.ok(builder.includes("readonly publishLive?: boolean"), "prop ไม่บังคับ (กัน build พังแบบเดิม)");

  const page = codeOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("const publishLive = publishGoesLive(page);"), "หน้าจอ server อ่านนโยบายกลาง");
  assert.ok(page.includes("publishLive={publishLive}"), "ส่งเข้า BlockBuilder");

  /* ผลหลังกดเผยแพร่ต้องบอกว่า \"หน้าเว็บเปลี่ยนหรือยัง\" */
  assert.ok(builder.includes('data-published-live="off"') && builder.includes('data-published-live="on"'), "มีจุดตรวจผลการขึ้นเว็บ");
  assert.ok(builder.includes("strings.publishedSavedOnly"), "หน้าที่ไม่ขึ้นเว็บต้องบอกตรง ๆ");
});

/* ── 4) พจนานุกรม ─────────────────────────────────────────────────────────── */

test("publish-live: ข้อความครบ TH/EN และไม่มีคีย์ของสวิตช์ที่ถอดออกแล้ว", () => {
  for (const locale of ["th", "en"]) {
    const dictionary = sourceOf(`lib/i18n/messages/areas/${locale}/adminLive.ts`);
    for (const key of ["publishedLive", "publishedSavedOnly", "publishHintLive", "publishHintSavedOnly"]) {
      assert.ok(dictionary.includes(`${key}:`), `${locale}/adminLive.ts ต้องมีคีย์ ${key}`);
    }
    /* คีย์ของสวิตช์ที่ถอดออกแล้วต้องไม่เหลือ (ไม่งั้นมีข้อความค้างที่ไม่มีใครใช้ + หลอกคนอ่านโค้ด) */
    for (const dead of ["liveOn:", "liveOff:", "liveTurnOn:", "liveTurnOff:", "liveHintOn:", "liveSyncOk:", "liveBlockedStale:", "publishedNotLive:"]) {
      assert.equal(dictionary.includes(dead), false, `${locale}/adminLive.ts ต้องไม่เหลือคีย์ตาย ${dead}`);
    }
    /* พื้นที่พจนานุกรมต้องไม่บวมกลับไปชนเพดาน */
    assert.ok(Buffer.byteLength(dictionary, "utf8") < 8 * 1024, `${locale}/adminLive.ts ต้องเล็ก (พื้นที่ย่อย ไม่ใช่ที่ทิ้งข้อความ)`);
  }

  /* คำใบ้ต้องไม่สัญญาว่า "ขึ้นเว็บ" ในหน้าที่ไม่ขึ้นเว็บ */
  const th = sourceOf("lib/i18n/messages/areas/th/adminLive.ts");
  assert.ok(th.includes("ยังไม่เปิดขึ้นเว็บจริง — กด"), "คำใบ้ (saved-only) ต้องบอกว่าไม่ขึ้นเว็บ");
  assert.ok(th.includes("ขึ้นเว็บทันที"), "คำใบ้ (live) ต้องบอกว่าขึ้นเว็บทันที");
  const en = sourceOf("lib/i18n/messages/areas/en/adminLive.ts");
  assert.ok(en.includes("not live yet"), "EN saved-only hint ต้องบอกว่าไม่ live");
  assert.ok(en.includes("goes live immediately"), "EN live hint ต้องบอกว่าขึ้นเว็บทันที");
});
