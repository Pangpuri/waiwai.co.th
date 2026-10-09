import assert from "node:assert/strict";
import { test } from "node:test";

import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { assemblePageContent, planOrphanKeys, rowKeyOf, type ContentRow } from "@/lib/content/rows";
import { CONTENT_FIELD_COLUMNS, SEED_ACTOR, buildUpsertStatements } from "@/lib/content/sql";

/** เทสต์ของชั้นประกอบ/เทียบแถว (ตรรกะล้วน — รันได้โดยไม่ต้องมี DB) */

function row(partial: Partial<ContentRow> & Pick<ContentRow, "section" | "field">): ContentRow {
  return {
    itemKey: "",
    itemOrder: null,
    kind: "text",
    th: null,
    en: null,
    mediaPath: null,
    mediaAltTh: null,
    mediaAltEn: null,
    mediaHasWatermark: null,
    ...partial,
  };
}

/** คีย์ทั้งหมดที่ "ชั้น SQL" จะเขียนจริง — รูปแบบเดียวกับที่ DB ประกอบ */
function keysFromSql(): readonly string[] {
  const size = CONTENT_FIELD_COLUMNS.length;
  const keys: string[] = [];
  for (const statement of buildUpsertStatements(HOME_PAGE_SPEC, HOME_SEED, SEED_ACTOR)) {
    for (let offset = 0; offset < statement.values.length; offset += size) {
      const rowValues = statement.values.slice(offset, offset + size);
      keys.push(rowKeyOf(String(rowValues[1]), String(rowValues[2]), String(rowValues[4])));
    }
  }
  return keys;
}

test("rows: คีย์มี 3 ส่วนเสมอ (ระดับ section ใช้ item_key ว่าง) — ตรงกับที่ DB ประกอบ", () => {
  assert.equal(rowKeyOf("hero", "", "title"), "hero||title");
  assert.equal(rowKeyOf("hero", "slides-1", "image"), "hero|slides-1|image");

  for (const key of keysFromSql()) {
    assert.equal(key.split("|").length, 3, `คีย์ต้องมี 3 ส่วน: ${key}`);
  }
});

test("rows: planOrphanKeys ต้องไม่ลบอะไรเลยเมื่อคีย์มาจากชั้น SQL (เคสจริง: ลบ 36 แถวทิ้ง)", () => {
  /*
    เคสจริง 2026-10-02: คีย์ระดับ section เดิมถูกสร้างเป็น `section|field` (2 ส่วน)
    แต่ DB ใช้ `section||field` → ทุกแถวระดับ section ถูกมองเป็นแถวกำพร้า แล้วถูกลบทิ้ง (140 → 104 แถว)
    เทสต์นี้ผูก "คีย์ที่ชั้น SQL เขียน" กับ "คีย์ที่ตัวลบเข้าใจ" ให้เป็นชุดเดียวกัน
  */
  const orphans = planOrphanKeys(HOME_PAGE_SPEC, HOME_SEED, keysFromSql());
  assert.deepEqual(orphans, [], `ต้องไม่มีแถวกำพร้า แต่พบ ${orphans.length} แถว`);
});

test("rows: ลบรายการออกจากเนื้อหา → คีย์ของรายการนั้นถูกระบุเป็นแถวกำพร้า", () => {
  const keys = keysFromSql();
  const recipes = HOME_SEED.sections.recipes;
  assert.ok(recipes, "ต้องมี section recipes");
  const recipesGroup = HOME_PAGE_SPEC.sections.find((section) => section.key === "recipes")?.items.find((group) => group.key === "recipes");
  assert.ok(recipesGroup, "ต้องมี spec ของกลุ่ม recipes");

  const list = recipes.items.recipes ?? [];
  assert.ok(list.length > 0, "ต้องมีรายการตั้งต้นอย่างน้อย 1 รายการ");

  const reduced = {
    page: HOME_SEED.page,
    sections: {
      ...HOME_SEED.sections,
      recipes: { ...recipes, items: { ...recipes.items, recipes: list.slice(0, -1) } },
    },
  };

  const orphans = planOrphanKeys(HOME_PAGE_SPEC, reduced, keys);
  assert.equal(orphans.length, recipesGroup.fields.length, "ต้องระบุคีย์ของรายการที่ถูกลบ ครบทุกฟิลด์");
  for (const key of orphans) {
    assert.ok(key.startsWith("recipes|recipes-"), `คีย์ที่ควรลบต้องเป็นของรายการสุดท้าย: ${key}`);
  }
});

test("rows: ประกอบแถวกลับเป็นโครงได้ — ลำดับรายการเรียงตาม item_order", () => {
  const result = assemblePageContent(HOME_PAGE_SPEC, [
    row({ section: "hero", field: "title", th: "หัวข้อ", en: "Title" }),
    row({ section: "products", itemKey: "categories-1", itemOrder: 1, field: "name", th: "ซ้าย", en: "" }),
    row({ section: "products", itemKey: "categories-2", itemOrder: 2, field: "name", th: "กลาง", en: "" }),
    // ส่งสลับลำดับมาโดยตั้งใจ — ผลลัพธ์ต้องเรียงตาม item_order
    row({ section: "products", itemKey: "categories-3", itemOrder: 3, field: "name", th: "ขวา", en: "" }),
  ]);

  assert.equal(result.unknownKeys.length, 0);
  assert.equal(result.content.sections.hero?.fields.title?.th, "หัวข้อ");
  assert.equal(result.content.sections.hero?.fields.title?.en, "Title");

  const slides = result.content.sections.products?.items.categories ?? [];
  assert.equal(slides.length, 3);
  assert.deepEqual(
    slides.map((item) => item.fields.name?.th),
    ["ซ้าย", "กลาง", "ขวา"],
  );
  assert.deepEqual(
    slides.map((item) => item.order),
    [1, 2, 3],
  );
});

test("rows: ฟิลด์ภาพที่ไม่มีไฟล์ต้องไม่กลายเป็นค่า (มีการ์ดไม่มีภาพก็ได้)", () => {
  const result = assemblePageContent(HOME_PAGE_SPEC, [
    row({ section: "recipes", itemKey: "recipes-1", itemOrder: 1, field: "image", kind: "media" }),
    row({ section: "recipes", itemKey: "recipes-1", itemOrder: 1, field: "name", th: "ผัดไทย", en: "Pad Thai" }),
  ]);

  const item = result.content.sections.recipes?.items.recipes?.[0];
  assert.ok(item);
  assert.equal(item.media.image, undefined, "ไม่มีพาธ = ไม่มีค่า MediaValue");
  assert.equal(item.fields.name?.th, "ผัดไทย");
});

test("rows: แถวที่โครงไม่รู้จักต้องถูกข้ามและรายงาน ไม่ทำให้ล่ม", () => {
  const result = assemblePageContent(HOME_PAGE_SPEC, [
    row({ section: "hero", field: "title", th: "ปกติ", en: "" }),
    row({ section: "section-ที่ถูกลบไปแล้ว", field: "title", th: "เก่า", en: "" }),
    row({ section: "hero", field: "field-ที่ไม่มีในโครง", th: "เก่า", en: "" }),
    row({ section: "products", itemKey: "group-ที่ไม่มี-1", itemOrder: 1, field: "name", th: "เก่า", en: "" }),
    row({ section: "products", itemKey: "categories-99", itemOrder: 99, field: "field-ไม่มี", th: "เก่า", en: "" }),
  ]);

  assert.equal(result.content.sections.hero?.fields.title?.th, "ปกติ");
  assert.equal(result.unknownKeys.length, 4);
  assert.ok(result.unknownKeys.some((key) => key.includes("section-ที่ถูกลบไปแล้ว")));
});
