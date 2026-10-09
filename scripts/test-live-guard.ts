import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  decideLiveEnable,
  liveBlockedReasonOf,
  livePanelInfoOf,
  liveSyncStateOf,
  liveSyncWarnCode,
} from "@/lib/blocks/live-guard";

/**
 * เทสต์รอบที่ 238 — 🐞 "เปิดสวิตช์ใช้กับหน้าเว็บจริง แล้วหน้าเว็บกลายเป็นบล็อกเก่า"
 *
 * เคสจริงจากเจ้าของ (2026-10-09): ในตัวสร้างเห็นพรีวิวสด (ฉบับร่าง) มีสินค้า/เมนู/ข่าวครบ
 * แต่พอเปิดสวิตช์ "ใช้กับหน้าเว็บจริง" → หน้าเว็บกลายเป็นเทมเพลตเก่าที่มีข้อมูลทดสอบ (ไม่มีภาพจริง)
 * ต้องปิดสวิตช์กลับ / คืนค่าเริ่มต้น
 *
 * ต้นเหตุ: สวิตช์ให้เว็บอ่าน **ฉบับที่เผยแพร่** แต่จอโชว์/แก้ **ฉบับร่าง**
 * ⇒ เปิดได้เสมอโดยไม่ดูว่าฉบับที่เผยแพร่เป็นอะไร = "จอโกหก"
 *
 * เทสต์ชุดนี้กันถอยหลัง 4 เรื่อง
 *   1. กติกาตัดสิน (ตรรกะล้วน) — เปิดได้เฉพาะเมื่อตรงกัน · ปิดได้เสมอ (ไม่ผ่านกติกานี้)
 *   2. Server Action ต้อง **ปฏิเสธ** การเปิดที่ไม่ตรง + เด้งกลับพร้อมเหตุผล (ไม่เงียบ)
 *   3. หน้าจอต้องบอกความจริง (ฉบับเผยแพร่ vs ฉบับร่าง) + ปิดปุ่มที่กดแล้วไม่สำเร็จ
 *   4. ข้อความต้องไม่โกหก ("หน้าเว็บกำลังแสดงเนื้อหาชุดนี้" แบบเดิม) และต้องมีครบทั้ง TH/EN
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) ตรรกะล้วน ─────────────────────────────────────────────────────────── */

test("live-guard: เปิดสวิตช์ได้เฉพาะเมื่อฉบับที่เผยแพร่ตรงกับฉบับร่าง", () => {
  /* ไม่มีฉบับเผยแพร่ = เปิดไม่ได้ (เปิดไปก็ไม่มีอะไรขึ้นเว็บ) */
  assert.equal(liveSyncStateOf({ hasPublished: false, inSync: false }), "missing");
  assert.equal(decideLiveEnable({ hasPublished: false, inSync: false }).allowed, false);
  assert.equal(liveBlockedReasonOf("missing"), "no-published");

  /* มีฉบับเผยแพร่แต่ไม่ตรงกับฉบับร่าง = เปิดไม่ได้ (เคสจริงที่เจ้าของเจอ) */
  assert.equal(liveSyncStateOf({ hasPublished: true, inSync: false }), "stale");
  const stale = decideLiveEnable({ hasPublished: true, inSync: false });
  assert.equal(stale.allowed, false);
  assert.equal(stale.allowed === false ? stale.reason : null, "draft-not-published");

  /* ตรงกัน = เปิดได้ (สิ่งที่เห็นในพรีวิว = สิ่งที่ขึ้นเว็บ) */
  assert.equal(liveSyncStateOf({ hasPublished: true, inSync: true }), "in-sync");
  assert.deepEqual(decideLiveEnable({ hasPublished: true, inSync: true }), { allowed: true, state: "in-sync" });
  assert.equal(liveBlockedReasonOf("in-sync"), null);
  assert.equal(liveSyncWarnCode("in-sync"), null);

  /* ⚠️ กติกานี้ใช้กับ "การเปิด" เท่านั้น — การปิดต้องทำได้เสมอ (เทสต์ที่ตัว action ด้านล่าง) */
});

test("live-guard: ข้อมูลสำหรับแผงหน้าจอ (isLive + สถานะ + จำนวนบล็อกของฉบับเผยแพร่)", () => {
  const panel = livePanelInfoOf({ isLive: false, hasPublished: true, inSync: false, publishedBlocks: 5 });
  assert.deepEqual(panel, { isLive: false, state: "stale", publishedBlocks: 5 });

  const missing = livePanelInfoOf({ isLive: true, hasPublished: false, inSync: false, publishedBlocks: null });
  assert.deepEqual(missing, { isLive: true, state: "missing", publishedBlocks: null });
});

/* ── 2) Server Action (fail-closed) ──────────────────────────────────────── */

test("live-guard: action ปฏิเสธการเปิดที่ไม่ตรง + เด้งกลับพร้อมเหตุผล (ของเดิมเปิดได้เสมอ)", () => {
  const actions = sourceOf("app/admin/builder/actions.ts");

  assert.ok(actions.includes("decideLiveEnable({ hasPublished, inSync })"), "action ต้องใช้กติกากลาง ไม่ตัดสินเอง");
  assert.ok(actions.includes("documentsEqual(published.document, draft.document)"), "ต้องเทียบฉบับเผยแพร่กับฉบับร่างจริง");
  assert.ok(actions.includes("if (!decision.allowed) redirect("), "ไม่ผ่านกติกา = ต้องไม่เขียน DB และเด้งกลับ (fail-closed)");
  assert.ok(actions.includes("`${pathOf(page)}?live=${decision.reason}`"), "ต้องส่งเหตุผลกลับไปให้หน้าจอแสดง (ไม่เงียบ)");

  /* ⚠️ ด่านต้องอยู่ในสาขา "เปิด" เท่านั้น — การปิดสวิตช์ต้องไม่ถูกบล็อก (ทางหนีกลับไปใช้เลย์เอาต์เดิม) */
  const guardAt = actions.indexOf("if (live) {");
  const decideAt = actions.indexOf("decideLiveEnable({ hasPublished, inSync })");
  const setAt = actions.indexOf("await setPageLive(page, live, user.email)");
  assert.ok(guardAt > 0 && decideAt > guardAt && setAt > decideAt, "ด่านต้องอยู่ก่อนการเขียน DB และอยู่ในสาขาเปิด");
  assert.ok(
    actions.includes("⚠️ การ **ปิด** สวิตช์ไม่ตรวจอะไร"),
    "ต้องมีคอมเมนต์ย้ำว่าการปิดไม่ถูกบล็อก (กันคนมาเติมด่านผิดที่)",
  );
});

/* ── 3) หน้าจอต้องบอกความจริง + ไม่มีปุ่มที่กดแล้วไม่เกิดอะไร ────────────── */

test("live-guard: หน้าจอคำนวณสถานะจากของจริง และส่งเข้าแผงสวิตช์", () => {
  const page = sourceOf("app/admin/builder/[page]/page.tsx");

  assert.ok(page.includes("const parsedPublished ="), "หน้าจอต้องอ่านฉบับที่เผยแพร่ด้วย (ไม่ใช่แค่ฉบับร่าง)");
  assert.ok(page.includes("documentsEqual(publishedDocument, initialDraft)"), "ต้องเทียบกับฉบับร่างที่กำลังแก้");
  assert.ok(page.includes("liveGuard={liveGuard}"), "ส่งสถานะเข้าแผงสวิตช์");
  assert.ok(page.includes("publishedBlocks={publishedDocument === null ? null : publishedDocument.blocks.length}"), "ส่งจำนวนบล็อกของฉบับเผยแพร่");
  assert.ok(page.includes("strings.liveBlockedStale") && page.includes("strings.liveBlockedNoPublished"), "ต้องมีข้อความสำหรับกรณีถูกปฏิเสธ");

  const builder = sourceOf("features/admin/ui/block-builder.tsx");
  assert.ok(builder.includes("liveSyncStateOf(liveGuard)"), "แผงใช้ตรรกะกลาง (ไม่ตีความเอง)");
  assert.ok(builder.includes("const liveBlocked = !isLive && liveState !== null && liveState !== \"in-sync\";"), "ปิดปุ่มเฉพาะตอนจะ 'เปิด' ที่ยังไม่พร้อม");
  assert.ok(builder.includes("disabled={liveBlocked}"), "ปุ่มต้องถูกปิดเมื่อกดแล้วไม่สำเร็จ (บทเรียนรอบที่ 85)");
  assert.ok(builder.includes("data-live-sync="), "มีจุดตรวจสถานะให้เทสต์/HTTP ตรวจได้");
  assert.ok(builder.includes("data-live-notice="), "มีจุดแสดงเหตุผลหลังถูกปฏิเสธ");
  assert.ok(builder.includes("strings.liveTurnOnBlocked"), "ปุ่มที่ถูกปิดต้องบอกเหตุผล (title)");
  /* ⚠️ ห้ามมีข้อความ/สตริงไทยใน .tsx (ด่าน check:i18n) — ที่นี่ดึงจากพจนานุกรมเท่านั้น */
  assert.ok(!/[\u0E00-\u0E7F]/.test(builder.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")), "ห้ามมีข้อความไทยในโค้ด UI (ต้องมาจากพจนานุกรม)");
});

test("live-guard: ข้อความต้องไม่โกหก + มีครบทั้ง TH/EN (พื้นที่ย่อย adminLive)", () => {
  for (const locale of ["th", "en"]) {
    const dictionary = sourceOf(`lib/i18n/messages/areas/${locale}/adminLive.ts`);
    for (const key of [
      "liveOn",
      "liveOff",
      "liveTurnOn",
      "liveTurnOff",
      "liveHintOn",
      "liveHintOff",
      "liveSyncOk",
      "liveSyncStale",
      "liveSyncMissing",
      "liveTurnOnBlocked",
      "liveBlockedStale",
      "liveBlockedNoPublished",
    ]) {
      assert.ok(dictionary.includes(`${key}:`), `${locale}/adminLive.ts ต้องมีคีย์ ${key}`);
    }
    /* ตัวเติมต้องมีครบ (ไม่งั้นผู้ใช้เห็น {published} ดิบ) */
    assert.ok(dictionary.includes("{published}"), `${locale}: liveSyncOk ต้องมี {published}`);
    assert.ok(dictionary.includes("{draft}"), `${locale}: liveSyncStale ต้องมี {draft}`);
  }

  /* ข้อความ "เปิดอยู่" ต้องบอกว่าหน้าเว็บแสดง **ฉบับที่เผยแพร่** (ไม่ใช่ "เนื้อหาชุดนี้" แบบเดิมที่ทำให้เข้าใจผิด) */
  const th = sourceOf("lib/i18n/messages/areas/th/adminLive.ts");
  assert.ok(th.includes("ฉบับที่เผยแพร่"), "liveHintOn ต้องพูดถึง 'ฉบับที่เผยแพร่' ให้ตรงความจริง");
  const en = sourceOf("lib/i18n/messages/areas/en/adminLive.ts");
  assert.ok(en.includes("published version"), "liveHintOn (EN) ต้องพูดถึง published version");

  /* พื้นที่เดิมต้องไม่เหลือคีย์ live* แล้ว (ย้ายไป adminLive เพราะพื้นที่ admin ชนเพดาน 32KB) */
  for (const locale of ["th", "en"]) {
    const adminArea = sourceOf(`lib/i18n/messages/areas/${locale}/admin.ts`);
    assert.ok(!adminArea.includes("liveHintOn:"), `${locale}/admin.ts ต้องไม่เหลือคีย์ live* (ย้ายไป adminLive)`);
    const composed = sourceOf(`lib/i18n/messages/${locale}.ts`);
    assert.ok(composed.includes("...adminLive,"), `${locale}.ts ต้องประกอบพื้นที่ย่อย adminLive เข้า admin`);
  }
});
