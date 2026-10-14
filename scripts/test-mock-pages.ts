import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

/** อ่านซอร์สของไฟล์ในโปรเจกต์ (ใช้ตรวจว่า "ไม่มีป้ายตัวอย่าง" แล้ว) */
function io_read(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}


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
      ] as const) {
        assert.ok(value.trim().length > 0, `${locale}: ${page}.${name} ว่าง`);
      }
    }
  }
});

test("mock pages: ต้องไม่มีป้าย \"ตัวอย่าง/รอการอนุมัติ\" แล้ว — เนื้อหาจริงขึ้นเว็บหมด (มติเจ้าของรอบ 272)", () => {
  /*
    เดิม (รอบที่ 15) หน้ากลุ่มนี้เป็น mockup ⇒ ผู้ใช้สั่งให้ติดป้าย "ตัวอย่าง รอการอนุมัติ"
    ตอนนี้มีเนื้อหาจริงครบแล้ว (เมนู 18 · ข่าว 151 · สินค้า 54 · หมวด 6) ⇒ เจ้าของสั่งถอดป้ายออก
    (เคสเดียวกับหน้า /contact รอบที่ 267)
  */
  for (const [locale, page] of [
    ["th", th.recipesPage],
    ["en", en.recipesPage],
    ["th", th.newsPage],
    ["en", en.newsPage],
  ] as const) {
    assert.ok(!("notice" in page), `${locale}: ต้องไม่มีคีย์ notice อีก`);
  }

  const dictionary = JSON.stringify(th) + JSON.stringify(en);
  for (const stale of ["ยังเป็นตัวอย่างรอการอนุมัติ", "หน้าตัวอย่าง (mockup)", "sample for the marketing team"]) {
    assert.ok(!dictionary.includes(stale), `พจนานุกรมต้องไม่มีข้อความล้าสมัย: ${stale}`);
  }

  /* หน้าที่เคยติดป้าย: ต้องไม่เรนเดอร์ SampleNotice อีก (หน้า /privacy ยังใช้ป้าย "ร่าง" ได้) */
  for (const file of [
    "app/[lang]/products/page.tsx",
    "app/[lang]/recipes/page.tsx",
    "features/news/ui/news-list-page.tsx",
  ]) {
    const source = io_read(file);
    assert.ok(!source.includes("SampleNotice"), `${file}: ต้องไม่เรนเดอร์ป้ายตัวอย่างอีก`);
  }

  /* การ์ดทดสอบยังอยู่ (ใช้เมื่อฐานข้อมูลว่าง) — แต่ไม่มีป้ายบอกว่า "หน้านี้เป็นตัวอย่าง" */
  const mockPages = ["app/[lang]/products/page.tsx", "app/[lang]/recipes/page.tsx"];
  for (const file of mockPages) {
    assert.ok(
      !io_read(file).includes("searchParams"),
      `${file}: ต้องไม่ใช้ searchParams (หน้า static)`,
    );
  }
});

test("การ์ดทดสอบ: หน้าจริงต้องไม่มีการ์ดทดสอบ/MockCardGrid อีก (มติเจ้าของรอบ 273)", () => {
  for (const file of [
    "app/[lang]/recipes/page.tsx",
    "features/news/ui/news-list-page.tsx",
    "app/[lang]/products/page.tsx",
  ]) {
    assert.ok(!io_read(file).includes("MockCardGrid"), `${file}: ต้องไม่ใช้การ์ดทดสอบ`);
  }
  /*
    ⚠️ รอบที่ 273: ตรวจเฉพาะ "ข้อความของหน้าจริง" (recipesPage/newsPage/productsPage)
    ส่วน `home.recipes.items` / `home.news.items` (ข้อมูล seed ของ EAV หน้าแรก) ยังเป็นข้อความทดสอบ
    แต่ **ไม่แสดงบนเว็บ** เพราะหน้าแรกอ่านเมนู/ข่าวจริงจากฐานข้อมูล — เป็นหนี้ D-273-1 (ดู ROADMAP § 9)
  */
  for (const [locale, page] of [
    ["th", th.recipesPage],
    ["en", en.recipesPage],
    ["th", th.newsPage],
    ["en", en.newsPage],
  ] as const) {
    for (const stale of ["ทดสอบ", "ภาพตัวอย่าง", "รอการอนุมัติ", "sample", "pending approval"]) {
      assert.ok(
        !JSON.stringify(page).toLowerCase().includes(stale.toLowerCase()),
        `${locale}: ข้อความของหน้าจริงต้องไม่มีคำว่า ${stale}`,
      );
    }
  }
});
