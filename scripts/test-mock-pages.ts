import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MOCK_CARDS_PER_ROW,
  MOCK_CARD_COUNT,
  MOCK_CARD_ROWS,
} from "@/features/shell/mock-cards";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

test("กริดการ์ดตัวอย่าง: ต้องเป็น 3 การ์ด × 2 แถว ตามที่ผู้ใช้ระบุ", () => {
  assert.equal(MOCK_CARDS_PER_ROW, 3);
  assert.equal(MOCK_CARD_ROWS, 2);
  assert.equal(MOCK_CARD_COUNT, 6);
  assert.equal(MOCK_CARD_COUNT, MOCK_CARDS_PER_ROW * MOCK_CARD_ROWS);
});

test("พจนานุกรม recipesPage / newsPage: ข้อความที่แสดงต้องครบทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    for (const [page, m] of [
      ["recipesPage", messages.recipesPage],
      ["newsPage", messages.newsPage],
    ] as const) {
      for (const [name, value] of [
        ["meta.title", m.meta.title],
        ["meta.description", m.meta.description],
        ["eyebrow", m.eyebrow],
        ["title", m.title],
        ["intro", m.intro],
        ["notice", m.notice],
        ["cardTitle", m.cardTitle],
        ["cardMeta", m.cardMeta],
        ["figureCaption", m.figureCaption],
        ["figureBadge", m.figureBadge],
      ] as const) {
        assert.ok(value.trim().length > 0, `${locale}: ${page}.${name} ว่าง`);
      }
    }
  }
});

test("notice: ต้องบอกชัดว่าเป็นหน้าตัวอย่าง รอการอนุมัติ (ผู้ใช้สั่งให้แจ้งบนหน้า)", () => {
  assert.ok(th.recipesPage.notice.includes("ตัวอย่าง"), "th recipesPage.notice ต้องมีคำว่า ตัวอย่าง");
  assert.ok(th.recipesPage.notice.includes("รอการอนุมัติ"), "th recipesPage.notice ต้องบอกว่ารอการอนุมัติ");
  assert.ok(th.newsPage.notice.includes("ตัวอย่าง"), "th newsPage.notice ต้องมีคำว่า ตัวอย่าง");
  assert.ok(th.newsPage.notice.includes("รอการอนุมัติ"), "th newsPage.notice ต้องบอกว่ารอการอนุมัติ");

  assert.ok(en.recipesPage.notice.toLowerCase().includes("sample"), "en recipesPage.notice ต้องมี sample");
  assert.ok(
    en.recipesPage.notice.toLowerCase().includes("pending approval"),
    "en recipesPage.notice ต้องบอกว่า pending approval",
  );
  assert.ok(en.newsPage.notice.toLowerCase().includes("sample"), "en newsPage.notice ต้องมี sample");
  assert.ok(
    en.newsPage.notice.toLowerCase().includes("pending approval"),
    "en newsPage.notice ต้องบอกว่า pending approval",
  );
});

test("การ์ดตัวอย่าง: ชื่อการ์ดเป็น 'ป้าย + ลำดับ' ที่แยกใบได้ ไม่ใช่ข้อมูลที่แต่งขึ้น", () => {
  // คอมโพเนนต์ MockCardGrid ต่อท้ายด้วย " 1" … " 6" — จึงต้องมี " " ปิดท้ายได้ถูกต้อง
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    for (const [page, m] of [
      ["recipesPage", messages.recipesPage],
      ["newsPage", messages.newsPage],
    ] as const) {
      assert.ok(!m.cardTitle.endsWith(" "), `${locale}: ${page}.cardTitle ไม่ควรมีช่องว่างท้าย`);
      assert.ok(!m.figureCaption.endsWith(" "), `${locale}: ${page}.figureCaption ไม่ควรมีช่องว่างท้าย`);
    }
  }

  // ป้ายมุมภาพต้องบอกว่าเป็นภาพตัวอย่าง ไม่ใช่คำกลาง ๆ ที่ทำให้เข้าใจว่าเป็นภาพจริง
  assert.equal(th.recipesPage.figureBadge, "ภาพตัวอย่าง");
  assert.equal(th.newsPage.figureBadge, "ภาพตัวอย่าง");
});
