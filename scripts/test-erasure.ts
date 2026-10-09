import assert from "node:assert/strict";
import {   } from "node:fs";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import {
  EMPTY_ERASURE_COUNTS,
  checkErasureRequest,
  erasureIsEmpty,
  erasureTotal,
  isPlausibleEmail,
  maskEmail,
  normalizeEmail,
  summarizeErasure,
} from "@/lib/privacy/erasure";

/**
 * เทสต์ X2b — "ลบข้อมูลทั้งหมดของอีเมลนี้" (PDPA · รอบที่ 77)
 *
 * เรื่องที่พลาดแล้วเจ็บมาก (เรียงตามความร้ายแรง)
 * 1. **ลบผิดคน** — อีเมลพิมพ์เพี้ยนแต่ระบบยอมลบ ⇒ ข้อมูลของคนอื่นหายถาวร
 * 2. **ลบไม่ครบ** — ตัวพิมพ์ใหญ่/ช่องว่างทำให้หาไม่เจอ ⇒ ผู้ขอยังถูกเก็บข้อมูลต่อทั้งที่ขอให้ลบ
 * 3. **ข้อมูลกลับเข้าไปในบันทึก** — หลังลบแล้วดันเขียนอีเมลเต็มลง audit log
 */


function sourceOf(relativePath: string): string {
  /* รอบที่ 243: ค่าเริ่มต้น = โค้ดจริง (ตัดคอมเมนต์) — กันด่าน "มีโค้ด X" ผ่านเพราะคอมเมนต์ */
  return codeOf(relativePath);
}

/* ── 1) ทำให้เป็นรูปแบบเดียวกัน (ตัดสินใจว่าจะเจอหรือไม่เจอ) ──────────────────── */

test("erasure: normalize อีเมลตัดช่องว่าง/ตัวพิมพ์ใหญ่-เล็ก", () => {
  assert.equal(normalizeEmail("  Someone@Example.COM "), "someone@example.com");
  assert.equal(normalizeEmail(""), "");
});

test("erasure: อีเมลที่พอรับได้ และที่ต้องปฏิเสธ", () => {
  for (const ok of ["a@b.co", "someone@example.com", "USER@EXAMPLE.CO.TH", " x@y.io "]) {
    assert.equal(isPlausibleEmail(ok), true, `${ok} ควรผ่าน`);
  }

  for (const bad of [
    "",
    "   ",
    "someone",
    "@example.com",
    "someone@",
    "someone@localhost",
    "someone@@example.com",
    "some one@example.com",
    "someone@.com",
    "someone@com.",
  ]) {
    assert.equal(isPlausibleEmail(bad), false, `"${bad}" ต้องไม่ผ่าน`);
  }
});

/* ── 2) ปิดบางส่วนก่อนเขียนลงบันทึก ─────────────────────────────────────────── */

test("erasure: อีเมลในบันทึกต้องถูกปิดบางส่วน (เก็บโดเมนไว้ตรวจย้อนหลัง)", () => {
  assert.equal(maskEmail("Someone@Example.com"), "s***@example.com");
  assert.equal(maskEmail("a@b.co"), "a***@b.co");
  /* ค่าที่ไม่ใช่อีเมลต้องไม่หลุดออกไปทั้งก้อน */
  assert.equal(maskEmail("ไม่ใช่อีเมล"), "***");
  assert.equal(maskEmail(""), "***");
  assert.equal(maskEmail("@example.com"), "***");
});

test("erasure: ข้อความสรุปไม่มีข้อมูลส่วนบุคคล", () => {
  const detail = summarizeErasure({ contact: 1, newsletter: 2, careers: 3, attachments: 2 });
  assert.equal(detail, "contact=1 newsletter=2 careers=3 attachments=2");
  assert.ok(!detail.includes("@"), "ห้ามมีอีเมลในข้อความสรุป");
});

/* ── 3) ประตู 3 ด่านก่อนลบจริง ─────────────────────────────────────────────── */

test("erasure: ต้องผ่านครบทั้งอีเมลถูกต้อง + ยืนยันตัวตน + พิมพ์ซ้ำตรงกัน", () => {
  const base = { email: "someone@example.com", confirmEmail: "someone@example.com", verified: true };

  assert.deepEqual(checkErasureRequest(base), { ok: true });
  /* พิมพ์ซ้ำต่างแค่ตัวพิมพ์ใหญ่/ช่องว่าง = ยังถือว่าตรง (ไม่ให้ผู้ใช้พลาดด้วยเรื่องไร้สาระ) */
  assert.deepEqual(checkErasureRequest({ ...base, confirmEmail: " SOMEONE@Example.com " }), { ok: true });

  assert.deepEqual(checkErasureRequest({ ...base, email: "ไม่ใช่อีเมล" }), { ok: false, reason: "invalid-email" });
  assert.deepEqual(checkErasureRequest({ ...base, verified: false }), { ok: false, reason: "not-verified" });
  assert.deepEqual(checkErasureRequest({ ...base, confirmEmail: "other@example.com" }), {
    ok: false,
    reason: "mismatch",
  });
  /* ลำดับการตรวจสำคัญ: อีเมลเพี้ยนต้องถูกปฏิเสธก่อนเรื่องอื่น (กันลบผิดคน) */
  assert.deepEqual(checkErasureRequest({ email: "", confirmEmail: "", verified: false }), {
    ok: false,
    reason: "invalid-email",
  });
});

/* ── 4) นับ/สรุปผล ─────────────────────────────────────────────────────────── */

test("erasure: นับรวมและบอกว่า \"ไม่มีอะไรให้ลบ\" ได้ถูกต้อง", () => {
  assert.equal(erasureTotal(EMPTY_ERASURE_COUNTS), 0);
  assert.equal(erasureIsEmpty(EMPTY_ERASURE_COUNTS), true);

  const counts = { contact: 1, newsletter: 0, careers: 2, attachments: 1 };
  assert.equal(erasureTotal(counts), 3, "ไฟล์แนบไม่นับเป็นรายการ (หายตามใบสมัคร)");
  assert.equal(erasureIsEmpty(counts), false);
  /* มีแต่ไฟล์แนบ (ไม่ควรเกิด) — ถือว่ามีข้อมูล ต้องไม่บอกว่า "ไม่พบ" */
  assert.equal(erasureIsEmpty({ contact: 0, newsletter: 0, careers: 0, attachments: 1 }), true);
});

/* ── 5) กฎสถาปัตยกรรม/ความปลอดภัยของเครื่องมือนี้ ─────────────────────────── */

test("erasure: การลบจริงต้องอยู่ใน transaction และเขียน audit เสมอ", () => {
  const repo = sourceOf("lib/privacy/repository.ts");

  assert.ok(repo.includes("withTransaction("), "การลบต้องอยู่ใน transaction เดียว");
  assert.ok(repo.includes('action: "erase-subject"'), "ต้องบันทึก audit ทุกครั้งที่ลบ");
  assert.ok(repo.includes("maskEmail("), "ห้ามเขียนอีเมลเต็มลงบันทึก");
  assert.ok(
    repo.includes("lower(btrim(email))"),
    "ต้องเทียบอีเมลแบบ normalize ทั้งสองฝั่ง (ไม่งั้นตัวพิมพ์ใหญ่ทำให้ลบไม่ครบ)",
  );
});

test("erasure: server action ต้องตรวจสิทธิ์ + ตรวจคำขอก่อนลบ", () => {
  const action = sourceOf("app/admin/inbox/actions.ts");

  assert.ok(/requireAdminUser\("(retention|users|content|media|inbox)"\)/.test(action), "ทุก action หลังบ้านต้องตรวจสิทธิ์ (พร้อมระบุสิทธิ์ — X1.10)");
  assert.ok(action.includes("checkErasureRequest("), "ต้องผ่านการตรวจ 3 ด่านก่อนลบ");
  /* ลำดับ: ตรวจ → ถ้าไม่ผ่านต้อง return ก่อนถึงบรรทัดที่ลบ */
  const checkIndex = action.indexOf("checkErasureRequest(");
  const eraseIndex = action.indexOf("await eraseSubject(");
  assert.ok(checkIndex > 0 && eraseIndex > checkIndex, "การลบต้องอยู่หลังการตรวจเสมอ");
  assert.ok(action.includes("if (!check.ok)"), "คำขอที่ไม่ผ่านต้องไม่ลบอะไรเลย");
});

test("erasure: หน้าจอต้องบอกผู้ใช้ว่าอะไรจะถูกลบ/อะไรถูกเก็บ และต้องมีขั้นตอนยืนยันตัวตน", () => {
  const page = sourceOf("app/admin/inbox/page.tsx");

  assert.ok(page.includes("eraseWillDelete"), "ต้องบอกจำนวนที่จะลบ");
  assert.ok(page.includes("eraseWillKeep"), "ต้องบอกสิ่งที่ยังเก็บไว้ (ตามจริง)");
  assert.ok(page.includes("eraseProcedureTitle"), "ต้องมีขั้นตอนยืนยันตัวตนบนหน้าจอ");
  assert.ok(page.includes('name="confirmEmail"'), "ต้องมีการพิมพ์อีเมลซ้ำ");
  assert.ok(page.includes('name="verified"'), "ต้องมีการติ๊กยืนยันตัวตน");
});
