import assert from "node:assert/strict";
import { test } from "node:test";

import { HOME_PAGE_SPEC, HOME_SECTIONS } from "@/lib/content/model";
import { HOME_SEED } from "@/lib/content/home-seed";
import type { ItemContent } from "@/lib/content/types";

/**
 * เทสต์ของ "โครงฟิลด์" (model) — กันความผิดพลาดที่ทำให้หลังบ้าน/ด่านเพี้ยนเงียบ ๆ
 * เช่นคีย์ซ้ำ (เขียนทับกันใน DB เพราะ primary key คือ page+section+item_key+field)
 * หรือตั้ง maxItems/maxLength ที่ใช้งานไม่ได้
 */

/** ลำดับ section บนหน้าแรกจริง — ต้องตรงกับ app/[lang]/page.tsx */
const PAGE_ORDER: readonly string[] = [
  "hero",
  "products",
  "brand",
  "sustainability",
  "recipes",
  "news",
  "whereToBuy",
  "newsletter",
  "seo",
];

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

test("model: หน้าแรกมี 9 section เรียงตามลำดับที่แสดงจริง", () => {
  assert.equal(HOME_PAGE_SPEC.page, "home");
  assert.deepEqual(
    HOME_SECTIONS.map((section) => section.key),
    PAGE_ORDER,
    "ลำดับ/ชื่อ section ต้องตรงกับหน้าจริง (ถ้าเพิ่ม section ใหม่ ต้องแก้เทสต์นี้ด้วยเจตนา)",
  );
});

test("model: คีย์ section ไม่ซ้ำ และมี label ครบ", () => {
  const keys = HOME_SECTIONS.map((section) => section.key);
  assert.equal(new Set(keys).size, keys.length, "คีย์ section ต้องไม่ซ้ำ");
  for (const section of HOME_SECTIONS) {
    assert.ok(section.label.length > 0, `section ${section.key} ต้องมี label`);
  }
});

test("model: ฟิลด์ในแต่ละ section ไม่ซ้ำกันเอง และค่าตั้งต้นใช้ได้", () => {
  for (const section of HOME_SECTIONS) {
    const keys = section.fields.map((field) => field.key);
    assert.equal(new Set(keys).size, keys.length, `ฟิลด์ใน ${section.key} ต้องไม่ซ้ำ`);

    for (const field of section.fields) {
      assert.equal(field.level, "section", `${section.key}.${field.key} ต้องเป็นฟิลด์ระดับ section`);
      assert.ok(KEY_PATTERN.test(field.key), `${section.key}.${field.key} ต้องเป็น camelCase (ใช้เป็นคีย์ DB)`);
      assert.ok(field.label.length > 0, `${section.key}.${field.key} ต้องมี label`);
      assert.ok(field.maxLength > 0, `${section.key}.${field.key} ต้องมีความยาวสูงสุด > 0`);
      assert.equal(field.altRequired, false, "ฟิลด์ระดับ section ยังไม่มีภาพ — ไม่ควรบังคับ alt");
    }
  }
});

test("model: กลุ่มรายการ (การ์ด/สไลด์) ไม่ซ้ำ และกำหนดจำนวนสูงสุดไว้", () => {
  for (const section of HOME_SECTIONS) {
    const keys = section.items.map((group) => group.key);
    assert.equal(new Set(keys).size, keys.length, `กลุ่มรายการใน ${section.key} ต้องไม่ซ้ำ`);

    for (const group of section.items) {
      assert.ok(group.maxItems >= 1, `${section.key}.${group.key} ต้องมี maxItems >= 1`);
      for (const field of group.fields) {
        assert.equal(field.level, "item", `${section.key}.${group.key}.${field.key} ต้องเป็นฟิลด์ระดับรายการ`);
      }
    }
  }
});

test("model: ฟิลด์ภาพต้องเป็น kind=media + บังคับ alt · ฟิลด์ข้อความต้องไม่บังคับ alt", () => {
  for (const section of HOME_SECTIONS) {
    const allFields = [...section.fields, ...section.items.flatMap((group) => group.fields)];
    for (const field of allFields) {
      if (field.kind === "media") {
        assert.equal(field.altRequired, true, `${field.key}: ภาพต้องบังคับ alt (มติ D7)`);
        assert.equal(field.localized, false, `${field.key}: ค่าภาพไม่ใช่ข้อความแปล (alt แยกเป็น altTh/altEn)`);
      } else {
        assert.equal(field.altRequired, false, `${field.key}: ฟิลด์ที่ไม่ใช่ภาพไม่ต้องบังคับ alt`);
      }
    }
  }
});

test("model: seed มี section ครบและไม่มี section เกิน", () => {
  assert.deepEqual(
    Object.keys(HOME_SEED.sections).sort(),
    HOME_SECTIONS.map((section) => section.key).sort(),
    "คีย์ section ใน seed ต้องตรงกับโมเดลเป๊ะ",
  );
});

test("model: กลุ่มรายการใน seed ตรงกับโมเดล และลำดับในแต่ละกลุ่มเริ่มที่ 1 เรียงต่อเนื่อง", () => {
  for (const section of HOME_SECTIONS) {
    const content = HOME_SEED.sections[section.key];
    assert.ok(content, `seed ต้องมี section ${section.key}`);
    if (!content) continue;

    assert.deepEqual(
      Object.keys(content.items).sort(),
      section.items.map((group) => group.key).sort(),
      `กลุ่มรายการของ ${section.key} ต้องตรงกับโมเดล`,
    );

    for (const group of section.items) {
      const rows: readonly ItemContent[] = content.items[group.key] ?? [];
      assert.deepEqual(
        rows.map((row: ItemContent) => row.order),
        rows.map((_row: ItemContent, index: number) => index + 1),
        `${section.key}.${group.key}: ลำดับต้องเริ่มที่ 1 และต่อเนื่อง`,
      );
      assert.ok(
        rows.length <= group.maxItems,
        `${section.key}.${group.key}: มี ${rows.length} แถว เกิน maxItems (${group.maxItems})`,
      );
    }
  }
});

