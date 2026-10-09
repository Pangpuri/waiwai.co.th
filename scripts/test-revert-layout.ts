import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { REVERT_LAYOUT_CONFIRM_VALUE, decideRevertLayout } from "@/lib/blocks/layout-revert";

import { codeOf, rawOf } from "./source-scan.ts";

const ROOT = join(import.meta.dirname, "..");

/**
 * เทสต์รอบที่ 246 — ปุ่ม **"กลับไปใช้ดีไซน์เดิมของเว็บ"** (ทางออกทิศเดียว)
 *
 * ## เคสจริงจากเจ้าของ (2026-10-09)
 * *"กลับดีฟอลยังไงครับ เราบันทึกดีฟอลหน้าแรกกันไว้ไหม"* — หลังจัดหน้าแรกด้วยบล็อก เจ้าของอยากถอยกลับ
 * ไปดีไซน์เดิม แต่ **ไม่มีปุ่มแล้ว** เพราะรอบที่ 240 ถอดสวิตช์ "ใช้กับหน้าเว็บจริง" ออก
 *
 * ## สัญญาที่ต้องล็อก
 * 1. **ทิศเดียว** — ปุ่มนี้ปิดได้อย่างเดียว (เปิดกลับ = กด "เผยแพร่") ⇒ ไม่มีทางเผลอเปิดเว็บทั้งที่ยังไม่พร้อม
 * 2. **fail-closed** — ไม่ติ๊กยืนยัน = ไม่เขียนอะไรเลย (ทั้ง DB และ audit)
 * 3. **ไม่ทำอะไรเมื่อไม่ได้ใช้บล็อกอยู่** (`not-live`) — กดซ้ำต้องเงียบ ไม่มีร่องรอยมั่ว
 * 4. **หน้าจอ/แอกชัน/ป้าย audit ใช้ค่าคงที่ตัวเดียวกัน** — ไม่มีทางหลุดจากกัน
 * 5. **ไม่มีโค้ดสวิตช์เดิมกลับมา** (`live-guard.ts` ถูกลบแล้ว — ถ้าจะคืนสวิตช์ต้องมีมติใหม่)
 */

/* ── 1) ตรรกะล้วน ─────────────────────────────────────────────────────────── */

test("revert-layout: ตัดสินถูกทุกกรณี (fail-closed + ไม่ทำอะไรเมื่อไม่ได้ใช้อยู่)", () => {
  assert.equal(REVERT_LAYOUT_CONFIRM_VALUE, "revert");

  /* ติ๊กยืนยัน + ใช้บล็อกอยู่ ⇒ ทำได้ */
  assert.equal(decideRevertLayout({ isLive: true, confirmValue: "revert" }), "ok");
  /* ยอมรับช่องว่างหัวท้าย (ค่าจากฟอร์มอาจมี space) */
  assert.equal(decideRevertLayout({ isLive: true, confirmValue: " revert " }), "ok");

  /* ไม่ติ๊ก/ติ๊กค่าแปลก ⇒ ไม่ทำอะไร (fail-closed) */
  assert.equal(decideRevertLayout({ isLive: true, confirmValue: "" }), "needs-confirm");
  assert.equal(decideRevertLayout({ isLive: true, confirmValue: "yes" }), "needs-confirm");
  assert.equal(decideRevertLayout({ isLive: true, confirmValue: "REVERT" }), "needs-confirm");

  /* ไม่ได้ใช้บล็อกอยู่ ⇒ "ไม่มีอะไรต้องกลับ" แม้ติ๊กถูก (กดซ้ำต้องเงียบ + ไม่เขียน audit) */
  assert.equal(decideRevertLayout({ isLive: false, confirmValue: "revert" }), "not-live");
  assert.equal(decideRevertLayout({ isLive: false, confirmValue: "" }), "not-live");
});

/* ── 2) Server Action: ทิศเดียว + ด่านครบ ─────────────────────────────────── */

test("revert-layout: action ต้องตรวจสิทธิ์ · ติ๊กยืนยัน · ปิดเท่านั้น · มี audit + refresh", () => {
  const actions = codeOf("app/admin/builder/actions.ts");
  const start = actions.indexOf("export async function revertToCodeLayoutAction");
  assert.ok(start > 0, "ต้องมี action ชื่อ revertToCodeLayoutAction");
  /* ขอบเขต = ถึง action ถัดไป */
  const nextExport = actions.indexOf("export async function", start + 10);
  const body = actions.slice(start, nextExport > 0 ? nextExport : undefined);

  assert.ok(body.includes('requireAdminUser("content")'), "ต้องผ่านประตูสิทธิ์ content");
  assert.ok(body.includes("decideRevertLayout("), "ต้องใช้ตรรกะกลางตัวเดียวกับหน้าจอ");
  assert.ok(body.includes("isPageLive(page)"), "ต้องอ่านสถานะจริงจาก DB (ห้ามเดา)");
  assert.ok(body.includes("setPageLive(page, false, user.email)"), "ต้องปิดการใช้บล็อก (false)");
  assert.equal(body.includes("setPageLive(page, true"), false, "ห้ามมีทางเปิดจากปุ่มนี้ (ทิศเดียว)");
  assert.ok(body.includes('action: "layout-revert"'), "ต้องมีร่องรอย audit");
  assert.ok(body.includes('refreshPublicSite("page")'), "ต้องสั่งให้หน้าเว็บกลับมาใช้เลย์เอาต์โค้ดทันที");
  assert.ok(body.includes("revalidatePath("), "ต้องล้างแคชหน้าหลังบ้านด้วย");
  /* ⚠️ ไม่แตะเนื้อหา: ห้ามมีคำสั่งลบ/เขียนเอกสาร */
  assert.equal(/deleteDocument|saveDraft\(|publishDraft\(/.test(body), false, "ห้ามแตะฉบับร่าง/ฉบับเผยแพร่ — แค่หยุดใช้");
});

/* ── 3) หน้าจอ: แสดงเฉพาะเมื่อใช้บล็อกอยู่ + ต้องติ๊กยืนยัน ────────────────── */

test("revert-layout: หน้าจอแสดงเฉพาะเมื่อหน้านี้ใช้บล็อกอยู่ + มีช่องยืนยันที่ค่าตรงกับ action", () => {
  const screen = codeOf("app/admin/builder/[page]/page.tsx");

  assert.ok(screen.includes("hasBlockTemplate(page) && isLive"), "แสดงเฉพาะหน้าที่มีเทมเพลตและใช้บล็อกอยู่จริง");
  assert.ok(screen.includes("revertToCodeLayoutAction"), "ฟอร์มต้องชี้ไปที่ action นี้");
  assert.ok(screen.includes('name="confirm"'), "ต้องมีช่องยืนยัน");
  assert.ok(
    screen.includes(`value="${REVERT_LAYOUT_CONFIRM_VALUE}"`),
    `ค่าช่องยืนยันต้องตรงกับค่าคงที่ (${REVERT_LAYOUT_CONFIRM_VALUE})`,
  );
  assert.ok(screen.includes("required"), "ช่องยืนยันต้องบังคับ (เบราว์เซอร์ช่วยชั้นแรก · ด่านจริงอยู่ที่ action)");

  /* แจ้งผลครบทุกกรณีที่ action ส่งกลับมา (`?layout=…`) */
  for (const reason of ["needs-confirm", "not-live", "done"]) {
    assert.ok(screen.includes(`layoutNotice === "${reason}"`), `ต้องมีข้อความสำหรับกรณี ${reason}`);
  }
  /* ⚠️ หน้าจอต้องไม่มีทาง "เปิด" จากปุ่มนี้ */
  assert.equal(screen.includes("setPageLive(page, true"), false, "หน้าจอห้ามมีทางเปิดใช้บล็อก");
});

/* ── 4) ค่าคงที่/ป้าย ต้องมีจริงทั้งสองภาษา ───────────────────────────────── */

test("revert-layout: ค่าคงที่ใช้ร่วมกันจริง + ป้าย audit มีทั้งไทย/อังกฤษ", () => {
  const action = codeOf("app/admin/builder/actions.ts");
  const logic = codeOf("lib/blocks/layout-revert.ts");
  assert.ok(logic.includes('REVERT_LAYOUT_CONFIRM_VALUE = "revert"'), "ค่าคงที่ต้องอยู่ที่ตรรกะกลาง");
  assert.ok(action.includes("decideRevertLayout"), "action ต้องเรียกตรรกะกลาง (ไม่เขียนเงื่อนไขเอง)");

  /* ชนิดเหตุการณ์ audit ต้องมี */
  assert.ok(codeOf("lib/audit/log.ts").includes('"layout-revert"'), "ต้องประกาศเหตุการณ์ layout-revert");

  /* ป้ายในแผนที่ + ข้อความทั้งสองภาษา */
  const labels = codeOf("features/admin/audit-labels.ts");
  assert.ok(labels.includes('"layout-revert": strings.auditLayoutRevert'), "ต้องมีป้ายในแผนที่");

  for (const locale of ["th", "en"]) {
    const area = codeOf(`lib/i18n/messages/areas/${locale}/adminLive.ts`);
    for (const key of [
      "layoutRevertTitle",
      "layoutRevertHint",
      "layoutRevertConfirm",
      "layoutRevertButton",
      "layoutRevertNeedsConfirm",
      "layoutRevertNotLive",
      "layoutRevertDone",
      "auditLayoutRevert",
    ]) {
      assert.ok(area.includes(`${key}:`), `${locale}: ขาดคีย์ ${key}`);
    }
  }
});

/* ── 5) ไม่มีโค้ดสวิตช์เดิมกลับมา ─────────────────────────────────────────── */

test("revert-layout: โค้ดสวิตช์ 'ใช้กับหน้าเว็บจริง' ต้องไม่กลับมา (ทิศเดียวเท่านั้น)", () => {
  assert.equal(existsSync(join(ROOT, "lib/blocks/live-guard.ts")), false, "live-guard.ts = เศษของสวิตช์ที่ถอดแล้ว — ต้องไม่มี");

  const actions = codeOf("app/admin/builder/actions.ts");
  assert.equal(actions.includes("setPageLiveAction"), false, "ห้ามมี action สวิตช์สองทางกลับมา");
  assert.equal(actions.includes("live-guard"), false, "ห้ามอ้างตัวช่วยของสวิตช์เดิม");

  /* ทางเดียวที่ "เปิด" ต้องเป็นเส้นทางเผยแพร่เท่านั้น */
  const publish = codeOf("lib/blocks/live-scope.ts");
  assert.ok(publish.includes("PUBLISH_GOES_LIVE_PAGES"), "การเปิดใช้ยังต้องมาจากนโยบายกลาง");
  assert.ok(rawOf("lib/blocks/live-scope.ts").includes("home"), "หน้าแรกคือหน้าที่เปิดอัตโนมัติเมื่อกดเผยแพร่");
});
