import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HISTORY_PANEL_LIMIT,
  MAX_PAGE_REVISIONS,
  PRUNE_HISTORY_CONFIRM_VALUE,
  revisionNumbersToPrune,
} from "@/lib/blocks/revision-plan";

import { codeOf } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 249 — ประวัติการเผยแพร่ต้องมีเพดาน + ล้างได้
 *
 * ## เคสจริงจากเจ้าของ
 * *"ประวัติการเผยแพร่ นี่เก็บ log จริง แต่ก็ค่อย ๆ ยืดมาเต็มเลยครับ ควรมีลอจิกลบหรือล้างออกบ้าง"*
 * (หน้าแรกมี 22 รุ่นในวันเดียว — ไม่มีเพดานจำนวนมาก่อน ⇒ แผงหลังบ้านยาวขึ้นเรื่อย ๆ)
 *
 * ## สัญญาที่ล็อก
 * 1. เพดานจำนวน (`MAX_PAGE_REVISIONS`) + ตัวตัดรุ่นอัตโนมัติเมื่อเผยแพร่ — **ห้ามลบจนไม่เหลือรุ่น**
 * 2. ล้างด้วยมือต้องติ๊กยืนยัน (fail-closed) และ **เก็บรุ่นล่าสุดไว้เสมอ**
 * 3. แผงหลังบ้านแสดงไม่เกิน `HISTORY_PANEL_LIMIT` และเลื่อนในกรอบ (ไม่ดันหน้าจอ)
 * 4. ค่าคงที่ทั้งหมดมาจากนโยบายเดียว (`lib/blocks/revision-plan.ts`) — ห้ามพิมพ์ตัวเลขซ้ำ
 */

/* ── 1) ตรรกะล้วน ─────────────────────────────────────────────────────────── */

test("revision-plan: เพดาน/ตัวแสดง ต้องสมเหตุสมผลและไม่ขัดกัน", () => {
  assert.ok(MAX_PAGE_REVISIONS >= 2, "ต้องเก็บมากกว่า 1 รุ่น (ไม่งั้นกู้คืนย้อนหลังไม่ได้)");
  assert.ok(HISTORY_PANEL_LIMIT >= 1, "ต้องแสดงอย่างน้อย 1 รุ่น");
  /* ⚠️ แผงห้ามแสดงรุ่นที่กำลังจะถูกลบปนกัน */
  assert.ok(HISTORY_PANEL_LIMIT <= MAX_PAGE_REVISIONS, "จำนวนที่แสดงต้องไม่เกินเพดานที่เก็บ");
  assert.equal(PRUNE_HISTORY_CONFIRM_VALUE, "prune");
});

test("revision-plan: ตัดรุ่นเก่าถูกตัว และไม่ลบจนไม่เหลืออะไร", () => {
  /* น้อยกว่าเพดาน = ไม่ตัดอะไร */
  assert.deepEqual(revisionNumbersToPrune([3, 1, 2], 5), []);
  assert.deepEqual(revisionNumbersToPrune([], 5), []);
  /* เท่าเพดานพอดี = ไม่ตัด */
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3, 4, 5], 5), []);
  /* เกิน = ตัดตัวเก่าสุด (เรียงจากน้อยไปมาก) */
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3, 4, 5, 6, 7], 5), [1, 2]);
  /* ลำดับที่ส่งเข้ามาไม่สำคัญ + ค่าซ้ำถูกตัดออก */
  assert.deepEqual(revisionNumbersToPrune([7, 3, 7, 5, 1, 6, 4, 2], 5), [1, 2]);
  /* keep = 1 (ปุ่มล้างด้วยมือ) ⇒ เก็บแค่รุ่นใหม่สุด */
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3], 1), [1, 2]);
  /*
    ⚠️ keep ที่ไม่ใช่จำนวนเต็มบวก ⇒ ถอยไปใช้ **เพดานนโยบาย** = ไม่ลบอะไร (ลบ *น้อยลง* ไม่ใช่ลบมากขึ้น)
    ปลอดภัยกว่า "บีบเป็น 1" เพราะค่าที่พังต้องไม่ทำให้ข้อมูลหายเกินเจตนา · ส่วน `keep = 1` ที่ส่งมา **โดยเจตนา**
    (ปุ่มล้างประวัติ) ยังเก็บรุ่นล่าสุดไว้ตามเดิม ⇒ ดูบรรทัดบน
  */
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3], 0), []);
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3], -5), []);
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3], Number.NaN), []);
  assert.deepEqual(revisionNumbersToPrune([1, 2, 3], 1.5), []);
  /* เลขรุ่นไม่ต่อเนื่อง (มีการลบมาก่อน) ยังทำงานถูก */
  assert.deepEqual(revisionNumbersToPrune([19, 18, 9, 3], 2), [3, 9]);
});

/* ── 2) ชั้นข้อมูล: SQL เป็นประตู ─────────────────────────────────────────── */

test("revision-plan: ตัวลบต้องผูกกับหน้า + เก็บบางรุ่น + เรียกหลังเผยแพร่แบบไม่ทำให้ล้ม", () => {
  const repo = codeOf("lib/blocks/repository.ts");

  const start = repo.indexOf("export async function prunePageRevisions");
  assert.ok(start > 0, "ต้องมี prunePageRevisions");
  const body = repo.slice(start, repo.indexOf("\n}", start) + 2);

  assert.ok(body.includes("delete from page_document_revision"), "ต้องลบจากตารางประวัติ");
  assert.ok(body.includes("where page = $1"), "ต้องจำกัดเฉพาะหน้านั้น (ห้ามลบข้ามหน้า)");
  assert.ok(body.includes("order by revision desc limit $2"), "ต้องเลือกรุ่นที่ต้องเก็บไว้ก่อนลบ");
  assert.ok(body.includes("Number.isInteger(keep) && keep >= 1"), "ค่าที่พังต้องถอยไปใช้เพดานนโยบาย (ลบน้อยลง)");
  /* ⚠️ ค่าเริ่มต้นมาจากนโยบายกลาง ไม่ใช่ตัวเลขลอย */
  assert.ok(body.includes("keep: number = MAX_PAGE_REVISIONS"), "ค่าเริ่มต้นต้องมาจากนโยบายกลาง");

  /* เรียกหลังเผยแพร่ + กลืน error (งานเสริมห้ามทำให้การเผยแพร่ล้ม) */
  const publish = repo.slice(repo.indexOf("export async function publishDraft"), start);
  assert.ok(publish.includes("await prunePageRevisions(page).catch(() => 0)"), "ต้องตัดรุ่นหลังเผยแพร่และไม่ทำให้ล้ม");

  /* หน้าจอต้องอ่านค่ากลาง ไม่พิมพ์ตัวเลขเอง */
  const list = repo.slice(repo.indexOf("export async function listRevisions"), repo.indexOf("export async function listRevisions") + 200);
  assert.ok(list.includes("limit = HISTORY_PANEL_LIMIT"), "จำนวนที่แสดงต้องมาจากนโยบายกลาง");
});

/* ── 3) Server Action: fail-closed + audit + เก็บรุ่นล่าสุด ───────────────── */

test("revision-plan: action ล้างประวัติต้องตรวจสิทธิ์ · ยืนยัน · เก็บรุ่นล่าสุด · มี audit", () => {
  const actions = codeOf("app/admin/builder/actions.ts");
  const start = actions.indexOf("export async function clearRevisionHistoryAction");
  assert.ok(start > 0, "ต้องมี clearRevisionHistoryAction");
  const nextExport = actions.indexOf("export async function", start + 10);
  const body = actions.slice(start, nextExport > 0 ? nextExport : undefined);

  assert.ok(body.includes('requireAdminUser("content")'), "ต้องผ่านประตูสิทธิ์ content");
  assert.ok(body.includes("PRUNE_HISTORY_CONFIRM_VALUE"), "ค่าที่ต้องยืนยันต้องมาจากนโยบายกลาง");
  assert.ok(body.includes("needs-confirm"), "ไม่ยืนยัน = ส่งกลับพร้อมรหัส (ไม่ทำอะไร)");
  assert.ok(body.includes("prunePageRevisions(page, 1)"), "ต้องเก็บบางรุ่นไว้ (รุ่นล่าสุด)");
  assert.ok(body.includes('action: "revisions-prune"'), "ต้องมีร่องรอย audit");
  assert.ok(body.includes("revalidatePath("), "ต้องล้างแคชหน้าหลังบ้าน");
  /* ⚠️ ห้ามลบเอกสาร/ฉบับเผยแพร่ — ปุ่มนี้แตะแค่ประวัติ */
  assert.equal(/deleteDocument|deletePage\b/.test(body), false, "ห้ามลบหน้า/เอกสารจากปุ่มนี้");
});

/* ── 4) หน้าจอ: หมายเหตุ + รูปแบบฟอร์ม + กรอบเลื่อน ───────────────────────── */

test("revision-plan: แผงประวัติต้องบอกเพดาน + มีปุ่มล้างที่ผูกค่าคงที่ + เลื่อนในกรอบ", () => {
  const builder = codeOf("features/admin/ui/block-builder.tsx");

  assert.ok(builder.includes("strings.historyShown"), "ต้องบอกผู้ใช้ว่าแสดงกี่รุ่น/เก็บไม่เกินกี่รุ่น");
  assert.ok(builder.includes("fillTemplate(strings.historyShown, { shown: HISTORY_PANEL_LIMIT, max: MAX_PAGE_REVISIONS })"), "ตัวเลขต้องมาจากนโยบายกลาง");
  assert.ok(builder.includes("clearRevisionHistoryAction"), "ต้องมีฟอร์มล้างประวัติ");
  assert.ok(builder.includes("value={PRUNE_HISTORY_CONFIRM_VALUE}"), "ค่าช่องยืนยันต้องตรงกับที่ action ตรวจ");
  assert.ok(builder.includes("required"), "ช่องยืนยันต้องบังคับ");
  /* แผงห้ามยืดจนดันหน้าจอ */
  assert.ok(builder.includes("max-h-72") && builder.includes("overflow-y-auto"), "รายการประวัติต้องเลื่อนในกรอบจำกัดความสูง");
  /* แจ้งผลครบทุกกรณี */
  for (const notice of ["needs-confirm", "nothing", "pruned"]) {
    assert.ok(builder.includes(`historyNotice === "${notice}"`), `ต้องมีข้อความกรณี ${notice}`);
  }
  /* ปุ่มซ่อนเมื่อเหลือรุ่นเดียว (ไม่มีอะไรให้ล้าง) */
  assert.ok(builder.includes("revisions.length <= 1 ? null"), "เหลือรุ่นเดียว = ไม่ต้องแสดงปุ่มล้าง");
});

test("revision-plan: หน้าจอ server ส่ง notice จาก URL (?history=) ลงแผงประวัติ", () => {
  const screen = codeOf("app/admin/builder/[page]/page.tsx");
  assert.ok(screen.includes("query.history ?? null"), "ต้องอ่านผลจาก searchParams");
  assert.ok(screen.includes("historyNotice={historyNotice}"), "ต้องส่งลง BlockBuilder");
  assert.ok(screen.includes("readonly history?: string"), "ต้องประกาศชนิด searchParams ให้ครบ");
});
