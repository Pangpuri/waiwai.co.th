import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  MAX_FOOTER_LABEL_LENGTH,
  MAX_FOOTER_TEXT_LENGTH,
  defaultFooterConfig,
  parseFooterConfig,
} from "@/lib/chrome/footer";
import { th } from "@/lib/i18n/messages/th";

/**
 * เทสต์เพดานความยาวของท้ายเว็บ (รอบที่ 312)
 *
 * 🐞 เคสจริงจากเจ้าของ: *"42/1 ถนนเพชรเกษม ตำบลอ้อมใหญ่ อำเภอสามพราน จ.นครปฐม
 *    แต่เมื่อกดเผยแพร่ จะเด้งกลับมาเหลือแค่ 42/1 ถนนเพชรเกษม ตำบลอ้อมใหญ่ อำเภอสามพร"*
 *
 * ต้นเหตุ: `toText()` เดิมใช้เพดาน **40 ตัวอักษร** (เพดานของ label ป้ายสั้น) กับ **ทุกช่อง**
 * รวมถึงที่อยู่/คำอธิบายท้ายเว็บ/ลิขสิทธิ์ ⇒ ข้อความยาวถูกตัดเงียบ ๆ ตอน parse แล้วบันทึกทับ
 *
 * เทสต์ชุดนี้ล็อก 3 อย่าง:
 *  1. ที่อยู่จริงต้องผ่านโดยไม่ถูกตัด
 *  2. เกินเพดานต้อง **รายงานปัญหา** (ไม่บันทึก) ไม่ใช่ตัดเงียบ ๆ
 *  3. หน้าจอมี `maxLength` ตรงกับเพดานจริง (ผู้ใช้เห็นขีดจำกัดก่อนโดนปฏิเสธ)
 */

const ROOT = process.cwd();
const sourceOf = (relative: string): string => readFileSync(path.join(ROOT, relative), "utf8");

/** ที่อยู่จริงของสำนักงานใหญ่ (ข้อความจากเจ้าของ) */
const FULL_ADDRESS = "42/1 ถนนเพชรเกษม ตำบลอ้อมใหญ่ อำเภอสามพราน จ.นครปฐม";

test("เพดาน: ข้อความยาวต้องมากกว่า label อย่างชัดเจน (ต้นเหตุของบั๊ก)", () => {
  assert.equal(MAX_FOOTER_LABEL_LENGTH, 40);
  assert.ok(MAX_FOOTER_TEXT_LENGTH >= 400, "ข้อความยาวต้องมีที่พอสำหรับที่อยู่/คำอธิบาย");
  assert.ok(
    FULL_ADDRESS.length > MAX_FOOTER_LABEL_LENGTH,
    `ที่อยู่จริงยาว ${FULL_ADDRESS.length} ตัวอักษร ⇒ เกินเพดาน label เดิม (${MAX_FOOTER_LABEL_LENGTH}) จึงเคยถูกตัด`,
  );
  assert.ok(FULL_ADDRESS.length <= MAX_FOOTER_TEXT_LENGTH);
});

test("★ เคสจริงรอบ 312: ที่อยู่เต็มผ่าน parse โดยไม่ถูกตัดแม้แต่ตัวอักษรเดียว", () => {
  const base = defaultFooterConfig(th);
  const outcome = parseFooterConfig(
    {
      ...base,
      contact: { ...base.contact, address: { th: FULL_ADDRESS, en: "42/1 Phetkasem Road, Om Yai, Sam Phran, Nakhon Pathom" } },
    },
    th,
  );

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.contact.address.th, FULL_ADDRESS);
  assert.equal(outcome.config.contact.address.en, "42/1 Phetkasem Road, Om Yai, Sam Phran, Nakhon Pathom");
});

test("คำอธิบายท้ายเว็บ/ลิขสิทธิ์ ยาวได้ถึงเพดานข้อความยาว (ไม่ถูกตัดที่ 40)", () => {
  const base = defaultFooterConfig(th);
  const longAbout = "ไวไว".repeat(60); // 240 ตัวอักษร
  const outcome = parseFooterConfig(
    { ...base, about: { th: longAbout, en: "" }, rights: { th: "ลิขสิทธิ์".repeat(40), en: "" } },
    th,
  );

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.equal(outcome.config.about.th.length, longAbout.length);
  assert.equal(outcome.config.rights.th.length, "ลิขสิทธิ์".repeat(40).length);
});

test("เกินเพดาน = รายงานปัญหาและไม่บันทึก (ห้ามตัดเงียบ ๆ)", () => {
  const base = defaultFooterConfig(th);

  const tooLongText = parseFooterConfig({ ...base, about: { th: "ก".repeat(MAX_FOOTER_TEXT_LENGTH + 1), en: "" } }, th);
  assert.equal(tooLongText.ok, false, "ข้อความยาวเกินเพดานต้องไม่ผ่าน");
  assert.ok(!tooLongText.ok);
  assert.ok(
    tooLongText.problems.some((problem) => problem.includes("about.th")),
    `ต้องบอกช่องที่ยาวเกิน (ได้: ${tooLongText.problems.join(" | ")})`,
  );

  const tooLongLabel = parseFooterConfig(
    {
      ...base,
      groups: [{ ...base.groups[0], title: { th: "ก".repeat(MAX_FOOTER_LABEL_LENGTH + 1), en: "" } }],
    },
    th,
  );
  assert.equal(tooLongLabel.ok, false, "ชื่อคอลัมน์เกินเพดานต้องไม่ผ่าน");
  assert.ok(!tooLongLabel.ok);
  assert.ok(
    tooLongLabel.problems.some((problem) => problem.includes("groups[0].title.th")),
    `ต้องบอกช่องที่ยาวเกิน (ได้: ${tooLongLabel.problems.join(" | ")})`,
  );
});

test("พอดีเพดาน = ผ่าน (ไม่มีการตัดทิ้งแม้แต่กรณีขอบ)", () => {
  const base = defaultFooterConfig(th);
  const exact = parseFooterConfig(
    {
      ...base,
      about: { th: "ก".repeat(MAX_FOOTER_TEXT_LENGTH), en: "" },
      groups: [{ ...base.groups[0], title: { th: "ข".repeat(MAX_FOOTER_LABEL_LENGTH), en: "" } }],
    },
    th,
  );

  assert.equal(exact.ok, true);
  assert.ok(exact.ok);
  assert.equal(exact.config.about.th.length, MAX_FOOTER_TEXT_LENGTH);
  assert.equal(exact.config.groups[0]?.title.th.length, MAX_FOOTER_LABEL_LENGTH);
});

test("หน้าจอหลังบ้าน: ช่องข้อความยาว/ป้ายสั้น มี maxLength ตรงกับเพดานจริง", () => {
  const editor = sourceOf("features/admin/ui/footer-editor.tsx");

  assert.ok(editor.includes("MAX_FOOTER_TEXT_LENGTH"), "ต้องใช้เพดานข้อความยาวจากแหล่งความจริง");
  assert.ok(editor.includes("MAX_FOOTER_LABEL_LENGTH"), "ต้องใช้เพดาน label จากแหล่งความจริง");

  /* ที่อยู่ทั้งสองภาษา (ช่องที่เจ้าของเจอปัญหา) ต้องมี maxLength */
  const addressBlock = editor.slice(editor.indexOf("value={config.contact.address.th}"), editor.indexOf("value={config.contact.address.en}"));
  assert.ok(addressBlock.includes("maxLength={MAX_FOOTER_TEXT_LENGTH}"), "ช่องที่อยู่ (ไทย) ต้องมี maxLength");

  const addressEnBlock = editor.slice(editor.indexOf("value={config.contact.address.en}"));
  assert.ok(
    addressEnBlock.slice(0, 800).includes("maxLength={MAX_FOOTER_TEXT_LENGTH}"),
    "ช่องที่อยู่ (อังกฤษ) ต้องมี maxLength",
  );
});
